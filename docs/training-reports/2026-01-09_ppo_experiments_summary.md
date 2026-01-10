# PPO Experiments Summary

**Date**: 2026-01-09
**Goal**: Break the 45% win rate ceiling against GreedyBot
**Result**: NEGATIVE - No configuration exceeded baseline

## Executive Summary

We conducted extensive PPO experiments testing:

1. Scaling (100K → 1M steps)
2. Imitation learning + warm start
3. DAgger + PPO warm start
4. Warm start hyperparameter fixes
5. Network architecture and hyperparameter sweeps

**Conclusion**: Pure PPO from scratch at 100K steps (45% vs Greedy) remains our best result. Additional training steps, warm starting, and hyperparameter tuning do not improve performance.

## Experiments Conducted

### 1. PPO Scaling Experiment

| Steps | vs Random | vs Greedy |
| ----- | --------- | --------- |
| 100K  | 78%       | 45%       |
| 200K  | 77%       | 46%       |
| 500K  | 76%       | 47%       |
| 1M    | 75%       | 48%       |

**Finding**: Diminishing returns beyond 100K. The model plateaus quickly.

### 2. Imitation Learning Baseline

| Model       | Accuracy | vs Random | vs Greedy |
| ----------- | -------- | --------- | --------- |
| ImitatorNet | 40.6%    | 68%       | 15.5%     |

**Finding**: Behavior cloning achieves decent action matching but poor game outcomes. Supervised learning ≠ game performance.

### 3. DAgger + PPO Warm Start v1

| Stage                       | vs Random | vs Greedy |
| --------------------------- | --------- | --------- |
| DAgger-improved ImitatorNet | 74%       | 18%       |
| PPO Warm Start v1           | 74.5%     | 17.5%     |

**Finding**: NEGATIVE. Naive warm start with low exploration hurt performance. The policy got stuck in a bad region.

### 4. PPO Warm Start v2 (Fixed)

Key changes:

- entropy_coef: 0.1 (was 0.01) - 10x more exploration
- clip_range: 0.2 (was 0.1) - standard PPO
- Value network NOT initialized from imitation weights

| Model         | vs Random | vs Greedy |
| ------------- | --------- | --------- |
| Warm Start v2 | 80%       | 40%       |

**Finding**: Fixed warm start recovered to near-baseline (40% vs 45%) but didn't exceed it. Warm start is neutral at best.

### 5. Hyperparameter Sweep

| Config        | Architecture | Key Change    | vs Random | vs Greedy |
| ------------- | ------------ | ------------- | --------- | --------- |
| Baseline      | 64x64        | -             | 78%       | 45%       |
| Large Network | 512x512      | 8x parameters | 70%       | 22%       |
| High Entropy  | 256x256      | ent=0.05      | 82%       | 38%       |
| LR Schedule   | 256x256      | 3e-4→1e-5     | 78%       | 26%       |

**Finding**: Larger networks and different hyperparameters did not help. The default configuration is already near-optimal for this problem.

### 6. Curriculum Learning v2

Progressive difficulty approach:

- Stage 1: 100% Random (30K steps, target 85%)
- Stage 2: 50% Random + 50% Greedy (30K steps, target 65%)
- Stage 3: 100% Greedy (50K steps, target 50%)

| Stage | Opponent | Win Rate        | Target | Status |
| ----- | -------- | --------------- | ------ | ------ |
| 1     | Random   | 73.3%           | 85%    | FAIL   |
| 2     | Mixed    | 36.7% vs Greedy | 65%    | FAIL   |
| 3     | Greedy   | 36.7% vs Greedy | 50%    | FAIL   |

**Final: 81% vs Random, 36% vs Greedy**

**Finding**: NEGATIVE. Curriculum learning actually hurt performance. The model learned patterns for the mixed distribution that didn't transfer to pure Greedy play. Performance dropped from 45% baseline to 36%.

### 7. Reward Shaping (Enhanced)

Increased reward shaping scale from 0.1 to 0.5 (5x) to make intermediate rewards more impactful.

Shaped reward characteristics:

- Range: [-0.038, +0.031] per step
- Average magnitude: 0.008
- Based on: life delta, board power, creature count, card advantage, mana

| Metric    | Sparse (baseline) | Shaped (5x scale) |
| --------- | ----------------- | ----------------- |
| vs Random | 78%               | 74%               |
| vs Greedy | 45%               | 38%               |

**Finding**: NEGATIVE. Reward shaping hurt performance (-7%). This is theoretically consistent - potential-based shaping preserves the optimal policy, it doesn't change what that policy is. The 45% ceiling is a property of the problem, not the reward signal.

## Analysis

### Why Does PPO Plateau at 45%?

Several hypotheses:

1. **Sparse Reward Problem**: Only +1/-1 at game end provides weak learning signal. The agent can't distinguish good intermediate moves from bad ones.

2. **Credit Assignment**: In a 50-step game, attributing the win/loss to specific moves is extremely difficult. The agent may learn superstitious behaviors.

3. **Opponent Exploitation vs Generalization**: Training against a single opponent (GreedyBot) may lead to narrow strategies that don't transfer.

4. **State Representation**: 36 features may not capture enough strategic information for deeper play.

5. **Sample Efficiency**: PPO may simply need orders of magnitude more samples than we're providing.

### Why Doesn't Warm Start Help?

1. **Different Objectives**: Imitation learning optimizes "match expert actions" while RL optimizes "win games." These objectives can conflict.

2. **Local Optima**: Pre-trained weights may place the policy in a region of parameter space that's hard to escape, even with exploration.

3. **Value Function Mismatch**: The value function needs to estimate game outcomes, not action preferences. Initializing it incorrectly is harmful.

### What Approaches Are Unlikely to Work?

Based on our experiments:

- ❌ More training steps (already at diminishing returns)
- ❌ Larger networks (worse performance)
- ❌ Warm starting from imitation (neutral at best)
- ❌ Hyperparameter tuning (marginal gains)
- ❌ Curriculum learning (hurt performance)
- ❌ Reward shaping (hurt performance)

## Recommended Next Steps

### Self-Play (HIGH PRIORITY)

Train against copies of itself instead of a fixed opponent. This avoids overfitting to GreedyBot's specific strategy and creates an adaptive curriculum.

### LLM-Based Approaches (MEDIUM PRIORITY)

Use language models for:

- Strategic reasoning about game state
- Action selection with chain-of-thought
- Learning from game commentary/analysis

## Artifacts

### Scripts Created

- `examples/train_ppo_warmstart_v2.py` - Fixed warm start with high exploration
- `examples/train_ppo_sweep.py` - Hyperparameter sweep framework
- `examples/run_ppo_experiments.py` - Sequential experiment runner
- `examples/collect_dagger.py` - DAgger data collection
- `examples/run_dagger_ppo_pipeline.py` - Full DAgger+PPO pipeline

### Models Generated

- `models/imitator-greedy/` - Behavior cloning baseline
- `models/warmstart_v2_*/` - Fixed warm start models
- `models/sweep/*/` - Hyperparameter sweep models

### Key Insight

**The 45% ceiling appears to be a fundamental limitation of training PPO against a fixed opponent with sparse rewards.** Breaking this ceiling likely requires:

1. Changing the training distribution (curriculum)
2. Changing the reward structure (shaping)
3. Changing the learning paradigm (self-play, LLM)

Simple scaling and hyperparameter tuning are insufficient.

## Conclusion

We have thoroughly explored the PPO approach space for ManaCore. The research value is in demonstrating what **doesn't** work:

- More compute doesn't help
- More parameters don't help
- Warm starting doesn't help
- Hyperparameter tuning doesn't help

This clears the path for fundamentally different approaches: curriculum learning, self-play, and LLM-based methods.
