# Track D: Meta-Game

**Focus:** Deck building, balance, AI creativity
**Lead Phases:** 8+
**Status:** Stretch goal

---

## Overview

Track D explores the frontier of AI creativity in games. While Tracks A-C focus on playing Magic well, Track D asks: **Can AI invent new strategies?**

This is a stretch goal—ambitious, speculative, and potentially the most interesting research outcome.

---

## Vision: The Creative AI

Most game AI research focuses on playing within fixed rules. But Magic: The Gathering has a unique property: **deck construction is part of the game**.

A truly intelligent MTG agent would:
1. Build decks (not just pilot them)
2. Adapt to metagames (counter popular strategies)
3. Discover novel combos (that humans haven't found)

This is closer to **creativity** than **optimization**.

---

## Phase 8: Genetic Algorithm Deck Builder

**Theme:** "Evolution discovers strategy"

**Goal:** Use genetic algorithms to evolve competitive decks without human guidance.

### Task 8.1: GA Framework

**Tasks:**

- [ ] Implement genetic algorithm core:
  ```typescript
  interface Deck {
    cards: { name: string; count: number }[];
    fitness?: number;
  }

  class DeckEvolver {
    population: Deck[];
    generation: number;

    constructor(populationSize: number, cardPool: Card[]);

    // Run tournament to compute fitness
    evaluateFitness(): void;

    // Selection: top 20% survive
    selection(): Deck[];

    // Crossover: combine two decks
    crossover(parent1: Deck, parent2: Deck): Deck;

    // Mutation: swap 1-5 cards randomly
    mutate(deck: Deck): Deck;

    // Main evolution loop
    evolve(generations: number): Deck;
  }
  ```

- [ ] Implement deck validity constraints:
  - Exactly 60 cards
  - Max 4 copies of non-basic cards
  - Color identity consistency (lands match spells)

- [ ] Implement fitness evaluation:
  - Play 20 games against reference decks
  - Fitness = average win rate

**Success Criteria:**
- [ ] GA produces valid 60-card decks
- [ ] Fitness improves over generations
- [ ] Converges to stable strategies

### Task 8.2: Evolution Experiment

**Tasks:**

- [ ] Run long evolution:
  ```bash
  bun scripts/evolve-decks.ts \
    --population 100 \
    --generations 50 \
    --output ./data/evolved-decks/
  ```

- [ ] Track evolution metrics:
  - Average fitness per generation
  - Population diversity
  - Card frequency over time

- [ ] Visualize evolution:
  - Fitness curve plot
  - Card frequency heatmap
  - Deck archetype clustering

**Success Criteria:**
- [ ] Clear fitness improvement over 50 generations
- [ ] Evolved decks are playable (not random piles)
- [ ] Some decks beat hand-crafted decks

### Task 8.3: Archetype Discovery

**Research Question:** Can GA rediscover known archetypes?

**Tasks:**

- [ ] Classify evolved decks:
  - Aggro (low curve, many creatures)
  - Control (removal, card draw, late game)
  - Midrange (balanced curve)
  - Combo (unusual card combinations)

- [ ] Compare to human archetypes:
  - Does GA find "Red Aggro" naturally?
  - Does GA find "Blue Control" naturally?
  - Any novel strategies?

- [ ] Document findings in Track C

**Success Criteria:**
- [ ] At least 2 recognizable archetypes emerge
- [ ] Card choices make strategic sense
- [ ] Potential for novel discoveries

### Task 8.4: Combo Discovery

**Research Question:** Can GA discover combos that weren't programmed?

**Tasks:**

- [ ] Define "combo" detection:
  ```typescript
  // A combo is when specific cards appear together
  // at higher than expected frequency in winning decks
  function detectCombos(winningDecks: Deck[]): CardPair[] {
    // Chi-square test for card co-occurrence
    ...
  }
  ```

- [ ] Run combo search on evolved decks
- [ ] Validate discovered combos:
  - Do the cards actually synergize?
  - Is the combo viable in gameplay?

**Success Criteria:**
- [ ] At least 1 non-obvious card synergy discovered
- [ ] Combo validated in actual games
- [ ] This would be a "eureka" moment!

---

## Phase 9: Metagame Simulation

**Theme:** "The arms race"

**Goal:** Simulate how a metagame evolves as players adapt to each other.

### Task 9.1: Metagame Simulator

**Tasks:**

- [ ] Implement metagame loop:
  ```typescript
  class MetagameSimulator {
    decks: Deck[];        // Current meta decks
    agents: Agent[];      // Agents piloting decks
    history: MetaSnapshot[];

    // One "week" of metagame evolution
    simulateWeek(): void {
      // 1. Run tournament
      const results = this.runTournament();

      // 2. Evolve decks based on results
      const newDecks = this.evolveMeta(results);

      // 3. Update metagame
      this.decks = newDecks;
      this.history.push(this.snapshot());
    }

    // Run for N weeks
    simulate(weeks: number): MetaHistory;
  }
  ```

- [ ] Track metagame metrics:
  - Deck diversity (number of viable archetypes)
  - Dominant strategies
  - Counter-strategies emergence

**Success Criteria:**
- [ ] Metagame evolves over time
- [ ] Dominant strategies get countered
- [ ] Rock-paper-scissors dynamics emerge

### Task 9.2: Balance Analysis

**Research Question:** Is the 6th Edition card pool balanced?

**Tasks:**

- [ ] Run metagame simulation for 100 "weeks"
- [ ] Analyze equilibrium:
  - Does one deck dominate forever?
  - Do we see healthy cycling of strategies?
  - Which cards are "too good"?

- [ ] Propose balance changes:
  - If a card appears in >50% of winning decks, it may be too strong
  - If a card never appears, it may be too weak

**Success Criteria:**
- [ ] Quantified balance metrics
- [ ] Identified problematic cards (if any)
- [ ] Recommendations for card pool adjustment

---

## Phase 10: AI as Game Designer

**Theme:** "Creating, not just playing"

**Goal:** Use AI to design new cards that would improve game balance.

### Task 10.1: Card Generation

**Tasks:**

- [ ] Train card generation model:
  - Input: Desired mana cost, card type, colors
  - Output: Card text, power/toughness

- [ ] Use LLM for initial generation:
  ```
  Generate a balanced red creature for 3 mana that would
  be playable but not overpowered in 6th Edition Limited.
  ```

- [ ] Validate generated cards:
  - Parse into game engine
  - Test in simulations
  - Measure impact on metagame

**Success Criteria:**
- [ ] Generated cards are syntactically valid
- [ ] Some generated cards are balanced
- [ ] Novel design space explored

### Task 10.2: Balance Optimization

**Tasks:**

- [ ] Use RL to optimize card stats:
  - Reward: Metagame diversity after adding card
  - Penalty: Dominance by single strategy

- [ ] Generate "balance patches":
  - AI suggests stat changes to problematic cards
  - Validate in simulation

**Success Criteria:**
- [ ] AI can propose reasonable balance changes
- [ ] Changes improve metagame health
- [ ] Novel approach to game design

---

## Speculative Ideas

These are ideas that go beyond the current roadmap:

### Multi-Format Learning
- Train agent on multiple MTG formats (Standard, Modern, Legacy)
- Transfer learning between formats
- Format-specific strategy emergence

### Opponent Modeling
- Learn to predict opponent's deck/strategy
- Adapt play style mid-game
- Metagame awareness during play

### Natural Language Deck Building
- "Build me an aggressive red deck"
- LLM interprets intent, GA optimizes
- Human-AI collaborative design

### Card Image Generation
- Generate card art for evolved cards
- Use Stable Diffusion / DALL-E
- Complete the "AI game designer" vision

---

## Dependencies

Track D has the longest dependency chain:

```
Track A (Gym) ──► Track B (Agents) ──► Track C (Experiments)
                                              │
                                              ▼
                                        Track D (Meta-Game)
```

**Minimum Requirements:**
- Stable game engine (Phase 0) ✅
- Fast simulation (1000+ games/sec) ✅
- At least one strong agent (MCTSBot) ✅

**Nice to Have:**
- PPO Specialists (for diverse opponents)
- Llama-Mage (for interpretable deck building)

---

## Success Metrics

| Goal | Metric | Target |
|------|--------|--------|
| GA produces viable decks | Win rate vs random | >70% |
| Archetypes emerge | Distinct clusters | 3+ |
| Combo discovery | Novel synergies | 1+ |
| Metagame health | Deck diversity | >3 viable |
| Balance insights | Actionable recommendations | Yes |

---

## Notes

- This is the most speculative track—may not fully succeed
- Even partial results are interesting for research
- Focus on discovery and creativity, not just performance
- Document process, not just outcomes
- Failure modes are valuable data too

---

## Why This Matters

If we can build AI that **creates** good game content (decks, cards, balance patches), we've moved beyond "AI that plays games" to "AI that designs games."

This has implications for:
- Game development (AI-assisted design)
- Procedural content generation
- Understanding creativity in AI
- Human-AI collaboration

Track D is ambitious, but that's the point. Research should push boundaries.
