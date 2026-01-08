#!/bin/bash
set -e

# Default to the pipeline experiment if no argument is provided
EXPERIMENT_FILE=${1:-experiments/mcts-greedy-tuning-pipeline.json}

# Ensure we are in the project root
if [ ! -f "package.json" ]; then
  echo "Error: Please run this script from the project root."
  exit 1
fi

# Build image
echo "Building Docker image..."
docker build -t manacore .

# Run container
echo "Running experiment: $EXPERIMENT_FILE"
echo "Mounting ./output to /app/output"
echo "Mounting ./experiments to /app/experiments"

# We use the relative path of the experiment file inside the container
# If the user passed "experiments/my-exp.json", we pass that directly.
# If they passed "my-exp.json", we assume it's in the root? No, strict relative paths are safer.

docker run --rm \
  -v "$(pwd)/output:/app/output" \
  -v "$(pwd)/experiments:/app/experiments" \
  manacore run "$EXPERIMENT_FILE"
