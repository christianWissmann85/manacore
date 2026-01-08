#!/usr/bin/env python3
"""
Convert ManaCore training data between formats.

Supports:
- JSON tensors -> NPZ (NumPy compressed)
- JSONL -> NPZ
- JSONL -> HuggingFace Dataset

Usage:
    # Convert tensor JSON to NPZ
    python scripts/convert-training-data.py tensors.json -o data.npz

    # Convert JSONL to NPZ
    python scripts/convert-training-data.py data.jsonl -o data.npz --format jsonl

    # Convert to HuggingFace format
    python scripts/convert-training-data.py data.jsonl -o ./hf_dataset --format jsonl --hf
"""

import argparse
import json
import sys
from pathlib import Path

import numpy as np


def load_tensor_json(filepath: str) -> dict:
    """Load tensor export JSON from ManaCore."""
    with open(filepath, "r") as f:
        return json.load(f)


def load_jsonl(filepath: str) -> list[dict]:
    """Load JSONL file (one JSON object per line)."""
    samples = []
    with open(filepath, "r") as f:
        for line in f:
            line = line.strip()
            if line:
                samples.append(json.loads(line))
    return samples


def tensor_json_to_npz(input_path: str, output_path: str) -> None:
    """Convert ManaCore tensor JSON to NumPy NPZ format."""
    print(f"Loading tensor JSON: {input_path}")
    data = load_tensor_json(input_path)

    feature_dim = data["feature_dim"]
    num_samples = data["num_samples"]

    print(f"Found {num_samples} samples with {feature_dim} features")
    print(f"From {data['num_games']} games")

    # Reshape features from flat array to 2D
    features = np.array(data["features"], dtype=np.float32).reshape(-1, feature_dim)
    actions = np.array(data["actions"], dtype=np.int32)
    legal_counts = np.array(data["legal_counts"], dtype=np.int32)
    outcomes = np.array(data["outcomes"], dtype=np.int32)

    print(f"Features shape: {features.shape}")
    print(f"Actions shape: {actions.shape}")

    # Save as compressed NPZ
    np.savez_compressed(
        output_path,
        features=features,
        actions=actions,
        legal_counts=legal_counts,
        outcomes=outcomes,
        feature_dim=np.array([feature_dim]),
        num_samples=np.array([num_samples]),
        num_games=np.array([data["num_games"]]),
    )

    # Report file size
    output_size = Path(output_path).stat().st_size
    print(f"Saved to: {output_path} ({output_size / 1024:.1f} KB)")


def jsonl_to_npz(input_path: str, output_path: str) -> None:
    """Convert JSONL format to NumPy NPZ."""
    print(f"Loading JSONL: {input_path}")
    samples = load_jsonl(input_path)

    if not samples:
        print("Error: No samples found in JSONL file")
        sys.exit(1)

    feature_dim = len(samples[0]["features"])
    num_samples = len(samples)

    print(f"Found {num_samples} samples with {feature_dim} features")

    features = np.array([s["features"] for s in samples], dtype=np.float32)
    actions = np.array([s["action"] for s in samples], dtype=np.int32)
    legal_counts = np.array([s["legal_count"] for s in samples], dtype=np.int32)
    outcomes = np.array([s["outcome"] for s in samples], dtype=np.int32)

    print(f"Features shape: {features.shape}")

    np.savez_compressed(
        output_path,
        features=features,
        actions=actions,
        legal_counts=legal_counts,
        outcomes=outcomes,
        feature_dim=np.array([feature_dim]),
        num_samples=np.array([num_samples]),
    )

    output_size = Path(output_path).stat().st_size
    print(f"Saved to: {output_path} ({output_size / 1024:.1f} KB)")


def jsonl_to_huggingface(input_path: str, output_dir: str) -> None:
    """Convert JSONL to HuggingFace Dataset format."""
    try:
        from datasets import Dataset, Features, Sequence, Value
    except ImportError:
        print("Error: HuggingFace datasets library required")
        print("Install with: pip install datasets")
        sys.exit(1)

    print(f"Loading JSONL: {input_path}")
    samples = load_jsonl(input_path)

    if not samples:
        print("Error: No samples found in JSONL file")
        sys.exit(1)

    feature_dim = len(samples[0]["features"])
    print(f"Found {len(samples)} samples with {feature_dim} features")

    # Convert to HuggingFace format
    hf_data = {
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
        hf_data["reasoning"] = [s.get("reasoning", "") for s in samples]

    # Create dataset
    dataset = Dataset.from_dict(hf_data)

    # Save
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    dataset.save_to_disk(output_dir)

    print(f"Saved HuggingFace dataset to: {output_dir}")
    print(f"Load with: Dataset.load_from_disk('{output_dir}')")


def npz_info(filepath: str) -> None:
    """Print information about an NPZ file."""
    print(f"Loading NPZ: {filepath}")
    data = np.load(filepath)

    print("\nArrays in file:")
    for key in data.files:
        arr = data[key]
        print(f"  {key}: shape={arr.shape}, dtype={arr.dtype}")

    if "features" in data:
        features = data["features"]
        print(f"\nFeatures statistics:")
        print(f"  Min: {features.min():.4f}")
        print(f"  Max: {features.max():.4f}")
        print(f"  Mean: {features.mean():.4f}")
        print(f"  Std: {features.std():.4f}")

    if "outcomes" in data:
        outcomes = data["outcomes"]
        wins = (outcomes == 1).sum()
        losses = (outcomes == -1).sum()
        draws = (outcomes == 0).sum()
        print(f"\nOutcome distribution:")
        print(f"  Wins: {wins} ({wins / len(outcomes) * 100:.1f}%)")
        print(f"  Losses: {losses} ({losses / len(outcomes) * 100:.1f}%)")
        print(f"  Draws: {draws} ({draws / len(outcomes) * 100:.1f}%)")


def main() -> None:
    parser = argparse.ArgumentParser(description="Convert ManaCore training data formats")
    parser.add_argument("input", help="Input file path")
    parser.add_argument("-o", "--output", help="Output file path")
    parser.add_argument(
        "--format",
        choices=["tensor", "jsonl", "auto"],
        default="auto",
        help="Input format (default: auto-detect)",
    )
    parser.add_argument("--hf", action="store_true", help="Output as HuggingFace Dataset")
    parser.add_argument("--info", action="store_true", help="Just print info about the file")

    args = parser.parse_args()
    input_path = args.input

    # Auto-detect format
    if args.format == "auto":
        if input_path.endswith(".jsonl"):
            args.format = "jsonl"
        elif input_path.endswith(".npz"):
            args.format = "npz"
        else:
            args.format = "tensor"

    # Info mode
    if args.info:
        if args.format == "npz" or input_path.endswith(".npz"):
            npz_info(input_path)
        else:
            if args.format == "jsonl":
                samples = load_jsonl(input_path)
                print(f"JSONL file with {len(samples)} samples")
            else:
                data = load_tensor_json(input_path)
                print(f"Tensor JSON with {data['num_samples']} samples from {data['num_games']} games")
        return

    # Determine output path
    if not args.output:
        if args.hf:
            args.output = Path(input_path).stem + "_hf_dataset"
        else:
            args.output = Path(input_path).stem + ".npz"

    # Convert
    if args.hf:
        if args.format != "jsonl":
            print("Error: HuggingFace output requires JSONL input")
            sys.exit(1)
        jsonl_to_huggingface(input_path, args.output)
    elif args.format == "jsonl":
        jsonl_to_npz(input_path, args.output)
    else:
        tensor_json_to_npz(input_path, args.output)


if __name__ == "__main__":
    main()
