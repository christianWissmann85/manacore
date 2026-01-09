# Training Report: PPO v2.0 - 36-Feature Observation Space

**Date:** January 9, 2026
**Run IDs:** `ppo_enhanced_standard_20260109_114213`, `ppo_enhanced_extended_20260109_140441`
**Phase:** 3B (Master the Baseline)
**Objective:** Test if enhanced observation features improve performance vs greedy

---

## Executive Summary

**Result: NEGATIVE** - Adding 11 new features based on GreedyBot's evaluation function did NOT improve performance and may have made it worse.

| Metric                 | v1.0 (25 features) | v2.0 (36 features) |
| ---------------------- | ------------------ | ------------------ |
| Best Training Win Rate | 48%                | 48%                |
| Final Eval (100 games) | 45%                | 30%                |
| Ceiling Broken?        | No                 | No                 |

---

## Configuration

### New Features Added (11 total)

**Phase 1 - Critical (5 features):**
| Feature | Description | Rationale |
|---------|-------------|-----------|
| `playerStackPower` | Power of pending creatures | GreedyBot gives 8.0x weight |
| `opponentStackPower` | Opponent's pending creatures | See opponent's plans |
| `playerLifeScaled` | Non-linear life value | Quadratic scaling below 20 |
| `opponentLifeScaled` | Opponent's scaled life | Danger detection |
| `attackingCreaturePower` | Power attacking | GreedyBot's 1.5x bonus |

**Phase 2 - Extended (4 features):**
| Feature | Description | Rationale |
|---------|-------------|-----------|
| `untappedCreaturePower` | Ready creatures | Tempo indicator |
| `spellsOnStack` | Non-creature spells | Combat tricks awareness |
| `creaturesInHand` | Creatures in hand | Planning |
| `spellsInHand` | Spells in hand | Planning |

**Phase 3 - Strategic (2 features):**
| Feature | Description | Rationale |
|---------|-------------|-----------|
| `canWinCombat` | Combat prediction | Heuristic: attack favorable? |
| `unusedMana` | Mana in pool | Efficiency tracking |

### Training Parameters

| Parameter        | Value                     |
| ---------------- | ------------------------- |
| Algorithm        | MaskablePPO (sb3-contrib) |
| Network          | 256x256 MLP               |
| Observation Size | **36** (up from 25)       |
| Learning Rate    | 3e-4                      |
| Batch Size       | 128                       |
| n_steps          | 2048                      |
| Entropy Coef     | 0.02                      |
| Reward Shaping   | Enabled                   |

---

## Results

### Standard Run (500K steps)

```
Win Rate vs Greedy over 500K steps

48% |              ●
46% |        *           *
44% |
42% |                          *
40% |              *     *             *
38% |    *
36% |         *  *     *        *   *
34% |
32% |      *   *                 *
30% |                                    *
28% |
26% | *
24% | *
22% |                                 *
20% |            *
    +--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+
    25 50 75 100 125 150 175 200 225 250 275 300 325 350 375 400 425 450 475 500
                        Training Steps (thousands)

● = Best checkpoint (48% at 300K)
```

| Checkpoint | Win Rate       |
| ---------- | -------------- |
| 25K        | 24%            |
| 50K        | 26%            |
| 75K        | 36%            |
| 100K       | 32%            |
| 150K       | 38%            |
| 200K       | 20%            |
| 275K       | 46%            |
| **300K**   | **48%** (best) |
| 500K       | 42%            |

**Final Evaluation (100 games):**

- vs Random: 74%
- vs Greedy: **30%**

### Extended Run (1M steps)

| Checkpoint | Win Rate       |
| ---------- | -------------- |
| 50K        | 24%            |
| 100K       | 32%            |
| 150K       | 46%            |
| 200K       | 28%            |
| **300K**   | **48%** (best) |
| 500K       | 28%            |
| 750K       | 24%            |
| 1M         | 38%            |

**Final Evaluation (100 games):**

- vs Random: 77%
- vs Greedy: **27%**

---

## Comparison with v1.0 (25 Features)

| Run  | Features | Steps | Best (Training) | Final (Eval) | Stability    |
| ---- | -------- | ----- | --------------- | ------------ | ------------ |
| v1.0 | 25       | 500K  | 48%             | **45%**      | Moderate     |
| v1.0 | 25       | 1M    | 48%             | 33%          | Low          |
| v2.0 | 36       | 500K  | 48%             | 30%          | **Very Low** |
| v2.0 | 36       | 1M    | 48%             | 27%          | Very Low     |

### Key Observations

1. **Same ceiling (48%)** - No improvement in peak performance
2. **Worse final evaluation** - 30% vs 45% (500K runs)
3. **Higher instability** - Range of 20-48% vs 28-48%
4. **Faster initial learning** - Hit 46% by 150K in 1M run
5. **No scaling benefit** - Best still at 100-300K steps

---

## Analysis

### Why Didn't More Features Help?

**Hypothesis 1: Curse of Dimensionality**

- 44% more features = 44% more weights to learn
- Same training budget, more parameters = underfitting
- Network capacity spread thinner

**Hypothesis 2: Feature Interference**

- `playerLifeScaled` correlates with `playerLife`
- `attackingCreaturePower` correlates with `playerTotalPower`
- Redundant features can confuse gradient descent

**Hypothesis 3: Observation ≠ Understanding**

- GreedyBot has **hardcoded priorities** for these features
- PPO must **learn** priorities from sparse reward
- Seeing features doesn't teach HOW to use them

**Hypothesis 4: Reward Signal Mismatch**

- Reward shaping weights differ from GreedyBot's evaluation
- Agent optimizes our reward, not GreedyBot's objective

### The Real Problem

The 48% ceiling is **not an observation problem**. PPO can see enough information - it just can't learn the right policy from RL alone.

Evidence:

- Adding GreedyBot's exact features didn't help
- High variance suggests policy instability, not observation gaps
- Evaluation scores worse than training suggests overfitting to specific patterns

---

## Conclusion

**The feature engineering hypothesis was wrong.** The limitation is not what PPO sees, but how it learns.

This suggests we need a different approach:

1. **Imitation Learning** - Give PPO a warm start by imitating GreedyBot
2. **Curriculum Learning** - Easier opponents first
3. **Architecture Changes** - Attention, LSTM, or action embeddings

---

## Next Steps

**Recommended: Imitation Learning**

1. Collect 10,000+ (state, action) pairs from GreedyBot
2. Train a behavior cloning model to mimic GreedyBot
3. Use this as initialization for PPO fine-tuning
4. Target: 55%+ vs GreedyBot after fine-tuning

---

## Files

| File                   | Path                                                |
| ---------------------- | --------------------------------------------------- |
| Standard Model         | `models/ppo_enhanced_standard_20260109_114213.zip`  |
| Extended Model         | `models/ppo_enhanced_extended_20260109_140441.zip`  |
| Best Model             | `models/ppo_best_vs_greedy.zip`                     |
| Feature Implementation | `packages/ai/src/training/TrainingDataCollector.ts` |
| Training Script        | `packages/python-gym/examples/train_enhanced.py`    |

---

## Appendix: Feature Engineering Code

The new features were implemented in `extractFeatures()`:

```typescript
// Stack power (GreedyBot's 8.0x weight)
playerStackPower: Math.min(playerStackPower / 20, 1.0),
opponentStackPower: Math.min(opponentStackPower / 20, 1.0),

// Non-linear life (quadratic below 20)
playerLifeScaled: Math.min(lifeValue(player.life) / 20, 2.0),
opponentLifeScaled: Math.min(lifeValue(opponent.life) / 20, 2.0),

// Attacking bonus (GreedyBot's 1.5x)
attackingCreaturePower: Math.min(playerStats.attackingPower / 20, 1.0),

// Extended features
untappedCreaturePower: Math.min(playerStats.untappedPower / 20, 1.0),
spellsOnStack: Math.min(spellsOnStack / 5, 1.0),
creaturesInHand: Math.min(playerHand.creatures / 5, 1.0),
spellsInHand: Math.min(playerHand.spells / 5, 1.0),

// Strategic features
canWinCombat,  // Heuristic: 0-1
unusedMana: Math.min(unusedMana / 10, 1.0),
```

---

_Report generated: January 9, 2026_
_Lesson learned: More features ≠ better learning_
