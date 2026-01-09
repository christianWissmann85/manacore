# Track B: Agents

**Focus:** Neural networks, reinforcement learning, LLM agents
**Lead Phases:** 2, 3, 5, 6
**Status:** Phase 3B In Progress (January 9, 2026)

> **Research Focus:** Extended Phase 3 to deeply explore PPO scaling, archetype specialists, and transfer learning before advancing to LLMs/AlphaZero.

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

| Agent          | Type             | Phase | Status      | Use Case                      |
| -------------- | ---------------- | ----- | ----------- | ----------------------------- |
| NeuralImitator | Behavior Cloning | 2B    | ✅ Done     | Validate pipeline             |
| PPO Baseline   | PPO (Generalist) | 3B    | 🔄 48% WR   | Master the basics             |
| Agent Ignis    | PPO (Aggro)      | 3C    | ⏳ Planned  | Aggro archetype specialist    |
| Agent Aqua     | PPO (Control)    | 3C    | ⏳ Planned  | Control archetype specialist  |
| Agent Silva    | PPO (Midrange)   | 3C    | ⏳ Planned  | Midrange archetype specialist |
| Agent Polymath | PPO (Generalist) | 3E    | ⏳ Planned  | Generalist vs specialist test |
| Llama-Mage     | Fine-tuned LLM   | 5     | ⏳ Deferred | Interpretability              |
| AlphaCore      | Self-play NN     | 6     | ⏳ Deferred | Peak performance              |

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

| Matchup                | Win Rate | Target | Status |
| ---------------------- | -------- | ------ | ------ |
| NeuralBot vs RandomBot | 60.0%    | >80%   | ⚠️     |
| NeuralBot vs GreedyBot | 18.0%    | >50%   | ⚠️     |
| GreedyBot vs RandomBot | 89.0%    | -      | ✅     |

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

## Phase 3: PPO Mastery & Research (Extended)

**Theme:** "Master reinforcement learning before moving on"

**Philosophy:** Phase 3 is now an extended research phase. Instead of rushing to LLMs and AlphaZero, we will deeply explore PPO's capabilities, document scaling behaviors, and run rigorous transfer learning experiments worthy of publication.

**Status:** Phase 3A complete, Phase 3B in progress

---

### Phase 3 Roadmap

```
Phase 3A: Foundation ────────────────────────► COMPLETE
    │
    ▼
Phase 3B: Master the Baseline ───────────────► CURRENT
    │   Goal: Beat greedy >60%
    │   Study: Scaling laws, emergent abilities
    │
    ▼
Phase 3C: Archetype Specialists
    │   Train: Ignis (Aggro), Aqua (Control), Silva (Midrange)
    │   Study: Convergence speed by archetype
    │
    ▼
Phase 3D: Transfer Learning Experiments ◄──── MOST EXCITING!
    │   Test: Can specialists generalize?
    │   Paper-worthy: "Do RL agents learn strategy or cards?"
    │
    ▼
Phase 3E: Generalist Challenge
    │   Train: Agent Polymath (all decks)
    │   Study: Specialist vs Generalist tradeoff
    │
    ▼
Phase 3F: Meta Analysis
        Tournament: Rock-Paper-Scissors dynamics
        Visualize: Strategy triangle emergence
```

---

### Phase 3A: Foundation ✅ COMPLETE

**Completed January 9, 2026**

Infrastructure for PPO training:

- [x] Gymnasium environment with action masking
- [x] Curriculum learning scheduler
- [x] Reward shaping module (potential-based)
- [x] Enhanced training scripts
- [x] Robust error handling

**Files Created:**

```
packages/python-gym/manacore_gym/training/
├── __init__.py
└── curriculum.py              # CurriculumScheduler

packages/python-gym/examples/
├── train_curriculum.py        # Basic PPO training
└── train_enhanced.py          # Large network + reward shaping

packages/gym-server/src/rewards/
├── index.ts
└── shaping.ts                 # RewardShaper class
```

**Reward Shaping Formula:**

```
F(s, s') = γ · V(s') - V(s)

where V(s) = 0.30 · life_advantage
           + 0.25 · board_power
           + 0.20 · creature_count
           + 0.15 · card_advantage
           + 0.10 · mana_advantage
```

---

### Phase 3B: Master the Baseline 🔬 CURRENT

**Goal:** Train ONE agent to consistently beat GreedyBot (>60% win rate)

**Why this matters:** Before training specialists, we must prove PPO can solve the core problem. If we can't beat greedy with unlimited compute, specialists won't help.

#### Training Log

| Run | Steps | Network | Reward Shaping | vs Random | vs Greedy (Best) | Notes                                                                              |
| --- | ----- | ------- | -------------- | --------- | ---------------- | ---------------------------------------------------------------------------------- |
| 1   | 250K  | 64x64   | No             | 77%       | 32%              | Baseline                                                                           |
| 2   | 500K  | 256x256 | Yes            | 78%       | 48%              | +16% improvement                                                                   |
| 3   | 1M    | 256x256 | Yes            | 75%       | 48%              | **No scaling benefit** - [Report](./training-reports/2026-01-09_ppo_1M_scaling.md) |

#### Research Questions

1. **Scaling Laws:** Does performance improve logarithmically with steps, or are there phase transitions ("emergent abilities")?

2. **Diminishing Returns:** At what point does more training stop helping? 1M? 5M? 10M steps?

3. **Architecture Impact:** Does 512x512 significantly outperform 256x256?

#### Experimental Protocol

For each training run, record:

- Win rate checkpoints every 50K steps
- TensorBoard logs (loss curves, entropy)
- Best model checkpoint
- Wall-clock time

**Success Criteria:**

- [ ] Achieve >60% win rate vs greedy
- [ ] Document the scaling curve
- [ ] Identify optimal hyperparameters

---

### Phase 3C: Archetype Specialists

**Goal:** Train three agents on distinct playstyles (not colors!)

**Key Insight (from Gemini):** Training on "Aggro" teaches tempo. Training on "Red" teaches card IDs. Archetypes transfer; colors don't.

#### The Roster

| Agent        | Archetype | Training Decks                            | Learning Hypothesis                      |
| ------------ | --------- | ----------------------------------------- | ---------------------------------------- |
| **Ignis** 🔥 | Aggro     | `red_burn`, `white_weenie`, `black_aggro` | Fast convergence (immediate rewards)     |
| **Aqua** 💧  | Control   | `blue_control`, `dimir`                   | Slow convergence (delayed gratification) |
| **Silva** 🌳 | Midrange  | `green_midrange`, `gruul`, `simic`        | Medium (investment → payoff)             |

#### Research Questions

1. **Convergence Speed:** Does Aggro (Ignis) learn faster than Control (Aqua)?
   - _Hypothesis:_ Yes, because rewards are more immediate

2. **Credit Assignment:** Can PPO solve Control's long-horizon problem?
   - _Hypothesis:_ Difficult; may need specialized reward shaping

3. **Learning Curves:** Do different archetypes show different curve shapes?
   - Plot side-by-side for comparison

#### Success Criteria

- [ ] All three specialists beat greedy >60%
- [ ] Documented learning curve differences
- [ ] Each agent shows archetype-appropriate behavior

---

### Phase 3D: Transfer Learning Experiments 📝 PAPER-WORTHY

**Goal:** Test whether agents learned _strategy_ or just _card patterns_

This is the most scientifically interesting phase. Results here could be publishable.

#### Experiment A: Within-Archetype Transfer

**Setup:**

1. Train Ignis ONLY on `red_burn` until mastery (>70% vs greedy)
2. Test Ignis on `white_weenie` (never seen during training)

**Hypothesis:** Ignis performs well (~60%+) because it learned "Aggro" concepts:

- Play cheap creatures early
- Attack aggressively
- Prioritize damage over card advantage

**Metrics:**

- Win rate on unseen deck
- Action distribution comparison (does it still play aggressively?)

#### Experiment B: Cross-Archetype Failure

**Setup:**

1. Take trained Ignis (Aggro specialist)
2. Force it to play `blue_control` deck

**Hypothesis:** Ignis fails miserably (<30%) because:

- Tries to play control cards aggressively
- Doesn't understand "wait and react"
- Wrong heuristics for the strategy

**Why this matters:** If Ignis fails at Control but succeeds at White Weenie, it proves the agent learned _strategy_, not _card mappings_.

#### Experiment C: Feature Importance Analysis

**Setup:**

1. Train agent normally
2. Ablate individual features (zero them out)
3. Measure performance drop

**Question:** Which features matter most for each archetype?

- _Hypothesis:_ Aggro cares about life differential; Control cares about card advantage

#### Data to Collect

| Agent | Home Deck    | vs Greedy | Transfer Deck | vs Greedy | Delta |
| ----- | ------------ | --------- | ------------- | --------- | ----- |
| Ignis | red_burn     | ?%        | white_weenie  | ?%        | ?     |
| Ignis | red_burn     | ?%        | blue_control  | ?%        | ?     |
| Aqua  | blue_control | ?%        | dimir         | ?%        | ?     |
| Aqua  | blue_control | ?%        | red_burn      | ?%        | ?     |

---

### Phase 3E: Generalist Challenge

**Goal:** Train a single agent on ALL deck types

#### Experiment: The Generalist Tax

**Setup:**

1. Train `Agent Polymath` on all decks simultaneously
   - Randomly sample deck each episode
   - Same total training steps as specialists

2. Compare win rates:
   - Polymath with red_burn vs Ignis with red_burn
   - Polymath with blue_control vs Aqua with blue_control

**Research Question:** How much worse is the generalist?

**Hypothesis:** Specialists are 5-15% better on their home archetype, but Polymath is more robust overall.

**The Holy Grail:** Can we train a generalist that matches specialist performance?

---

### Phase 3F: Meta Analysis

**Goal:** Discover emergent metagame dynamics

#### Experiment: Round-Robin Tournament

**Setup:**

```
1000 games per matchup:
- Ignis (Aggro) vs Aqua (Control)
- Aqua (Control) vs Silva (Midrange)
- Silva (Midrange) vs Ignis (Aggro)
```

**Research Question:** Do agents discover Rock-Paper-Scissors dynamics naturally?

**Expected Pattern (if agents learned real MTG):**

```
        Ignis (Aggro)
           ▲
          / \
   beats /   \ loses to
        /     \
       /       \
  Aqua ◄───────► Silva
(Control) beats (Midrange)
```

**Visualization:**

- Win rate heatmap
- Strategy triangle diagram
- Decision tree comparisons

---

### Available Decks by Archetype

```
AGGRO (Damage-focused, fast games):
├── red_burn        # Shock, Hammer of Bogardan, Stone Rain
├── white_weenie    # Tundra Wolves, Samite Healer, cheap creatures
└── black_aggro     # Bog Rats, Python, aggressive black creatures

CONTROL (Card advantage, long games):
├── blue_control    # Counterspell, Power Sink, Air Elemental
└── dimir           # Blue + Black (counters + removal)

MIDRANGE (Investment, board presence):
├── green_midrange  # River Boa, Gorilla Chieftain, Hurricane
├── gruul           # Red + Green (creatures + burn)
└── simic           # Blue + Green (tempo + creatures)

SPECIAL (Edge cases):
├── artifact        # Colorless cards
├── color_hate      # Protection/hate cards
└── spells          # Spell-heavy deck
```

---

### Success Metrics Summary

| Phase | Key Metric             | Target     | Status |
| ----- | ---------------------- | ---------- | ------ |
| 3A    | Infrastructure         | Complete   | ✅     |
| 3B    | Win rate vs greedy     | >60%       | 🔄 48% |
| 3C    | Specialist convergence | All >60%   | ⏳     |
| 3D    | Transfer accuracy      | Measured   | ⏳     |
| 3E    | Generalist gap         | <10%       | ⏳     |
| 3F    | Meta emergence         | Documented | ⏳     |

---

### Research Output Goals

By the end of Phase 3, we aim to produce:

1. **Scaling Analysis:** Graph of performance vs training steps
2. **Transfer Learning Results:** Table of within/cross-archetype transfer
3. **Archetype Learning Curves:** Comparison plot (Aggro vs Control vs Midrange)
4. **Meta Visualization:** Strategy triangle with empirical win rates

These could form the basis of a research paper: _"Transfer Learning in Strategic Card Games: Do RL Agents Learn Strategy or Cards?"_

---

### Documentation Practices

**Every training run should produce a report** in `docs/training-reports/`.

Report template: `YYYY-MM-DD_[experiment]_[detail].md`

Each report must include:

1. **Configuration**: All hyperparameters, architecture
2. **Results**: Training curve, checkpoints, final eval
3. **Analysis**: Key findings, hypotheses
4. **Next Steps**: What to try based on results
5. **Files**: Paths to models, logs

See [Training Reports README](./training-reports/README.md) for full format.

---

### Current Status (Phase 3B)

**Latest Finding (Jan 9, 2026):** [1M Scaling Report](./training-reports/2026-01-09_ppo_1M_scaling.md)

- No scaling benefit beyond 100K steps
- Ceiling at ~48% vs greedy
- Next: Diagnose WHY greedy wins before adding complexity

### Next Steps (Phase 3B)

1. [x] Run 1M step training (measure scaling) - **No benefit found**
2. [ ] **Diagnose failure patterns** (Option C) - watch games where greedy wins
3. [ ] Try richer observations (Option A) if diagnosis suggests it
4. [ ] Try hyperparameter tuning (Option B) - more eval games, entropy
5. [ ] Once >60% achieved, proceed to Phase 3C

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

| Agent           | vs Random | vs Greedy | vs MCTS | Notes                             |
| --------------- | --------- | --------- | ------- | --------------------------------- |
| NeuralImitator  | 60% ⚠️    | 18% ⚠️    | -       | Trained on Greedy data (not MCTS) |
| PPO (Enhanced)  | 78%       | 45-48%    | -       | Reward shaping + 256x256 network  |
| PPO Specialists | >95%      | >70%      | >55%    | Curriculum target (future)        |
| Llama-Mage      | >80%      | >60%      | TBD     | Interpretable                     |
| AlphaCore       | >99%      | >90%      | >60%    | Peak performance                  |

---

## Notes

- Start with NeuralImitator to validate pipeline before investing in RL
- PPO specialists enable comparative experiments (Track C)
- Llama-Mage is about interpretability, not peak performance
- AlphaZero is the ambitious goal, may require significant compute
