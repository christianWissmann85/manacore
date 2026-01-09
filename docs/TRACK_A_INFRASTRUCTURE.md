# Track A: Infrastructure

**Focus:** Gym bridge, data pipeline, orchestrator
**Lead Phases:** 1, 2, 4
**Status:** ✅ Phase 1 Complete | ✅ Phase 2 Complete | 🔜 Phase 4 Next

---

## Overview

Track A builds the infrastructure that enables AI research. This includes:

1. **Gym Bridge** (Phase 1) - Python interface to the TypeScript engine
2. **Data Factory** (Phase 2) - Training data generation at scale
3. **Orchestrator** (Phase 4) - Multi-provider LLM API management

These components are foundational - Track B (Agents) cannot proceed without them.

---

## Phase 1: The Gym Bridge

**Theme:** "ManaCore becomes a Gym"

**Goal:** Create a Python package (`manacore-gym`) that allows ML researchers to train agents using standard tools (Stable Baselines3, RLlib, custom PyTorch).

### Task 1.1: HTTP Server for Python Bridge

**Location:** `packages/gym-server/`

**Tasks:**

- [x] Create package structure:

  ```
  packages/gym-server/
  ├── src/
  │   ├── index.ts           # Main server entry
  │   ├── routes/
  │   │   ├── game.ts        # Game CRUD endpoints
  │   │   ├── batch.ts       # Batch operations
  │   │   └── health.ts      # Health check
  │   ├── serialization/
  │   │   ├── state.ts       # GameState → JSON
  │   │   └── actions.ts     # Action encoding
  │   └── sessions/
  │       └── manager.ts     # Multi-game session management
  ├── package.json
  └── tsconfig.json
  ```

- [x] Implement core endpoints:

  ```typescript
  POST /game/create          → { gameId, state, legalActions }
  POST /game/:id/step        → { state, legalActions, reward, done, info }
  POST /game/:id/reset       → { state, legalActions }
  DELETE /game/:id           → { success }
  GET /health                → { status, version, games_active }
  ```

- [x] Implement batch endpoint for vectorized environments:

  ```typescript
  POST /batch/step           → [{ state, reward, done }...]
  POST /batch/reset          → [{ state, legalActions }...]
  ```

- [x] Add state serialization optimized for ML:
  - Feature vector (25 dims) - for neural networks
  - Legal action mask - for action space
  - Minimal JSON - for fast transfer

- [x] Add session management:
  - In-memory game storage (Map<gameId, GameState>)
  - Auto-cleanup after inactivity (5 min default)
  - Max concurrent games limit (1000 default)

- [x] Add CLI command:
  ```bash
  bun run gym-server --port 3333
  ```

**Success Criteria:**

- [x] Server starts on `bun run gym-server`
- [x] Can create/step/reset games via HTTP
- [x] Response time <5ms for single step (achieved: 2.5ms)
- [x] Handles 100+ concurrent games

### Task 1.2: Python Package Structure

**Location:** `packages/python-gym/`

**Tasks:**

- [x] Create package structure:

  ```
  packages/python-gym/
  ├── pyproject.toml
  ├── README.md
  ├── manacore_gym/
  │   ├── __init__.py
  │   ├── env.py              # ManaCoreBattleEnv
  │   ├── bridge.py           # HTTP client to Bun server
  │   ├── spaces.py           # Observation/action space definitions
  │   ├── wrappers/
  │   │   ├── __init__.py
  │   │   ├── action_mask.py  # Invalid action masking
  │   │   └── normalize.py    # Observation normalization
  │   └── utils/
  │       ├── __init__.py
  │       └── server.py       # Auto-start Bun server
  ├── tests/
  │   ├── test_env.py
  │   ├── test_bridge.py
  │   └── conftest.py
  └── examples/
      ├── random_agent.py
      ├── train_ppo.py
      └── evaluate_agent.py
  ```

- [x] Define `pyproject.toml`:

  ```toml
  [project]
  name = "manacore-gym"
  version = "0.1.0"
  description = "Gymnasium environment for Magic: The Gathering AI research"
  dependencies = [
      "gymnasium>=0.29.0",
      "numpy>=1.24.0",
      "requests>=2.31.0",
  ]

  [project.optional-dependencies]
  sb3 = ["stable-baselines3>=2.0.0"]
  dev = ["pytest", "black", "mypy", "ruff"]
  ```

**Success Criteria:**

- [x] `pip install -e packages/python-gym/` works
- [x] Package structure follows Python best practices
- [x] Type hints pass `mypy`

### Task 1.3: Gymnasium Environment Implementation

**Tasks:**

- [x] Implement `ManaCoreBattleEnv(gym.Env)`:

  ```python
  class ManaCoreBattleEnv(gym.Env):
      """
      Gymnasium environment for ManaCore battles.

      Observation Space: Box(25,) - normalized feature vector
      Action Space: Discrete(N) with action masking

      Reward:
        +1.0 for winning
        -1.0 for losing
        0.0 for ongoing (sparse reward)
      """

      def __init__(
          self,
          opponent: str = "greedy",  # random, greedy, mcts
          deck: str = "vanilla",
          opponent_deck: str = "vanilla",
          server_url: str = "http://localhost:3333",
          auto_start_server: bool = True,
      ):
          ...

      def reset(self, seed=None) -> tuple[np.ndarray, dict]:
          ...

      def step(self, action: int) -> tuple[np.ndarray, float, bool, bool, dict]:
          ...

      def action_masks(self) -> np.ndarray:
          """Return boolean mask of legal actions."""
          ...
  ```

- [x] Design observation space (25 dimensions):

  ```python
  self.observation_space = gym.spaces.Box(
      low=-1.0, high=1.0, shape=(25,), dtype=np.float32
  )
  ```

- [x] Design action space with masking:

  ```python
  # Max possible actions (will be masked)
  self.action_space = gym.spaces.Discrete(200)

  # Action mask returned in info dict
  info["action_mask"] = self.action_masks()
  ```

- [x] Implement reward shaping (optional):

  ```python
  # Sparse (default)
  reward = 1.0 if won else -1.0 if lost else 0.0

  # Shaped (optional)
  reward = life_delta * 0.01 + board_delta * 0.02
  ```

**Success Criteria:**

- [x] Passes `gym.utils.env_checker.check_env()`
- [x] Works with Stable Baselines3's MaskablePPO
- [x] Observation space consistent across episodes

### Task 1.4: Bridge Client Implementation

**Tasks:**

- [x] Implement `BunBridge` class:

  ```python
  class BunBridge:
      def __init__(self, url="http://localhost:3333", auto_start=True):
          self.url = url
          self.process = None
          if auto_start:
              self._start_server()
          self._wait_for_server()

      def create_game(self, opponent, deck, opponent_deck) -> dict:
          ...

      def step(self, game_id, action_index) -> dict:
          ...

      def reset(self, game_id) -> dict:
          ...

      def close(self, game_id):
          ...

      def __del__(self):
          if self.process:
              self.process.terminate()
  ```

- [x] Add connection pooling for performance (handled by requests library)
- [x] Add automatic retry on connection errors
- [x] Add server health check before operations

**Success Criteria:**

- [x] Bridge auto-starts Bun server when needed
- [x] Handles server restarts gracefully
- [x] <5ms overhead per request (achieved: 2.5ms mean)

### Task 1.5: Example Training Scripts

**Tasks:**

- [x] Create `examples/random_agent.py`:

  ```python
  """Sanity check: random agent playing games."""
  import gymnasium as gym
  import manacore_gym

  env = gym.make("ManaCore-v0", opponent="greedy")
  obs, info = env.reset(seed=42)

  total_reward = 0
  for _ in range(100):
      # Sample from legal actions only
      mask = info["action_mask"]
      legal_actions = np.where(mask)[0]
      action = np.random.choice(legal_actions)

      obs, reward, terminated, truncated, info = env.step(action)
      total_reward += reward

      if terminated or truncated:
          print(f"Game over! Reward: {reward}")
          obs, info = env.reset()
  ```

- [x] Create `examples/train_ppo.py`:

  ```python
  """Train PPO agent using Stable Baselines3."""
  from sb3_contrib import MaskablePPO
  from stable_baselines3.common.env_checker import check_env
  import manacore_gym

  env = manacore_gym.make_env(opponent="greedy")
  check_env(env)

  model = MaskablePPO(
      "MlpPolicy",
      env,
      verbose=1,
      tensorboard_log="./logs/ppo/",
  )

  model.learn(total_timesteps=100_000)
  model.save("ppo_manacore_100k")
  ```

- [x] Create `examples/evaluate_agent.py`:
  ```python
  """Evaluate trained agent vs different opponents."""
  ...
  ```

**Success Criteria:**

- [x] Random agent runs without errors
- [x] PPO training starts and logs to TensorBoard
- [x] Can save and load trained models

### Task 1.6: Vectorized Environments

**Tasks:**

- [x] Implement `make_vec_env()` helper:

  ```python
  from stable_baselines3.common.vec_env import SubprocVecEnv

  def make_vec_env(n_envs=8, opponent="greedy"):
      def make_env(seed):
          def _init():
              env = ManaCoreBattleEnv(opponent=opponent)
              env.reset(seed=seed)
              return env
          return _init

      return SubprocVecEnv([make_env(i) for i in range(n_envs)])
  ```

- [x] Test parallel training with 8 environments
- [x] Measure games/second throughput

**Success Criteria:**

- [x] Can train on 8+ environments in parallel
- [x] ~8 games/second from Python (HTTP overhead; step latency 2.5ms meets <5ms target)
- [x] Memory usage stable (no leaks)

### Task 1.7: Testing & Documentation

**Tasks:**

- [x] Write unit tests:

  ```python
  def test_env_reset():
      env = ManaCoreBattleEnv()
      obs, info = env.reset(seed=42)
      assert obs.shape == (25,)
      assert "action_mask" in info

  def test_env_step():
      env = ManaCoreBattleEnv()
      obs, info = env.reset(seed=42)
      legal = np.where(info["action_mask"])[0]
      obs, reward, term, trunc, info = env.step(legal[0])
      assert obs.shape == (25,)

  def test_determinism():
      # Same seed → same game
      ...
  ```

- [x] Write comprehensive README:
  - Installation instructions
  - Quick start example
  - API reference
  - Training guide

- [x] Create tutorial Jupyter notebook:
  - `notebooks/01_getting_started.ipynb`

**Success Criteria:**

- [x] All tests pass with `pytest` (8 tests, 7 passed, 1 xfail for server-side determinism)
- [x] README covers all use cases
- [x] Notebook runs without errors

### Task 1.8: PyPI Publishing Preparation

**Tasks:**

- [x] Add LICENSE file (MIT)
- [x] Add CHANGELOG.md
- [x] Test installation from source
- [x] Prepare for PyPI upload:
  ```bash
  cd packages/python-gym
  python -m build
  twine check dist/*
  ```

**Success Criteria:**

- [x] Package builds cleanly
- [x] Can install from wheel
- [x] Ready for `twine upload` (when Phase 1 complete)

---

## Phase 2: Data Factory (Track A portion)

**Theme:** "Training data at scale"

**Goal:** Generate 10K+ games with high-quality labels for neural network training.

### Task 2.1: Dual-Format Export

**Tasks:**

- [x] Add JSONL export to `TrainingDataCollector`:

  ```typescript
  // For HuggingFace / LLM fine-tuning
  export function saveAsJSONL(data: GameTrainingData, filepath: string) {
    const lines = data.samples.map((s) =>
      JSON.stringify({
        features: featuresToArray(s.features),
        action: s.actionIndex,
        legal_count: s.legalActionCount,
        outcome: data.outcome,
        reasoning: s.reasoning,
      }),
    );
    writeFileSync(filepath, lines.join('\n'));
  }
  ```

- [x] Add NPZ export for PyTorch:

  ```typescript
  // Binary format for fast loading via Python conversion
  export function exportForNumPy(datasets: GameTrainingData[], filepath: string) {
    // Exports JSON tensor format that Python converts to NPZ
  }
  ```

- [x] Add format conversion script:
  ```bash
  python scripts/convert-training-data.py tensors.json -o data.npz
  python scripts/convert-training-data.py data.jsonl -o data.npz --format jsonl
  python scripts/convert-training-data.py data.jsonl -o ./hf_dataset --format jsonl --hf
  ```

**Success Criteria:**

- [x] JSONL files load in Python with `json.loads()`
- [x] NPZ files load with `np.load()`
- [x] Both formats contain identical data

### Task 2.2: Batch Data Generation

**Tasks:**

- [x] Create cloud generation script:

  ```bash
  # Run overnight on DigitalOcean
  bun scripts/generate-batch-data.ts \
    --games 10000 \
    --p1 mcts-eval \
    --p2 greedy \
    --output ./data/mcts-vs-greedy-10k/
  ```

- [x] Add progress tracking and resume capability
- [x] Add quality metrics logging:
  - Games per hour
  - Average game length (turns/game)
  - Win rate distribution
  - Total samples collected

**Success Criteria:**

- [x] Generate 10K games in <24 hours on cloud
- [x] Data quality verified (no corrupted games)
- [x] Can resume from interruption (`--resume` flag)

### Task 2.3: HuggingFace Dataset Card

**Tasks:**

- [x] Create dataset card for HuggingFace Hub:
  - See `docs/HUGGINGFACE_DATASET_CARD.md`
  - YAML frontmatter with license, task_categories, tags
  - Complete feature vector documentation
  - PyTorch DataLoader example
  - Generation command examples

- [x] Upload initial dataset (10K games)
  - URL: https://huggingface.co/datasets/Chris-AiKi/manacore-mtg-10k
  - 10,000 games, 474,410 samples
- [x] Add dataset loading example:
  ```python
  from datasets import load_dataset
  dataset = load_dataset("Chris-AiKi/manacore-mtg-10k")
  ```

**Success Criteria:**

- [x] Dataset visible on HuggingFace Hub
- [x] Can load with `datasets` library
- [x] Documentation complete

---

## Phase 4: LLM Training Pipeline

**Theme:** "Multi-provider orchestration"

**Goal:** Build infrastructure to generate training data using Claude, Gemini, and other LLMs.

### Task 4.1: Orchestrator Package

**Location:** `packages/orchestrator/`

**Tasks:**

- [ ] Create package structure:

  ```
  packages/orchestrator/
  ├── src/
  │   ├── index.ts           # Main entry
  │   ├── providers/
  │   │   ├── base.ts        # Provider interface
  │   │   ├── anthropic.ts   # Claude API
  │   │   ├── google.ts      # Gemini API
  │   │   ├── openai.ts      # GPT API
  │   │   └── local.ts       # Ollama/vLLM
  │   ├── game/
  │   │   ├── session.ts     # Game session management
  │   │   └── prompt.ts      # Prompt templates
  │   ├── data/
  │   │   ├── collector.ts   # Training data collection
  │   │   └── storage.ts     # File management
  │   └── config/
  │       └── types.ts       # Configuration types
  ├── package.json
  └── tsconfig.json
  ```

- [ ] Implement provider interface:

  ```typescript
  interface LLMProvider {
    name: string;
    chooseAction(
      state: string, // Rendered game state
      actions: string[], // Legal action descriptions
    ): Promise<{
      actionIndex: number;
      reasoning: string;
    }>;
  }
  ```

- [ ] Implement Anthropic provider (Claude)
- [ ] Implement Google provider (Gemini)
- [ ] Add cost tracking per provider

**Success Criteria:**

- [ ] Can generate games with Claude API
- [ ] Can generate games with Gemini API
- [ ] Cost per game tracked and logged

### Task 4.2: Batch Generation CLI

**Tasks:**

- [ ] Create orchestrator CLI:

  ```bash
  bun run orchestrator generate \
    --provider anthropic \
    --model claude-sonnet-4-20250514 \
    --games 100 \
    --opponent greedy \
    --output ./data/claude-games/
  ```

- [ ] Add parallel game support (multiple API calls)
- [ ] Add resume capability
- [ ] Add cost estimation before run

**Success Criteria:**

- [ ] Can generate 100 games overnight
- [ ] Parallel execution works (3-5 concurrent)
- [ ] Cost tracking accurate

### Task 4.3: LLM vs LLM Mode

**Tasks:**

- [ ] Implement dual-LLM game mode:

  ```bash
  bun run orchestrator duel \
    --player1 anthropic:claude-sonnet-4.5 \
    --player2 google:gemini-3.0-flash \
    --games 50 \
    --output ./data/claude-vs-gemini/
  ```

- [ ] Capture reasoning from both players
- [ ] Track win rates by provider

**Success Criteria:**

- [ ] Both LLMs can play a complete game
- [ ] Reasoning captured for both sides
- [ ] Head-to-head statistics tracked

---

## Dependencies

### Track A → Track B

```
Phase 1 (Gym Bridge) → Phase 2B (Neural Imitator)
                     → Phase 3 (PPO Specialists)

Phase 2A (Data Factory) → Phase 2B (Neural Imitator)

Phase 4 (Orchestrator) → Phase 5 (Llama-Mage)
```

### External Dependencies

| Component    | Dependency            | Version |
| ------------ | --------------------- | ------- |
| Gym Server   | Hono (HTTP framework) | ^4.0.0  |
| Python Gym   | gymnasium             | ^0.29.0 |
| Python Gym   | numpy                 | ^1.24.0 |
| Orchestrator | @anthropic-ai/sdk     | ^0.30.0 |
| Orchestrator | @google/generative-ai | ^0.21.0 |

---

## Success Metrics

| Metric             | Target     | Measurement       |
| ------------------ | ---------- | ----------------- |
| Games/sec (Python) | >100       | Benchmark script  |
| Parallel envs      | 8+         | SB3 SubprocVecEnv |
| Training data      | 10K+ games | File count        |
| LLM cost/game      | <$0.10     | API billing       |
| PyPI downloads     | 100+       | PyPI stats        |

---

## Notes

- The Gym server is intentionally separate from the MCP server to avoid protocol mixing
- The orchestrator starts minimal and can be expanded to support more providers
- All training data should be compatible with HuggingFace datasets library
