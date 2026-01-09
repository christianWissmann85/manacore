"""
Training utilities for ManaCore agents.
"""

from .curriculum import FAST_CURRICULUM, STANDARD_CURRICULUM, CurriculumScheduler, CurriculumStage

__all__ = [
    "CurriculumScheduler",
    "CurriculumStage",
    "STANDARD_CURRICULUM",
    "FAST_CURRICULUM",
]
