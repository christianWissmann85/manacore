"""
ImitatorNet: Simple MLP for behavior cloning.

Architecture:
    Input:  25 features (normalized game state)
    Hidden: 256 -> ReLU -> 256 -> ReLU -> 128 -> ReLU
    Output: logits over action indices

Parameters: ~100K (small and fast)
"""

import torch
import torch.nn as nn
import torch.nn.functional as F


class ImitatorNet(nn.Module):
    """
    Simple MLP that learns to imitate bot decisions.

    The network outputs logits for each possible action index.
    During inference, these are masked by legal actions and
    used to select the best move.
    """

    def __init__(
        self,
        input_dim: int = 25,
        hidden_dims: tuple[int, ...] = (256, 256, 128),
        output_dim: int = 200,  # Max action space size
        dropout: float = 0.1,
    ):
        super().__init__()

        self.input_dim = input_dim
        self.output_dim = output_dim

        # Build hidden layers
        layers: list[nn.Module] = []
        prev_dim = input_dim

        for hidden_dim in hidden_dims:
            layers.append(nn.Linear(prev_dim, hidden_dim))
            layers.append(nn.ReLU())
            if dropout > 0:
                layers.append(nn.Dropout(dropout))
            prev_dim = hidden_dim

        self.hidden = nn.Sequential(*layers)

        # Output layer
        self.output = nn.Linear(prev_dim, output_dim)

        # Initialize weights
        self._init_weights()

    def _init_weights(self):
        """Initialize weights using Xavier/Glorot initialization."""
        for module in self.modules():
            if isinstance(module, nn.Linear):
                nn.init.xavier_uniform_(module.weight)
                if module.bias is not None:
                    nn.init.zeros_(module.bias)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        Forward pass.

        Args:
            x: Input features of shape (batch, input_dim)

        Returns:
            Logits of shape (batch, output_dim)
        """
        h = self.hidden(x)
        logits = self.output(h)
        return logits

    def predict_action(
        self,
        features: torch.Tensor,
        legal_mask: torch.Tensor,
        temperature: float = 1.0,
        sample: bool = False,
    ) -> tuple[torch.Tensor, torch.Tensor]:
        """
        Predict action with legal action masking.

        Args:
            features: Input features (batch, input_dim)
            legal_mask: Boolean mask of legal actions (batch, max_actions)
            temperature: Softmax temperature (lower = more deterministic)
            sample: If True, sample from distribution; if False, take argmax

        Returns:
            action_indices: Selected action indices (batch,)
            action_probs: Probabilities of all actions (batch, max_actions)
        """
        logits = self.forward(features)

        # Apply mask: set illegal actions to -inf
        masked_logits = logits.clone()
        masked_logits[~legal_mask] = float("-inf")

        # Apply temperature
        if temperature != 1.0:
            masked_logits = masked_logits / temperature

        # Get probabilities
        probs = F.softmax(masked_logits, dim=-1)

        if sample:
            # Sample from distribution
            action_indices = torch.multinomial(probs, num_samples=1).squeeze(-1)
        else:
            # Take argmax
            action_indices = torch.argmax(probs, dim=-1)

        return action_indices, probs

    def get_num_params(self) -> int:
        """Get total number of trainable parameters."""
        return sum(p.numel() for p in self.parameters() if p.requires_grad)

    def export_onnx(self, path: str, opset_version: int = 14):
        """
        Export model to ONNX format for TypeScript inference.

        Args:
            path: Output path for .onnx file
            opset_version: ONNX opset version
        """
        # Move to CPU for export
        self.eval()
        self.cpu()

        # Create dummy input on CPU
        dummy_input = torch.randn(1, self.input_dim)

        # Export using legacy exporter for compatibility
        torch.onnx.export(
            self,
            dummy_input,
            path,
            input_names=["features"],
            output_names=["logits"],
            dynamic_axes={
                "features": {0: "batch_size"},
                "logits": {0: "batch_size"},
            },
            opset_version=opset_version,
            dynamo=False,  # Use legacy exporter
        )

        print(f"Exported ONNX model to: {path}")


def create_imitator_net(
    input_dim: int = 25,
    hidden_dims: tuple[int, ...] = (256, 256, 128),
    output_dim: int = 200,
    dropout: float = 0.1,
    device: str = "cpu",
) -> ImitatorNet:
    """
    Factory function to create ImitatorNet.

    Args:
        input_dim: Number of input features
        hidden_dims: Tuple of hidden layer sizes
        output_dim: Number of output logits (max action space)
        dropout: Dropout probability
        device: Device to place model on

    Returns:
        Initialized ImitatorNet on specified device
    """
    model = ImitatorNet(
        input_dim=input_dim,
        hidden_dims=hidden_dims,
        output_dim=output_dim,
        dropout=dropout,
    )

    model = model.to(device)

    print(f"Created ImitatorNet with {model.get_num_params():,} parameters")
    print(f"  Input: {input_dim} -> Hidden: {hidden_dims} -> Output: {output_dim}")

    return model
