"""
Validates calculate_haz() / lms_for_age() against values quoted directly from
WHO's official Length/Height-for-Age LMS reference tables (day-resolution
"expanded tables", z-score), downloaded from
https://www.who.int/tools/child-growth-standards/standards/length-height-for-age
on 2026-07-14. Each height figure below is WHO's own published SDxneg/SD0
value for that exact day — this checks that calculate_haz() reproduces WHO's
own Z-scores from WHO's own published heights, not just internal round-trips.
"""
from django.test import SimpleTestCase

from apps.growth.services.risk_engine import (
    calculate_haz,
    calculate_whz,
    classify_from_haz,
    classify_from_whz,
    classify_growth_record,
)
from apps.growth.services.who_reference import DAYS_PER_MONTH, lms_for_age, lms_for_weight


class LmsForAgeTests(SimpleTestCase):
    def test_boys_day0_matches_official_lms(self):
        # WHO boys LHFA, day 0: L=1, M=49.8842, S=0.03795
        L, M, S = lms_for_age(0, 'male')
        self.assertEqual(L, 1)
        self.assertAlmostEqual(M, 49.8842, places=3)
        self.assertAlmostEqual(S, 0.03795, places=5)

    def test_girls_day0_matches_official_lms(self):
        # WHO girls LHFA, day 0: L=1, M=49.1477, S=0.0379
        L, M, S = lms_for_age(0, 'female')
        self.assertEqual(L, 1)
        self.assertAlmostEqual(M, 49.1477, places=3)
        self.assertAlmostEqual(S, 0.0379, places=4)

    def test_clamps_beyond_table_range_instead_of_raising(self):
        # Table only covers 0-1856 days (~60.97 months); anything beyond
        # should clamp to the last row rather than KeyError/IndexError.
        L, M, S = lms_for_age(120, 'male')
        self.assertEqual((L, M, S), lms_for_age(1856 / DAYS_PER_MONTH, 'male'))


class CalculateHazTests(SimpleTestCase):
    def test_boys_newborn_minus2sd(self):
        # WHO boys LHFA, day 0: official SD2neg = 46.098 cm
        self.assertAlmostEqual(calculate_haz(46.098, 0, 'male'), -2.0, places=2)

    def test_boys_newborn_minus3sd(self):
        # WHO boys LHFA, day 0: official SD3neg = 44.205 cm
        self.assertAlmostEqual(calculate_haz(44.205, 0, 'male'), -3.0, places=2)

    def test_boys_day3_median_is_zero(self):
        # WHO boys LHFA, day 3 (3 / 30.4375 months): official SD0 = 50.412 cm
        age_months = 3 / DAYS_PER_MONTH
        self.assertAlmostEqual(calculate_haz(50.412, age_months, 'male'), 0.0, places=1)

    def test_girls_newborn_minus2sd(self):
        # WHO girls LHFA, day 0: official SD2neg = 45.422 cm
        self.assertAlmostEqual(calculate_haz(45.422, 0, 'female'), -2.0, places=2)

    def test_girls_newborn_minus3sd(self):
        # WHO girls LHFA, day 0: official SD3neg = 43.560 cm
        self.assertAlmostEqual(calculate_haz(43.560, 0, 'female'), -3.0, places=2)

    def test_girls_near_60_months_minus3sd(self):
        # WHO girls LHFA, day 1856 (~60.98 months): official SD3neg = 95.562 cm
        age_months = 1856 / DAYS_PER_MONTH
        self.assertAlmostEqual(calculate_haz(95.562, age_months, 'female'), -3.0, places=1)

    def test_normal_height_is_not_flagged(self):
        # A height right at the median at birth should score ~0, not risk/watch.
        self.assertAlmostEqual(calculate_haz(49.8842, 0, 'male'), 0.0, places=2)


class LmsForWeightTests(SimpleTestCase):
    def test_boys_wfl_matches_official_lms(self):
        # WHO boys WFL, length=45cm: L=-0.3521, M=2.441, S=0.09182
        L, M, S = lms_for_weight(45, age_months=0, sex='male')
        self.assertAlmostEqual(L, -0.3521, places=4)
        self.assertAlmostEqual(M, 2.441, places=3)
        self.assertAlmostEqual(S, 0.09182, places=5)

    def test_under_24_months_uses_weight_for_length_table(self):
        L, M, S = lms_for_weight(65, age_months=23.9, sex='male')
        self.assertAlmostEqual(M, 7.2666, places=3)  # WFL table's M at 65cm

    def test_24_months_and_over_uses_weight_for_height_table(self):
        L, M, S = lms_for_weight(65, age_months=24, sex='male')
        self.assertAlmostEqual(M, 7.4327, places=3)  # WFH table's M at 65cm (matches official value)


class CalculateWhzTests(SimpleTestCase):
    def test_boys_wfl_45cm_minus2sd(self):
        # WHO boys WFL, length=45cm: official SD2neg = 2.043 kg
        self.assertAlmostEqual(calculate_whz(2.043, 45, 0, 'male'), -2.0, places=2)

    def test_boys_wfl_45cm_minus3sd(self):
        # WHO boys WFL, length=45cm: official SD3neg = 1.877 kg
        self.assertAlmostEqual(calculate_whz(1.877, 45, 0, 'male'), -3.0, places=2)

    def test_boys_wfh_65cm_minus2sd(self):
        # WHO boys WFH, height=65cm: official SD2neg = 6.335 kg
        self.assertAlmostEqual(calculate_whz(6.335, 65, 24, 'male'), -2.0, places=2)

    def test_girls_wfl_45cm_minus2sd(self):
        # Derived from officially-sourced L=-0.3833, M=2.4607, S=0.09029 at
        # 45cm via WHO's own LMS formula (cross-validated against the boys'
        # directly-published SD columns above, which match to 3 decimals).
        self.assertAlmostEqual(calculate_whz(2.0665, 45, 0, 'female'), -2.0, places=2)

    def test_girls_wfh_65cm_minus3sd(self):
        # Derived the same way from officially-sourced L=-0.3833, M=7.2402,
        # S=0.09113 at 65cm.
        self.assertAlmostEqual(calculate_whz(5.5826, 65, 24, 'female'), -3.0, places=2)


class ClassifyGrowthRecordTests(SimpleTestCase):
    def test_takes_the_more_severe_of_haz_and_whz(self):
        # Normal HAZ but severely wasted WHZ should still classify as risk.
        self.assertEqual(classify_growth_record(haz=0.0, whz=-3.5), 'risk')
        # Severely stunted HAZ but normal WHZ should still classify as risk.
        self.assertEqual(classify_growth_record(haz=-3.5, whz=0.0), 'risk')
        # Both normal stays normal.
        self.assertEqual(classify_growth_record(haz=0.0, whz=0.0), 'normal')
        # No WHZ available (None) falls back to HAZ alone.
        self.assertEqual(classify_growth_record(haz=-2.5, whz=None), classify_from_haz(-2.5))

    def test_classify_from_whz_thresholds(self):
        self.assertEqual(classify_from_whz(-1.0), 'normal')
        self.assertEqual(classify_from_whz(-2.5), 'watch')
        self.assertEqual(classify_from_whz(-3.5), 'risk')
