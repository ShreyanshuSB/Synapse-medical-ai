# PulmoScan AI — System Architecture

## Architectural Principles

1. **Separation of Concerns**:
   - `API Layer` (`app/api/routes`): Request handling, parameter validation, HTTP responses.
   - `Services Layer` (`app/services`): Business workflows, DICOM parsing, slice rendering, temporal comparisons, report generation.
   - `AI / Analytics Core` (`app/ai`): Abstract pipeline definitions, detection, 3D segmentation, quantitative feature extraction, risk estimation.
   - `Data Layer` (`app/models`, `app/schemas`): SQLAlchemy ORM models, Pydantic schemas, database migrations.

2. **CT Volume Rendering Engine (`ct_renderer.py`)**:
   - Treats thoracic CT data as true 3D arrays with physical voxel spacing ($x, y, z$).
   - Computes multi-planar slices across Axial, Coronal, and Sagittal orthogonal views.
   - Implements transfer functions with clinical window presets:
     - Lung Window (WL: -600, WW: 1500)
     - Mediastinal Window (WL: 40, WW: 350)
     - Bone Window (WL: 400, WW: 1800)

3. **DICOM Ingestion & Quality Control (`dicom_service.py`)**:
   - Inspects DICOM ZIP series, individual DICOM files, or NIfTI volumes via `pydicom` and `nibabel`.
   - Extracts spatial attributes: `PixelSpacing`, `SliceThickness`, `ImagePositionPatient`, `RescaleSlope`, `RescaleIntercept`.
   - Evaluates scan quality against LUNA16 benchmark criteria (e.g. slice thickness $\le 2.5\text{ mm}$, minimum slice count, regular spacing).

4. **Longitudinal Kinetics Engine (`temporal_service.py`)**:
   - Measures interval duration in days.
   - Computes percentage and absolute change in 3D volume ($\text{mm}^3$) and maximum diameter ($\text{mm}$).
   - Employs the Schwartz doubling formula to estimate Volume Doubling Time (VDT).
