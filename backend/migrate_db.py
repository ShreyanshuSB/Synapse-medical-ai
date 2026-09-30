import sqlite3
conn = sqlite3.connect('pulmoscan.db')
cur = conn.cursor()
cur.execute('PRAGMA table_info(cases)')
cols = [r[1] for r in cur.fetchall()]
print('Existing columns:', cols)
if 'review_status' not in cols:
    cur.execute("ALTER TABLE cases ADD COLUMN review_status TEXT DEFAULT 'unreviewed'")
    print('Added review_status')
else:
    print('review_status already exists')
if 'patient_context' not in cols:
    cur.execute('ALTER TABLE cases ADD COLUMN patient_context TEXT')
    print('Added patient_context')
else:
    print('patient_context already exists')
conn.commit()
conn.close()
print('Migration complete')
