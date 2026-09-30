"""
Pre-populate and synchronize database with default demo cases (DEMO-001 through DEMO-005).
Ensures the case history, demo selection, and risk queue are ready and 100% consistent on launch.
"""
from app.core.database import SessionLocal, create_tables
from app.models.case import Case
from app.schemas.case import CaseCreateRequest
from app.services.case_service import CaseService
from app.ai.demo_service import DEMO_CASES

def seed_demo_cases(force_update: bool = True):
    create_tables()
    db = SessionLocal()
    service = CaseService(db)

    demos = [
        ("DEMO-001", "Solitary Small Nodule — 5.4 mm (Low Suspicion, Lung-RADS 3)"),
        ("DEMO-002", "Multiple Nodules — Dominant 8.6 mm (Intermediate Suspicion, Lung-RADS 4A)"),
        ("DEMO-003", "High-Risk Spiculated Mass — 16.4 mm (Higher Suspicion, Lung-RADS 4X)"),
        ("DEMO-004", "Screening CT — No Significant Nodules (Negative, Lung-RADS 1)"),
        ("DEMO-005", "Multiple Nodules — Mixed Suspicion (Dominant 14.2 mm, Lung-RADS 4X)"),
    ]

    print("Seeding/synchronizing demo cases...")
    for demo_id, notes in demos:
        existing = db.query(Case).filter(Case.demo_case_id == demo_id).first()
        if existing:
            if force_update:
                print(f"  Synchronizing existing {demo_id} (Case ID: {existing.case_id})...")
                existing.notes = notes
                db.commit()
                service.load_demo_case(existing.id, demo_id)
                print(f"  Synchronized {demo_id} -> {existing.case_id}")
            else:
                print(f"  {demo_id} already exists (ID: {existing.case_id})")
            continue

        case = service.create_case(CaseCreateRequest(
            is_demo=True,
            demo_case_id=demo_id,
            notes=notes,
        ))
        service.load_demo_case(case.id, demo_id)
        print(f"  Created and loaded {demo_id} -> {case.case_id}")

    db.close()
    print("Demo seeding and synchronization complete.")

if __name__ == "__main__":
    seed_demo_cases(force_update=True)
