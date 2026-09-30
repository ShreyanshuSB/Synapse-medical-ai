# Third-Party Notices & Attribution

This project incorporates, depends upon, or references third-party open-source libraries, pretrained model architectures, public research benchmarks, and published clinical guidelines. All third-party copyrights and trademarks belong to their respective owners.

---

## 1. Project Implementation

The original software architecture, user interface, deterministic clinical calculation engines, and integration logic in this repository are licensed under the MIT License (see `LICENSE`).

---

## 2. Third-Party Software Libraries & Dependencies

### Backend (Python)
- **FastAPI** (`fastapi`): MIT License (tiangolo)
- **Uvicorn** (`uvicorn`): BSD 3-Clause License (Encode OSS Ltd)
- **Pydantic & Pydantic-Settings** (`pydantic`, `pydantic-settings`): MIT License (Samuel Colvin & contributors)
- **SQLAlchemy** (`sqlalchemy`): MIT License (Michael Bayer)
- **Alembic** (`alembic`): MIT License (Michael Bayer)
- **psycopg2-binary** (`psycopg2-binary`): LGPL v3 with OpenSSL exception
- **aiofiles** (`aiofiles`): Apache License 2.0
- **python-jose** (`python-jose`): MIT License
- **passlib** (`passlib`): BSD License
- **httpx** (`httpx`): BSD 3-Clause License (Encode OSS Ltd)
- **NumPy** (`numpy`): BSD 3-Clause License (NumPy Developers)
- **SciPy** (`scipy`): BSD 3-Clause License (SciPy Developers)
- **Pydicom** (`pydicom`): MIT License (Darcy Mason & pydicom contributors)
- **Pillow** (`Pillow`): HPND License (Historical Permission Notice and Disclaimer)
- **ReportLab** (`reportlab`): BSD License (ReportLab Inc.)
- **Google GenAI Python SDK** (`google-genai`): Apache License 2.0 (Google LLC)

### Frontend (TypeScript / JavaScript)
- **Next.js** (`next`): MIT License (Vercel, Inc.)
- **React & React DOM** (`react`, `react-dom`): MIT License (Meta Platforms, Inc.)
- **Three.js** (`three`, `@types/three`): MIT License (Ricardo Cabello / mrdoob and contributors)
- **Lucide Icons** (`lucide-react`): ISC License (Lucide Contributors)
- **Tailwind CSS** (`tailwindcss`, `@tailwindcss/postcss`): MIT License (Tailwind Labs, Inc.)
- **shadcn / UI utilities** (`class-variance-authority`, `cn`, `tw-animate-css`): MIT License
- **Base UI** (`@base-ui/react`): MIT License (Material UI SAS)
- **TypeScript** (`typescript`): Apache License 2.0 (Microsoft Corporation)
- **ESLint** (`eslint`, `eslint-config-next`): MIT License (OpenJS Foundation)

---

## 3. External Model Architecture References

The repository references the following deep learning architectures and Model Zoo definitions in its roadmap and modular interfaces (see `docs/models.md`). Pretrained checkpoint weights are **not bundled** in this Git repository:

- **Project MONAI 3D Lung Nodule CT Detector (`lung_nodule_ct_detection`)**
  - **Architecture:** 3D RetinaNet (Feature Pyramid Network with anchor classification and bounding box regression heads).
  - **Source:** Project MONAI Model Zoo (`https://github.com/Project-MONAI/model-zoo`).
  - **Framework:** PyTorch & Project MONAI.
  - **License:** Apache License 2.0.
  - **Status in Repository:** Modular interface integration target (`backend/app/ai/detector.py`). Checkpoint weights are optional, loaded from a local cache if present, and never committed to version control.

- **Project MONAI 3D Nodule Segmentation (3D U-Net / UNETR)**
  - **Architecture:** 3D Convolutional U-Net / Transformer with residual connections.
  - **Source:** Project MONAI (`monai.networks.nets.UNet`).
  - **License:** Apache License 2.0.
  - **Status in Repository:** Modular interface integration target (`backend/app/ai/segmenter.py`). Algorithmic 3D adaptive morphological thresholding and contour extraction provide deterministic fallbacks when neural weights are not present.

- **Google Gemini (GenAI Service)**
  - **Service:** Google Gemini API via official `google-genai` SDK.
  - **License / Terms:** Governed by Google Cloud / Google AI Terms of Service.
  - **Status in Repository:** Optional external cloud assistance for clinical report narrative synthesis, finding explanations, and doctor assistant Q&A. Not used for numeric risk scoring.

---

## 4. Public Research Datasets & Competition Benchmarks

The project references standard publicly available thoracic imaging benchmarks in its documentation and interface design:

- **LUNA16 (LUng Nodule Analysis 2016)**
  - A challenge dataset derived from a subset of thoracic CT scans from the LIDC-IDRI database, comprising 888 scans with radiologist annotations.
  - Sensitivity figures cited in documentation (~94.2% at 1.0 FPs/scan for MONAI RetinaNet) are **published external competition benchmarks**, not internal validation measurements of PulmoScan AI.
- **LIDC-IDRI (Lung Image Database Consortium and Image Database Resource Initiative)**
  - National Cancer Institute / Foundation for the National Institutes of Health public archive of 1,010 thoracic CT scans with boundary segmentations from thoracic radiologists.
  - Referenced as ground truth training data for external segmentation model research.

---

## 5. Clinical Frameworks & Medical Literature

The quantitative risk engines and classification algorithms in PulmoScan AI implement published, peer-reviewed clinical guidelines and mathematical models:

- **Brock / PanCan Malignancy Risk Model**
  - **Citation:** McWilliams A, Tammemagi MC, Mayo JR, Roberts H, Liu G, Soghrati K, Yasufuku K, Martel S, Laberge F, Gingras M, Atkar-Khattra S, Berg CD, Evans K, Finley R, Goffin J, Puksa S, Stewart L, Tsai S, Johnston MR, Manos D, Nicholas G, Goss GD, Seely JM, Sekhon HS, Burling D, MacEachern P, Burrowes P, Tremblay A, Church N, Bhatia R, Chhajed P, Lam S. *Probability of Cancer in Pulmonary Nodules Detected on First Screening CT.* **New England Journal of Medicine**, 2013; 369(10):910-919. DOI: [10.1056/NEJMoa1214726](https://doi.org/10.1056/NEJMoa1214726).
  - **Implementation:** Implemented as an explicit, deterministic multivariable logistic regression equation in `backend/app/ai/risk_engine.py`.

- **ACR Lung-RADS® v2022 Screening Framework**
  - **Source:** American College of Radiology (ACR) Lung CT Screening Reporting and Data System (Lung-RADS®) v2022.
  - **Notice:** Lung-RADS is a registered trademark of the American College of Radiology. The categories (1, 2, 3, 4A, 4B, 4X) and associated management recommendations implemented in this software are adapted from public ACR clinical practice guidelines.
  - **Clinical Designation:** Decision-support and structured reporting framework; does not constitute a primary diagnostic tool.

- **Schwartz Formula for Volume Doubling Time (VDT)**
  - Used in longitudinal temporal comparison for measuring nodule growth kinetics.
