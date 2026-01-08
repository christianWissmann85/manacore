# Track C: Experiments

**Focus:** Research questions, papers, scientific rigor
**Lead Phases:** 5+
**Status:** Planned (depends on Track B agents)

---

## Overview

Track C is where we answer research questions and produce publishable findings. This track doesn't build software—it uses the infrastructure (Track A) and agents (Track B) to run experiments and analyze results.

**Publication Targets:**
- HuggingFace Papers
- arXiv (cs.AI, cs.LG)
- Blog posts and open-source documentation

---

## Experiment 1: LLM vs MCTS Showdown

**Research Question:** Can a model that "reads" cards (LLM) beat a model that "simulates" mechanics (MCTS)?

**Hypothesis:**
- MCTS will dominate in tactical situations (combat math, damage calculation)
- LLM will excel in strategic decisions (long-term planning, card valuation)
- Overall, MCTS wins on win rate, but LLM provides better explanations

### Methodology

**Agents:**
- MCTS-500 (500 iterations, greedy rollout)
- MCTS-1000 (1000 iterations, greedy rollout)
- Llama-Mage (fine-tuned on Claude reasoning)
- Claude Sonnet (via API, as reference)

**Conditions:**
1. Tactical: Simple board states, clear optimal play
2. Strategic: Complex boards, multiple viable lines
3. Time-pressured: Limited decision time (1s vs 10s)

**Metrics:**
- Win rate (primary)
- Decision time
- Agreement with human experts (if available)
- "Mistake rate" (obviously suboptimal plays)

### Experimental Design

```
Phase 1: Baseline
- MCTS-500 vs MCTS-500: 1000 games (establish variance)
- Llama-Mage vs Llama-Mage: 1000 games (establish variance)

Phase 2: Head-to-Head
- MCTS-500 vs Llama-Mage: 1000 games (each side)
- MCTS-1000 vs Llama-Mage: 1000 games (each side)

Phase 3: Ablation
- MCTS with NN value function vs pure MCTS
- Llama-Mage with vs without reasoning prompt
```

### Analysis Plan

1. **Quantitative:**
   - Win rate with confidence intervals
   - Decision time distribution
   - Performance by game phase (early/mid/late)

2. **Qualitative:**
   - Sample 100 games, annotate key decisions
   - Identify patterns where LLM excels/fails
   - Document "surprising" plays from each agent

3. **Statistical Tests:**
   - Chi-square for win rate significance
   - Mann-Whitney U for decision time

### Expected Outcomes

| Metric | MCTS-500 | Llama-Mage | Prediction |
|--------|----------|------------|------------|
| Win rate | ~55% | ~45% | MCTS wins overall |
| Tactical accuracy | High | Medium | MCTS stronger |
| Strategic quality | Medium | High | LLM stronger |
| Interpretability | None | High | LLM wins |

### Deliverables

- [ ] Experiment protocol document
- [ ] Raw data (all games in JSONL)
- [ ] Analysis notebook
- [ ] Paper draft: "Search vs Semantics: Comparing MCTS and LLM Agents in Magic: The Gathering"
- [ ] Blog post summary

---

## Experiment 2: Transfer Learning (Power Creep)

**Research Question:** Can an agent trained on "fair" Magic (6th Edition) adapt to "broken" Magic (Urza's Block)?

**Hypothesis:**
- Pre-training on Core Sets creates "General Magic Intuition"
- This accelerates learning of Power Creep mechanics
- Zero-shot transfer will fail, but fine-tuning will be faster than from-scratch

### Background

6th Edition is considered "fair" Magic:
- Balanced mana costs
- Limited combo potential
- Creature-based gameplay

Urza's Block is considered "broken":
- Fast mana (Tolarian Academy, Gaea's Cradle)
- Combo engines (High Tide, Megrim)
- Paradigm-shifting cards

### Methodology

**Scenario Pack:** Implement 10-15 high-impact Urza's Saga cards:
- Tolarian Academy (lands = blue mana)
- Gaea's Cradle (creatures = green mana)
- Windfall (draw/discard)
- Time Spiral (untap, draw)
- Cycling cards (filtering)

**Agent Groups:**

| Group | Pre-training | Fine-tuning | Notes |
|-------|--------------|-------------|-------|
| A (Zero-Shot) | 6ED (1M steps) | None | Test raw transfer |
| B (Transfer) | 6ED (1M steps) | Urza (varying) | Measure adaptation |
| C (From Scratch) | None | Urza (1M steps) | Baseline comparison |

**Metrics:**
- "Time to Adaptation" (steps to reach 60% win rate)
- Card valuation (does agent recognize Academy is good?)
- Strategy emergence (does agent discover combos?)

### Experimental Design

```
Phase 1: Baseline Training
- Train Group C from scratch on Urza environment
- Track learning curve, save checkpoints

Phase 2: Transfer Testing
- Load Group A (pre-trained 6ED) into Urza environment
- Evaluate zero-shot performance (no fine-tuning)
- Analyze decisions: does it understand new cards?

Phase 3: Fine-tuning Comparison
- Fine-tune Group B at varying timesteps: 10K, 50K, 100K, 500K
- Compare to Group C at same timesteps
- Plot learning curves

Phase 4: Card Valuation Analysis
- Extract action probabilities for specific cards
- Compare valuation of Tolarian Academy before/after adaptation
- Identify "aha moment" where agent recognizes power
```

### Expected Outcomes

| Metric | Group A | Group B | Group C |
|--------|---------|---------|---------|
| Zero-shot win rate | ~30% | N/A | N/A |
| Steps to 60% WR | N/A | ~50K | ~200K |
| Discovers Academy value | No | Yes (fast) | Yes (slow) |

### Deliverables

- [ ] Urza Scenario Pack implementation
- [ ] Training scripts for all groups
- [ ] Learning curve plots
- [ ] Analysis of card valuation evolution
- [ ] Paper draft: "Plasticity of RL Agents in Evolving TCG Environments"

---

## Experiment 3: Specialist vs Generalist

**Research Question:** Is it better to train deck-specific agents or one multi-task agent?

**Hypothesis:**
- Specialists will outperform on their home deck
- Generalist will be more robust across decks
- League training (specialists + generalist) produces best overall results

### Methodology

**Specialists:**
- Agent Ignis (Red only)
- Agent Aqua (Blue only)
- Agent Silva (Green only)

**Generalists:**
- Multi-Task Agent (trained on all decks, deck identity as input)
- League Agent (trained against specialists)

**Evaluation:**
```
Round Robin Tournament:
- Each agent plays each deck
- 100 games per deck per matchup
- Track win rate and confidence intervals
```

### Experimental Design

```
Phase 1: Train Specialists
- Ignis: 1M steps on Red decks
- Aqua: 1M steps on Blue decks
- Silva: 1M steps on Green decks

Phase 2: Train Generalist
- Multi-Task: 3M steps (1M per deck, interleaved)
- Input includes deck embedding

Phase 3: League Training
- League: 3M steps against pool of (Random, Greedy, Specialists)
- Adversarial component: specialists also improve

Phase 4: Evaluation
- Round robin: All agents × All decks × 100 games
- Compute ELO ratings
- Analyze cross-deck performance
```

### Analysis

| Agent | Red Deck | Blue Deck | Green Deck | Average |
|-------|----------|-----------|------------|---------|
| Ignis | Best | Poor | Poor | ? |
| Aqua | Poor | Best | Poor | ? |
| Silva | Poor | Poor | Best | ? |
| Multi-Task | Good | Good | Good | ? |
| League | ? | ? | ? | Best? |

### Deliverables

- [ ] Training scripts for all conditions
- [ ] ELO rating system implementation
- [ ] Round robin tournament runner
- [ ] Analysis of when specialists beat generalists
- [ ] Paper section for Track B documentation

---

## Experiment 4: Interpretability Study

**Research Question:** Can we understand why agents make decisions?

**Hypothesis:**
- LLM reasoning can be validated against actual outcomes
- MCTS visit counts reveal decision confidence
- PPO action probabilities show learned heuristics

### Methodology

**Techniques:**
1. **LLM Reasoning Analysis**
   - Collect 1000 decisions with reasoning
   - Categorize reasoning types (tempo, card advantage, threat assessment)
   - Correlate reasoning quality with outcomes

2. **MCTS Tree Analysis**
   - Visualize decision trees for key moments
   - Analyze visit count distribution
   - Identify "close" decisions vs "obvious" plays

3. **PPO Attention Analysis** (if using attention-based policy)
   - What features drive decisions?
   - How does attention change over game phases?

### Deliverables

- [ ] Reasoning taxonomy for MTG decisions
- [ ] MCTS visualization tool (Phase 3 web client)
- [ ] Feature importance analysis
- [ ] Paper section: "Opening the Black Box"

---

## Experiment 5: Human Baseline

**Research Question:** How do our agents compare to human players?

**Hypothesis:**
- Strong agents should beat casual humans
- Expert humans may still beat our best agents
- LLM agents feel more "human-like" to play against

### Methodology

**Human Participants:**
- Recruit 10-20 MTG players (varying skill)
- Categorize: Beginner, Intermediate, Expert
- Each plays 10 games vs each agent type

**Agents:**
- RandomBot (sanity check)
- MCTSBot-500
- PPO Specialist
- Llama-Mage

**Metrics:**
- Win rate by skill level
- Post-game survey: "How human-like was the opponent?"
- Decision time comparison

### Ethical Considerations

- IRB approval if publishing with human subjects
- Informed consent
- Anonymized data

### Deliverables

- [ ] Human study protocol
- [ ] Survey instrument
- [ ] Analysis of human vs agent performance
- [ ] Qualitative feedback summary

---

## Publication Roadmap

| Experiment | Target Venue | Timeline | Status |
|------------|--------------|----------|--------|
| 1: LLM vs MCTS | arXiv, HuggingFace | Phase 5+ | Planned |
| 2: Transfer Learning | arXiv | Phase 7 | Planned |
| 3: Specialist vs Generalist | Blog post | Phase 3+ | Planned |
| 4: Interpretability | Paper section | Ongoing | Planned |
| 5: Human Baseline | Optional | Stretch | Idea |

---

## Data Management

All experimental data should be:
- Stored in `data/experiments/{experiment_name}/`
- Versioned with git LFS or external storage
- Documented with data cards
- Reproducible (seeds saved)

---

## Notes

- Experiments can run in parallel once agents are trained
- Statistical rigor is important for publication
- Document negative results too—they're valuable
- Consider pre-registration for credibility
