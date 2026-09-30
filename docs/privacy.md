# Privacy & Data Handling Policy

This document outlines how data is stored, processed, and transmitted in **PulmoScan AI**.

> **IMPORTANT CLINICAL & PRIVACY NOTICE**  
> PulmoScan AI is an experimental research and clinical workflow demonstration prototype. **Real patient data, HIPAA Protected Health Information (PHI), or identifiable clinical imaging must NOT be uploaded or processed using this software.** Demo cases and sample series included with the software are entirely synthetic or de-identified.  
> **This prototype is NOT "100% private" or "fully local" when cloud services are configured.** Please read the boundaries below carefully.

---

## 1. Local Processing & Storage (Default Workstation Mode)

When operating locally without optional cloud services enabled, data handling is confined to the local host machine:

### SQLite & Database Storage
- Case metadata, nodule coordinates, computed morphological metrics (diameters, volumes, sphericity, compactness), Hounsfield Unit statistics, ACR Lung-RADS classifications, and Brock risk scores are stored in a local SQLite database (`pulmoscan.db`).
- The database is created locally upon running seeding scripts or ingesting scans, and is ignored by Git (`.gitignore`).

### Local CT Processing & Arrays
- CT preprocessing (Hounsfield Unit rescaling, canonical LPS/RAS reorientation, voxel resampling to standard spacing, and lung windowing) executes locally on CPU or local CUDA GPU via NumPy and SciPy.
- Intermediate voxel arrays (`.npy`, `.npz`) and uploaded series reside in local directories under `backend/data/` (or `data/`).

### Local Slice & Report Generation
- Multi-Planar Reconstruction (MPR) slices for Axial, Coronal, and Sagittal orthogonal views are rendered locally into JPEG/PNG bytes using Pillow and NumPy.
- Radiology report PDFs are generated locally on the workstation filesystem using ReportLab vector PDF compilation.

### Demo Data
- All bundled demo cases (`DEMO-001` through `DEMO-005`) are synthetic, de-identified profiles with simulated clinical notes and calibrated CT slice captures stored directly within the repository.

---

## 2. Cloud AI Integration (Google Gemini via Google GenAI SDK)

Cloud communication occurs **only** when an external Gemini API key is explicitly configured in local environment variables (`GEMINI_API_KEY`).

### When Configured:
- **What is Sent:** Structured text parameters describing case findings are sent over encrypted HTTPS to Google GenAI endpoints. These parameters include:
  - Nodule anatomical location (e.g., Right Upper Lobe)
  - Measured dimensions (e.g., maximum diameter in mm, volume in mm³)
  - Attenuation pattern and HU statistics (e.g., part-solid, mean HU)
  - Morphological margin descriptors (e.g., spiculated, lobulated)
  - Clinician-entered risk factors (e.g., age, smoking pack-years, emphysema status)
  - Prompt instructions for report impressions, executive summaries, finding rationale, or doctor Q&A
- **What is NOT the Source of Numeric Risk:**
  - **Gemini does NOT compute the core numeric Brock/PanCan risk probability.**
  - **Gemini does NOT compute ACR Lung-RADS categories.**
  - The Brock/PanCan multivariable logistic regression formula and the ACR Lung-RADS rules are computed deterministically inside the local backend Python risk engine (`backend/app/ai/risk_engine.py`).
  - Gemini receives the already computed numeric probability and category to compose clinical narratives and explanatory impressions; it is strictly prohibited by system instructions from fabricating or altering numeric measurements.

### When NOT Configured (or Key Absent):
- The application bypasses cloud requests completely.
- Structured findings, quantitative tables, Brock risk percentages, Lung-RADS categories, and deterministic report summaries continue to function normally without degradation.

---

## 3. Data Retention & Hygiene

1. **Local Filesystem:** Uploaded CT files, generated PDF reports, and cached volumes reside in local directories (`backend/data/uploads`, `backend/data/reports`, `backend/data/volumes`).
2. **Git Hygiene:** Local configuration files (`.env`, `.env.local`), database files (`*.db`, `*.sqlite`), temporary binary caches (`*.npy`, `*.npz`), and generated reports are explicitly excluded from Git version control via `.gitignore`.
3. **User Responsibility:** Users running or deploying this prototype are responsible for ensuring that all data placed on their local disk or transmitted to third-party APIs complies with applicable institutional, regional, and national medical privacy regulations.
