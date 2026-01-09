#!/usr/bin/env python3
"""
Train ImitatorNet on ManaCore training data.

This script trains a simple MLP to imitate bot decisions (behavior cloning).

Usage:
    # Train on HuggingFace dataset
    uv run python examples/train_imitator.py --epochs 50

    # Train on local NPZ file
    uv run python examples/train_imitator.py --data ./data/training-data.npz --epochs 50

    # Export to ONNX after training
    uv run python examples/train_imitator.py --epochs 50 --export-onnx

Requirements:
    pip install torch datasets
"""

import argparse
from pathlib import Path

import torch


def main() -> None:
    parser = argparse.ArgumentParser(description="Train ImitatorNet on ManaCore data")

    # Data
    parser.add_argument("--data", type=str, default=None, help="Path to NPZ data file (default: load from HuggingFace)")
    parser.add_argument("--repo", type=str, default="Chris-AiKi/manacore-mtg-10k", help="HuggingFace dataset repo ID")
    parser.add_argument("--val-split", type=float, default=0.1, help="Validation split ratio")

    # Model
    parser.add_argument("--hidden", type=int, nargs="+", default=[256, 256, 128], help="Hidden layer sizes")
    parser.add_argument("--output-dim", type=int, default=350, help="Output dimension (max action space)")
    parser.add_argument("--dropout", type=float, default=0.1, help="Dropout probability")

    # Training
    parser.add_argument("--epochs", type=int, default=50, help="Number of training epochs")
    parser.add_argument("--batch-size", type=int, default=256, help="Batch size")
    parser.add_argument("--lr", type=float, default=1e-3, help="Learning rate")
    parser.add_argument("--weight-decay", type=float, default=0.01, help="Weight decay")
    parser.add_argument("--label-smoothing", type=float, default=0.1, help="Label smoothing")

    # Output
    parser.add_argument("--output", type=str, default="./models/imitator", help="Output directory")
    parser.add_argument("--export-onnx", action="store_true", help="Export to ONNX after training")

    # Device
    parser.add_argument("--device", type=str, default=None, help="Device (default: auto)")

    args = parser.parse_args()

    # Import here to avoid slow startup
    from manacore_gym.neural import Trainer, TrainingConfig, create_imitator_net, load_from_huggingface, load_from_npz
    from manacore_gym.neural.data_loader import create_data_loaders, train_val_split

    # Determine device
    if args.device is None:
        args.device = "cuda" if torch.cuda.is_available() else "cpu"

    print("=" * 60)
    print("ManaCore ImitatorNet Training")
    print("=" * 60)

    # Load data
    if args.data:
        print(f"\nLoading data from: {args.data}")
        dataset = load_from_npz(args.data)
    else:
        print(f"\nLoading data from HuggingFace: {args.repo}")
        dataset = load_from_huggingface(args.repo, split="train")

    # Split into train/val
    print(f"\nSplitting data (val_ratio={args.val_split})...")
    train_dataset, val_dataset = train_val_split(dataset, val_ratio=args.val_split)

    # Create data loaders
    train_loader, val_loader = create_data_loaders(
        train_dataset,
        val_dataset,
        batch_size=args.batch_size,
    )

    # Create model
    # Note: input_dim is auto-detected from data, but we default to 36 (v2.0)
    print("\nCreating model...")
    input_dim = train_dataset.num_features  # Auto-detect from data
    print(f"  Detected {input_dim} input features")

    model = create_imitator_net(
        input_dim=input_dim,
        hidden_dims=tuple(args.hidden),
        output_dim=args.output_dim,
        dropout=args.dropout,
        device=args.device,
    )

    # Training config
    config = TrainingConfig(
        learning_rate=args.lr,
        weight_decay=args.weight_decay,
        batch_size=args.batch_size,
        epochs=args.epochs,
        label_smoothing=args.label_smoothing,
        device=args.device,
    )

    # Create trainer
    trainer = Trainer(
        model=model,
        config=config,
        train_loader=train_loader,
        val_loader=val_loader,
        output_dir=args.output,
    )

    # Train
    print("\n" + "=" * 60)
    print("Starting training...")
    print("=" * 60 + "\n")

    stats = trainer.train()

    # Export to ONNX
    if args.export_onnx:
        output_dir = Path(args.output)
        onnx_path = output_dir / "imitator.onnx"
        print(f"\nExporting to ONNX: {onnx_path}")
        model.export_onnx(str(onnx_path))

    # Summary
    print("\n" + "=" * 60)
    print("Training Complete!")
    print("=" * 60)
    print(f"Final train accuracy: {stats.train_acc * 100:.1f}%")
    print(f"Best val accuracy: {stats.best_val_acc * 100:.1f}%")
    print(f"Model saved to: {args.output}")

    if args.export_onnx:
        print(f"ONNX model: {args.output}/imitator.onnx")


if __name__ == "__main__":
    main()
