# External AI Models, Datasets & Risk Framework Documentation

This document describes all external machine learning architectures, pretrained checkpoints, clinical benchmark datasets, and risk prediction frameworks integrated into **PulmoScan AI**.

> **Research Prototype Disclaimer:**  
> PulmoScan AI is an investigational research decision-support prototype. It is **NOT** a clinically validated diagnostic device and does not provide definitive medical diagnoses or replace licensed physician judgment.

---

## 1. 3D Pulmonary Nodule Detector (MONAI / LUNA16)

* **Model Name:** MONAI 3D Lung Nodule CT Detector (`lung_nodule_ct_detection`)
* **Architecture:** 3D RetinaNet (Feature Pyramid Network + Anchor Classification & Regression Heads)
* **Source / Model Zoo:** MONAI Model Zoo (`https://github.com/Project-MONAI/model-zoo/tree/dev/models/lung_nodule_ct_detection`)
* **Framework:** PyTorch & Project MONAI (v1.6.0)
* **License:** Apache License 2.0
* **Training Dataset:** LUNA16 (Grand Challenge on Pulmonary Nodule Detection, subset of LIDC-IDRI, 888 thoracic CT scans with radiologist reference standard of 1,186 nodules)
* **Pretrained Weights Cache:** Configurable via environment variable `MODEL_DIR` (default: `./models/lung_nodule_ct_detection/model.pt`). Weights are cached locally and not committed to git.
* **Exact Preprocessing Requirements:**
  * Input Spacing: Standardized resampled voxel spacing of approximately `(0.703, 0.703, 1.25)` mm (X, Y, Z).
  * Intensity Windowing: Standard thoracic lung window `[-1000 HU, 400 HU]` normalized to `[0.0, 1.0]`.
  * Spatial Direction: Canonical LPS/RAS anatomical orientation.
* **Published Model Performance (PUBLISHED EXTERNAL BENCHMARK):**
  * Detection Sensitivity: ~94.2% at 1.0 false positives per scan (published evaluation from LUNA16 competition benchmark).
  * *Note: The referenced MONAI/LUNA16 sensitivity figure is a PUBLISHED EXTERNAL BENCHMARK and should not be interpreted as Synapse's own measured performance or internal validation.*
* **Limitations:**
  * Performance relies on thin-slice thoracic CT scans ($\le 2.5$ mm slice thickness). Thick-slice or motion-degraded scans reduce candidate sensitivity.

---

## 2. 3D Nodule Segmentation (MONAI 3D U-Net / Active Contour)

* **Model Name:** MONAI 3D U-Net Nodule Segmenter
* **Architecture:** 3D Convolutional U-Net with residual skip connections and dice loss.
* **Source:** Project MONAI (`monai.networks.nets.UNet`)
* **License:** Apache License 2.0
* **Intended Use:** Voxel-level binary mask segmentation inside the candidate lesion 3D region of interest (ROI).
* **Reference Dataset:** LIDC-IDRI (Lung Image Database Consortium and Image Database Resource Initiative, 1,010 thoracic CT studies with radiologist-annotated nodule boundary segmentations).
* **Outputs:**
  * True 3D binary mask array `(Z, Y, X)` corresponding to actual CT voxel attenuation.
  * Real slice-by-slice 2D boundary contour points extracted via `skimage.measure.find_contours` on the real binary mask.
* **Inference Labeling:**
  * When neural weights are loaded: `REAL_MODEL_INFERENCE`.
  * When deterministic 3D adaptive thresholding is executed: `REAL_3D_MORPHOLOGICAL_SEGMENTATION`.
  * Procedural, trigonometric, or fake sinusoidal masks are strictly prohibited.

---

## 3. Evidence-Based Malignancy Risk Engine (Brock / PanCan Model)

* **Model Name:** Brock University / Pan-Canadian Early Detection of Lung Cancer (PanCan) Malignancy Risk Model
* **Source Citation:** McWilliams A, Tammemagi MC, Mayo JR, et al. *Probability of Cancer in Pulmonary Nodules Detected on First Screening CT.* **New England Journal of Medicine**, 2013; 369:910-919. DOI: 10.1056/NEJMoa1214726.
* **License / Access:** Published clinical literature.
* **Variables Consumed:**
  * Patient Age (years)
  * Biological Sex (female / male)
  * Family History of Lung Cancer (first-degree relative)
  * Emphysema (radiologic or clinical)
  * Smoking History & Pack-years
  * Nodule Maximum Diameter (mm)
  * Anatomical Location (Upper lobe: RUL/LUL vs Other)
  * Nodule Attenuation Pattern (Solid, Part-solid, Ground-glass, Calcified)
  * Nodule Margins (Spiculated vs Smooth/Lobulated)
  * Total Nodule Count
* **Mathematical Formula:**
  $$\text{logit} = -6.7892 + 0.0287 \cdot (\text{Age} - 62) + 0.3344 \cdot \text{Female} + 0.5808 \cdot \text{FamHist} + 0.2974 \cdot \text{Emphysema} + 0.1850 \cdot \text{Size} + 0.6581 \cdot \text{UpperLobe} + \beta_{\text{type}} + 0.7729 \cdot \text{Spiculation} - 0.0984 \cdot (\text{Count} - 1)$$
  $$P(\text{Malignancy}) = \frac{1}{1 + e^{-\text{logit}}}$$
* **Missing Data Policy:** Missing clinical data are explicitly tagged as `"Not provided"` and never silently assumed to be negative.
* **Limitations:**
  * Derived from a screening population of individuals with smoking history; positive predictive value varies across unselected clinical populations.
  * Deterministic risk engine calculates the numeric probability; Gemini is prohibited from altering numeric malignancy probabilities.

---

## 4. ACR Lung-RADS v2022 Screening Framework

* **Framework Name:** American College of Radiology (ACR) Lung CT Screening Reporting and Data System (Lung-RADS®) v2022.
* **Source:** American College of Radiology (`https://www.acr.org/Clinical-Resources/Clinical-Tools-and-Reference/Reporting-and-Data-Systems/Lung-RADS`)
* **Classification Logic:**
  * Category 1: Negative ($\le -200$ HU calcification or clear benignity).
  * Category 2: Benign appearance (solid $<6$ mm, ground-glass $<30$ mm).
  * Category 3: Probably benign (solid $6$ to $<8$ mm, non-solid $\ge 30$ mm). Low-dose CT in 6 months.
  * Category 4A: Suspicious (solid $8$ to $<15$ mm, part-solid with solid core $6$ to $<8$ mm). Low-dose CT in 3 months; PET/CT.
  * Category 4B: Very suspicious (solid $\ge 15$ mm, solid core $\ge 8$ mm). Contrast CT, PET/CT, biopsy.
  * Category 4X: Category 3 or 4 nodules with additional suspicious features (spiculation, lymphadenopathy).
* **Clinical Designation:** Screening and reporting decision-support framework — **not a definitive clinical diagnosis**.

---

## 5. Decision-Support & Report Narrative (Google Gemini via google-genai)

* **Service:** Google Gemini via official Google GenAI Python SDK (`google-genai`).
* **Model Configuration:** Configured via `GEMINI_MODEL` (default: `gemini-2.5-flash`).
* **Role:** Finding explanation, executive clinical summary, radiology report narrative, and grounded doctor Q&A.
* **Grounding Constraints:**
  * Strictly grounded in structured CT radiomics output (diameters, volumes, HUs, Brock probability, ACR Lung-RADS).
  * Prohibited from modifying numerical measurements or inventing lesions.
  * If Gemini API is unreachable or key is missing, analysis still completes with structured findings intact.
