"""
Training utilities for ImitatorNet.
"""

from dataclasses import dataclass
from pathlib import Path
from typing import Callable

import torch
import torch.nn as nn
from torch.optim import AdamW
from torch.optim.lr_scheduler import CosineAnnealingLR
from torch.utils.data import DataLoader

from .imitator import ImitatorNet


@dataclass
class TrainingConfig:
    """Configuration for training."""

    # Optimization
    learning_rate: float = 1e-3
    weight_decay: float = 0.01
    batch_size: int = 256
    epochs: int = 50

    # Learning rate schedule
    use_scheduler: bool = True
    warmup_epochs: int = 2

    # Regularization
    label_smoothing: float = 0.1

    # Logging
    log_every: int = 100
    eval_every: int = 1  # Evaluate every N epochs

    # Checkpointing
    save_best: bool = True
    save_every: int = 10  # Save every N epochs

    # Device
    device: str = "cuda" if torch.cuda.is_available() else "cpu"


@dataclass
class TrainingStats:
    """Statistics from training."""

    epoch: int = 0
    train_loss: float = 0.0
    train_acc: float = 0.0
    val_loss: float = 0.0
    val_acc: float = 0.0
    best_val_acc: float = 0.0
    learning_rate: float = 0.0


class Trainer:
    """
    Trainer for ImitatorNet.

    Handles:
        - Training loop with early stopping
        - Validation evaluation
        - Checkpointing
        - Logging
    """

    def __init__(
        self,
        model: ImitatorNet,
        config: TrainingConfig,
        train_loader: DataLoader,
        val_loader: DataLoader | None = None,
        output_dir: str | Path = "./models",
    ):
        self.model = model.to(config.device)
        self.config = config
        self.train_loader = train_loader
        self.val_loader = val_loader
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

        # Optimizer
        self.optimizer = AdamW(
            model.parameters(),
            lr=config.learning_rate,
            weight_decay=config.weight_decay,
        )

        # Scheduler
        self.scheduler = None
        if config.use_scheduler:
            self.scheduler = CosineAnnealingLR(
                self.optimizer,
                T_max=config.epochs - config.warmup_epochs,
                eta_min=config.learning_rate * 0.01,
            )

        # Loss function with label smoothing
        self.criterion = nn.CrossEntropyLoss(label_smoothing=config.label_smoothing)

        # Tracking
        self.stats = TrainingStats()
        self.history: list[TrainingStats] = []

    def train_epoch(self) -> tuple[float, float]:
        """Train for one epoch. Returns (loss, accuracy)."""
        self.model.train()

        total_loss = 0.0
        correct = 0
        total = 0

        for batch_idx, batch in enumerate(self.train_loader):
            features = batch["features"].to(self.config.device)
            actions = batch["action"].to(self.config.device)
            legal_counts = batch["legal_count"].to(self.config.device)

            # Forward
            logits = self.model(features)

            # Create mask based on legal_count for accuracy calculation
            batch_size = features.shape[0]
            max_actions = logits.shape[1]
            mask = torch.arange(max_actions, device=self.config.device).unsqueeze(0) < legal_counts.unsqueeze(1)

            # Loss on raw logits (target actions are always valid)
            loss = self.criterion(logits, actions)

            # For accuracy, use masked logits
            masked_logits = logits.clone()
            masked_logits[~mask] = float("-inf")

            # Backward
            self.optimizer.zero_grad()
            loss.backward()
            torch.nn.utils.clip_grad_norm_(self.model.parameters(), 1.0)
            self.optimizer.step()

            # Stats
            total_loss += loss.item()
            pred = masked_logits.argmax(dim=-1)
            correct += (pred == actions).sum().item()
            total += batch_size

            # Logging
            if (batch_idx + 1) % self.config.log_every == 0:
                avg_loss = total_loss / (batch_idx + 1)
                acc = correct / total * 100
                print(f"    Batch {batch_idx + 1}/{len(self.train_loader)}: loss={avg_loss:.4f}, acc={acc:.1f}%")

        avg_loss = total_loss / len(self.train_loader)
        accuracy = correct / total

        return avg_loss, accuracy

    @torch.no_grad()
    def evaluate(self) -> tuple[float, float]:
        """Evaluate on validation set. Returns (loss, accuracy)."""
        if self.val_loader is None:
            return 0.0, 0.0

        self.model.eval()

        total_loss = 0.0
        correct = 0
        total = 0

        for batch in self.val_loader:
            features = batch["features"].to(self.config.device)
            actions = batch["action"].to(self.config.device)
            legal_counts = batch["legal_count"].to(self.config.device)

            # Forward
            logits = self.model(features)

            # Mask for accuracy calculation
            max_actions = logits.shape[1]
            mask = torch.arange(max_actions, device=self.config.device).unsqueeze(0) < legal_counts.unsqueeze(1)
            masked_logits = logits.clone()
            masked_logits[~mask] = float("-inf")

            # Loss on raw logits
            loss = self.criterion(logits, actions)
            total_loss += loss.item()

            # Accuracy with masking
            pred = masked_logits.argmax(dim=-1)
            correct += (pred == actions).sum().item()
            total += features.shape[0]

        avg_loss = total_loss / len(self.val_loader)
        accuracy = correct / total

        return avg_loss, accuracy

    def train(self, callback: Callable[[TrainingStats], None] | None = None) -> TrainingStats:
        """
        Full training loop.

        Args:
            callback: Optional callback called after each epoch

        Returns:
            Final training statistics
        """
        print(f"Training on {self.config.device}")
        print(f"  Epochs: {self.config.epochs}")
        print(f"  Batch size: {self.config.batch_size}")
        print(f"  Learning rate: {self.config.learning_rate}")
        print(f"  Train samples: {len(self.train_loader.dataset):,}")  # type: ignore[arg-type]
        if self.val_loader:
            print(f"  Val samples: {len(self.val_loader.dataset):,}")  # type: ignore[arg-type]
        print()

        best_val_acc = 0.0

        for epoch in range(1, self.config.epochs + 1):
            print(f"Epoch {epoch}/{self.config.epochs}")

            # Train
            train_loss, train_acc = self.train_epoch()

            # Update scheduler (after warmup)
            if self.scheduler and epoch > self.config.warmup_epochs:
                self.scheduler.step()

            # Evaluate
            val_loss, val_acc = 0.0, 0.0
            if self.val_loader and epoch % self.config.eval_every == 0:
                val_loss, val_acc = self.evaluate()

            # Get current learning rate
            lr = self.optimizer.param_groups[0]["lr"]

            # Update stats
            self.stats = TrainingStats(
                epoch=epoch,
                train_loss=train_loss,
                train_acc=train_acc,
                val_loss=val_loss,
                val_acc=val_acc,
                best_val_acc=max(best_val_acc, val_acc),
                learning_rate=lr,
            )
            self.history.append(self.stats)

            # Log
            print(f"  Train: loss={train_loss:.4f}, acc={train_acc * 100:.1f}%")
            if self.val_loader:
                print(f"  Val:   loss={val_loss:.4f}, acc={val_acc * 100:.1f}%")
            print(f"  LR: {lr:.2e}")

            # Save best model
            if self.config.save_best and val_acc > best_val_acc:
                best_val_acc = val_acc
                self.save(self.output_dir / "best_model.pt")
                print(f"  Saved best model (val_acc={val_acc * 100:.1f}%)")

            # Save checkpoint
            if epoch % self.config.save_every == 0:
                self.save(self.output_dir / f"checkpoint_epoch_{epoch}.pt")

            # Callback
            if callback:
                callback(self.stats)

            print()

        # Save final model
        self.save(self.output_dir / "final_model.pt")
        print(f"Training complete. Best val accuracy: {best_val_acc * 100:.1f}%")

        return self.stats

    def save(self, path: str | Path) -> None:
        """Save model and training state."""
        path = Path(path)
        torch.save(
            {
                "model_state_dict": self.model.state_dict(),
                "optimizer_state_dict": self.optimizer.state_dict(),
                "scheduler_state_dict": self.scheduler.state_dict() if self.scheduler else None,
                "stats": self.stats,
                "config": self.config,
            },
            path,
        )

    def load(self, path: str | Path) -> None:
        """Load model and training state."""
        path = Path(path)
        checkpoint = torch.load(path, map_location=self.config.device)

        self.model.load_state_dict(checkpoint["model_state_dict"])
        self.optimizer.load_state_dict(checkpoint["optimizer_state_dict"])
        if self.scheduler and checkpoint["scheduler_state_dict"]:
            self.scheduler.load_state_dict(checkpoint["scheduler_state_dict"])
        self.stats = checkpoint["stats"]

        print(f"Loaded checkpoint from {path}")
        print(f"  Epoch: {self.stats.epoch}")
        print(f"  Best val acc: {self.stats.best_val_acc * 100:.1f}%")
