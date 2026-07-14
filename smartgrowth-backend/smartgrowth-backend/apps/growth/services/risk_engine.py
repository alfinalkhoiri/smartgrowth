"""
Stage 1 risk classification: rule-based, using WHO Height-for-Age Z-score (HAZ).
This is the clinically-grounded baseline that ships first; the ML/predictive
layer (Stage 2) sits ON TOP of this later, not instead of it. Keep both layers
producing a risk_status + reason_codes so the frontend RiskBadge never needs
to know which layer produced the result.

`calculate_haz()` and `calculate_whz()` use the official WHO Child Growth
Standards LMS reference tables (see who_reference.py) via the standard LMS
formula:
    Z = (((measurement / M) ** L) - 1) / (L * S)   if L != 0
    Z = ln(measurement / M) / S                     if L == 0
"""
import math
from dataclasses import dataclass

from .who_reference import lms_for_age, lms_for_weight


RISK = 'risk'
WATCH = 'watch'
NORMAL = 'normal'


@dataclass
class RiskResult:
    risk_status: str
    reason_codes: list


_SEVERITY = {NORMAL: 0, WATCH: 1, RISK: 2}


def _more_severe(a: str, b: str) -> str:
    return a if _SEVERITY[a] >= _SEVERITY[b] else b


def classify_from_haz(haz: float) -> str:
    if haz < -3:
        return RISK        # Severely stunted
    if haz < -2:
        return WATCH        # Stunted — needs monitoring
    return NORMAL


def classify_from_whz(whz: float) -> str:
    if whz < -3:
        return RISK        # Gizi buruk — severe acute malnutrition (wasting)
    if whz < -2:
        return WATCH        # Gizi kurang — moderate wasting, needs monitoring
    return NORMAL


def classify_growth_record(haz: float, whz: float = None) -> str:
    """
    Combines HAZ (stunting, chronic) and WHZ (wasting, acute) into the single
    risk_status stored on a GrowthRecord — the more severe of the two, since
    either alone signals malnutrition that needs attention, and a child can
    be wasted without (yet) being stunted or vice versa.
    """
    status = classify_from_haz(haz)
    if whz is not None:
        status = _more_severe(status, classify_from_whz(whz))
    return status


def _lms_zscore(measurement: float, L: float, M: float, S: float) -> float:
    if L != 0:
        return (((measurement / M) ** L) - 1) / (L * S)
    return math.log(measurement / M) / S


def calculate_haz(height_cm: float, age_months: float, sex: str) -> float:
    """
    Height-for-Age Z-score, per the WHO LMS method, using the official
    reference tables loaded in who_reference.py.
    """
    L, M, S = lms_for_age(age_months, sex)
    return _lms_zscore(height_cm, L, M, S)


def calculate_whz(weight_kg: float, height_cm: float, age_months: float, sex: str) -> float:
    """
    Weight-for-Length/Height Z-score, per the WHO LMS method. Detects acute
    malnutrition (wasting), a different clinical signal from HAZ's stunting
    (chronic). Uses Weight-for-Length under 24 months, Weight-for-Height from
    24 months onward, matching WHO's own convention (see who_reference.py).
    """
    L, M, S = lms_for_weight(height_cm, age_months, sex)
    return _lms_zscore(weight_kg, L, M, S)


def assess_child_risk(child, latest_record) -> RiskResult:
    """
    Combines the HAZ/WHZ-based Stage 1 result with simple risk-factor flags.
    Stage 2 (ML) should call this first for the baseline, then layer its
    own prediction as an additional reason code / confidence score.
    """
    reason_codes = []
    status = NORMAL

    if latest_record.height_for_age_z is not None:
        haz_status = classify_from_haz(float(latest_record.height_for_age_z))
        if haz_status != NORMAL:
            reason_codes.append(f'HAZ_BELOW_{-2 if haz_status == WATCH else -3}')
        status = _more_severe(status, haz_status)

    if latest_record.weight_for_height_z is not None:
        whz_status = classify_from_whz(float(latest_record.weight_for_height_z))
        if whz_status != NORMAL:
            reason_codes.append(f'WHZ_BELOW_{-2 if whz_status == WATCH else -3}')
        status = _more_severe(status, whz_status)

    if child.exclusive_breastfeeding is False:
        reason_codes.append('NO_EXCLUSIVE_BF')
        status = WATCH if status == NORMAL else status

    return RiskResult(risk_status=status, reason_codes=reason_codes)
