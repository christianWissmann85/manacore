"""
Data loading utilities for training neural networks.

Supports loading from:
- HuggingFace Hub
- Local NPZ files
- Local JSONL files
"""

from pathlib import Path

import numpy as np
import torch
from torch.utils.data import DataLoader, Dataset


class ManaDataset(Dataset):
    """
    PyTorch Dataset for ManaCore training data.

    Each sample contains:
        - features: 25-dim normalized game state
        - action: Action index (target for classification)
        - legal_count: Number of legal actions
        - outcome: Game result (1=win, -1=loss, 0=draw)
    """

    def __init__(
        self,
        features: np.ndarray,
        actions: np.ndarray,
        legal_counts: np.ndarray,
        outcomes: np.ndarray,
    ):
        """
        Initialize dataset from numpy arrays.

        Args:
            features: Shape (N, 25) - normalized game states
            actions: Shape (N,) - action indices
            legal_counts: Shape (N,) - number of legal actions per sample
            outcomes: Shape (N,) - game outcomes
        """
        self.features = torch.tensor(features, dtype=torch.float32)
        self.actions = torch.tensor(actions, dtype=torch.long)
        self.legal_counts = torch.tensor(legal_counts, dtype=torch.long)
        self.outcomes = torch.tensor(outcomes, dtype=torch.float32)

    def __len__(self) -> int:
        return len(self.actions)

    def __getitem__(self, idx: int) -> dict[str, torch.Tensor]:
        return {
            "features": self.features[idx],
            "action": self.actions[idx],
            "legal_count": self.legal_counts[idx],
            "outcome": self.outcomes[idx],
        }

    @property
    def num_features(self) -> int:
        return self.features.shape[1]


def load_from_npz(path: str | Path) -> ManaDataset:
    """
    Load dataset from NPZ file.

    Args:
        path: Path to .npz file

    Returns:
        ManaDataset instance
    """
    print(f"Loading NPZ: {path}")
    data = np.load(path)

    features = data["features"]
    actions = data["actions"]
    legal_counts = data["legal_counts"]
    outcomes = data["outcomes"]

    print(f"  Loaded {len(actions):,} samples with {features.shape[1]} features")

    return ManaDataset(features, actions, legal_counts, outcomes)


def load_from_huggingface(
    repo_id: str = "Chris-AiKi/manacore-mtg-10k",
    split: str = "train",
    cache_dir: str | None = None,
) -> ManaDataset:
    """
    Load dataset from HuggingFace Hub.

    Args:
        repo_id: HuggingFace dataset repository ID
        split: Dataset split to load (train/test)
        cache_dir: Optional cache directory

    Returns:
        ManaDataset instance
    """
    try:
        from datasets import load_dataset
    except ImportError:
        raise ImportError("Please install datasets: pip install datasets") from None

    print(f"Loading from HuggingFace: {repo_id} ({split})")
    dataset = load_dataset(repo_id, split=split, cache_dir=cache_dir)

    # Convert to numpy
    features = np.array(dataset["features"], dtype=np.float32)
    actions = np.array(dataset["action"], dtype=np.int32)
    legal_counts = np.array(dataset["legal_count"], dtype=np.int32)
    outcomes = np.array(dataset["outcome"], dtype=np.int32)

    print(f"  Loaded {len(actions):,} samples")

    return ManaDataset(features, actions, legal_counts, outcomes)


def create_data_loaders(
    train_dataset: ManaDataset,
    val_dataset: ManaDataset | None = None,
    batch_size: int = 256,
    num_workers: int = 0,
    shuffle_train: bool = True,
) -> tuple[DataLoader, DataLoader | None]:
    """
    Create PyTorch DataLoaders for training.

    Args:
        train_dataset: Training dataset
        val_dataset: Optional validation dataset
        batch_size: Batch size
        num_workers: Number of data loading workers
        shuffle_train: Whether to shuffle training data

    Returns:
        Tuple of (train_loader, val_loader)
    """
    train_loader = DataLoader(
        train_dataset,
        batch_size=batch_size,
        shuffle=shuffle_train,
        num_workers=num_workers,
        pin_memory=True,
    )

    val_loader = None
    if val_dataset is not None:
        val_loader = DataLoader(
            val_dataset,
            batch_size=batch_size,
            shuffle=False,
            num_workers=num_workers,
            pin_memory=True,
        )

    return train_loader, val_loader


def train_val_split(
    dataset: ManaDataset,
    val_ratio: float = 0.1,
    seed: int = 42,
) -> tuple[ManaDataset, ManaDataset]:
    """
    Split dataset into train and validation sets.

    Args:
        dataset: Full dataset
        val_ratio: Fraction for validation
        seed: Random seed for reproducibility

    Returns:
        Tuple of (train_dataset, val_dataset)
    """
    np.random.seed(seed)

    n_samples = len(dataset)
    n_val = int(n_samples * val_ratio)
    n_train = n_samples - n_val

    # Random shuffle indices
    indices = np.random.permutation(n_samples)
    train_indices = indices[:n_train]
    val_indices = indices[n_train:]

    # Create new datasets
    train_dataset = ManaDataset(
        features=dataset.features[train_indices].numpy(),
        actions=dataset.actions[train_indices].numpy(),
        legal_counts=dataset.legal_counts[train_indices].numpy(),
        outcomes=dataset.outcomes[train_indices].numpy(),
    )

    val_dataset = ManaDataset(
        features=dataset.features[val_indices].numpy(),
        actions=dataset.actions[val_indices].numpy(),
        legal_counts=dataset.legal_counts[val_indices].numpy(),
        outcomes=dataset.outcomes[val_indices].numpy(),
    )

    print(f"Split: {len(train_dataset):,} train, {len(val_dataset):,} val")

    return train_dataset, val_dataset
