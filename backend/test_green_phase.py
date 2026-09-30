"""
PulmoScan AI — Green Phase Comprehensive Automated Validation Suite.

Validates all Green Phase criteria:
1. Supported Image/CT Extensions: .dcm, .zip, .nii, .nii.gz, .png, .jpg, .jpeg
2. Supported Video Extensions: .mp4, .mkv, .mov, .webm, .avi
3. Unsupported file rejection (400)
4. Oversized upload rejection (413)
5. Input type and analysis mode classification & database persistence
6. 2D Photo/Image is NOT treated as 3D CT (no fabricated voxel spacing / 3D nodules)
7. CT Video is NOT treated as 3D CT
8. Gemini service stabilization (configurable model, missing key fallback, no leaks)
9. End-to-end Demo case workflow
10. All API endpoints & routes responsiveness
"""

import os
import io
import json
import urllib.request
import urllib.error
import http.client
from datetime import datetime

BASE_URL = "http://localhost:8000/api"

def upload_mock_file(filename: str, content: bytes) -> tuple[int, dict]:
    boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW"
    body = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\n'
        f"Content-Type: application/octet-stream\r\n\r\n"
    ).encode("utf-8") + content + f"\r\n--{boundary}--\r\n".encode("utf-8")

    req = urllib.request.Request(
        f"{BASE_URL}/cases/upload",
        data=body,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        try:
            return e.code, json.loads(body)
        except Exception:
            return e.code, {"detail": body}

def run_green_validation():
    print("=" * 65)
    print("PULMOSCAN AI — GREEN PHASE VALIDATION SUITE")
    print("=" * 65)

    # 1. API Health Check
    print("\n[Test 1] Backend Health & Status")
    with urllib.request.urlopen(f"{BASE_URL}/health") as resp:
        assert resp.status == 200
        health = json.loads(resp.read().decode())
        assert health["status"] == "ok"
        print(f"  ✓ Backend healthy: {health['status']}, version: {health['version']}")

    # 2. Test Supported Image / CT Upload Formats
    print("\n[Test 2] Supported Image / CT Upload Formats (.png, .jpg, .jpeg, .dcm, .zip, .nii, .nii.gz)")
    image_formats = [
        ("scan_slice.png", b"\x89PNG\r\n\x1a\n" + b"\x00" * 64, "image", "image_review"),
        ("chest_photo.jpg", b"\xff\xd8\xff\xe0" + b"\x00" * 64, "image", "image_review"),
        ("chest_photo.jpeg", b"\xff\xd8\xff\xe0" + b"\x00" * 64, "image", "image_review"),
        ("study.dcm", b"\x00" * 128 + b"DICM" + b"\x00" * 64, "dicom", "volumetric_ct"),
        ("series.zip", b"PK\x03\x04" + b"\x00" * 64, "dicom", "volumetric_ct"),
        ("volume.nii", b"\x00" * 348 + b"\x00" * 64, "nifti", "volumetric_ct"),
        ("volume.nii.gz", b"\x1f\x8b\x08" + b"\x00" * 64, "nifti", "volumetric_ct"),
    ]

    for fname, data, exp_type, exp_mode in image_formats:
        status, res = upload_mock_file(fname, data)
        assert status == 200, f"Failed to upload {fname}: {res}"
        assert res["input_type"] == exp_type, f"Expected {exp_type}, got {res.get('input_type')}"
        assert res["analysis_mode"] == exp_mode, f"Expected {exp_mode}, got {res.get('analysis_mode')}"
        print(f"  ✓ {fname}: status=200, input_type='{res['input_type']}', analysis_mode='{res['analysis_mode']}'")

    # 3. Test Supported Video Upload Formats
    print("\n[Test 3] Supported Video Formats (.mp4, .mkv, .mov, .webm, .avi)")
    video_formats = [
        ("cine_study.mp4", b"\x00\x00\x00\x18ftypmp42" + b"\x00" * 64),
        ("cine_study.mkv", b"\x1a\x45\xdf\xa3" + b"\x00" * 64),
        ("cine_study.mov", b"\x00\x00\x00\x14ftypqt  " + b"\x00" * 64),
        ("cine_study.webm", b"\x1a\x45\xdf\xa3\x9f\x42\x86\x81\x01" + b"\x00" * 64),
        ("cine_study.avi", b"RIFF" + b"\x00\x00\x00\x00" + b"AVI " + b"\x00" * 64),
    ]

    for fname, data in video_formats:
        status, res = upload_mock_file(fname, data)
        assert status == 200, f"Failed to upload {fname}: {res}"
        assert res["input_type"] == "video", f"Expected video, got {res.get('input_type')}"
        assert res["analysis_mode"] == "video_review", f"Expected video_review, got {res.get('analysis_mode')}"
        print(f"  ✓ {fname}: status=200, input_type='video', analysis_mode='video_review'")

    # 4. Test Unsupported File Rejection (400)
    print("\n[Test 4] Unsupported File Rejection")
    bad_files = ["malware.exe", "document.pdf", "data.csv", "archive.tar"]
    for bname in bad_files:
        status, res = upload_mock_file(bname, b"some content")
        assert status == 400, f"Expected 400 for {bname}, got {status}: {res}"
        assert "Unsupported file type" in res.get("detail", "")
        print(f"  ✓ {bname}: correctly rejected with 400: '{res.get('detail')}'")

    # 5. Test Oversized Upload Rejection (413)
    print("\n[Test 5] Oversized Upload Limit Enforcement (500 MB)")
    # Test boundary by simulating size header or setting settings.MAX_UPLOAD_SIZE_MB temporarily
    from app.core.config import settings
    orig_limit = settings.MAX_UPLOAD_SIZE_MB
    try:
        settings.MAX_UPLOAD_SIZE_MB = 1  # 1 MB threshold for test
        large_content = b"0" * (2 * 1024 * 1024)  # 2 MB
        status, res = upload_mock_file("oversized_test.png", large_content)
        assert status == 413, f"Expected 413 for oversized file, got {status}: {res}"
        assert "File too large" in res.get("detail", "")
        print(f"  ✓ Oversized upload (2 MB vs 1 MB limit): rejected with 413: '{res.get('detail')}'")
    finally:
        settings.MAX_UPLOAD_SIZE_MB = orig_limit

    # 6. Verify 2D Photo / Video is NOT treated as 3D CT
    print("\n[Test 6] Verification: 2D Photo / Video Not Treated as 3D CT")
    # Upload photo
    status, photo_case = upload_mock_file("nodule_photo.png", b"\x89PNG\r\n\x1a\n" + b"\x00" * 32)
    assert photo_case["analysis_mode"] == "image_review"
    # Inspect metadata from results
    with urllib.request.urlopen(f"{BASE_URL}/cases/{photo_case['id']}/results") as resp:
        results = json.loads(resp.read().decode())
        sm = results.get("scan_metadata", {})
        assert sm.get("slice_thickness_mm") is None, "Slice thickness should not be fabricated for 2D photo"
        assert sm.get("pixel_spacing_x") is None, "Pixel spacing should not be fabricated for 2D photo"
        assert sm.get("modality") == "PHOTO / 2D IMAGE"
        print(f"  ✓ 2D Photo case ({photo_case['case_id']}): modality='{sm['modality']}', slice_thickness=None, pixel_spacing=None")

    # Upload video
    status, vid_case = upload_mock_file("scan_cine.mp4", b"\x00\x00\x00\x18ftypmp42" + b"\x00" * 32)
    assert vid_case["analysis_mode"] == "video_review"
    with urllib.request.urlopen(f"{BASE_URL}/cases/{vid_case['id']}/results") as resp:
        v_results = json.loads(resp.read().decode())
        v_sm = v_results.get("scan_metadata", {})
        assert v_sm.get("slice_thickness_mm") is None, "Slice thickness should not be fabricated for video"
        assert v_sm.get("modality") == "CT VIDEO"
        print(f"  ✓ CT Video case ({vid_case['case_id']}): modality='{v_sm['modality']}', slice_thickness=None")

    # 7. Gemini Service Stabilization & Security
    print("\n[Test 7] Gemini Service Stabilization & Security")
    from app.services.gemini_service import GeminiService
    # Test configured model
    assert hasattr(settings, "GEMINI_MODEL"), "settings must have GEMINI_MODEL"
    print(f"  ✓ GEMINI_MODEL setting present: '{settings.GEMINI_MODEL}'")

    # Test missing key fallback
    g_service = GeminiService()
    fallback_expl = g_service.explain_finding({"max_diameter_mm": 6.8, "density_type": "part_solid"})
    assert len(fallback_expl) > 20, "Fallback explanation should be clinically grounded and non-empty"
    assert "Lesion Dimensions" in fallback_expl or "6.8" in fallback_expl
    print("  ✓ Gemini fallback explanation works cleanly without throwing error")

    # Test key absence from API responses
    with urllib.request.urlopen(f"{BASE_URL}/cases") as resp:
        cases_json = resp.read().decode()
        assert "AIza" not in cases_json and "GEMINI" not in cases_json
        print("  ✓ No Gemini API key or credentials exposed in /cases response")

    # 8. Demo Case Workflow End-to-End
    print("\n[Test 8] Demo Case Workflow End-to-End")
    # Query demo list
    with urllib.request.urlopen(f"{BASE_URL}/demo-cases") as resp:
        demos = json.loads(resp.read().decode())
        assert len(demos) == 3
        print(f"  ✓ Demo cases available: {[d['id'] for d in demos]}")

    # Create demo case
    req_body = json.dumps({"is_demo": True, "demo_case_id": "DEMO-002"}).encode("utf-8")
    req = urllib.request.Request(
        f"{BASE_URL}/cases",
        data=req_body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req) as resp:
        demo_case = json.loads(resp.read().decode())
        assert demo_case["is_demo"] is True
        print(f"  ✓ Loaded demo case: {demo_case['case_id']} ({demo_case['id']})")

    # 9. Verify All Current Endpoints
    print("\n[Test 9] All Route Status Checks")
    cid = demo_case["id"]
    endpoints = [
        f"/cases",
        f"/cases/{cid}",
        f"/cases/{cid}/results",
        f"/cases/{cid}/volume-info",
        f"/cases/{cid}/temporal",
        f"/cases/{cid}/report",
        f"/cases/{cid}/report/pdf",
    ]
    for ep in endpoints:
        with urllib.request.urlopen(f"{BASE_URL}{ep}") as resp:
            assert resp.status == 200
            print(f"  ✓ {ep}: HTTP 200 OK")

    print("\n" + "=" * 65)
    print("GREEN PHASE VALIDATION COMPLETE: ALL 9 TEST SUITES PASSED!")
    print("=" * 65)

if __name__ == "__main__":
    run_green_validation()
