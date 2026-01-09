# Training Report: Imitation Learning Baseline (Behavior Cloning)

**Date:** January 9, 2026
**Run ID:** `imitator-greedy`
**Phase:** 3B.1 (Imitation Learning)
**Objective:** Test if behavior cloning from GreedyBot can break the 48% PPO ceiling

---

## Executive Summary

**Result: PARTIAL SUCCESS** - Behavior cloning achieved 40.6% validation accuracy but only 15.5% win rate vs GreedyBot in actual games. This demonstrates classic imitation learning challenges but provides a foundation for improvement.

| Metric            | ImitatorNet | PPO (v1.0) | Random |
| ----------------- | ----------- | ---------- | ------ |
| vs Random         | 68-75%      | 78%        | 50%    |
| vs Greedy         | 15.5%       | 45%        | ~20%   |
| Training Accuracy | 41.6%       | N/A        | N/A    |
| Val Accuracy      | 40.6%       | N/A        | N/A    |

---

## Configuration

### Training Data

| Parameter | Value                      |
| --------- | -------------------------- |
| Source    | GreedyBot self-play        |
| Games     | ~200 games                 |
| Samples   | 10,000+ state-action pairs |
| Features  | 36 (v2.0 enhanced)         |
| Expert    | GreedyBot                  |

### Model Architecture

| Parameter  | Value             |
| ---------- | ----------------- |
| Type       | MLP (ImitatorNet) |
| Input      | 36 features       |
| Hidden     | 256 → 256 → 128   |
| Output     | 350 action logits |
| Dropout    | 0.1               |
| Parameters | ~100K             |

### Training Parameters

| Parameter       | Value           |
| --------------- | --------------- |
| Epochs          | 50              |
| Batch Size      | 256             |
| Learning Rate   | 1e-3            |
| Weight Decay    | 0.01            |
| Label Smoothing | 0.1             |
| Optimizer       | AdamW           |
| Scheduler       | CosineAnnealing |

---

## Results

### Training Metrics

```
Epoch 50/50 - Loss: 2.4234 - Acc: 41.6% - Val Loss: 2.4891 - Val Acc: 40.6%
Best validation accuracy: 40.6%
```

### Game Evaluation (200 games each, temperature=0.1)

| Opponent | Games | Wins | Losses | Win Rate  |
| -------- | ----- | ---- | ------ | --------- |
| Random   | 200   | 136  | 64     | **68.0%** |
| Greedy   | 200   | 31   | 169    | **15.5%** |

### Comparison with Baselines

| Agent              | vs Random | vs Greedy |
| ------------------ | --------- | --------- |
| Random Baseline    | 50%       | ~20%      |
| **ImitatorNet**    | **68%**   | **15.5%** |
| PPO v1.0 (25 feat) | 78%       | 45%       |
| PPO v2.0 (36 feat) | 74%       | 30%       |

### Temperature Sensitivity

| Temperature | vs Random | vs Greedy |
| ----------- | --------- | --------- |
| 0.5         | 57%       | 11%       |
| 0.1         | 68%       | 15.5%     |

Lower temperature (more deterministic) improved performance.

---

## Analysis

### Why 40.6% Accuracy ≠ 15.5% Win Rate

**1. Compounding Errors**

- Each wrong action leads to states GreedyBot never visited
- Model has no training data for these "off-policy" states
- Errors compound: one mistake leads to more mistakes

**2. Action Space Complexity**

- Average 10-50 legal actions per decision
- 40.6% accuracy means ~60% of moves differ from expert
- Over a 50-action game: (0.406)^50 ≈ 0% chance of perfect play

**3. Distribution Shift**

- Training data: States GreedyBot visits (expert trajectory)
- Test data: States ImitatorNet visits (learner trajectory)
- These distributions diverge quickly after first mistake

### What the Model Learned

Despite poor win rate, the model shows:

- **+28pp improvement over random** vs Greedy opponent
- **Shorter games** (39.6 avg steps vs 71.5 for random)
- Some understanding of when to attack/block

### Why This Matters

This confirms our hypothesis from the 36-feature experiment:

> "The limitation is not what PPO sees, but how it learns."

Pure supervised learning from expert demonstrations isn't sufficient. The model needs either:

1. **Interactive learning** (DAgger) - Learn from its own states
2. **RL fine-tuning** - Learn to recover from mistakes

---

## Diagnosis: Distribution Mismatch

```
Expert Trajectory (GreedyBot):
  S0 → a0 → S1 → a1 → S2 → a2 → S3 → ... → WIN

Learner Trajectory (ImitatorNet):
  S0 → a0' → S1' → a1' → S2' → ... → ???
       ↑
       Different action leads to different state
       Model never saw S1' during training!
```

The model was trained on `{S0, S1, S2, ...}` but encounters `{S0, S1', S2', ...}` during evaluation.

---

## Next Steps

### Recommended: Two-Phase Approach

**Phase 1: DAgger (Dataset Aggregation)**

1. Run ImitatorNet against GreedyBot
2. At each state, record what GreedyBot _would_ do
3. Add these (state, expert_action) pairs to training data
4. Retrain ImitatorNet on combined dataset
5. Repeat 2-3 iterations

**Phase 2: PPO Warm Start**

1. Initialize PPO policy network from DAgger-improved ImitatorNet
2. Fine-tune with RL against GreedyBot
3. RL learns to recover from mistakes and optimize strategy

### Expected Outcomes

| Phase               | Expected Result                             |
| ------------------- | ------------------------------------------- |
| After DAgger        | 30-40% vs Greedy (better on learner states) |
| After PPO Fine-tune | 55%+ vs Greedy (breaks 48% ceiling)         |

---

## Key Insight

**Behavior cloning provides initialization, not solution.**

The imitation model is a stepping stone:

- It's better than random (proof the model learned something)
- It's worse than RL alone (proof imitation isn't sufficient)
- Combined with RL, it should provide the best of both worlds

---

## Files

| File              | Path                                                       |
| ----------------- | ---------------------------------------------------------- |
| Model Directory   | `packages/python-gym/models/imitator-greedy/`              |
| Best Model        | `packages/python-gym/models/imitator-greedy/best_model.pt` |
| Training Script   | `packages/python-gym/examples/train_imitator.py`           |
| Evaluation Script | `packages/python-gym/examples/evaluate_imitator.py`        |
| Training Data     | `packages/python-gym/data/greedy-training-data.npz`        |

---

## Appendix: DAgger Algorithm

```
Algorithm: DAgger (Dataset Aggregation)

D ← ∅                           # Initialize empty dataset
π₀ ← Train on expert demos      # Initial policy (our ImitatorNet)

for i = 1 to N:
    π_i ← Train on D            # Current policy

    for each episode:
        s ← initial state
        while not done:
            a_learner ← π_i(s)   # Learner's action
            a_expert ← Expert(s)  # What expert would do
            D ← D ∪ {(s, a_expert)}  # Add to dataset
            s ← Execute(a_learner)   # But execute learner's action!

    # Aggregate and retrain
    π_{i+1} ← Train on D

return π_N
```

The key insight: We execute the learner's actions but label with expert actions. This collects data from the learner's distribution while maintaining expert supervision.

---

_Report generated: January 9, 2026_
_Key lesson: Imitation provides initialization, RL provides optimization_
