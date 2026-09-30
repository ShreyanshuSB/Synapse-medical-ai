"""
Temporal CT Comparison & Growth Kinetics Engine.
Calculates interval change, volume growth, Volume Doubling Time (VDT),
and growth velocity across longitudinal CT studies.
"""
import math
from typing import Dict, Any, List, Optional
from datetime import datetime


class TemporalService:
    """Service for comparing longitudinal CT studies and tracking nodule growth."""

    @staticmethod
    def calculate_growth_metrics(
        prior_date_str: str,
        current_date_str: str,
        prior_diameter_mm: float,
        current_diameter_mm: float,
        prior_volume_mm3: float,
        current_volume_mm3: float,
    ) -> Dict[str, Any]:
        """
        Compute interval growth metrics:
          - Diameter change (mm, %)
          - Volume change (mm3, %)
          - Volume Doubling Time (VDT in days) via Schwartz formula
          - Kinetic category (rapid, intermediate, indolent, stable)
        """
        # Parse dates to compute elapsed days
        elapsed_days = TemporalService._calculate_elapsed_days(prior_date_str, current_date_str)
        if elapsed_days <= 0:
            elapsed_days = 365  # Default 1-year baseline interval if dates are approximate

        # Diameter change
        delta_diam = round(current_diameter_mm - prior_diameter_mm, 2)
        diam_pct = round(((current_diameter_mm - prior_diameter_mm) / max(0.1, prior_diameter_mm)) * 100.0, 1)

        # Volume change
        delta_vol = round(current_volume_mm3 - prior_volume_mm3, 1)
        vol_pct = round(((current_volume_mm3 - prior_volume_mm3) / max(0.1, prior_volume_mm3)) * 100.0, 1)

        # Volume Doubling Time: VDT = (T * ln(2)) / ln(V2 / V1)
        vdt_days = None
        vdt_category = "stable"
        growth_flag = "No significant interval change"

        if current_volume_mm3 > prior_volume_mm3 and prior_volume_mm3 > 0:
            ratio = current_volume_mm3 / prior_volume_mm3
            if ratio > 1.05:  # At least 5% volume change to register growth
                log_ratio = math.log(ratio)
                if log_ratio > 0:
                    vdt_days = round((elapsed_days * math.log(2.0)) / log_ratio, 1)

                    if vdt_days < 400:
                        vdt_category = "rapid_growth"
                        growth_flag = "Rapid interval growth (VDT < 400 days) — high suspicion for malignancy."
                    elif vdt_days <= 600:
                        vdt_category = "intermediate"
                        growth_flag = "Intermediate growth rate (VDT 400–600 days) — close monitoring warranted."
                    else:
                        vdt_category = "indolent"
                        growth_flag = "Indolent growth (VDT > 600 days) — typical of low-grade or benign processes."
        elif current_volume_mm3 < prior_volume_mm3 * 0.90:
            vdt_category = "regression"
            growth_flag = "Interval regression/decrease in volume."

        return {
            "elapsed_days": elapsed_days,
            "prior_diameter_mm": prior_diameter_mm,
            "current_diameter_mm": current_diameter_mm,
            "diameter_change_mm": delta_diam,
            "diameter_change_pct": diam_pct,
            "prior_volume_mm3": prior_volume_mm3,
            "current_volume_mm3": current_volume_mm3,
            "volume_change_mm3": delta_vol,
            "volume_change_pct": vol_pct,
            "volume_doubling_time_days": vdt_days,
            "kinetic_category": vdt_category,
            "growth_flag": growth_flag,
        }

    @staticmethod
    def _calculate_elapsed_days(d1: str, d2: str) -> int:
        """Calculate elapsed days between two date strings (ISO, year-month, or year)."""
        formats = ["%Y-%m-%d", "%Y-%m", "%Y"]
        date1 = None
        date2 = None

        for fmt in formats:
            try:
                date1 = datetime.strptime(d1.strip(), fmt)
                break
            except Exception:
                pass

        for fmt in formats:
            try:
                date2 = datetime.strptime(d2.strip(), fmt)
                break
            except Exception:
                pass

        if date1 and date2:
            return abs((date2 - date1).days)
        return 365


temporal_service = TemporalService()
