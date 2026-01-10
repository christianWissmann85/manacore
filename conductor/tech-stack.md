# Tech Stack - ManaCore

## Core Technologies

- **Runtime:** [Bun](https://bun.sh) (v1.0+) - Chosen for high-speed execution and a unified toolchain for TypeScript.
- **Languages:**
  - **TypeScript:** Primary language for the game engine, AI logic, and clients.
  - **Python:** Used for machine learning integration, reinforcement learning (PPO), and data analysis.
    - **Dependency Management:** [uv](https://github.com/astral-sh/uv)
    - **Tooling:** mypy (type checking), ruff (linting/formatting), pytest (testing)

## Frontend & Visualization

- **React:** Powering the "Glass-Box" Web Client.
- **Tailwind CSS:** For functional and responsive UI styling.
- **Vite:** Build tool for the frontend.

## Research & Integration

- **Gymnasium (Python):** Standardized API for reinforcement learning experiments.
- **Model Context Protocol (MCP):** To expose the engine to LLM-based agents like Claude.
- **FastAPI (Python):** Potential use for Gym Server integration.

## Infrastructure & Tooling

- **Monorepo:** Managed via Bun Workspaces.
- **Testing:** Bun's built-in test runner for TypeScript; pytest for Python.
- **Linting & Formatting:** ESLint/Prettier for TypeScript; ruff for Python.
- **Containerization:** Docker for reproducible environments.
