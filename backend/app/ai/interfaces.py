"""
AI Pipeline abstract interface definitions.
"""
from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional, Tuple


class NoduleDetector(ABC):
    """Interface for 3D pulmonary nodule detection models."""

    @abstractmethod
    def detect(self, volume: Any, metadata: Dict[str, Any]) -> List[Dict[str, Any]]:
        pass


class NoduleSegmenter(ABC):
    """Interface for 3D nodule segmentation models."""

    @abstractmethod
    def segment(self, volume: Any, bbox: Dict[str, float]) -> Any:
        pass


class FeatureExtractor(ABC):
    """Interface for quantitative feature extraction from segmented nodules."""

    @abstractmethod
    def extract(self, volume: Any, mask: Any, spacing: tuple, centroid: tuple) -> Dict[str, Any]:
        pass


class RiskEngine(ABC):
    """Interface for malignancy risk estimation models."""

    @abstractmethod
    def assess_risk(
        self,
        nodule_features: Dict[str, Any],
        clinical_inputs: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        pass


class ReportGenerator(ABC):
    """Interface for structured radiology report generation."""

    @abstractmethod
    def generate(self, case_data: Dict[str, Any]) -> Dict[str, Any]:
        pass
