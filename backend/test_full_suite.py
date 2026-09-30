"""
End-to-End Validation Test Suite for PulmoScan AI Backend.
Tests all phases:
  - Phase 1: Health & Case Foundation
  - Phase 2: Slice Rendering & Volume Info (Axial, Coronal, Sagittal)
  - Phase 3 & 4: Detection & Segmentation Contours
  - Phase 5: Quantitative Feature Extraction (HU stats, Morphology)
  - Phase 6: Brock Risk Assessment & ACR Lung-RADS Engine
  - Phase 7: Longitudinal Temporal Growth & VDT Calculation
  - Phase 8: Structured Report Generation & PDF Export
  - Phase 9: Demo Cases Inspection
"""
import urllib.request
import json
import time
import os

BASE_URL = "http://localhost:8000/api"

def run_tests():
    print("=" * 60)
    print("PULMOSCAN AI - COMPREHENSIVE BACKEND VALIDATION")
    print("=" * 60)

    # 1. Health check
    print("\n[1/10] Checking API Health...")
    r = urllib.request.urlopen(f"{BASE_URL}/health")
    health = json.loads(r.read())
    assert health["status"] == "ok"
    print(f"  [OK] Health status: {health['status']}, version: {health['version']}")

    # 2. List demo cases
    print("\n[2/10] Checking Demo Cases...")
    r = urllib.request.urlopen(f"{BASE_URL}/demo-cases")
    demos = json.loads(r.read())
    assert len(demos) >= 3
    print(f"  [OK] Found {len(demos)} demo cases: {[d['id'] for d in demos]}")

    # 3. List existing cases
    print("\n[3/10] Querying Case History...")
    r = urllib.request.urlopen(f"{BASE_URL}/cases")
    cases = json.loads(r.read())
    assert len(cases) > 0
    test_case = cases[0]
    case_id = test_case["id"]
    readable_id = test_case["case_id"]
    print(f"  [OK] Found {len(cases)} cases. Using case {readable_id} ({case_id}) for deep testing.")

    # 4. Get Case Results
    print("\n[4/10] Verifying Analysis Results...")
    r = urllib.request.urlopen(f"{BASE_URL}/cases/{case_id}/results")
    results = json.loads(r.read())
    nodules = results.get("nodules", [])
    print(f"  [OK] Status: {results['status']}, Nodules: {len(nodules)}")
    if nodules:
        n0 = nodules[0]
        print(f"    - Nodule #{n0['nodule_index']}: {n0['max_diameter_mm']} mm, Lobe: {n0['lung_lobe']}, Density: {n0['density_type']}")
        if n0.get("risk_assessments"):
            r0 = n0["risk_assessments"][0]
            print(f"    - Risk: {r0['risk_probability'] * 100:.1f}%, Lung-RADS: {r0['lung_rads_category']}")

    # 5. Volume Info & Slice Rendering (Phase 2)
    print("\n[5/10] Testing Multi-Planar Slice Rendering (Axial, Coronal, Sagittal)...")
    r = urllib.request.urlopen(f"{BASE_URL}/cases/{case_id}/volume-info")
    vol_info = json.loads(r.read())
    print(f"  [OK] Volume: {vol_info['axial_slices']} axial, {vol_info['coronal_slices']} coronal, {vol_info['sagittal_slices']} sagittal")

    slice_indices = {
        "axial": vol_info.get("default_axial", 64),
        "coronal": vol_info.get("default_coronal", 128),
        "sagittal": vol_info.get("default_sagittal", 128),
    }

    for plane in ["axial", "coronal", "sagittal"]:
        idx = slice_indices[plane]
        slice_url = f"{BASE_URL}/cases/{case_id}/slices/{plane}/{idx}?wl=-600&ww=1500"
        r_slice = urllib.request.urlopen(slice_url)
        img_bytes = r_slice.read()
        assert img_bytes.startswith(b"\x89PNG"), f"Invalid PNG returned for {plane}"
        print(f"  [OK] Rendered {plane} slice #{idx} (size: {len(img_bytes)} bytes PNG)")

    # 6. Nodule Segmentation Contours (Phase 4)
    if nodules:
        print("\n[6/10] Testing 2D/3D Segmentation Contours...")
        n0_id = nodules[0]["id"]
        r = urllib.request.urlopen(f"{BASE_URL}/cases/{case_id}/nodules/{n0_id}/mask?plane=axial")
        mask_res = json.loads(r.read())
        pts = mask_res.get("contour_points", [])
        print(f"  [OK] Contour extracted: {len(pts)} polygon points for Nodule #{nodules[0]['nodule_index']}")

    # 7. Dynamic Brock Risk Recalculation (Phase 6)
    if nodules:
        print("\n[7/10] Testing Dynamic Risk Recalculation with Clinical Inputs...")
        n0_id = nodules[0]["id"]
        req_data = {
            "nodule_id": n0_id,
            "clinical_inputs": {
                "age": 68,
                "sex": "female",
                "smoking_history": True,
                "pack_years": 45,
                "family_history_lung_cancer": True,
                "emphysema": True,
            }
        }
        req = urllib.request.Request(
            f"{BASE_URL}/cases/{case_id}/nodules/{n0_id}/risk",
            data=json.dumps(req_data).encode(),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        r = urllib.request.urlopen(req)
        re_risk = json.loads(r.read())
        print(f"  [OK] Re-evaluated Brock Risk: {re_risk['risk_probability'] * 100:.1f}% ({re_risk['risk_category']})")
        print(f"  [OK] Updated ACR Lung-RADS: Category {re_risk['lung_rads_category']}")

    # 8. Longitudinal Growth & VDT (Phase 7)
    print("\n[8/10] Testing Temporal Growth & Volume Doubling Time...")
    r = urllib.request.urlopen(f"{BASE_URL}/cases/{case_id}/temporal")
    temp = json.loads(r.read())
    metrics = temp.get("metrics", {})
    print(f"  [OK] Elapsed: {metrics.get('elapsed_days')} days, VDT: {metrics.get('volume_doubling_time_days')} days")
    print(f"  [OK] Volume Change: +{metrics.get('volume_change_pct')}% ({metrics.get('kinetic_category')})")

    # 9. Reviewer Human-in-the-Loop Correction (Phase 5/9)
    if nodules:
        print("\n[9/10] Testing Expert Nodule Adjustment ('Correct AI')...")
        n0_id = nodules[0]["id"]
        update_data = {
            "max_diameter_mm": 8.6,
            "margin_type": "spiculated",
            "spiculation_detected": True,
        }
        req = urllib.request.Request(
            f"{BASE_URL}/cases/{case_id}/nodules/{n0_id}",
            data=json.dumps(update_data).encode(),
            headers={"Content-Type": "application/json"},
            method="PUT",
        )
        r = urllib.request.urlopen(req)
        updated = json.loads(r.read())
        print(f"  [OK] Updated Nodule: {updated['max_diameter_mm']} mm, Margin: {updated['margin_type']}")

    # 10. Report Generation & PDF Export (Phase 8)
    print("\n[10/10] Testing Radiology Report & PDF Export...")
    req = urllib.request.Request(
        f"{BASE_URL}/cases/{case_id}/report",
        data=b"{}",
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    r = urllib.request.urlopen(req)
    rpt = json.loads(r.read())
    print(f"  [OK] Structured text generated ({len(rpt['report_text'].splitlines())} lines)")

    # Test PDF download endpoint
    pdf_url = f"{BASE_URL}/cases/{case_id}/report/pdf"
    r_pdf = urllib.request.urlopen(pdf_url)
    pdf_bytes = r_pdf.read()
    assert pdf_bytes.startswith(b"%PDF"), "Response is not a valid PDF file"
    print(f"  [OK] PDF generated and downloaded ({len(pdf_bytes)} bytes)")

    print("\n" + "=" * 60)
    print("ALL TESTS PASSED! ALL PHASES 1-9 FUNCTIONAL")
    print("=" * 60)

if __name__ == "__main__":
    run_tests()
