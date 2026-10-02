"""Tests for scripts/analyse.py and scripts/groundtruth.py against synthetic data with known effects.

    python -m unittest discover -s scripts/tests -v
"""
import math
import sys
import tempfile
import unittest
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))  # scripts/
sys.path.insert(0, str(Path(__file__).resolve().parent))         # scripts/tests/

import analyse  # noqa: E402
import groundtruth  # noqa: E402
import synthetic  # noqa: E402


class AnalysisTestCase(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)

    def tearDown(self):
        self.tmp.cleanup()

    def run_pipeline(self, telemetry, declination=0.0, threshold=30.0):
        synthetic.write_site(self.root, declination)
        path = self.root / "telemetry.csv"
        telemetry.to_csv(path, index=False)
        return analyse.run(synthetic.SITE, path, self.root / "out", data_dir=self.root, threshold=threshold)


class TestStudy2(AnalysisTestCase):
    def test_recovers_planted_distance_bound(self):
        t, _ = synthetic.make_telemetry(seed=1)
        s2 = self.run_pipeline(t)["study2"]
        expected = synthetic.expected_bound()
        # Sampling noise may move the crossing by one bin, never more.
        self.assertLessEqual(abs(s2["anchor_distance_bound_m"] - expected), 5.0, s2["bound_note"])
        self.assertTrue(s2["bound_exceeded_within_data"])

    def test_bound_holds_on_held_out_runs_and_devices(self):
        t, _ = synthetic.make_telemetry(seed=2)
        s2 = self.run_pipeline(t)["study2"]
        for key in ("holdout_by_run", "holdout_by_device"):
            h = s2[key]
            self.assertIsNotNone(h, key)
            # Derived as a 95th-percentile bound, so held-out coverage should sit near 95%.
            self.assertGreaterEqual(h["mean_coverage"], 0.90, key)
            self.assertLessEqual(h["mean_coverage"], 1.0, key)
        self.assertEqual(len(s2["holdout_by_device"]["folds"]), len(synthetic.DEVICES))

    def test_anchor_reset_beats_raw_compass(self):
        t, _ = synthetic.make_telemetry(seed=3)
        s2 = self.run_pipeline(t)["study2"]
        self.assertGreater(s2["raw_compass_p95_abs_error_overall_deg"], s2["p95_abs_error_first_bin_deg"])

    def test_bound_beyond_data_when_never_exceeded(self):
        t, _ = synthetic.make_telemetry(seed=4)
        s2 = self.run_pipeline(t, threshold=170.0)["study2"]
        self.assertFalse(s2["bound_exceeded_within_data"])

    def test_writes_all_figures(self):
        t, _ = synthetic.make_telemetry(seed=5, runs_per_device=2)
        self.run_pipeline(t)
        for name in ["fig1_study1_error_map.png", "fig2_study1_error_by_device.png",
                     "fig3_study2_error_vs_distance.png", "fig4_study2_by_device.png",
                     "table_devices.csv", "study1_points.csv", "study2_bins.csv", "summary.json"]:
            self.assertTrue((self.root / "out" / name).exists(), name)


class TestStudy1(AnalysisTestCase):
    def test_recovers_planted_point_bias(self):
        bias = lambda d, k: (-12 + 3 * k) * (1 + 0.1 * d)  # noqa: E731
        t, planted = synthetic.make_telemetry(seed=6, runs_per_device=1, point_bias=bias)
        self.run_pipeline(t)
        pts = pd.read_csv(self.root / "out" / "study1_points.csv", dtype={"point_id": str})
        for r in pts.itertuples():
            self.assertAlmostEqual(r.error, planted[(r.device, r.point_id)], delta=0.6)

    def test_applies_magnetic_declination(self):
        t, planted = synthetic.make_telemetry(seed=7, runs_per_device=1, point_bias=lambda d, k: 0.0, declination=2.0)
        s1 = self.run_pipeline(t, declination=2.0)["study1"]
        self.assertLess(s1["max_abs_error_deg"], 1.0)

    def test_excludes_relative_heading(self):
        t, _ = synthetic.make_telemetry(seed=8, runs_per_device=1)
        relative = t.device_model == "iPhone"
        t.loc[relative, "absolute_flag"] = "false"
        s1 = self.run_pipeline(t)["study1"]
        self.assertEqual(s1["n_devices"], len(synthetic.DEVICES) - 1)


class TestDataQuality(AnalysisTestCase):
    def test_flags_injected_problems(self):
        t, _ = synthetic.make_telemetry(seed=9, runs_per_device=1)
        t.loc[t.index[:3], "raw_heading"] = 400.0
        t.loc[t.index[3:8], "sample_age_ms"] = 5000
        dup = t.iloc[[10, 11]]
        t = pd.concat([t, dup], ignore_index=True)
        q = self.run_pipeline(t)["data_quality"]["issues"]
        self.assertEqual(q["raw_heading_out_of_range"], 3)
        self.assertEqual(q["stale_sensor_reading"], 5)
        self.assertEqual(q["duplicate_session_timestamp"], 2)

    def test_clean_data_has_no_issues(self):
        t, _ = synthetic.make_telemetry(seed=10, runs_per_device=1)
        q = self.run_pipeline(t)["data_quality"]
        # Study 1 rows have no smoothed/corrected heading, which is expected, not an issue.
        self.assertEqual(q["issues"], {})
        self.assertAlmostEqual(q["median_sample_interval_ms"], 200, delta=1)


class TestGroundTruth(unittest.TestCase):
    def test_cardinal_bearings(self):
        self.assertAlmostEqual(groundtruth.true_bearing(19.0, 72.8, 19.001, 72.8), 0.0, places=6)
        self.assertAlmostEqual(groundtruth.true_bearing(19.0, 72.8, 19.0, 72.801), 90.0, delta=0.01)
        self.assertAlmostEqual(groundtruth.true_bearing(19.001, 72.8, 19.0, 72.8), 180.0, places=6)
        self.assertAlmostEqual(groundtruth.true_bearing(19.0, 72.801, 19.0, 72.8), 270.0, delta=0.01)

    def test_haversine_length(self):
        # 0.001 deg of latitude is ~111.2 m everywhere.
        self.assertAlmostEqual(groundtruth.haversine_m(19.0, 72.8, 19.001, 72.8), 111.19, delta=0.1)

    def test_wrap180(self):
        self.assertEqual(groundtruth.wrap180(190), -170)
        self.assertEqual(groundtruth.wrap180(-190), 170)
        self.assertEqual(groundtruth.wrap180(180), -180)


class TestInputValidation(unittest.TestCase):
    def test_reference_lines(self):
        good = pd.DataFrame([{"line_id": "L1", "lat1": 19.0, "lon1": 72.8, "lat2": 19.001, "lon2": 72.8, "map_bearing_deg": 0}])
        self.assertEqual(groundtruth.validate_lines(good), [])
        bad = pd.DataFrame([
            {"line_id": "L1", "lat1": 95.0, "lon1": 72.8, "lat2": 19.001, "lon2": 72.8, "map_bearing_deg": 0},
            {"line_id": "L2", "lat1": 19.0, "lon1": 72.8, "lat2": 19.0, "lon2": 72.8, "map_bearing_deg": 360},
        ])
        problems = " | ".join(groundtruth.validate_lines(bad))
        self.assertIn("L1: lat1", problems)
        self.assertIn("L2: map_bearing_deg", problems)
        self.assertIn("L2: both ends", problems)
        self.assertEqual(groundtruth.validate_lines(pd.DataFrame({"line_id": ["L1"]})),
                         ["missing columns: lat1, lon1, lat2, lon2, map_bearing_deg"])

    def test_survey_points(self):
        self.assertEqual(analyse.validate_survey(synthetic.SURVEY.astype({"point_id": str})), [])
        bad = pd.DataFrame([{"point_id": "P1", "x": 0, "y": 0, "align_map_bearing_deg": 0},
                            {"point_id": "P1", "x": "?", "y": 1, "align_map_bearing_deg": -5}])
        problems = " | ".join(analyse.validate_survey(bad))
        self.assertIn("duplicate point_id: P1", problems)
        self.assertIn("x must be a number", problems)
        self.assertIn("align_map_bearing_deg", problems)

    def test_template_site_files_are_valid(self):
        site = Path(__file__).resolve().parents[2] / "data" / "sites" / "_template"
        self.assertEqual(groundtruth.validate_lines(pd.read_csv(site / "reference_lines.csv")), [])
        self.assertEqual(analyse.validate_survey(pd.read_csv(site / "survey_points.csv", dtype={"point_id": str})), [])


class TestCircularStats(unittest.TestCase):
    def test_mean_across_north(self):
        self.assertAlmostEqual(analyse.wrap180(analyse.circ_mean([359, 1]))[()], 0.0, places=6)

    def test_std_of_constant_is_zero(self):
        self.assertAlmostEqual(analyse.circ_std([45, 45, 45]), 0.0, places=3)

    def test_map_bearing_axes(self):
        np.testing.assert_allclose(analyse.map_bearing(np.array([0, 1, 0, -1]), np.array([1, 0, -1, 0])),
                                   [0, 90, 180, 270], atol=1e-9)


if __name__ == "__main__":
    unittest.main()
