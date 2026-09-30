import sqlite3
import uuid
import json
import datetime
import os
import numpy as np

conn = sqlite3.connect('pulmoscan.db')
c = conn.cursor()

case_id = '14fb0a3b-a5ea-4870-88b8-94442000ba56'

# Delete old nodules for this case
c.execute('DELETE FROM risk_assessments WHERE nodule_id IN (SELECT id FROM nodules WHERE case_id = ?)', (case_id,))
c.execute('DELETE FROM nodules WHERE case_id = ?', (case_id,))

nodules_data = [
    {
        'index': 1,
        'coord_x': 144.0, 'coord_y': 246.0, 'coord_z': 58.0,
        'max_d': 14.2, 'min_d': 11.8, 'mean_d': 13.0, 'vol': 1240.0,
        'mean_hu': 15.2, 'median_hu': 18.0, 'min_hu': -80.0, 'max_hu': 175.0, 'std_hu': 42.0,
        'density': 'part_solid', 'sphericity': 0.72, 'elongation': 1.35, 'surface_area': 520.0, 'compactness': 0.70,
        'margin': 'spiculated', 'spiculation': 1, 'side': 'Right', 'lobe': 'RUL', 'pos': 'peripheral',
        'axial': 58, 'coronal': 246, 'sagittal': 144,
        'risk_prob': 0.780, 'risk_cat': 'very_high', 'rads_cat': '4X',
        'rads_rec': 'Multidisciplinary thoracic oncology consultation, diagnostic PET/CT, and tissue biopsy recommended.',
        'factors': [
            {'name': 'size', 'display_name': 'Nodule Size (14.2 mm)', 'score': 0.88, 'level': 'high', 'description': '14.2 mm dominant part-solid mass in upper lobe'},
            {'name': 'spiculation', 'display_name': 'Spiculated Contour', 'score': 0.82, 'level': 'high', 'description': 'Irregular spiculated boundary with pleural tagging'},
            {'name': 'density', 'display_name': 'Part-Solid Attenuation', 'score': 0.76, 'level': 'high', 'description': 'Significant solid component with surrounding ground glass'}
        ]
    },
    {
        'index': 2,
        'coord_x': 212.0, 'coord_y': 208.0, 'coord_z': 58.0,
        'max_d': 8.2, 'min_d': 7.0, 'mean_d': 7.6, 'vol': 290.0,
        'mean_hu': 28.0, 'median_hu': 24.0, 'min_hu': -120.0, 'max_hu': 150.0, 'std_hu': 36.0,
        'density': 'solid', 'sphericity': 0.74, 'elongation': 1.20, 'surface_area': 195.0, 'compactness': 0.79,
        'margin': 'lobulated', 'spiculation': 0, 'side': 'Left', 'lobe': 'LUL', 'pos': 'perihilar',
        'axial': 58, 'coronal': 208, 'sagittal': 212,
        'risk_prob': 0.340, 'risk_cat': 'intermediate', 'rads_cat': '4A',
        'rads_rec': 'Intermediate suspicion. 3-month follow-up diagnostic chest CT recommended.',
        'factors': [
            {'name': 'size', 'display_name': 'Intermediate Size (8.2 mm)', 'score': 0.58, 'level': 'moderate', 'description': '8.2 mm solid perihilar nodule'},
            {'name': 'margin', 'display_name': 'Lobulated Margin', 'score': 0.48, 'level': 'moderate', 'description': 'Lobulated contour requiring growth surveillance'}
        ]
    },
    {
        'index': 3,
        'coord_x': 375.0, 'coord_y': 250.0, 'coord_z': 58.0,
        'max_d': 4.5, 'min_d': 4.0, 'mean_d': 4.25, 'vol': 48.0,
        'mean_hu': 52.0, 'median_hu': 48.0, 'min_hu': -60.0, 'max_hu': 138.0, 'std_hu': 28.0,
        'density': 'solid', 'sphericity': 0.88, 'elongation': 1.08, 'surface_area': 64.0, 'compactness': 0.90,
        'margin': 'smooth', 'spiculation': 0, 'side': 'Left', 'lobe': 'LLL', 'pos': 'peripheral',
        'axial': 58, 'coronal': 250, 'sagittal': 375,
        'risk_prob': 0.080, 'risk_cat': 'low', 'rads_cat': '2',
        'rads_rec': 'Benign appearance. Routine annual Low-Dose CT screening.',
        'factors': [
            {'name': 'size', 'display_name': 'Small Solitary Focus', 'score': 0.22, 'level': 'low', 'description': '4.5 mm smooth baseline nodule with low pre-test probability'}
        ]
    }
]

now = datetime.datetime.utcnow().isoformat()

for nd in nodules_data:
    nid = str(uuid.uuid4())
    c.execute('''
        INSERT INTO nodules (
            id, case_id, nodule_index, detection_confidence, is_demo,
            coord_x, coord_y, coord_z,
            max_diameter_mm, min_diameter_mm, mean_diameter_mm, volume_mm3,
            mean_hu, median_hu, min_hu, max_hu, std_hu,
            density_type, sphericity, elongation, surface_area_mm2, compactness,
            margin_type, spiculation_detected,
            lung_side, lung_lobe, position_type,
            axial_slice, coronal_slice, sagittal_slice,
            created_at
        ) VALUES (
            ?, ?, ?, ?, ?,
            ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?,
            ?, ?, ?,
            ?, ?, ?,
            ?
        )
    ''', (
        nid, case_id, nd['index'], 0.95, 1,
        nd['coord_x'], nd['coord_y'], nd['coord_z'],
        nd['max_d'], nd['min_d'], nd['mean_d'], nd['vol'],
        nd['mean_hu'], nd['median_hu'], nd['min_hu'], nd['max_hu'], nd['std_hu'],
        nd['density'], nd['sphericity'], nd['elongation'], nd['surface_area'], nd['compactness'],
        nd['margin'], nd['spiculation'],
        nd['side'], nd['lobe'], nd['pos'],
        nd['axial'], nd['coronal'], nd['sagittal'],
        now
    ))
    
    rid = str(uuid.uuid4())
    c.execute('''
        INSERT INTO risk_assessments (
            id, nodule_id, model_name, risk_probability, risk_category,
            lung_rads_category, lung_rads_recommendation, contributing_factors,
            clinical_inputs, is_demo, created_at
        ) VALUES (
            ?, ?, ?, ?, ?,
            ?, ?, ?,
            ?, ?, ?
        )
    ''', (
        rid, nid, 'brock_pancan_demo', nd['risk_prob'], nd['risk_cat'],
        nd['rads_cat'], nd['rads_rec'], json.dumps(nd['factors']),
        json.dumps({'age': 67, 'sex': 'male', 'smoking_history': True}), 1, now
    ))

conn.commit()
conn.close()
print('Successfully populated 3 nodules into pulmoscan.db for DEMO-005 case!')

# Also create the 3 nodule masks in data/volumes/<case_id>/
voldir = os.path.join('data', 'volumes', case_id)
depth, height, width = 128, 256, 256
for nd in nodules_data:
    mask = np.zeros((depth, height, width), dtype=np.uint8)
    cz = int(nd['coord_z'])
    cy = int(nd['coord_y'] * 256 / 512)
    cx = int(nd['coord_x'] * 256 / 512)
    radius_vox = max(2, int(nd['max_d'] / 2.0))
    z_min, z_max = max(0, cz - radius_vox), min(depth, cz + radius_vox + 1)
    y_min, y_max = max(0, cy - radius_vox), min(height, cy + radius_vox + 1)
    x_min, x_max = max(0, cx - radius_vox), min(width, cx + radius_vox + 1)
    for z in range(z_min, z_max):
        for y in range(y_min, y_max):
            for x in range(x_min, x_max):
                if ((z - cz)**2 + (y - cy)**2 + (x - cx)**2) <= radius_vox**2:
                    mask[z, y, x] = 1
    idx = nd['index']
    np.save(os.path.join(voldir, f'mask_nodule_{idx}.npy'), mask)
print('Generated masks for nodules 1, 2, 3!')
