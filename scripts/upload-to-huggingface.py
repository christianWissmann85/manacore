#!/usr/bin/env python3
"""
Upload ManaCore training data to HuggingFace Hub.

Usage:
    # First, login to HuggingFace
    uv run python -c "from huggingface_hub import login; login()"

    # Then upload the dataset
    uv run python scripts/upload-to-huggingface.py --data-dir ./output/greedy-vs-greedy-10k --repo-name manacore-mtg-10k

Requirements:
    pip install huggingface-hub datasets
"""

import argparse
import json
from pathlib import Path

from datasets import Dataset, DatasetDict, Features, Sequence, Value
from huggingface_hub import HfApi, create_repo


def load_jsonl(filepath: str) -> list[dict]:
    """Load JSONL file."""
    samples = []
    print(f"Loading JSONL: {filepath}")
    with open(filepath, "r") as f:
        for i, line in enumerate(f):
            line = line.strip()
            if line:
                samples.append(json.loads(line))
            if (i + 1) % 100000 == 0:
                print(f"  Loaded {i + 1} samples...")
    print(f"  Total: {len(samples)} samples")
    return samples


def create_dataset(samples: list[dict]) -> Dataset:
    """Convert samples to HuggingFace Dataset."""
    print("Converting to HuggingFace Dataset format...")

    # Prepare data in columnar format
    data = {
        "features": [s["features"] for s in samples],
        "action": [s["action"] for s in samples],
        "legal_count": [s["legal_count"] for s in samples],
        "action_type": [s["action_type"] for s in samples],
        "outcome": [s["outcome"] for s in samples],
        "game_id": [s["game_id"] for s in samples],
        "turn": [s["turn"] for s in samples],
        "phase": [s["phase"] for s in samples],
    }

    # Add reasoning if present
    if "reasoning" in samples[0] and samples[0]["reasoning"]:
        data["reasoning"] = [s.get("reasoning", "") for s in samples]

    dataset = Dataset.from_dict(data)
    print(f"  Created dataset with {len(dataset)} rows")
    return dataset


def upload_dataset(
    data_dir: str,
    repo_name: str,
    username: str | None = None,
    private: bool = False,
    split_ratio: float = 0.1,
) -> str:
    """Upload dataset to HuggingFace Hub."""

    data_path = Path(data_dir)
    jsonl_path = data_path / "training-data.jsonl"

    if not jsonl_path.exists():
        raise FileNotFoundError(f"JSONL file not found: {jsonl_path}")

    # Load data
    samples = load_jsonl(str(jsonl_path))

    # Create dataset
    dataset = create_dataset(samples)

    # Split into train/test
    print(f"Splitting dataset (test ratio: {split_ratio})...")
    split = dataset.train_test_split(test_size=split_ratio, seed=42)
    dataset_dict = DatasetDict({"train": split["train"], "test": split["test"]})
    print(f"  Train: {len(dataset_dict['train'])} samples")
    print(f"  Test: {len(dataset_dict['test'])} samples")

    # Get username if not provided
    api = HfApi()
    if username is None:
        user_info = api.whoami()
        username = user_info["name"]
        print(f"Logged in as: {username}")

    # Full repo name
    full_repo_name = f"{username}/{repo_name}"

    # Create repository
    print(f"Creating repository: {full_repo_name}")
    try:
        create_repo(full_repo_name, repo_type="dataset", private=private, exist_ok=True)
    except Exception as e:
        print(f"  Note: {e}")

    # Push dataset
    print("Uploading dataset to HuggingFace Hub...")
    dataset_dict.push_to_hub(
        full_repo_name,
        private=private,
        commit_message="Upload ManaCore MTG training data",
    )

    # Upload additional files
    print("Uploading additional files...")

    # Upload README/dataset card
    readme_path = Path(__file__).parent.parent / "docs" / "HUGGINGFACE_DATASET_CARD.md"
    if readme_path.exists():
        api.upload_file(
            path_or_fileobj=str(readme_path),
            path_in_repo="README.md",
            repo_id=full_repo_name,
            repo_type="dataset",
            commit_message="Add dataset card",
        )
        print("  Uploaded README.md")

    # Upload NPZ file
    npz_path = data_path / "training-data.npz"
    if npz_path.exists():
        api.upload_file(
            path_or_fileobj=str(npz_path),
            path_in_repo="training-data.npz",
            repo_id=full_repo_name,
            repo_type="dataset",
            commit_message="Add NPZ file for direct NumPy loading",
        )
        print("  Uploaded training-data.npz")

    # Upload progress.json for metadata
    progress_path = data_path / "progress.json"
    if progress_path.exists():
        api.upload_file(
            path_or_fileobj=str(progress_path),
            path_in_repo="metadata.json",
            repo_id=full_repo_name,
            repo_type="dataset",
            commit_message="Add generation metadata",
        )
        print("  Uploaded metadata.json")

    hub_url = f"https://huggingface.co/datasets/{full_repo_name}"
    print(f"\nDataset uploaded successfully!")
    print(f"URL: {hub_url}")

    return hub_url


def main():
    parser = argparse.ArgumentParser(description="Upload ManaCore training data to HuggingFace Hub")
    parser.add_argument("--data-dir", required=True, help="Directory containing training data")
    parser.add_argument("--repo-name", default="manacore-mtg-10k", help="Repository name (default: manacore-mtg-10k)")
    parser.add_argument("--username", help="HuggingFace username (default: auto-detect)")
    parser.add_argument("--private", action="store_true", help="Make repository private")
    parser.add_argument("--test-split", type=float, default=0.1, help="Test split ratio (default: 0.1)")

    args = parser.parse_args()

    url = upload_dataset(
        data_dir=args.data_dir,
        repo_name=args.repo_name,
        username=args.username,
        private=args.private,
        split_ratio=args.test_split,
    )

    print(f"\nTo load this dataset in Python:")
    print(f'  from datasets import load_dataset')
    print(f'  dataset = load_dataset("{args.username or "YOUR_USERNAME"}/{args.repo_name}")')


if __name__ == "__main__":
    main()
