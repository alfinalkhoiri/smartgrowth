"""
Stage 1 risk classification: rule-based, combining WHO Height-for-Age (HAZ),
Weight-for-Length/Height (WHZ), Weight-for-Age (WAZ) and, optionally,
Head-Circumference-for-Age (HCZ) Z-scores into a single weighted 0-100 score
and a 4-tier risk_status. This is the clinically-grounded baseline that ships
first; the ML/predictive layer (Stage 2) sits ON TOP of this later, not
instead of it.

`calculate_haz()`, `calculate_whz()`, `calculate_waz()` and `calculate_hcz()`
use the official WHO Child Growth Standards LMS reference tables (see
who_reference.py) via the standard LMS formula:
    Z = (((measurement / M) ** L) - 1) / (L * S)   if L != 0
    Z = ln(measurement / M) / S                     if L == 0

Four-tier status (normal/berisiko/stunting/malnutrisi, not the earlier
3-tier normal/watch/risk) because "stunting kronis" (chronic, HAZ-driven)
and "malnutrisi akut parah" (acute, severe wasting/underweight) carry
different referral urgency and shouldn't be collapsed into one label —
matches how Indonesia's own posyandu/Kemenkes practice names these.
"""
import math
from dataclasses import dataclass, field
from typing import Optional

from .who_reference import lms_for_age, lms_for_head_circumference, lms_for_weight, lms_for_weight_age


NORMAL = 'normal'
WATCH = 'berisiko'
STUNTING = 'stunting'
MALNUTRISI = 'malnutrisi'


@dataclass
class RiskResult:
    risk_status: str
    score: int = 0  # 0-100, higher = more severe
    reason_codes: list = field(default_factory=list)
    recommendations: list = field(default_factory=list)


def classify_from_haz(haz: float) -> str:
    if haz < -3:
        return MALNUTRISI   # Severely stunted
    if haz < -2:
        return STUNTING     # Stunted — needs monitoring
    return NORMAL


def classify_from_whz(whz: float) -> str:
    if whz < -3:
        return MALNUTRISI   # Gizi buruk — severe acute malnutrition (wasting)
    if whz < -2:
        return WATCH        # Gizi kurang — moderate wasting, needs monitoring
    return NORMAL


def classify_from_waz(waz: float) -> str:
    if waz < -3:
        return MALNUTRISI   # Berat badan sangat kurang — severely underweight
    if waz < -2:
        return WATCH        # Berat badan kurang — underweight, needs monitoring
    return NORMAL


def classify_from_hcz(hcz: float) -> str:
    if hcz < -2:
        return WATCH        # Mikrosefali — needs monitoring/referral evaluation
    return NORMAL


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


def calculate_hcz(head_circumference_cm: float, age_months: float, sex: str) -> float:
    """
    Head-Circumference-for-Age Z-score, per the WHO LMS method. An optional
    supplementary indicator (mainly for microcephaly screening) — not every
    posyandu measurement includes head circumference, so callers treat this
    as absent (None) rather than required.
    """
    L, M, S = lms_for_head_circumference(age_months, sex)
    return _lms_zscore(head_circumference_cm, L, M, S)


def _tier_recommendations(status: str) -> list:
    """
    Advisory recommendations keyed to the overall risk tier (distinct from
    questionnaire_recommendations() below, which is keyed to specific
    answered risk-factor fields). Intentionally only ever suggests monitoring/
    referral/consultation, never a diagnosis.
    """
    if status == NORMAL:
        return [
            'Pertumbuhan dalam batas normal — lanjutkan pemantauan bulanan di Posyandu.',
            'Pertahankan pola makan bergizi seimbang sesuai usia.',
        ]
    if status == WATCH:
        return [
            'Tingkatkan asupan protein hewani (telur, ikan, daging, susu) sesuai usia.',
            'Pantau berat/tinggi setiap 2 minggu, bukan hanya jadwal bulanan biasa.',
            'Konsultasikan ke bidan/nakes Posyandu untuk evaluasi lebih lanjut.',
        ]
    if status == STUNTING:
        return [
            'Rujuk ke Puskesmas untuk evaluasi status gizi lebih lanjut.',
            'Pertimbangkan pemberian makanan tambahan (PMT) sesuai panduan nakes.',
            'Periksa riwayat infeksi/sakit berulang yang bisa memperparah stunting.',
            'Pantau berat/tinggi setiap 2 minggu.',
        ]
    return [  # MALNUTRISI
        'Rujukan segera ke Puskesmas/fasilitas kesehatan — kondisi butuh penanganan cepat.',
        'Ikuti protokol pemberian makan terapeutik sesuai arahan tenaga kesehatan.',
        'Periksa kemungkinan penyakit penyerta (komorbiditas) yang memperberat kondisi.',
        'Pemantauan intensif sampai kondisi membaik.',
    ]


def score_risk(haz: float, whz: float, waz: float, hcz: Optional[float] = None) -> RiskResult:
    """
    Weighted scoring combining HAZ (stunting, chronic), WHZ (wasting, acute),
    WAZ (underweight) and optionally HCZ (head circumference) into a single
    0-100 risk score, rather than just taking the single worst indicator —
    lets moderate deficits across multiple indicators add up to something
    that needs attention even if no single Z-score alone crosses a severe
    cutoff. HAZ can still force at least the "stunting" tier on its own
    (chronic stunting shouldn't get diluted away by an otherwise-ok score).
    """
    score = 0
    reasons = []

    if haz < -3:
        score += 50
        reasons.append('HAZ_SEVERELY_STUNTED')
    elif haz < -2:
        score += 30
        reasons.append('HAZ_STUNTED')
    elif haz < -1:
        score += 12
        reasons.append('HAZ_APPROACHING_THRESHOLD')

    if whz < -3:
        score += 45
        reasons.append('WHZ_SEVERE_WASTING')
    elif whz < -2:
        score += 25
        reasons.append('WHZ_WASTING')
    elif whz > 3:
        score += 25
        reasons.append('WHZ_OBESITY')
    elif whz > 2:
        score += 12
        reasons.append('WHZ_OVERWEIGHT_RISK')

    if waz < -3:
        score += 25
        reasons.append('WAZ_SEVERELY_UNDERWEIGHT')
    elif waz < -2:
        score += 15
        reasons.append('WAZ_UNDERWEIGHT')

    if hcz is not None and hcz < -2:
        score += 15
        reasons.append('HCZ_MICROCEPHALY')

    score = min(100, score)

    if score >= 45:
        status = MALNUTRISI
    elif haz < -2:
        status = STUNTING   # HAZ alone forces this tier even if total score is lower
    elif score >= 20:
        status = WATCH      # "berisiko"
    else:
        status = NORMAL

    return RiskResult(
        risk_status=status, score=score, reason_codes=reasons,
        recommendations=_tier_recommendations(status),
    )


def assess_child_risk(child, latest_record) -> RiskResult:
    """
    Combines the score_risk() Stage 1 result (HAZ/WHZ/WAZ/HCZ) with simple
    risk-factor flags from the child's profile. Stage 2 (ML) should call this
    first for the baseline, then layer its own prediction as an additional
    reason code / confidence score.
    """
    if latest_record.height_for_age_z is None:
        return RiskResult(risk_status=NORMAL, score=0)

    result = score_risk(
        haz=float(latest_record.height_for_age_z),
        whz=float(latest_record.weight_for_height_z) if latest_record.weight_for_height_z is not None else 0.0,
        waz=float(latest_record.weight_for_age_z) if latest_record.weight_for_age_z is not None else 0.0,
        hcz=float(latest_record.head_circumference_z) if latest_record.head_circumference_z is not None else None,
    )

    if child.exclusive_breastfeeding is False:
        result.reason_codes.append('NO_EXCLUSIVE_BF')
        if result.risk_status == NORMAL:
            result.risk_status = WATCH

    return result


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
