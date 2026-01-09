# Training Reports

This folder contains detailed analysis reports for each significant training run in the ManaCore project.

## Purpose

- **Reproducibility**: Document exact configurations for each experiment
- **Learning**: Track what worked and what didn't
- **Research**: Build evidence for scaling laws, transfer learning, etc.
- **Reference**: Avoid repeating failed experiments

## Report Format

Each report should follow this structure:

```markdown
# Training Report: [Descriptive Name]

**Date:** YYYY-MM-DD
**Run ID:** [model filename or unique ID]
**Phase:** [e.g., 3B, 3C, etc.]
**Objective:** [What question are we answering?]

## Configuration

[All hyperparameters, network architecture, etc.]

## Results

[Training curve, checkpoint data, final evaluation]

## Analysis

[Key findings, hypotheses, comparisons]

## Next Steps

[What to try based on these results]

## Files

[Paths to models, logs, scripts]
```

## Naming Convention

Files should be named: `YYYY-MM-DD_[experiment_type]_[key_detail].md`

Examples:

- `2026-01-09_ppo_1M_scaling.md`
- `2026-01-10_ignis_aggro_specialist.md`
- `2026-01-12_transfer_learning_red_to_white.md`

## Index

### Phase 3B: Master the Baseline

| Date       | Report                                           | Key Finding                                           |
| ---------- | ------------------------------------------------ | ----------------------------------------------------- |
| 2026-01-09 | [ppo_1M_scaling](./2026-01-09_ppo_1M_scaling.md) | No scaling benefit beyond 100K steps; ceiling at ~48% |

### Phase 3C: Archetype Specialists

_(Coming soon)_

### Phase 3D: Transfer Learning

_(Coming soon)_

---

## Quick Stats

| Metric    | Best Achieved | Target |
| --------- | ------------- | ------ |
| vs Random | 78%           | >90%   |
| vs Greedy | 48%           | >60%   |
| vs MCTS   | -             | >50%   |

---

_Last updated: January 9, 2026_
