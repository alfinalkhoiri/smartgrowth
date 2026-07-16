"""
WHO Child Growth Standards — LMS reference tables.

All CSVs in services/data/ are official WHO data (downloaded 2026-07-14 from
https://www.who.int/tools/child-growth-standards), converted from WHO's own
"expanded tables" (z-score) Excel files. Two indicators are supported:

- Length/Height-for-Age (HFA): indexed by day, 0-1856 days (0-60.97 months),
  boys/girls. L is fixed at 1 for every row (no skewness transform needed).
- Weight-for-Length (WFL, 0-2 years) / Weight-for-Height (WFH, 2-5 years):
  indexed by length/height in 0.1cm steps — WFL covers 45.0-110.0cm, WFH
  covers 65.0-120.0cm. L varies (and is negative), so the general LMS formula
  in risk_engine matters here, not just the L=1 special case.

WHO's own convention (used by their Anthro software) is to pick WFL for
children under 24 months and WFH from 24 months onward — see
lms_for_weight() below.
"""
import csv
import math
from functools import lru_cache
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent / 'data'

# WHO's own convention for converting a month-based age to days when building
# the day-resolution HFA tables (365.25 days/year / 12 months/year).
DAYS_PER_MONTH = 30.4375

# WFL/WFH tables step by 0.1cm; scaling by 10 turns that into consecutive
# integer keys so the same interpolation logic as the day-indexed HFA table
# can be reused as-is.
CM_STEPS_PER_UNIT = 10

_TABLE_FILES = {
    ('hfa', 'male'): 'hfa_boys.csv',
    ('hfa', 'female'): 'hfa_girls.csv',
    ('wfl', 'male'): 'wfl_boys.csv',
    ('wfl', 'female'): 'wfl_girls.csv',
    ('wfh', 'male'): 'wfh_boys.csv',
    ('wfh', 'female'): 'wfh_girls.csv',
}


@lru_cache(maxsize=None)
def _load_table(indicator: str, sex: str, key_column: str, scale: int = 1) -> dict:
    """Loads and caches an {int_key: (L, M, S)} table from its CSV file."""
    path = DATA_DIR / _TABLE_FILES[(indicator, sex)]
    table = {}
    with open(path, newline='') as f:
        for row in csv.DictReader(f):
            key = round(float(row[key_column]) * scale)
            table[key] = (float(row['L']), float(row['M']), float(row['S']))
    return table


def _interpolate(table: dict, scaled_value: float) -> tuple:
    """
    Linear interpolation between the two nearest integer keys in `table`.
    Values outside the table's range are clamped to the nearest edge rather
    than raising, since a slightly-out-of-range measurement shouldn't crash
    risk classification.
    """
    max_key = max(table)
    min_key = min(table)
    value = max(min_key, min(scaled_value, max_key))

    lower = int(value)
    upper = min(lower + 1, max_key)
    if lower == upper:
        return table[lower]

    fraction = value - lower
    l_lo, m_lo, s_lo = table[lower]
    l_hi, m_hi, s_hi = table[upper]
    return (
        l_lo + (l_hi - l_lo) * fraction,
        m_lo + (m_hi - m_lo) * fraction,
        s_lo + (s_hi - s_lo) * fraction,
    )


def load_lms_table(sex: str) -> dict:
    """Height-for-Age table, kept as its own function for backwards compat."""
    return _load_table('hfa', sex, key_column='day')


def lms_for_age(age_months: float, sex: str) -> tuple:
    """Returns (L, M, S) for Height-for-Age at the given age in months."""
    table = load_lms_table(sex)
    return _interpolate(table, age_months * DAYS_PER_MONTH)


def lms_for_weight(height_cm: float, age_months: float, sex: str) -> tuple:
    """
    Returns (L, M, S) for Weight-for-Length/Height at the given body length
    or height. Follows WHO's own convention: Weight-for-Length (0-2 years)
    under 24 months, Weight-for-Height (2-5 years) from 24 months onward.
    """
    indicator = 'wfl' if age_months < 24 else 'wfh'
    table = _load_table(indicator, sex, key_column='measure_cm', scale=CM_STEPS_PER_UNIT)
    return _interpolate(table, height_cm * CM_STEPS_PER_UNIT)


def _lms_inverse(z: float, L: float, M: float, S: float) -> float:
    """
    The LMS formula solved for the raw measurement instead of Z — this is
    exactly how WHO's own SD2neg/SD2/etc. reference columns are generated
    (see the "expanded tables" this project's CSVs came from). Used to turn
    a Z-score threshold back into a "what height/weight is that" value for
    the reference-range guide.
    """
    if L != 0:
        return M * ((1 + L * S * z) ** (1 / L))
    return M * math.exp(S * z)


def height_range_for_age(age_months: float, sex: str) -> tuple:
    """
    (min, max) height in cm spanning WHO's -2SD to +2SD Height-for-Age band
    — the same threshold classify_from_haz() uses for "normal" vs "watch".
    A reference guide, not a hard validation rule (real children do fall
    outside this range without it being a data-entry error).
    """
    L, M, S = lms_for_age(age_months, sex)
    return _lms_inverse(-2, L, M, S), _lms_inverse(2, L, M, S)


def weight_range_for_height(height_cm: float, age_months: float, sex: str) -> tuple:
    """(min, max) weight in kg spanning WHO's -2SD to +2SD Weight-for-Length/Height band."""
    L, M, S = lms_for_weight(height_cm, age_months, sex)
    return _lms_inverse(-2, L, M, S), _lms_inverse(2, L, M, S)
