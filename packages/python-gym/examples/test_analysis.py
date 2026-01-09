#!/usr/bin/env python3
"""
Quick test of the analysis toolkit.
"""

from manacore_gym.analysis import quick_analysis

# Test loading
print("Testing Phase 3 Analysis Toolkit...\n")

analyzer = quick_analysis("./logs")

print("\n✨ Success! You can now:")
print("  1. Open notebooks/02_phase3_analysis.ipynb in Jupyter")
print("  2. Use the command: uv run python scripts/analyze_training.py")
print("  3. Import in your own scripts:")
print("     from manacore_gym.analysis import TrainingAnalyzer\n")
