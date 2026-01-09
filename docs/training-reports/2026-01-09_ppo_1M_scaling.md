# Training Report: PPO 1M Scaling Experiment

**Date:** January 9, 2026
**Run ID:** `ppo_enhanced_extended_20260109_094429`
**Phase:** 3B (Master the Baseline)
**Objective:** Test if more training steps improve performance vs greedy

---

## Configuration

| Parameter      | Value                     |
| -------------- | ------------------------- |
| Algorithm      | MaskablePPO (sb3-contrib) |
| Network        | 256x256 MLP               |
| Total Steps    | 1,000,000                 |
| Learning Rate  | 3e-4                      |
| Batch Size     | 128                       |
| n_steps        | 2048                      |
| Entropy Coef   | 0.02                      |
| Reward Shaping | Enabled (potential-based) |
| Opponent       | GreedyBot                 |
| Eval Frequency | 50,000 steps              |
| Eval Games     | 50 per checkpoint         |
| Seed           | 42                        |

### Reward Shaping Weights

```
life_advantage:    0.30
board_power:       0.25
creature_count:    0.20
card_advantage:    0.15
mana_advantage:    0.10
```

---

## Results

### Training Curve

```
Win Rate vs Greedy over 1M steps

50% |          *
48% |    ●
46% |                      *           *
44% |                                      *   *
42% |              *    *      *                    *  *  *
40% |        *                                  *
38% | *                                             *
36% |                             *  *
34% |                                *
32% |                   *     *
30% |      *                              *     *
28% |                                  *
    +--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+
     50 100 150 200 250 300 350 400 450 500 550 600 650 700 750 800 850 900 950 1M
                            Training Steps (thousands)

● = Best checkpoint saved (48% at 100K)
* = Evaluation checkpoint
```

### Checkpoint Data

| Steps (K) | Win Rate | Notes     |
| --------- | -------- | --------- |
| 50        | 38%      | Initial   |
| **100**   | **48%**  | **BEST**  |
| 150       | 30%      | Drop      |
| 200       | 40%      | Recovery  |
| 250       | 42%      |           |
| 300       | 32%      | Drop      |
| 350       | 42%      | Recovery  |
| 400       | 46%      | Near best |
| 450       | 32%      | Drop      |
| 500       | 34%      |           |
| 550       | 36%      |           |
| 600       | 36%      |           |
| 650       | 28%      | Lowest    |
| 700       | 46%      | Recovery  |
| 750       | 44%      |           |
| 800       | 30%      | Drop      |
| 850       | 38%      |           |
| 900       | 40%      |           |
| 950       | 42%      |           |
| 1000      | 42%      | Final     |

### Final Evaluation (100 games)

| Opponent  | Wins | Win Rate |
| --------- | ---- | -------- |
| RandomBot | 75   | 75.0%    |
| GreedyBot | 33   | 33.0%    |

### Statistics

| Metric                    | Value            |
| ------------------------- | ---------------- |
| Best Win Rate (training)  | 48% @ 100K steps |
| Final Win Rate (training) | 42%              |
| Final Win Rate (eval)     | 33%              |
| Win Rate Range            | 28% - 48%        |
| Standard Deviation        | ~6% (estimated)  |
| Total Training Time       | ~95 minutes      |
| Speed                     | ~175 it/s        |

---

## Analysis

### Key Finding: No Scaling Benefit

**The agent achieved its best performance (48%) at just 100K steps.** Additional training to 1M steps provided no improvement and potentially caused degradation.

### Observations

1. **Early Peak**: Best performance occurred at 100K steps (10% of total training)

2. **High Variance**: Win rate oscillated between 28-48% throughout training
   - This suggests policy instability or high evaluation noise

3. **No Emergent Abilities**: Unlike LLM scaling, we saw no "phase transitions" or sudden capability jumps

4. **Eval vs Training Gap**: Final eval (33%) was worse than final training checkpoint (42%)
   - Possible overfitting to training opponent patterns
   - Or evaluation sample size too small (100 games)

5. **Plateau Pattern**: Performance oscillated around 35-42% for most of training

### Hypotheses for Ceiling

| Hypothesis                              | Evidence                                            | Likelihood |
| --------------------------------------- | --------------------------------------------------- | ---------- |
| **Observation space insufficient**      | 25 features can't capture combat math, abilities    | High       |
| **Greedy exploits specific weaknesses** | Deterministic opponent; consistent winning patterns | High       |
| **Reward shaping local optima**         | Dense rewards may teach suboptimal habits           | Medium     |
| **Action semantics invisible**          | Agent sees indices, not action meaning              | Medium     |
| **Evaluation noise**                    | 50 games per checkpoint is low sample               | Medium     |

---

## Comparison with Previous Runs

| Run             | Steps  | Network     | Shaping | vs Greedy (Best) | vs Greedy (Final) |
| --------------- | ------ | ----------- | ------- | ---------------- | ----------------- |
| 1 (Baseline)    | 250K   | 64x64       | No      | 32%              | 32%               |
| 2 (Enhanced)    | 500K   | 256x256     | Yes     | 48%              | 45%               |
| **3 (Scaling)** | **1M** | **256x256** | **Yes** | **48%**          | **33%**           |

**Conclusion**: Doubling training steps from 500K to 1M provided no benefit. The 500K run actually had better final performance (45% vs 33%).

---

## Next Steps

### Immediate: Diagnostic Analysis (Option C)

Before changing the approach, understand WHY greedy wins:

1. Watch games where greedy beats PPO
2. Identify specific failure patterns
3. Determine what information is missing

### Potential Improvements

**Option A: Richer Observations**

- Add creature abilities (flying, first strike, etc.)
- Add spell type information
- Add combat math predictions
- Add mana curve analysis

**Option B: Hyperparameter Tuning**

- Increase entropy coefficient (more exploration)
- Decrease learning rate (more stable)
- Increase evaluation games (reduce noise)
- Try different network architectures (512x512, CNN)

**Option D: Alternative Training**

- Self-play instead of vs greedy
- Population-based training
- Imitation learning on MCTS data

---

## Files

| File             | Path                                                                   |
| ---------------- | ---------------------------------------------------------------------- |
| Final Model      | `packages/python-gym/models/ppo_enhanced_extended_20260109_094429.zip` |
| Best Model       | `packages/python-gym/models/ppo_best_vs_greedy.zip`                    |
| TensorBoard Logs | `packages/python-gym/logs/scaling_1M/`                                 |
| Training Script  | `packages/python-gym/examples/train_enhanced.py`                       |

---

## Appendix: Training Output

```
============================================================
ManaCore Enhanced PPO Training
============================================================
Mode: extended
Total timesteps: 1,000,000
Network: 256x256 (larger)
Reward shaping: ENABLED (dense rewards)
Opponent: greedy
Target: 60% win rate
Seed: 42

FINAL EVALUATION (100 games each)
============================================================
  vs random: 75/100 (75.0%)
  vs greedy: 33/100 (33.0%)

TRAINING SUMMARY
============================================================
  vs greedy: 42.0% (best: 48.0%) [FAIL]
  Total timesteps: 1,000,000
```

---

_Report generated: January 9, 2026_
_Author: Claude + Chris_
