# PulmoScan AI — AI Pipeline & Clinical Risk Model

## 1. Pipeline Stages

The PulmoScan AI pipeline processes thoracic CT scans through 6 modular steps:

1. **Volume Preprocessing**: Rescaling raw CT pixel data to Hounsfield Units ($HU = \text{val} \times \text{slope} + \text{intercept}$), spatial resampling, and orientation alignment.
2. **Nodule Detection (`detector.py`)**: 3D candidate patch scanning, intensity profiling, and non-maximum suppression (NMS) to generate candidate centroids and 3D bounding boxes.
3. **Nodule Segmentation (`segmenter.py`)**: 3D voxel mask generation and slice-specific 2D boundary contour polygon extraction.
4. **Quantitative Feature Extraction (`feature_extractor.py`)**:
   - Equivalent spherical diameter & maximum 3D caliper diameter (mm).
   - Volume: $V = N_{\text{voxels}} \times (s_x \cdot s_y \cdot s_z) \text{ mm}^3$.
   - Sphericity: $\Psi = \frac{\pi^{1/3}(6V)^{2/3}}{A}$.
   - Margin assessment: smooth, lobulated, irregular, spiculated.
   - HU distribution statistics: mean, median, min, max, standard deviation.
   - Anatomical lobe localization: RUL, RML, RLL, LUL, LLL.
5. **Malignancy Risk Estimation (`risk_engine.py`)**:
   - **Brock (PanCan) Multivariable Logistic Model**:
     Calculates logit probability from size, lobe, density type, spiculation, age, sex, smoking history, pack-years, family history, and emphysema.
   - **ACR Lung-RADS v2022**:
     Assigns standard categories (1, 2, 3, 4A, 4B, 4X) and management follow-up guidance.
   - **Explainability Attributions**:
     Quantifies the relative contribution of each clinical and radiomic factor.
6. **Structured Reporting & PDF Export (`report_service.py`)**:
   - Generates standard radiology findings text and ReportLab vector PDF reports.

## 2. Integrating Production MONAI Models

The AI layer adheres to the abstract interfaces defined in `app/ai/pipeline.py`:
- `NoduleDetector`: Swap in MONAI RetinaNet trained on LUNA16.
- `NoduleSegmenter`: Swap in MONAI UNETR / Swin UNETR trained on LIDC-IDRI annotations.
- `FeatureExtractor`: Compatible with PyRadiomics features.
- `RiskEngine`: Validated against Brock and ACR screening cohorts.
