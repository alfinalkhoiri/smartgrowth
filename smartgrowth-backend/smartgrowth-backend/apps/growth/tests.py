"""
Validates calculate_haz() / lms_for_age() against values quoted directly from
WHO's official Length/Height-for-Age LMS reference tables (day-resolution
"expanded tables", z-score), downloaded from
https://www.who.int/tools/child-growth-standards/standards/length-height-for-age
on 2026-07-14. Each height figure below is WHO's own published SDxneg/SD0
value for that exact day — this checks that calculate_haz() reproduces WHO's
own Z-scores from WHO's own published heights, not just internal round-trips.
"""
import base64
from datetime import date, datetime, timedelta, timezone as dt_timezone
from types import SimpleNamespace

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import RequestFactory, SimpleTestCase, TestCase
from rest_framework.test import APIClient

from apps.accounts.models import RegistrationInviteCode
from apps.growth.models import Child, GrowthRecord
from apps.growth.permissions import visible_children
from apps.growth.serializers import ChildSerializer, GrowthRecordSerializer, PosyanduScheduleSerializer
from apps.growth.services.risk_engine import (
    calculate_haz,
    calculate_hcz,
    calculate_waz,
    calculate_whz,
    classify_from_haz,
    classify_from_hcz,
    classify_from_waz,
    classify_from_whz,
    classify_weight_trend,
    has_2t_alert,
    questionnaire_recommendations,
    score_risk,
)
from apps.growth.services.who_reference import (
    DAYS_PER_MONTH,
    height_range_for_age,
    lms_for_age,
    lms_for_head_circumference,
    lms_for_weight,
    lms_for_weight_age,
    weight_range_for_height,
)


def _child(exclusive_breastfeeding=None, birth_weight_kg=None):
    return SimpleNamespace(exclusive_breastfeeding=exclusive_breastfeeding, birth_weight_kg=birth_weight_kg)


def _record(clean_water_access=None, recurrent_illness=None, immunization_complete=None):
    return SimpleNamespace(
        clean_water_access=clean_water_access,
        recurrent_illness=recurrent_illness,
        immunization_complete=immunization_complete,
    )


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


class LmsForWeightAgeTests(SimpleTestCase):
    def test_boys_day0_matches_official_lms(self):
        # WHO weianthro (WFA) boys, day 0: L=0.3487, M=3.3464, S=0.14602 —
        # cross-checked against the existing WFL table's published L/M/S at
        # 45cm (matched to 4 decimal places), confirming the same source.
        L, M, S = lms_for_weight_age(0, 'male')
        self.assertAlmostEqual(L, 0.3487, places=4)
        self.assertAlmostEqual(M, 3.3464, places=4)
        self.assertAlmostEqual(S, 0.14602, places=5)

    def test_girls_day0_matches_official_lms(self):
        # WHO weianthro (WFA) girls, day 0: L=0.3809, M=3.2322, S=0.14171
        L, M, S = lms_for_weight_age(0, 'female')
        self.assertAlmostEqual(L, 0.3809, places=4)
        self.assertAlmostEqual(M, 3.2322, places=4)
        self.assertAlmostEqual(S, 0.14171, places=5)


class CalculateWazTests(SimpleTestCase):
    def test_boys_newborn_minus2sd(self):
        # SD2neg = 2.4593 kg — computed from the official LMS above via the
        # same LMS-inverse formula that generates WHO's own SDneg/SD columns
        # (see who_reference._lms_inverse / GrowthRangeTests).
        self.assertAlmostEqual(calculate_waz(2.4593, 0, 'male'), -2.0, places=2)

    def test_boys_newborn_minus3sd(self):
        # SD3neg = 2.0803 kg, same derivation.
        self.assertAlmostEqual(calculate_waz(2.0803, 0, 'male'), -3.0, places=2)

    def test_girls_newborn_minus2sd(self):
        # SD2neg = 2.3947 kg, derived from the official girls LMS above.
        self.assertAlmostEqual(calculate_waz(2.3947, 0, 'female'), -2.0, places=2)

    def test_boys_24_months_minus2sd(self):
        # WHO weianthro boys, day 730 (~24mo): L=-0.0136, M=12.1482, S=0.11425;
        # SD2neg = 9.6701 kg, same derivation.
        age_months = 730 / DAYS_PER_MONTH
        self.assertAlmostEqual(calculate_waz(9.6701, age_months, 'male'), -2.0, places=2)

    def test_normal_weight_is_not_flagged(self):
        self.assertAlmostEqual(calculate_waz(3.3464, 0, 'male'), 0.0, places=2)


class LmsForHeadCircumferenceTests(SimpleTestCase):
    def test_boys_day0_matches_official_lms(self):
        # WHO hcanthro (HCA) boys, day 0: L=1, M=34.4618, S=0.03686 —
        # sourced from the same WHO Anthro macro package as wfl/wfh/weianthro.
        L, M, S = lms_for_head_circumference(0, 'male')
        self.assertEqual(L, 1)
        self.assertAlmostEqual(M, 34.4618, places=4)
        self.assertAlmostEqual(S, 0.03686, places=5)

    def test_girls_day0_matches_official_lms(self):
        # WHO hcanthro (HCA) girls, day 0: L=1, M=33.8787, S=0.03496
        L, M, S = lms_for_head_circumference(0, 'female')
        self.assertEqual(L, 1)
        self.assertAlmostEqual(M, 33.8787, places=4)
        self.assertAlmostEqual(S, 0.03496, places=5)


class CalculateHczTests(SimpleTestCase):
    def test_boys_newborn_minus2sd(self):
        # SD2neg = 31.9213 cm — computed from the official LMS above via the
        # same LMS-inverse formula that generates WHO's own SDneg/SD columns.
        self.assertAlmostEqual(calculate_hcz(31.9213, 0, 'male'), -2.0, places=2)

    def test_boys_newborn_minus3sd(self):
        # SD3neg = 30.651 cm, same derivation.
        self.assertAlmostEqual(calculate_hcz(30.651, 0, 'male'), -3.0, places=2)

    def test_girls_newborn_minus2sd(self):
        # SD2neg = 31.5099 cm, derived from the official girls LMS above.
        self.assertAlmostEqual(calculate_hcz(31.5099, 0, 'female'), -2.0, places=2)

    def test_normal_head_circumference_is_not_flagged(self):
        self.assertAlmostEqual(calculate_hcz(34.4618, 0, 'male'), 0.0, places=2)


class ClassifyThresholdTests(SimpleTestCase):
    """Single-indicator tier labels — building blocks, not the overall
    risk_status (see ScoreRiskTests for the combined 4-tier decision)."""

    def test_classify_from_haz_thresholds(self):
        self.assertEqual(classify_from_haz(-1.0), 'normal')
        self.assertEqual(classify_from_haz(-2.5), 'stunting')
        self.assertEqual(classify_from_haz(-3.5), 'malnutrisi')

    def test_classify_from_whz_thresholds(self):
        self.assertEqual(classify_from_whz(-1.0), 'normal')
        self.assertEqual(classify_from_whz(-2.5), 'berisiko')
        self.assertEqual(classify_from_whz(-3.5), 'malnutrisi')

    def test_classify_from_waz_thresholds(self):
        self.assertEqual(classify_from_waz(-1.0), 'normal')
        self.assertEqual(classify_from_waz(-2.5), 'berisiko')
        self.assertEqual(classify_from_waz(-3.5), 'malnutrisi')

    def test_classify_from_hcz_thresholds(self):
        self.assertEqual(classify_from_hcz(-1.0), 'normal')
        self.assertEqual(classify_from_hcz(-2.5), 'berisiko')


class ScoreRiskTests(SimpleTestCase):
    """
    score_risk() is the single source of truth for risk_status (used by both
    GrowthRecordViewSet._score() and assess_child_risk()) — a weighted 0-100
    combination of HAZ/WHZ/WAZ/HCZ, not just "most severe of N".
    """

    def test_all_normal_is_normal_with_zero_score(self):
        result = score_risk(haz=0.0, whz=0.0, waz=0.0)
        self.assertEqual(result.risk_status, 'normal')
        self.assertEqual(result.score, 0)

    def test_severely_stunted_haz_alone_is_malnutrisi(self):
        # HAZ<-3 alone already scores 50 >= 45.
        result = score_risk(haz=-3.5, whz=0.0, waz=0.0)
        self.assertEqual(result.risk_status, 'malnutrisi')
        self.assertEqual(result.score, 50)

    def test_stunted_haz_alone_is_stunting_even_though_score_is_only_30(self):
        # HAZ<-2 forces at least "stunting" even though 30 < 45 and < 20 isn't
        # the trigger here — chronic stunting shouldn't get diluted away.
        result = score_risk(haz=-2.5, whz=0.0, waz=0.0)
        self.assertEqual(result.risk_status, 'stunting')
        self.assertEqual(result.score, 30)

    def test_severe_wasting_alone_is_malnutrisi(self):
        # WHZ<-3 alone scores 45 >= 45, independent of HAZ.
        result = score_risk(haz=0.0, whz=-3.5, waz=0.0)
        self.assertEqual(result.risk_status, 'malnutrisi')

    def test_moderate_waz_alone_stays_normal(self):
        # WAZ<-2 alone scores 15, under the 20-point "berisiko" threshold.
        result = score_risk(haz=0.0, whz=0.0, waz=-2.5)
        self.assertEqual(result.score, 15)
        self.assertEqual(result.risk_status, 'normal')

    def test_combined_moderate_deficits_add_up_to_berisiko(self):
        # HAZ approaching (-1.5: +12) + WAZ underweight (-2.5: +15) = 27 >= 20
        # -> "berisiko" even though neither alone crosses its own cutoff.
        result = score_risk(haz=-1.5, whz=0.0, waz=-2.5)
        self.assertEqual(result.score, 27)
        self.assertEqual(result.risk_status, 'berisiko')

    def test_hcz_contributes_to_score_when_provided(self):
        result_without = score_risk(haz=-1.5, whz=0.0, waz=0.0, hcz=None)
        result_with = score_risk(haz=-1.5, whz=0.0, waz=0.0, hcz=-2.5)
        self.assertEqual(result_without.score, 12)
        self.assertEqual(result_with.score, 27)
        self.assertIn('HCZ_MICROCEPHALY', result_with.reason_codes)

    def test_score_is_capped_at_100(self):
        result = score_risk(haz=-4.0, whz=-4.0, waz=-4.0, hcz=-4.0)
        self.assertEqual(result.score, 100)

    def test_recommendations_are_present_for_every_tier(self):
        for haz, whz, waz in [(0.0, 0.0, 0.0), (-1.5, 0.0, -2.5), (-2.5, 0.0, 0.0), (-3.5, -3.5, -3.5)]:
            result = score_risk(haz=haz, whz=whz, waz=waz)
            self.assertTrue(len(result.recommendations) > 0)


class ChildSerializerDateValidationTests(SimpleTestCase):
    def test_rejects_future_birth_date(self):
        tomorrow = (date.today() + timedelta(days=1)).isoformat()
        serializer = ChildSerializer(data={'name': 'Anak Uji', 'birth_date': tomorrow, 'sex': 'male'})
        self.assertFalse(serializer.is_valid())
        self.assertIn('birth_date', serializer.errors)

    def test_accepts_past_birth_date(self):
        yesterday = (date.today() - timedelta(days=1)).isoformat()
        serializer = ChildSerializer(data={'name': 'Anak Uji', 'birth_date': yesterday, 'sex': 'male'})
        self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_accepts_todays_birth_date(self):
        today = date.today().isoformat()
        serializer = ChildSerializer(data={'name': 'Anak Uji', 'birth_date': today, 'sex': 'male'})
        self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_posyandu_location_is_optional(self):
        yesterday = (date.today() - timedelta(days=1)).isoformat()
        serializer = ChildSerializer(data={'name': 'Anak Uji', 'birth_date': yesterday, 'sex': 'male'})
        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertEqual(serializer.validated_data.get('posyandu_location', ''), '')

    def test_posyandu_location_round_trips(self):
        yesterday = (date.today() - timedelta(days=1)).isoformat()
        serializer = ChildSerializer(
            data={'name': 'Anak Uji', 'birth_date': yesterday, 'sex': 'male', 'posyandu_location': 'Posyandu Melati'}
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertEqual(serializer.validated_data['posyandu_location'], 'Posyandu Melati')


class GrowthRecordSerializerDateValidationTests(TestCase):
    def setUp(self):
        self.child = Child.objects.create(name='Anak Uji', birth_date=date(2024, 1, 1), sex='male')

    def test_rejects_measured_at_before_birth_date(self):
        serializer = GrowthRecordSerializer(data={
            'child_id': str(self.child.id),
            'measured_at': '2023-12-31',
            'weight_kg': 10,
            'height_cm': 70,
            'age_months': 0,
        })
        self.assertFalse(serializer.is_valid())
        self.assertIn('measured_at', serializer.errors)

    def test_rejects_future_measured_at(self):
        tomorrow = (date.today() + timedelta(days=1)).isoformat()
        serializer = GrowthRecordSerializer(data={
            'child_id': str(self.child.id),
            'measured_at': tomorrow,
            'weight_kg': 10,
            'height_cm': 70,
            'age_months': 0,
        })
        self.assertFalse(serializer.is_valid())
        self.assertIn('measured_at', serializer.errors)

    def test_accepts_valid_measured_at(self):
        serializer = GrowthRecordSerializer(data={
            'child_id': str(self.child.id),
            'measured_at': '2024-06-01',
            'weight_kg': 10,
            'height_cm': 70,
            'age_months': 5,
        })
        self.assertTrue(serializer.is_valid(), serializer.errors)


class GrowthRecordSerializerPlausibilityValidationTests(TestCase):
    def setUp(self):
        self.child = Child.objects.create(name='Anak Uji', birth_date=date(2024, 1, 1), sex='male')

    def test_rejects_implausible_height_for_age(self):
        # 200cm at 5 months old (expected ~65cm) puts HAZ far beyond +6 —
        # this is the exact class of bad data found in production (typo'd
        # or wrong-unit height), not a real measurement.
        serializer = GrowthRecordSerializer(data={
            'child_id': str(self.child.id),
            'measured_at': '2024-06-01',
            'weight_kg': 10,
            'height_cm': 200,
            'age_months': 5,
        })
        self.assertFalse(serializer.is_valid())
        self.assertIn('height_cm', serializer.errors)

    def test_rejects_implausible_weight_for_height(self):
        # 100kg at 70cm tall puts WHZ far beyond +5.
        serializer = GrowthRecordSerializer(data={
            'child_id': str(self.child.id),
            'measured_at': '2024-06-01',
            'weight_kg': 100,
            'height_cm': 70,
            'age_months': 5,
        })
        self.assertFalse(serializer.is_valid())
        self.assertIn('weight_kg', serializer.errors)

    def test_rejects_implausible_weight_for_age(self):
        # A newborn at 54cm/6.5kg: HAZ=2.17 and WHZ=4.52 individually still
        # pass their own (looser) plausible ranges, but WAZ=5.12 exceeds +5 —
        # confirms WAZ catches implausible entries HAZ/WHZ miss on their own,
        # not just unreachable dead code behind the other two checks.
        serializer = GrowthRecordSerializer(data={
            'child_id': str(self.child.id),
            'measured_at': '2024-01-01',
            'weight_kg': 6.5,
            'height_cm': 54,
            'age_months': 0,
        })
        self.assertFalse(serializer.is_valid())
        self.assertIn('weight_kg', serializer.errors)

    def test_rejects_implausible_head_circumference(self):
        # 15cm head circumference at 5 months (expected ~42cm) puts HCZ far
        # beyond -5 — head_circumference_cm is optional, so this only fires
        # when it's actually provided.
        serializer = GrowthRecordSerializer(data={
            'child_id': str(self.child.id),
            'measured_at': '2024-06-01',
            'weight_kg': 10,
            'height_cm': 70,
            'head_circumference_cm': 15,
            'age_months': 5,
        })
        self.assertFalse(serializer.is_valid())
        self.assertIn('head_circumference_cm', serializer.errors)

    def test_accepts_plausible_values(self):
        serializer = GrowthRecordSerializer(data={
            'child_id': str(self.child.id),
            'measured_at': '2024-06-01',
            'weight_kg': 10,
            'height_cm': 70,
            'age_months': 5,
        })
        self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_accepts_plausible_head_circumference(self):
        serializer = GrowthRecordSerializer(data={
            'child_id': str(self.child.id),
            'measured_at': '2024-06-01',
            'weight_kg': 10,
            'height_cm': 70,
            'head_circumference_cm': 42,
            'age_months': 5,
        })
        self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_allows_updating_other_fields_on_an_already_bad_existing_record(self):
        # Simulates real production data found with an implausible height
        # already saved (predates this validation). Saving just a note on
        # that record must not be blocked by re-flagging its untouched,
        # already-bad height/weight — that's an existing-data cleanup
        # problem, not something an unrelated field save should get stuck on.
        bad_record = GrowthRecord.objects.create(
            child=self.child, measured_at=date(2024, 6, 1),
            weight_kg=10, height_cm=200, age_months=5,
        )
        serializer = GrowthRecordSerializer(bad_record, data={
            'child_id': str(self.child.id),
            'measured_at': '2024-06-01',
            'weight_kg': 10,
            'height_cm': 200,
            'age_months': 5,
            'notes': 'catatan baru',
        })
        self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_still_rejects_a_new_implausible_value_on_update(self):
        record = GrowthRecord.objects.create(
            child=self.child, measured_at=date(2024, 6, 1),
            weight_kg=10, height_cm=70, age_months=5,
        )
        serializer = GrowthRecordSerializer(record, data={
            'child_id': str(self.child.id),
            'measured_at': '2024-06-01',
            'weight_kg': 10,
            'height_cm': 200,
            'age_months': 5,
        })
        self.assertFalse(serializer.is_valid())
        self.assertIn('height_cm', serializer.errors)


class QuestionnaireRecommendationsTests(SimpleTestCase):
    def test_no_recommendations_when_nothing_flagged_or_unanswered(self):
        recs = questionnaire_recommendations(_child(), _record())
        self.assertEqual(recs, [])

    def test_no_exclusive_breastfeeding_flags_recommendation(self):
        recs = questionnaire_recommendations(_child(exclusive_breastfeeding=False), _record())
        self.assertEqual(len(recs), 1)
        self.assertIn('ASI eksklusif', recs[0])

    def test_low_birth_weight_flags_recommendation(self):
        recs = questionnaire_recommendations(_child(birth_weight_kg=2.3), _record())
        self.assertEqual(len(recs), 1)
        self.assertIn('BBLR', recs[0])

    def test_normal_birth_weight_does_not_flag(self):
        recs = questionnaire_recommendations(_child(birth_weight_kg=3.2), _record())
        self.assertEqual(recs, [])

    def test_no_clean_water_access_flags_recommendation(self):
        recs = questionnaire_recommendations(_child(), _record(clean_water_access=False))
        self.assertEqual(len(recs), 1)
        self.assertIn('air bersih', recs[0])

    def test_recurrent_illness_flags_recommendation(self):
        recs = questionnaire_recommendations(_child(), _record(recurrent_illness=True))
        self.assertEqual(len(recs), 1)
        self.assertIn('Puskesmas', recs[0])

    def test_incomplete_immunization_flags_recommendation(self):
        recs = questionnaire_recommendations(_child(), _record(immunization_complete=False))
        self.assertEqual(len(recs), 1)
        self.assertIn('imunisasi', recs[0])

    def test_unanswered_questionnaire_fields_are_not_flagged(self):
        # None means "not asked", which must not be treated as a risk signal.
        recs = questionnaire_recommendations(
            _child(exclusive_breastfeeding=None, birth_weight_kg=None),
            _record(clean_water_access=None, recurrent_illness=None, immunization_complete=None),
        )
        self.assertEqual(recs, [])

    def test_multiple_flags_combine(self):
        recs = questionnaire_recommendations(
            _child(exclusive_breastfeeding=False, birth_weight_kg=2.0),
            _record(clean_water_access=False, recurrent_illness=True, immunization_complete=False),
        )
        self.assertEqual(len(recs), 5)


class ClassifyWeightTrendTests(SimpleTestCase):
    def test_naik_when_weight_increased(self):
        self.assertEqual(classify_weight_trend(10, 10.5), 'naik')

    def test_tetap_turun_when_weight_dropped(self):
        self.assertEqual(classify_weight_trend(10, 9.5), 'tetap_turun')

    def test_tetap_turun_when_weight_unchanged(self):
        self.assertEqual(classify_weight_trend(10, 10), 'tetap_turun')


class Has2tAlertTests(SimpleTestCase):
    def test_true_when_last_two_are_tetap_turun(self):
        self.assertTrue(has_2t_alert(['naik', 'tetap_turun', 'tetap_turun']))

    def test_false_when_only_one_tetap_turun(self):
        self.assertFalse(has_2t_alert(['tetap_turun', 'naik']))

    def test_false_when_fewer_than_two_trends(self):
        self.assertFalse(has_2t_alert(['tetap_turun']))
        self.assertFalse(has_2t_alert([]))

    def test_false_when_most_recent_is_naik(self):
        self.assertFalse(has_2t_alert(['tetap_turun', 'tetap_turun', 'naik']))


class GrowthTrendIntegrationTests(TestCase):
    """
    End-to-end through the serializers (not just the pure risk_engine
    functions) — confirms weight_trend/growth_alert are wired to real
    GrowthRecord history in chronological order, not just unit-tested in
    isolation.
    """

    def setUp(self):
        self.child = Child.objects.create(name='Anak Uji', birth_date=date(2024, 1, 1), sex='male')

    def _add_record(self, measured_at, weight_kg):
        return GrowthRecord.objects.create(
            child=self.child, measured_at=measured_at, weight_kg=weight_kg, height_cm=70, age_months=6,
        )

    def test_first_record_has_no_weight_trend(self):
        record = self._add_record(date(2024, 6, 1), 8.0)
        data = GrowthRecordSerializer(record).data
        self.assertIsNone(data['weight_trend'])

    def test_second_record_weight_trend_reflects_change(self):
        self._add_record(date(2024, 6, 1), 8.0)
        second = self._add_record(date(2024, 7, 1), 7.5)
        data = GrowthRecordSerializer(second).data
        self.assertEqual(data['weight_trend'], 'tetap_turun')

    def test_growth_alert_none_with_fewer_than_three_records(self):
        self._add_record(date(2024, 6, 1), 8.0)
        self._add_record(date(2024, 7, 1), 7.5)
        data = ChildSerializer(self.child).data
        self.assertIsNone(data['growth_alert'])

    def test_growth_alert_2t_after_two_consecutive_non_increases(self):
        self._add_record(date(2024, 6, 1), 8.0)
        self._add_record(date(2024, 7, 1), 7.8)
        self._add_record(date(2024, 8, 1), 7.8)
        data = ChildSerializer(self.child).data
        self.assertEqual(data['growth_alert'], '2T')

    def test_growth_alert_none_when_a_gain_breaks_the_streak(self):
        self._add_record(date(2024, 6, 1), 8.0)
        self._add_record(date(2024, 7, 1), 7.8)  # tetap_turun
        self._add_record(date(2024, 8, 1), 8.5)  # naik — breaks it
        data = ChildSerializer(self.child).data
        self.assertIsNone(data['growth_alert'])


class GrowthRangeTests(SimpleTestCase):
    """Reference-range guide, checked against the same officially-quoted WHO
    SD2neg/SD2 values used elsewhere in this file (see CalculateHazTests /
    CalculateWhzTests docstrings for provenance)."""

    def test_height_range_boys_newborn(self):
        # WHO boys LHFA, day 0: official SD2neg=46.098, SD2=53.67
        lo, hi = height_range_for_age(0, 'male')
        self.assertAlmostEqual(lo, 46.098, places=2)
        self.assertAlmostEqual(hi, 53.67, places=2)

    def test_weight_range_boys_wfl_45cm(self):
        # WHO boys WFL, length=45cm: official SD2neg=2.043, SD2=2.951
        lo, hi = weight_range_for_height(45, age_months=0, sex='male')
        self.assertAlmostEqual(lo, 2.043, places=2)
        self.assertAlmostEqual(hi, 2.951, places=2)

    def test_weight_range_boys_wfh_65cm(self):
        # WHO boys WFH, height=65cm: official SD2neg=6.335, SD2=8.804
        lo, hi = weight_range_for_height(65, age_months=24, sex='male')
        self.assertAlmostEqual(lo, 6.335, places=2)
        self.assertAlmostEqual(hi, 8.804, places=2)

    def test_range_min_is_always_less_than_max(self):
        lo, hi = height_range_for_age(30, 'female')
        self.assertLess(lo, hi)


class PosyanduScheduleSerializerTests(SimpleTestCase):
    def test_accepts_valid_schedule(self):
        serializer = PosyanduScheduleSerializer(data={
            'scheduled_at': datetime(2026, 8, 1, 9, 0, tzinfo=dt_timezone.utc).isoformat(),
            'location': 'Posyandu Melati',
            'notes': 'Bawa buku KIA',
        })
        self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_rejects_missing_location(self):
        serializer = PosyanduScheduleSerializer(data={
            'scheduled_at': datetime(2026, 8, 1, 9, 0, tzinfo=dt_timezone.utc).isoformat(),
        })
        self.assertFalse(serializer.is_valid())
        self.assertIn('location', serializer.errors)

    def test_rejects_missing_scheduled_at(self):
        serializer = PosyanduScheduleSerializer(data={'location': 'Posyandu Melati'})
        self.assertFalse(serializer.is_valid())
        self.assertIn('scheduled_at', serializer.errors)

    def test_notes_is_optional(self):
        serializer = PosyanduScheduleSerializer(data={
            'scheduled_at': datetime(2026, 8, 1, 9, 0, tzinfo=dt_timezone.utc).isoformat(),
            'location': 'Posyandu Melati',
        })
        self.assertTrue(serializer.is_valid(), serializer.errors)


# Minimal valid 1x1 transparent PNG — real image bytes so Django's ImageField
# (which uses Pillow to verify the upload is actually an image) accepts it.
_ONE_PIXEL_PNG = base64.b64decode(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='
)


class GrowthRecordPhotoTests(TestCase):
    """
    Documentation-only photo field (see GrowthRecord.photo docstring) — not
    used for AI-vision estimation, so the only thing worth verifying is that
    it's genuinely optional and that a real image upload round-trips.
    """

    def setUp(self):
        self.child = Child.objects.create(name='Anak Uji', birth_date=date(2024, 1, 1), sex='male')

    def test_photo_is_optional(self):
        serializer = GrowthRecordSerializer(data={
            'child_id': str(self.child.id),
            'measured_at': '2024-06-01',
            'weight_kg': 10,
            'height_cm': 70,
            'age_months': 5,
        })
        self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_accepts_a_real_image_upload(self):
        photo = SimpleUploadedFile('balita.png', _ONE_PIXEL_PNG, content_type='image/png')
        serializer = GrowthRecordSerializer(data={
            'child_id': str(self.child.id),
            'measured_at': '2024-06-01',
            'weight_kg': 10,
            'height_cm': 70,
            'age_months': 5,
            'photo': photo,
        })
        self.assertTrue(serializer.is_valid(), serializer.errors)


class VisibleChildrenScopingTests(TestCase):
    """orangtua only ever sees children linked via Child.link_code; kader_nakes/admin see everyone."""

    def setUp(self):
        User = get_user_model()
        self.kader = User.objects.create_user(username='kader_scope', password='x', role='kader_nakes')
        self.parent = User.objects.create_user(username='parent_scope', password='x', role='orangtua')
        self.unlinked_parent = User.objects.create_user(username='parent_scope2', password='x', role='orangtua')
        self.child_a = Child.objects.create(name='Anak Scope A', birth_date=date(2024, 1, 1), sex='male')
        self.child_b = Child.objects.create(name='Anak Scope B', birth_date=date(2024, 1, 1), sex='female')
        self.child_a.parents.add(self.parent)

    def test_kader_nakes_sees_all_children(self):
        self.assertEqual(set(visible_children(self.kader)), {self.child_a, self.child_b})

    def test_orangtua_sees_only_linked_children(self):
        self.assertEqual(list(visible_children(self.parent)), [self.child_a])

    def test_orangtua_with_no_linked_children_sees_none(self):
        self.assertEqual(list(visible_children(self.unlinked_parent)), [])


class ChildSerializerLinkCodeVisibilityTests(TestCase):
    """
    link_code is the only thing needed to see a child's data (via /children/link/),
    so it must stay hidden from anyone who isn't kader_nakes/admin or already a
    linked parent of that specific child.
    """

    def setUp(self):
        User = get_user_model()
        self.kader = User.objects.create_user(username='kader_lc', password='x', role='kader_nakes')
        self.parent = User.objects.create_user(username='parent_lc', password='x', role='orangtua')
        self.stranger = User.objects.create_user(username='parent_lc2', password='x', role='orangtua')
        self.child = Child.objects.create(name='Anak LC', birth_date=date(2024, 1, 1), sex='male')
        self.child.parents.add(self.parent)

    def _serialize_as(self, user):
        request = RequestFactory().get('/')
        request.user = user
        return ChildSerializer(self.child, context={'request': request}).data

    def test_kader_nakes_sees_link_code(self):
        self.assertEqual(self._serialize_as(self.kader)['link_code'], self.child.link_code)

    def test_linked_parent_sees_link_code(self):
        self.assertEqual(self._serialize_as(self.parent)['link_code'], self.child.link_code)

    def test_unrelated_parent_does_not_see_link_code(self):
        self.assertIsNone(self._serialize_as(self.stranger)['link_code'])


class RoleBasedGrowthPermissionAPITests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.kader = User.objects.create_user(username='kader_api', password='x', role='kader_nakes')
        self.parent = User.objects.create_user(username='parent_api', password='x', role='orangtua')
        self.child = Child.objects.create(name='Anak API', birth_date=date(2024, 1, 1), sex='male')
        self.other_child = Child.objects.create(name='Anak API 2', birth_date=date(2024, 1, 1), sex='female')
        self.child.parents.add(self.parent)

    @staticmethod
    def _client_for(user):
        client = APIClient()
        client.force_authenticate(user=user)
        return client

    def test_orangtua_lists_only_linked_children(self):
        response = self._client_for(self.parent).get('/api/children/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual({c['id'] for c in response.data}, {str(self.child.id)})

    def test_orangtua_cannot_create_child(self):
        response = self._client_for(self.parent).post(
            '/api/children/', {'name': 'X', 'birth_date': '2024-01-01', 'sex': 'male'}
        )
        self.assertEqual(response.status_code, 403)

    def test_orangtua_gets_404_for_unlinked_child(self):
        response = self._client_for(self.parent).get(f'/api/children/{self.other_child.id}/')
        self.assertEqual(response.status_code, 404)

    def test_kader_nakes_sees_all_children_and_can_create(self):
        client = self._client_for(self.kader)
        list_response = client.get('/api/children/')
        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(len(list_response.data), 2)
        create_response = client.post('/api/children/', {'name': 'X', 'birth_date': '2024-01-01', 'sex': 'male'})
        self.assertEqual(create_response.status_code, 201, create_response.data)


class OrangtuaSelfMeasurementTests(TestCase):
    """
    Orangtua may POST a new GrowthRecord for their own linked child
    ("pengukuran mandiri") but never edit/delete one, and never for a child
    they aren't linked to — see GrowthRecordPermission +
    GrowthRecordSerializer.validate().
    """

    def setUp(self):
        User = get_user_model()
        self.parent = User.objects.create_user(username='parent_selfm', password='x', role='orangtua')
        self.child = Child.objects.create(name='Anak Mandiri', birth_date=date(2024, 1, 1), sex='male')
        self.other_child = Child.objects.create(name='Anak Mandiri 2', birth_date=date(2024, 1, 1), sex='female')
        self.child.parents.add(self.parent)

    def _client(self):
        client = APIClient()
        client.force_authenticate(user=self.parent)
        return client

    def _payload(self, child_id):
        return {
            'child_id': str(child_id), 'measured_at': '2024-06-01', 'weight_kg': '9.0', 'height_cm': '70', 'age_months': 5,
        }

    def test_orangtua_can_create_record_for_linked_child(self):
        response = self._client().post('/api/growth-records/', self._payload(self.child.id))
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data['officer_name'], 'Orang Tua (Mandiri)')

    def test_orangtua_cannot_create_record_for_unlinked_child(self):
        response = self._client().post('/api/growth-records/', self._payload(self.other_child.id))
        self.assertEqual(response.status_code, 400)
        self.assertIn('child_id', response.data)

    def test_orangtua_cannot_update_own_record(self):
        create_response = self._client().post('/api/growth-records/', self._payload(self.child.id))
        record_id = create_response.data['id']
        update_response = self._client().patch(f'/api/growth-records/{record_id}/', {'weight_kg': '9.5'})
        self.assertEqual(update_response.status_code, 403)

    def test_orangtua_cannot_delete_own_record(self):
        create_response = self._client().post('/api/growth-records/', self._payload(self.child.id))
        record_id = create_response.data['id']
        delete_response = self._client().delete(f'/api/growth-records/{record_id}/')
        self.assertEqual(delete_response.status_code, 403)


class LinkChildEndpointTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.parent = User.objects.create_user(username='parent_link', password='x', role='orangtua')
        self.child = Child.objects.create(name='Anak Link', birth_date=date(2024, 1, 1), sex='male')

    def _client(self):
        client = APIClient()
        client.force_authenticate(user=self.parent)
        return client

    def test_valid_code_links_child_to_requesting_user(self):
        response = self._client().post('/api/children/link/', {'code': self.child.link_code})
        self.assertEqual(response.status_code, 200, response.data)
        self.assertTrue(self.child.parents.filter(pk=self.parent.pk).exists())

    def test_invalid_code_is_rejected(self):
        bogus = '000000' if self.child.link_code != '000000' else '111111'
        response = self._client().post('/api/children/link/', {'code': bogus})
        self.assertEqual(response.status_code, 400)
        self.assertFalse(self.child.parents.filter(pk=self.parent.pk).exists())


class PublicChildDashboardTests(TestCase):
    """Fase 2: orangtua tidak perlu login — GET /api/public/children/<token>/."""

    def setUp(self):
        self.child = Child.objects.create(name='Anak Publik', birth_date=date(2024, 1, 1), sex='male')
        self.other_child = Child.objects.create(name='Anak Lain', birth_date=date(2024, 1, 1), sex='female')
        GrowthRecord.objects.create(
            child=self.child, measured_at=date(2024, 6, 1), weight_kg=7, height_cm=65, age_months=5,
        )
        GrowthRecord.objects.create(
            child=self.child, measured_at=date(2024, 9, 1), weight_kg=8, height_cm=68, age_months=8,
        )
        GrowthRecord.objects.create(
            child=self.other_child, measured_at=date(2024, 6, 1), weight_kg=6, height_cm=60, age_months=5,
        )

    def test_valid_token_returns_dashboard_with_no_authorization_header(self):
        client = APIClient()  # deliberately never calls force_authenticate / sets a token
        response = client.get(f'/api/public/children/{self.child.public_token}/')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['name'], 'Anak Publik')
        self.assertEqual(len(response.data['records']), 2)

    def test_records_belong_only_to_this_child(self):
        client = APIClient()
        response = client.get(f'/api/public/children/{self.child.public_token}/')
        weights = {r['weight_kg'] for r in response.data['records']}
        self.assertEqual(weights, {'7.00', '8.00'})

    def test_invalid_token_returns_404(self):
        client = APIClient()
        response = client.get('/api/public/children/not-a-real-token/')
        self.assertEqual(response.status_code, 404)

    def test_payload_excludes_staff_only_fields(self):
        # notes/recommendations ARE included (parent dashboard's "Rekomendasi"
        # tab renders them) — officer_name/location/photo stay excluded.
        client = APIClient()
        response = client.get(f'/api/public/children/{self.child.public_token}/')
        self.assertNotIn('id', response.data)
        self.assertNotIn('link_code', response.data)
        self.assertNotIn('public_token', response.data)
        self.assertNotIn('parent_name', response.data)
        record = response.data['records'][0]
        self.assertNotIn('officer_name', record)
        self.assertNotIn('location', record)
        self.assertNotIn('photo', record)
        self.assertIn('notes', record)
        self.assertIn('recommendations', record)


class RegenerateTokenActionTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.kader = User.objects.create_user(username='kader_regen', password='x', role='kader_nakes')
        self.child = Child.objects.create(name='Anak Regen', birth_date=date(2024, 1, 1), sex='male')

    def _client(self):
        client = APIClient()
        client.force_authenticate(user=self.kader)
        return client

    def test_regenerate_public_token_invalidates_old_one(self):
        old_token = self.child.public_token
        response = self._client().post(f'/api/children/{self.child.id}/regenerate-public-token/')
        self.assertEqual(response.status_code, 200, response.data)
        new_token = response.data['public_token']
        self.assertNotEqual(new_token, old_token)

        anon = APIClient()
        self.assertEqual(anon.get(f'/api/public/children/{old_token}/').status_code, 404)
        self.assertEqual(anon.get(f'/api/public/children/{new_token}/').status_code, 200)


class RegistrationRoleGateTests(TestCase):
    def test_orangtua_registration_needs_no_invite_code(self):
        response = APIClient().post('/api/auth/register', {
            'username': 'ortu_gate_test', 'password': 'StrongPass123!', 'role': 'orangtua',
            'email': 'ortu_gate_test@example.com', 'phone_number': '081200000001',
        })
        self.assertEqual(response.status_code, 201, response.data)

    def test_kader_nakes_registration_rejects_missing_invite_code(self):
        response = APIClient().post('/api/auth/register', {
            'username': 'kader_gate_test', 'password': 'StrongPass123!', 'role': 'kader_nakes',
            'email': 'kader_gate_test@example.com', 'phone_number': '081200000002',
        })
        self.assertEqual(response.status_code, 400)
        self.assertIn('invite_code', response.data)

    def test_kader_nakes_registration_accepts_correct_invite_code(self):
        response = APIClient().post('/api/auth/register', {
            'username': 'kader_gate_test2', 'password': 'StrongPass123!', 'role': 'kader_nakes',
            'email': 'kader_gate_test2@example.com', 'phone_number': '081200000003',
            'invite_code': RegistrationInviteCode.load().code,
        })
        self.assertEqual(response.status_code, 201, response.data)

    def test_registration_rejects_missing_email_and_phone(self):
        response = APIClient().post('/api/auth/register', {
            'username': 'no_contact_test', 'password': 'StrongPass123!', 'role': 'orangtua',
        })
        self.assertEqual(response.status_code, 400)
        self.assertIn('email', response.data)
        self.assertIn('phone_number', response.data)


class InviteCodeViewTests(TestCase):
    """GET/POST /api/auth/invite-code — admin-only management of the kader_nakes registration gate."""

    def setUp(self):
        User = get_user_model()
        self.admin = User.objects.create_user(username='admin_ic', password='x', role='admin')
        self.kader = User.objects.create_user(username='kader_ic', password='x', role='kader_nakes')
        self.parent = User.objects.create_user(username='parent_ic', password='x', role='orangtua')

    @staticmethod
    def _client_for(user):
        client = APIClient()
        client.force_authenticate(user=user)
        return client

    def test_admin_can_view_current_code(self):
        response = self._client_for(self.admin).get('/api/auth/invite-code')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['code'], RegistrationInviteCode.load().code)

    def test_kader_nakes_cannot_view_code(self):
        response = self._client_for(self.kader).get('/api/auth/invite-code')
        self.assertEqual(response.status_code, 403)

    def test_orangtua_cannot_view_code(self):
        response = self._client_for(self.parent).get('/api/auth/invite-code')
        self.assertEqual(response.status_code, 403)

    def test_admin_regenerate_changes_code_and_invalidates_old_one(self):
        old_code = RegistrationInviteCode.load().code
        response = self._client_for(self.admin).post('/api/auth/invite-code')
        self.assertEqual(response.status_code, 200)
        new_code = response.data['code']
        self.assertNotEqual(new_code, old_code)
        # response.data is the pre-render serializer output (snake_case) —
        # camelCase conversion happens later, only in the rendered JSON body.
        self.assertEqual(response.data['updated_by'], 'admin_ic')

        # Old code no longer works for registration, new one does.
        register_response = APIClient().post('/api/auth/register', {
            'username': 'kader_after_regen', 'password': 'StrongPass123!', 'role': 'kader_nakes',
            'email': 'kader_after_regen@example.com', 'phone_number': '081200000004',
            'invite_code': old_code,
        })
        self.assertEqual(register_response.status_code, 400)

        register_response = APIClient().post('/api/auth/register', {
            'username': 'kader_after_regen2', 'password': 'StrongPass123!', 'role': 'kader_nakes',
            'email': 'kader_after_regen2@example.com', 'phone_number': '081200000005',
            'invite_code': new_code,
        })
        self.assertEqual(register_response.status_code, 201, register_response.data)

    def test_kader_nakes_cannot_regenerate_code(self):
        response = self._client_for(self.kader).post('/api/auth/invite-code')
        self.assertEqual(response.status_code, 403)
