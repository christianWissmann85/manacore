#!/usr/bin/env bash
#
# Setup script for ManaCore Python Gym notebooks
# This script sets up all dependencies needed to run Jupyter notebooks
#

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PYTHON_GYM_DIR="$SCRIPT_DIR/../packages/python-gym"

echo "🔧 Setting up ManaCore Gym notebook environment..."

# Check if uv is installed
if ! command -v uv &> /dev/null; then
    echo "❌ Error: uv is not installed."
    echo "Install it with: curl -LsSf https://astral.sh/uv/install.sh | sh"
    exit 1
fi

# Navigate to python-gym directory
cd "$PYTHON_GYM_DIR"

# Sync dependencies with notebook extras
echo "📦 Installing dependencies (this may take a few minutes)..."
uv sync --extra notebook

# Verify installation
echo "✅ Verifying installation..."
.venv/bin/python -c "import ipykernel, jupyter, manacore_gym, sb3_contrib" || {
    echo "❌ Installation verification failed"
    exit 1
}

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Open VS Code"
echo "2. Open any notebook in packages/python-gym/notebooks/"
echo "3. Select kernel: Python 3.x ('.venv': venv)"
echo "4. Press play to run cells!"
echo ""
echo "For manual setup, see: packages/python-gym/notebooks/README.md"
