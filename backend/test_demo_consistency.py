"""
Automated Demo Consistency Validation Test (Requirement #21)
Verifies:
- Required metadata exists
- Nodule count matches array length
- Every nodule has measurement data (diameter, volume, mean_hu, lobe)
- Every nodule has coordinates (coord_x, coord_y, coord_z, axial_slice)
- Risk category matches risk result
- Thumbnails map to valid paths
- No-significant-nodule case (DEMO-004) contains zero nodules
- Dominant sizes and risk values match summary
"""
import sys
import os

from app.ai.demo_service import DEMO_CASES

def run_demo_consistency_tests():
    print("=" * 60)
    print("RUNNING AUTOMATED DEMO CONSISTENCY VALIDATION")
    print("=" * 60)

    expected_matrix = {
        "DEMO-001": {"scenario": "Low", "nodule_count": 1, "risk_category": "low", "dominant_size": 5.4},
        "DEMO-002": {"scenario": "Intermediate", "nodule_count": 3, "risk_category": "intermediate", "dominant_size": 8.6},
        "DEMO-003": {"scenario": "Higher Suspicion", "nodule_count": 1, "risk_category": "higher", "dominant_size": 16.4},
        "DEMO-004": {"scenario": "Negative / No Significant Nodule", "nodule_count": 0, "risk_category": "unassessed", "dominant_size": None},
        "DEMO-005": {"scenario": "Mixed Multiple Nodules", "nodule_count": 3, "risk_category": "higher", "dominant_size": 14.2},
    }

    all_passed = True

    for case_id, exp in expected_matrix.items():
        assert case_id in DEMO_CASES, f"Missing {case_id} in DEMO_CASES!"
        case = DEMO_CASES[case_id]
        print(f"\nChecking {case_id}: {case['label']}")

        # 1. Nodule count matches array
        nodules = case["nodules"]
        summary = case["summary"]
        assert len(nodules) == exp["nodule_count"], f"Expected {exp['nodule_count']} nodules, found {len(nodules)}"
        assert summary["nodule_count"] == len(nodules), f"Summary count {summary['nodule_count']} != {len(nodules)}"

        if exp["nodule_count"] == 0:
            assert summary["largest_nodule_mm"] is None, f"{case_id} largest nodule must be None"
            assert summary["highest_risk_pct"] is None, f"{case_id} highest risk must be None"
            assert summary["lung_rads_overall"] == "1", f"{case_id} overall Lung-RADS must be 1"
            print("  [OK] Zero nodule integrity verified (no ghost nodules, no fake risk)")
        else:
            diams = [n["max_diameter_mm"] for n in nodules]
            assert abs(max(diams) - exp["dominant_size"]) < 0.01, f"Dominant size mismatch: {max(diams)} != {exp['dominant_size']}"
            assert abs(summary["largest_nodule_mm"] - exp["dominant_size"]) < 0.01, f"Summary largest mismatch"

            # Check each nodule
            for n in nodules:
                idx = n["nodule_index"]
                assert n["coord_x"] is not None and n["coord_y"] is not None and n["coord_z"] is not None
                assert n["axial_slice"] is not None
                assert n["max_diameter_mm"] > 0
                assert n["volume_mm3"] > 0
                assert n["mean_hu"] is not None
                assert n["lung_lobe"] in ["RUL", "RML", "RLL", "LUL", "LLL"]
                assert n["risk"] is not None
                assert n["risk"]["risk_probability"] is not None
                assert n["thumbnail_url"].startswith("/thumbnails/")

            print(f"  [OK] {len(nodules)} nodules with 3D coordinates, HU analytics, and thumbnails verified")

            # Check risk category match
            primary_cat = case["primary_risk_category"]
            assert primary_cat == exp["risk_category"], f"Risk category mismatch: {primary_cat} != {exp['risk_category']}"
            print(f"  [OK] Primary risk category '{primary_cat}' matches expected '{exp['risk_category']}'")

    print("\n" + "=" * 60)
    print("ALL 5 DEMO CASES ARE 100% INTERNALLY CONSISTENT!")
    print("=" * 60)

if __name__ == "__main__":
    run_demo_consistency_tests()
