"""
Neural network models for ManaCore.

This module contains:
- ImitatorNet: Simple MLP for behavior cloning
- Training utilities
- ONNX export
"""

from .imitator import ImitatorNet, create_imitator_net
from .trainer import Trainer, TrainingConfig
from .data_loader import ManaDataset, load_from_huggingface, load_from_npz

__all__ = [
    "ImitatorNet",
    "create_imitator_net",
    "Trainer",
    "TrainingConfig",
    "ManaDataset",
    "load_from_huggingface",
    "load_from_npz",
]
