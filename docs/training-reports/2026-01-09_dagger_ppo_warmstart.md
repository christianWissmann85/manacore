# DAgger + PPO Warm Start Experiment

**Date**: 2026-01-09
**Experiment**: Combining DAgger with PPO Warm Start
**Result**: NEGATIVE - Warm start hurt performance

## Hypothesis

Combining DAgger (Dataset Aggregation) with PPO warm start should yield better results than either approach alone:

1. **DAgger** fixes the distribution mismatch problem in behavior cloning by collecting data from the learner's state distribution while labeling with expert actions
2. **PPO Warm Start** initializes the RL policy from the improved imitation model, giving it a head start

Expected: 55%+ win rate vs Greedy (breaking the 48% PPO ceiling)

## Method

### Pipeline Steps

1. **DAgger Data Collection** (150 games)
   - Run ImitatorNet against Greedy
   - At each state, query what Greedy would do
   - Store (learner_state, expert_action) pairs
   - Aggregate with original training data

2. **Retrain ImitatorNet** (50 epochs)
   - Train on aggregated DAgger data
   - Architecture: 36 → 256 → 256 → 128 → 350

3. **PPO Warm Start** (200K timesteps)
   - Copy ImitatorNet weights to MaskablePPO policy network
   - Fine-tune hyperparameters for transfer learning:
     - Learning rate: 1e-4 (lower for fine-tuning)
     - Clip range: 0.1 (smaller for stability)
     - Entropy coefficient: 0.01 (less exploration)

4. **Evaluation** (200 games each)

### Weight Transfer

```python
# ImitatorNet → PPO Policy Network mapping
hidden.0.weight → mlp_extractor.policy_net.0.weight
hidden.3.weight → mlp_extractor.policy_net.2.weight
hidden.6.weight → mlp_extractor.policy_net.4.weight
output.weight   → action_net.weight
```

Also initialized value network from same weights for reasonable starting point.

## Results

### DAgger Improved Accuracy

| Metric              | Before DAgger | After DAgger |
| ------------------- | ------------- | ------------ |
| Validation Accuracy | 40.6%         | 53.1%        |
| Expert Match Rate   | ~35%          | ~52%         |

DAgger successfully improved the imitation model's ability to match expert decisions.

### Game Performance (NEGATIVE)

| Model                          | vs Random | vs Greedy |
| ------------------------------ | --------- | --------- |
| Pure PPO v1.0 (baseline)       | 78%       | 45%       |
| ImitatorNet (behavior cloning) | 68%       | 15.5%     |
| DAgger-improved ImitatorNet    | 74%       | 18%       |
| **DAgger + PPO Warm Start**    | 74.5%     | **17.5%** |

**The warm-started PPO performed WORSE than pure PPO against Greedy.**

## Analysis

### Why Did Warm Start Hurt?

Several possible explanations:

1. **Local Minimum Trap**: The imitation-learned policy may have placed PPO in a region of policy space that's hard to escape. The greedy expert's style might not translate well to the RL objective.

2. **Value Function Mismatch**: We initialized the value network from action-prediction weights. This is a fundamentally different task (predicting returns vs predicting actions), possibly giving bad value estimates that misguide policy updates.

3. **Exploration Collapse**: The warm start with low entropy coefficient (0.01) may have prevented sufficient exploration to discover better strategies.

4. **Hyperparameter Mismatch**: Fine-tuning hyperparameters (lower LR, smaller clip range) optimized for stability may have slowed down necessary policy changes.

5. **Distribution Shift Recovery**: While DAgger helps with distribution shift during imitation, the RL fine-tuning still needs to learn recovery behaviors. The warm start may have made this harder.

### The Accuracy-Performance Paradox

DAgger improved accuracy (40% → 53%) but this didn't translate to better game performance (15.5% → 18% vs Greedy). This reinforces the finding that **matching expert decisions ≠ winning games**.

The imitation approach fundamentally captures "what the expert does" but not "why" or "when to deviate."

## Comparison with Literature

This negative result aligns with some findings in the imitation learning literature:

- **Silver et al. (AlphaGo)**: Used supervised learning only for initialization, required millions of RL games to reach expert level
- **Vinyals et al. (AlphaStar)**: Needed extensive RL fine-tuning after imitation, with careful curriculum design
- **Ross & Bagnell (DAgger paper)**: DAgger guarantees improve policy _within_ the imitation objective, not necessarily task performance

## Recommendations for Future Work

### Alternative Approaches

1. **Behavior Cloning + RL from Scratch**
   - Use imitation data for auxiliary loss during RL training
   - Don't initialize from imitation weights

2. **Higher Entropy Warm Start**
   - Keep entropy coefficient high (0.1+) to maintain exploration
   - Gradually anneal down

3. **Separate Value Network**
   - Don't initialize value network from imitation weights
   - Let value function learn from scratch

4. **More DAgger Iterations**
   - Run full DAgger loop: collect → train → deploy → repeat
   - Current experiment only did 1 iteration

5. **Expert Distillation Loss**
   - Add KL divergence to expert as auxiliary objective
   - Balance with RL objective

6. **GAIL / Inverse RL**
   - Learn reward function from expert demonstrations
   - Use learned reward for RL training

### Hyperparameter Exploration

If trying warm start again:

- Learning rate: Try 3e-4 or 5e-4 (more aggressive)
- Clip range: Try 0.2 (standard PPO value)
- Entropy: Try 0.05-0.1 (more exploration)
- Value function coefficient: Try 0.25 (less trust in initial values)

## Conclusion

**The DAgger + PPO warm start experiment was a NEGATIVE result.** While DAgger improved imitation accuracy, the warm-started PPO achieved only 17.5% vs Greedy - worse than both:

- Pure PPO from scratch (45%)
- The warm start source model (18%)

This suggests that naive weight transfer from behavior cloning to RL may be counterproductive. Future work should explore alternative integration strategies or focus on pure RL with curriculum design.

## Artifacts

- Pipeline script: `examples/run_dagger_ppo_pipeline.py`
- DAgger collection: `examples/collect_dagger.py`
- PPO warm start: `examples/train_ppo_warmstart.py`
- DAgger data: `data/dagger-*.npz`
- Models: `models/imitator-dagger-*`, `models/best_model.zip`

## Reproduction

```bash
cd packages/python-gym

# Quick test (50 games, 50K steps)
uv run python examples/run_dagger_ppo_pipeline.py --quick

# Full experiment (150 games, 200K steps)
uv run python examples/run_dagger_ppo_pipeline.py

# Extended (300 games, 500K steps)
uv run python examples/run_dagger_ppo_pipeline.py --extended
```
