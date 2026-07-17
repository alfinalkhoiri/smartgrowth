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

from .who_reference import lms_for_age, lms_for_weight, lms_for_weight_age


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


def classify_from_waz(waz: float) -> str:
    if waz < -3:
        return RISK        # Berat badan sangat kurang — severely underweight
    if waz < -2:
        return WATCH        # Berat badan kurang — underweight, needs monitoring
    return NORMAL


def classify_growth_record(haz: float, whz: float = None, waz: float = None) -> str:
    """
    Combines HAZ (stunting, chronic), WHZ (wasting, acute) and WAZ
    (underweight) into the single risk_status stored on a GrowthRecord — the
    most severe of the three, matching Indonesia's own "status gizi" practice
    (Permenkes No. 2/2020: TB/U, BB/TB, BB/U are each assessed independently,
    not folded into one number). A child can be underweight without (yet)
    crossing the stunting or wasting cutoff alone, so WAZ still catches cases
    HAZ/WHZ individually miss.
    """
    status = classify_from_haz(haz)
    if whz is not None:
        status = _more_severe(status, classify_from_whz(whz))
    if waz is not None:
        status = _more_severe(status, classify_from_waz(waz))
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


def calculate_waz(weight_kg: float, age_months: float, sex: str) -> float:
    """
    Weight-for-Age Z-score, per the WHO LMS method. Underweight is a
    composite signal (reflects both chronic and acute deficits at once) —
    historically the primary indicator on Indonesia's posyandu BB/U ("kurva
    berat badan") growth chart, still tracked independently in current
    Kemenkes nutritional-status guidance alongside HAZ/WHZ, not replaced by them.
    """
    L, M, S = lms_for_weight_age(age_months, sex)
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

    if latest_record.weight_for_age_z is not None:
        waz_status = classify_from_waz(float(latest_record.weight_for_age_z))
        if waz_status != NORMAL:
            reason_codes.append(f'WAZ_BELOW_{-2 if waz_status == WATCH else -3}')
        status = _more_severe(status, waz_status)

    if child.exclusive_breastfeeding is False:
        reason_codes.append('NO_EXCLUSIVE_BF')
        status = WATCH if status == NORMAL else status

    return RiskResult(risk_status=status, reason_codes=reason_codes)


_LOW_BIRTH_WEIGHT_KG = 2.5


def questionnaire_recommendations(child, record) -> list:
    """
    Advisory recommendations from well-established general stunting risk
    factors — exclusive breastfeeding, low birth weight (BBLR), clean water/
    sanitation access, recurrent illness, and immunization completeness (all
    widely cited by WHO/UNICEF/Kemenkes stunting prevention guidance). This
    supplements the HAZ/WHZ Z-score result; it does not replace it, and
    intentionally only ever recommends further monitoring/consultation, never
    a diagnosis. Fields left unanswered (None) are skipped, not treated as
    "no risk" — an unanswered question isn't evidence of anything.
    """
    recommendations = []

    if child.exclusive_breastfeeding is False:
        recommendations.append(
            'Edukasi pentingnya ASI eksklusif; jika usia di atas 6 bulan, pastikan MPASI bergizi seimbang.'
        )

    if child.birth_weight_kg is not None and float(child.birth_weight_kg) < _LOW_BIRTH_WEIGHT_KG:
        recommendations.append(
            'Riwayat berat badan lahir rendah (BBLR) — pantau pertumbuhan lebih ketat dan rujuk ke nakes bila perlu.'
        )

    if record.clean_water_access is False:
        recommendations.append(
            'Tingkatkan akses air bersih dan sanitasi layak untuk mencegah infeksi berulang.'
        )

    if record.recurrent_illness is True:
        recommendations.append(
            'Ada riwayat sakit/diare berulang — periksakan ke Puskesmas untuk evaluasi lebih lanjut.'
        )

    if record.immunization_complete is False:
        recommendations.append(
            'Lengkapi imunisasi sesuai jadwal di Posyandu/Puskesmas terdekat.'
        )

    return recommendations


# Indonesia's own posyandu weight-monitoring convention (Buku KIA / KMS,
# Kemenkes RI): N (Naik) if weight increased since the last weighing, T
# (Tetap/Turun) if it stayed flat or dropped. Two consecutive T's — "2T" — is
# the standard trigger for referral to Puskesmas, regardless of what the
# absolute HAZ/WHZ says. This matters because growth *faltering* (a flattening
# trend) is often visible before it's severe enough to show up as an
# out-of-range Z-score on a single measurement — the trend is itself a signal,
# not just a restatement of the point-in-time classification above.
NAIK = 'naik'
TETAP_TURUN = 'tetap_turun'


def classify_weight_trend(previous_weight_kg, current_weight_kg) -> str:
    return NAIK if float(current_weight_kg) > float(previous_weight_kg) else TETAP_TURUN


def has_2t_alert(weight_trends: list) -> bool:
    """
    True if the two most recent weight_trend values (in chronological order)
    are both TETAP_TURUN — i.e. weight failed to increase at two consecutive
    measurements in a row.
    """
    return len(weight_trends) >= 2 and weight_trends[-1] == TETAP_TURUN and weight_trends[-2] == TETAP_TURUN
