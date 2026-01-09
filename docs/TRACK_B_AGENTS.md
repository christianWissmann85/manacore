# Track B: Agents

**Focus:** Neural networks, reinforcement learning, LLM agents
**Lead Phases:** 2, 3, 5, 6
**Status:** Phase 2B Complete (January 8, 2026)

---

## Overview

Track B builds the intelligent agents that play Magic: The Gathering. We follow a progression from simple to complex:

1. **Neural Imitator** (Phase 2) - Learn to mimic MCTS
2. **PPO Specialists** (Phase 3) - RL agents trained from scratch
3. **Llama-Mage** (Phase 5) - Fine-tuned LLM with reasoning
4. **AlphaZero** (Phase 6) - Self-play training loop

Each stage builds on the previous, validating infrastructure before adding complexity.

---

## Agent Roster

### Baseline Agents (Complete)

| Agent     | Type      | Speed       | Strength | Use Case          |
| --------- | --------- | ----------- | -------- | ----------------- |
| RandomBot | Random    | 1000+ g/s   | Weak     | Testing, baseline |
| GreedyBot | Heuristic | 100-200 g/s | Medium   | Fast evaluation   |
| MCTSBot   | Search    | 3-30 g/s    | Strong   | Gold standard     |

### Research Agents

| Agent          | Type             | Phase | Status    | Use Case          |
| -------------- | ---------------- | ----- | --------- | ----------------- |
| NeuralImitator | Behavior Cloning | 2B    | ✅ Done    | Validate pipeline |
| Agent Ignis    | PPO (Red)        | 3     | Planned   | Specialist study  |
| Agent Aqua     | PPO (Blue)       | 3     | Planned   | Specialist study  |
| Agent Silva    | PPO (Green)      | 3     | Planned   | Specialist study  |
| Llama-Mage     | Fine-tuned LLM   | 5     | Planned   | Interpretability  |
| AlphaCore      | Self-play NN     | 6     | Planned   | Peak performance  |

---

## ✅ Phase 2B: Neural Imitator (Complete)

**Theme:** "Learn to mimic the master"

**Goal:** Train a simple neural network to predict bot moves. This validates the entire ML pipeline before investing in RL.

**Completed:** January 8, 2026

### Summary

Successfully implemented end-to-end neural network training pipeline:

1. **Training Data**: 10K games (474K samples) from GreedyBot vs GreedyBot
   - Dataset: [Chris-AiKi/manacore-mtg-10k](https://huggingface.co/datasets/Chris-AiKi/manacore-mtg-10k)

2. **Model**: ImitatorNet (150K parameters)
   - Architecture: 25 → 256 → 256 → 128 → 350 (logits)
   - Training: 30 epochs with label smoothing (0.1)
   - Validation accuracy: 47.3%

3. **Deployment**: ONNX export (589KB) for TypeScript inference

### Benchmark Results

| Matchup                  | Win Rate | Target | Status |
| ------------------------ | -------- | ------ | ------ |
| NeuralBot vs RandomBot   | 60.0%    | >80%   | ⚠️      |
| NeuralBot vs GreedyBot   | 18.0%    | >50%   | ⚠️      |
| GreedyBot vs RandomBot   | 89.0%    | -      | ✅      |

**Analysis**: NeuralBot underperforms targets, likely due to:
- Training on Greedy data (not MCTS) - simpler decision patterns
- 47% validation accuracy means ~50% of moves are "wrong"
- Better data (MCTS games) would improve quality

### Files Created

```
packages/python-gym/manacore_gym/neural/
├── __init__.py
├── imitator.py      # ImitatorNet architecture
├── data_loader.py   # HuggingFace/NPZ data loading
└── trainer.py       # Training loop with label smoothing

packages/python-gym/examples/
└── train_imitator.py    # Training script

packages/ai/src/neural/
├── index.ts
├── NeuralBot.ts     # ONNX Runtime inference
└── benchmark.ts     # Bot comparison script

packages/ai/models/
└── imitator.onnx    # Trained model (589KB)
```

### Task 2B.1: Model Architecture ✅

- [x] Created neural network module in `packages/python-gym/manacore_gym/neural/`
- [x] Defined ImitatorNet: 25 → 256 → 256 → 128 → 350 logits
- [x] ONNX export support with `model.export_onnx()`

### Task 2B.2: Training Pipeline ✅

- [x] Implemented HuggingFace data loader (`data_loader.py`)
- [x] Implemented training loop with label smoothing (`trainer.py`)
- [x] Training script: `uv run python examples/train_imitator.py`
- [x] Model achieves 47.3% validation accuracy

### Task 2B.3: NeuralBot Implementation ✅

- [x] Implemented `NeuralBot` with ONNX Runtime inference
- [x] Added to package exports (`@manacore/ai`)
- [x] Async `chooseActionAsync()` for ONNX compatibility
- [x] Benchmark script for comparison

### Task 2B.4: Validation & Analysis ✅

- [x] Compared NeuralBot to baselines (see results above)
- [x] Identified weakness: training data quality
- [x] Pipeline validated end-to-end

### Lessons Learned

1. **Data quality matters**: Greedy vs Greedy produces simpler patterns than MCTS
2. **Action masking**: Compute loss on raw logits, mask only for accuracy
3. **ONNX export**: Use legacy exporter (`dynamo=False`) for compatibility
4. **Label smoothing**: Helps with noisy training data

### Next Steps (Optional Improvements)

- [ ] Retrain on MCTS data for better decision quality
- [ ] Expand feature set beyond 25 dimensions
- [ ] Try larger network architectures
- [ ] Add value head for state evaluation

---

## Phase 3: PPO Specialists (In Progress)

**Theme:** "Train from scratch"

**Goal:** Train reinforcement learning agents that discover strategies through self-play, without imitating existing bots.

**Status:** Infrastructure complete, initial training shows promise

### Progress Update (January 8, 2026)

**Completed:**
- [x] Curriculum learning scheduler implemented (`manacore_gym/training/curriculum.py`)
- [x] PPO training script with curriculum (`examples/train_curriculum.py`)
- [x] Robust error handling in gym-server for edge cases
- [x] Observation sanitization to prevent NaN values

**Initial Training Results (Fast Curriculum - 70K steps):**
| Stage | Opponent | Win Rate | Target |
|-------|----------|----------|--------|
| 1     | Random   | 76.7%    | 75%    |
| 2     | Greedy   | 35%      | 50%    |

**Files Created:**
```
packages/python-gym/manacore_gym/training/
├── __init__.py
└── curriculum.py          # CurriculumScheduler class

packages/python-gym/examples/
└── train_curriculum.py    # PPO training with curriculum
```

### Task 3.1: Curriculum Learning Setup

**Tasks:**

- [x] Define training curriculum:

  ```python
  CURRICULUM = [
      # Stage 1: Beat random
      {"opponent": "random", "timesteps": 100_000, "target_wr": 0.90},

      # Stage 2: Beat greedy
      {"opponent": "greedy", "timesteps": 200_000, "target_wr": 0.70},

      # Stage 3: Beat MCTS
      {"opponent": "mcts-eval-fast", "timesteps": 500_000, "target_wr": 0.55},

      # Stage 4: Self-play
      {"opponent": "self", "timesteps": 1_000_000},
  ]
  ```

- [x] Implement curriculum scheduler:

  ```python
  class CurriculumScheduler:
      def __init__(self, curriculum: list):
          self.stages = curriculum
          self.current_stage = 0

      def get_opponent(self) -> str:
          return self.stages[self.current_stage]["opponent"]

      def should_advance(self, win_rate: float) -> bool:
          target = self.stages[self.current_stage]["target_wr"]
          return win_rate >= target
  ```

- [x] Add callback for automatic stage advancement

**Success Criteria:**

- [x] Curriculum scheduler implemented
- [x] Automatic advancement on target reached
- [x] Logging of stage transitions

### Task 3.2: Agent Ignis (Red Specialist)

**Tasks:**

- [ ] Create training script for Red decks:

  ```python
  # scripts/train_ignis.py
  from sb3_contrib import MaskablePPO
  from manacore_gym import ManaCoreBattleEnv, CurriculumScheduler

  env = ManaCoreBattleEnv(
      deck="red-aggro",
      opponent_deck="vanilla",
  )

  model = MaskablePPO(
      "MlpPolicy",
      env,
      learning_rate=3e-4,
      n_steps=2048,
      batch_size=64,
      n_epochs=10,
      gamma=0.99,
      verbose=1,
      tensorboard_log="./logs/ignis/",
  )

  scheduler = CurriculumScheduler(CURRICULUM)

  # Training loop with curriculum
  ...

  model.save("models/ignis-v1")
  ```

- [ ] Train for 1M+ timesteps
- [ ] Track ELO progression over time
- [ ] Save checkpoints every 100K steps

**Success Criteria:**

- [ ] Agent converges (loss stabilizes)
- [ ] Beats RandomBot >95%
- [ ] Beats GreedyBot >70%
- [ ] ELO improves monotonically

### Task 3.3: Agent Aqua (Blue Specialist)

**Tasks:**

- [ ] Create training script for Blue decks (control style)
- [ ] Use different reward shaping:

  ```python
  # Blue values card advantage and game length
  def blue_reward(info):
      base = info["win"] - info["loss"]
      card_bonus = info["card_advantage"] * 0.01
      return base + card_bonus
  ```

- [ ] Train for 1M+ timesteps
- [ ] Compare learning curves to Ignis

**Success Criteria:**

- [ ] Agent learns control playstyle
- [ ] Different decision patterns than Ignis
- [ ] Competitive win rate

### Task 3.4: Agent Silva (Green Specialist)

**Tasks:**

- [ ] Create training script for Green decks (ramp/big creatures)
- [ ] Train for 1M+ timesteps
- [ ] Complete the "color triangle"

**Success Criteria:**

- [ ] Three distinct specialists trained
- [ ] Each has different strategic tendencies
- [ ] Rock-paper-scissors dynamics observable

### Task 3.5: Specialist Analysis

**Tasks:**

- [ ] Run round-robin tournament:

  ```
  Ignis vs Aqua: 1000 games
  Aqua vs Silva: 1000 games
  Silva vs Ignis: 1000 games
  ```

- [ ] Analyze decision differences:
  - When do specialists diverge?
  - What heuristics did each learn?
  - Can we identify "personality"?

- [ ] Create visualization of learned policies

**Success Criteria:**

- [ ] Quantified matchup data
- [ ] Identified strategic differences
- [ ] Documentation for Track C experiments

---

## Phase 5: Llama-Mage

**Theme:** "The semantic agent"

**Goal:** Fine-tune an LLM to play MTG with interpretable reasoning.

**Depends on:** Phase 4 (Orchestrator) - need Claude/Gemini training data

### Task 5.1: Training Data Preparation

**Tasks:**

- [ ] Collect 10K+ games with reasoning from Claude:

  ```bash
  bun run orchestrator generate \
    --provider anthropic \
    --games 10000 \
    --output ./data/claude-reasoning/
  ```

- [ ] Convert to instruction-tuning format:

  ```json
  {
    "instruction": "You are playing Magic: The Gathering...",
    "input": "Board state: You have 15 life...\nLegal moves: [1] Cast...",
    "output": "I choose action 2: Cast Lightning Bolt targeting the Serra Angel. Reasoning: The Serra Angel is a 4/4 flying creature that threatens lethal damage next turn. Removing it now is worth the card because..."
  }
  ```

- [ ] Create train/val/test splits (80/10/10)

**Success Criteria:**

- [ ] 10K+ training examples with reasoning
- [ ] Diverse game states and decisions
- [ ] Quality validated (no nonsense reasoning)

### Task 5.2: Model Selection

**Tasks:**

- [ ] Evaluate base model options:
      | Model | Size | VRAM | Notes |
      |-------|------|------|-------|
      | Llama-3.2-3B | 3B | 8GB | Fast, good baseline |
      | Llama-3.1-8B | 8B | 16GB | Better reasoning |
      | Mistral-7B | 7B | 14GB | Good instruction following |
      | Qwen2.5-7B | 7B | 14GB | Strong on structured tasks |

- [ ] Choose based on available compute
- [ ] Document selection rationale

**Success Criteria:**

- [ ] Model selected and justified
- [ ] Can run inference locally
- [ ] Baseline performance measured

### Task 5.3: QLoRA Fine-tuning

**Tasks:**

- [ ] Set up fine-tuning environment:

  ```bash
  pip install transformers peft bitsandbytes accelerate
  ```

- [ ] Configure QLoRA parameters:

  ```python
  lora_config = LoraConfig(
      r=16,                    # Rank
      lora_alpha=32,           # Scaling
      target_modules=["q_proj", "v_proj", "k_proj", "o_proj"],
      lora_dropout=0.05,
      bias="none",
      task_type="CAUSAL_LM",
  )

  training_args = TrainingArguments(
      output_dir="./llama-mage-v1",
      num_train_epochs=3,
      per_device_train_batch_size=4,
      gradient_accumulation_steps=4,
      learning_rate=2e-4,
      fp16=True,
      logging_steps=10,
      save_steps=500,
  )
  ```

- [ ] Train on Claude reasoning data
- [ ] Monitor loss and generation quality

**Success Criteria:**

- [ ] Training completes without OOM
- [ ] Loss decreases smoothly
- [ ] Generated reasoning is coherent

### Task 5.4: Llama-Mage Bot Implementation

**Tasks:**

- [ ] Implement LlamaMageBot:

  ```typescript
  class LlamaMageBot implements Bot {
    private model: LocalLLM; // Ollama or vLLM

    async chooseAction(state: GameState, playerId: PlayerId): Promise<Action> {
      // 1. Render state as text
      const stateText = renderGameState(state, playerId);

      // 2. Get legal actions
      const actions = getLegalActions(state, playerId);
      const actionText = actions.map((a, i) => `[${i}] ${describeAction(a)}`).join('\n');

      // 3. Query LLM
      const prompt = `${stateText}\n\nLegal moves:\n${actionText}\n\nChoose the best move and explain why:`;
      const response = await this.model.generate(prompt);

      // 4. Parse response
      const { actionIndex, reasoning } = parseResponse(response);

      return actions[actionIndex];
    }
  }
  ```

- [ ] Add to bot registry
- [ ] Handle parsing errors gracefully

**Success Criteria:**

- [ ] Bot plays complete games
- [ ] Reasoning is coherent and relevant
- [ ] Handles edge cases (invalid output)

### Task 5.5: Evaluation & Comparison

**Tasks:**

- [ ] Run evaluation suite:

  ```
  Llama-Mage vs RandomBot:  1000 games
  Llama-Mage vs GreedyBot:  1000 games
  Llama-Mage vs MCTSBot:    1000 games
  Llama-Mage vs PPO:        1000 games
  ```

- [ ] Qualitative analysis:
  - Is reasoning accurate?
  - Does it make "human" mistakes?
  - Where does semantic understanding help?

- [ ] Create comparison report for Track C

**Success Criteria:**

- [ ] Quantified performance vs baselines
- [ ] Identified strengths (strategic) and weaknesses (tactical)
- [ ] Ready for Experiment 1 (LLM vs MCTS showdown)

---

## Phase 6: AlphaZero Self-Play

**Theme:** "The ultimate agent"

**Goal:** Implement self-play training loop with value and policy networks.

**Depends on:** Phase 3 (PPO Specialists) - validates RL pipeline

### Task 6.1: Network Architecture

**Tasks:**

- [ ] Design AlphaCore network:

  ```
  Input: 25 features (can expand later)

  Shared Tower:
    Dense(256) → ReLU → Dense(256) → ReLU

  Policy Head:
    Dense(128) → ReLU → Dense(action_space) → Softmax

  Value Head:
    Dense(128) → ReLU → Dense(1) → Tanh
  ```

- [ ] Implement in PyTorch
- [ ] Add ONNX export for TypeScript inference

**Success Criteria:**

- [ ] Network forward pass works
- [ ] Both heads produce valid outputs
- [ ] Export/import cycle works

### Task 6.2: Self-Play Loop

**Tasks:**

- [ ] Implement self-play game generation:

  ```python
  def generate_self_play_games(model, n_games=100):
      games = []
      for _ in range(n_games):
          game = play_game_with_mcts(model)
          games.append(game)
      return games
  ```

- [ ] Implement MCTS with neural network guidance:

  ```python
  def mcts_search(state, model, n_simulations=100):
      root = MCTSNode(state)

      for _ in range(n_simulations):
          node = root

          # Selection (use policy as prior)
          while not node.is_leaf():
              node = node.select_child(c_puct=1.0)

          # Expansion
          if not node.is_terminal():
              policy, value = model(node.state)
              node.expand(policy)
              node.backpropagate(value)
          else:
              node.backpropagate(node.outcome)

      return root.best_action()
  ```

- [ ] Training loop:

  ```python
  for iteration in range(1000):
      # Generate games
      games = generate_self_play_games(model, n_games=100)

      # Train on games
      train_on_games(model, games)

      # Evaluate
      elo = evaluate_vs_baseline(model)
      log(f"Iteration {iteration}: ELO {elo}")

      # Save checkpoint
      if iteration % 10 == 0:
          save_checkpoint(model, iteration)
  ```

**Success Criteria:**

- [ ] Self-play generates valid games
- [ ] Training updates model weights
- [ ] ELO improves over iterations

### Task 6.3: Training Infrastructure

**Tasks:**

- [ ] Set up distributed training (if needed)
- [ ] Implement replay buffer:

  ```python
  class ReplayBuffer:
      def __init__(self, capacity=100_000):
          self.buffer = deque(maxlen=capacity)

      def add_game(self, game):
          for state, policy, outcome in game:
              self.buffer.append((state, policy, outcome))

      def sample(self, batch_size):
          return random.sample(self.buffer, batch_size)
  ```

- [ ] Add training monitoring:
  - Policy loss
  - Value loss
  - ELO rating
  - Games per hour

**Success Criteria:**

- [ ] Training stable over long runs
- [ ] No memory leaks
- [ ] Clear progress metrics

### Task 6.4: AlphaCore Evaluation

**Tasks:**

- [ ] Full evaluation suite:

  ```
  AlphaCore vs RandomBot:    Should be >99%
  AlphaCore vs GreedyBot:    Should be >90%
  AlphaCore vs MCTSBot:      Target >60%
  AlphaCore vs PPO:          Measure
  AlphaCore vs Llama-Mage:   The showdown!
  ```

- [ ] Analyze learned strategies
- [ ] Document in Track C experiments

**Success Criteria:**

- [ ] Strongest agent in the roster
- [ ] Discovered novel strategies?
- [ ] Ready for transfer learning experiments

---

## Dependencies

### Internal Dependencies

```
Phase 1 (Gym) ──────────────────────────────┐
                                            ▼
Phase 2A (Data) ──► Phase 2B (Imitator) ──► Phase 3 (PPO)
                                                   │
Phase 4 (Orchestrator) ──► Phase 5 (Llama-Mage) ◄──┘
                                   │
                                   ▼
                           Phase 6 (AlphaZero)
```

### External Dependencies

| Component       | Dependency        | Version |
| --------------- | ----------------- | ------- |
| Neural Imitator | ONNX Runtime      | ^1.16.0 |
| PPO Training    | stable-baselines3 | ^2.0.0  |
| Llama-Mage      | transformers      | ^4.40.0 |
| Llama-Mage      | peft              | ^0.10.0 |
| AlphaZero       | PyTorch           | ^2.0.0  |

---

## Success Metrics

| Agent           | vs Random | vs Greedy | vs MCTS | Notes                                    |
| --------------- | --------- | --------- | ------- | ---------------------------------------- |
| NeuralImitator  | 60% ⚠️    | 18% ⚠️    | -       | Trained on Greedy data (not MCTS)        |
| PPO Specialists | >95%      | >70%      | >55%    | Curriculum target                        |
| Llama-Mage      | >80%      | >60%      | TBD     | Interpretable                            |
| AlphaCore       | >99%      | >90%      | >60%    | Peak performance                         |

---

## Notes

- Start with NeuralImitator to validate pipeline before investing in RL
- PPO specialists enable comparative experiments (Track C)
- Llama-Mage is about interpretability, not peak performance
- AlphaZero is the ambitious goal, may require significant compute
