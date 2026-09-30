import urllib.request, json, time

if __name__ == "__main__":
    req = urllib.request.Request(
        'http://localhost:8000/api/cases',
        data=json.dumps({'is_demo': True, 'demo_case_id': 'DEMO-003'}).encode(),
        headers={'Content-Type': 'application/json'},
        method='POST'
    )
    r = urllib.request.urlopen(req)
    case = json.loads(r.read())
    print('Created:', case['case_id'], 'status:', case['status'])
    time.sleep(3)

    r2 = urllib.request.urlopen('http://localhost:8000/api/cases/' + case['id'] + '/results')
    results = json.loads(r2.read())
    print('Status:', results['status'])
    print('Nodules:', len(results['nodules']))
    for n in results['nodules']:
        idx = n['nodule_index']
        diam = n['max_diameter_mm']
        risk = n['risk_assessments'][0]['risk_probability'] if n['risk_assessments'] else None
        print(f'  Nodule {idx}: {diam} mm, risk: {risk}')

    print('Summary:', results.get('summary', {}).get('conclusion', '')[:80])
