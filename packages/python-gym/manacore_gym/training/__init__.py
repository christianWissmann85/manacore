"""
Training utilities for ManaCore agents.
"""

from .curriculum import CurriculumScheduler, CurriculumStage, STANDARD_CURRICULUM, FAST_CURRICULUM

__all__ = [
    "CurriculumScheduler",
    "CurriculumStage",
    "STANDARD_CURRICULUM",
    "FAST_CURRICULUM",
]
