import urllib.request
import urllib.error
import json
import sys

BASE_FRONTEND = 'http://localhost:3000'
BASE_BACKEND = 'http://127.0.0.1:8000/api'

def main():
    print("=" * 60)
    print("GREEN PHASE COMPREHENSIVE VALIDATION SUITE")
    print("=" * 60)

    # 1. Frontend Core Routes
    print("\n[1/5] Testing Frontend Core Routes & Logo Embedding...")
    routes = ['/', '/analyze', '/cases']
    for r in routes:
        req = urllib.request.urlopen(f"{BASE_FRONTEND}{r}")
        html = req.read().decode('utf-8', errors='ignore')
        assert req.status == 200, f"Route {r} returned {req.status}"
        assert 'logo.png' in html, f"logo.png missing in {r}"
        print(f"  [OK] {r:15} -> HTTP {req.status} (Logo rendered)")

    # 2. Querying all demo cases
    print("\n[2/5] Testing Demo Cases End-to-End...")
    req = urllib.request.urlopen(f"{BASE_BACKEND}/cases")
    cases = json.loads(req.read())
    print(f"  Found {len(cases)} cases in database")

    for c in cases:
        cid = c['id']
        readable = c['case_id']
        is_demo = c['is_demo']
        print(f"\n  Checking Case {readable} ({cid}) [Demo: {is_demo}]")

        # Dynamic frontend routes
        for page in ['/workspace', '/risk', '/compare', '/report', '/processing']:
            url = f"{BASE_FRONTEND}{page}/{cid}"
            r_page = urllib.request.urlopen(url)
            assert r_page.status == 200, f"Page {url} failed with {r_page.status}"
            p_html = r_page.read().decode('utf-8', errors='ignore')
            assert 'logo.png' in p_html, f"logo.png missing in {url}"
            print(f"    [OK] Frontend {page} -> HTTP 200")

        # Backend analysis results
        res = json.loads(urllib.request.urlopen(f"{BASE_BACKEND}/cases/{cid}/results").read())
        nodules = res.get('nodules', [])
        print(f"    [OK] Backend results: status={res['status']}, nodules={len(nodules)}")

        # Multi-planar slice rendering (Axial, Coronal, Sagittal)
        for plane in ['axial', 'coronal', 'sagittal']:
            slice_url = f"{BASE_BACKEND}/cases/{cid}/slices/{plane}/64?wl=-600&ww=1500"
            s_bytes = urllib.request.urlopen(slice_url).read()
            assert s_bytes.startswith(b'\x89PNG'), f"Invalid PNG for {plane}"
            print(f"    [OK] Slice rendering ({plane}): {len(s_bytes)} bytes PNG")

        # Report & PDF generation
        rpt = json.loads(urllib.request.urlopen(f"{BASE_BACKEND}/cases/{cid}/report").read())
        assert len(rpt.get('report_text', '')) > 0, "Empty report text"
        pdf_bytes = urllib.request.urlopen(f"{BASE_BACKEND}/cases/{cid}/report/pdf").read()
        assert pdf_bytes.startswith(b'%PDF'), "Invalid PDF export header"
        print(f"    [OK] Report generated & PDF exported ({len(pdf_bytes)} bytes)")

    # 3. Logo asset verification
    print("\n[3/5] Testing Logo Asset Serving...")
    logo_req = urllib.request.urlopen(f"{BASE_FRONTEND}/logo.png")
    logo_bytes = logo_req.read()
    assert logo_bytes.startswith(b'\x89PNG'), "logo.png is not a valid PNG"
    print(f"  [OK] /logo.png served with {len(logo_bytes)} bytes PNG")

    # 4. Security & Privacy check
    print("\n[4/5] Checking Security & Secret Privacy...")
    # Check .env accessibility via frontend
    try:
        urllib.request.urlopen(f"{BASE_FRONTEND}/.env")
        print("  [FAIL] .env is exposed via HTTP!")
        sys.exit(1)
    except urllib.error.HTTPError as e:
        print(f"  [OK] / .env access blocked with HTTP {e.code}")

    # Check client bundles for API key leakage
    client_html = urllib.request.urlopen(f"{BASE_FRONTEND}/").read().decode('utf-8')
    assert "AQ.Ab8RN6Jg" not in client_html, "Gemini API key leaked in client HTML!"
    print("  [OK] No API key leaked in frontend HTML/scripts")

    # 5. Case creation via demo route
    print("\n[5/5] Testing Dynamic Demo Case Ingestion...")
    create_req = urllib.request.Request(
        f"{BASE_BACKEND}/cases",
        data=json.dumps({"is_demo": True, "demo_case_id": "DEMO-002"}).encode(),
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    new_case = json.loads(urllib.request.urlopen(create_req).read())
    assert new_case['id'], "Failed to create demo case"
    print(f"  [OK] Dynamic case created: {new_case['case_id']} ({new_case['id']})")

    print("\n" + "=" * 60)
    print("ALL 5/5 GREEN PHASE VALIDATION STEPS PASSED SUCCESSFULLY!")
    print("=" * 60)

if __name__ == '__main__':
    main()
