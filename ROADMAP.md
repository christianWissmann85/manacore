# MANACORE: Development Roadmap

**Version:** 1.0.0  
**Last Updated:** January 4, 2026  
**Total Estimated Duration:** 30+ Tasks  
**Approach:** Agile, iterative, ship early and often

---

## Phase 0: Foundation

**Theme:** "Prove the Architecture Works"

### Goals

- Set up monorepo with clean separation of concerns
- Implement minimal game loop (play cards, attack, win/lose)
- Validate that the engine can run headless at high speed
- Establish data pipeline from Scryfall

### Task 1: Project Setup

**Tasks:**

- [x] Initialize Bun workspace monorepo
- [x] Create `packages/engine`, `packages/ai`, `packages/cli-client`
- [x] Configure TypeScript for each package
- [x] Set up Git repo with proper `.gitignore`
- [x] Write project README

**Deliverable:** Empty but properly structured project

### Task 2: Data & Engine Core

**Tasks:**

- [x] Implement Scryfall scraper (`packages/data-scraper`)
- [x] Fetch 6th Edition card data
- [x] Parse and cache JSON locally
- [x] Implement `CardLoader` in engine
- [x] Define core types: `GameState`, `PlayerState`, `CardInstance`
- [x] Implement basic `applyAction` reducer for:
  - Play land
  - Cast creature (sorcery speed)
  - Attack (attacker chooses blocker)

**Deliverable:** Engine can simulate a vanilla creature game

**Test Deck:**

```json
{
  "name": "Vanilla Red",
  "cards": [
    { "name": "Mountain", "count": 24 },
    { "name": "Grizzly Bears", "count": 12 }, // 2/2 for 1G
    { "name": "Hill Giant", "count": 12 }, // 3/3 for 3R
    { "name": "Lightning Bolt", "count": 12 } // 3 damage
  ]
}
```

### Task 3: CLI & RandomBot

**Tasks:**

- [x] Build CLI interface (`packages/cli-client`)
  - Display game state in ASCII art
  - Accept text commands (play 0, attack 1, etc.)
- [x] Implement `RandomBot` that picks random legal actions
- [x] Run 100 games of RandomBot vs RandomBot
- [x] Verify games complete without crashes

**Success Criteria:**

- ✅ Two RandomBots finish 100 games
- ✅ Average game length: 20-50 turns
- ✅ No infinite loops or crashes
- ✅ Simulation speed: >500 games/second

**Deliverable:** Working CLI client you can play against RandomBot

**Screenshot Goal:**

```
BATTLEFIELD
Opponent: 15 life, 5 mana
  [Mountain] [Mountain] [Mountain]
  [Hill Giant] (3/3, untapped)

Your: 12 life, 4 mana
  [Mountain] [Mountain] [Mountain] [Forest]
  [Grizzly Bears] (2/2, tapped)

HAND: [Lightning Bolt] [Grizzly Bears] [Mountain]

> cast 0 target opponent_unit_0
```

---

## Phase 1: Core MTG Rules

**Theme:** "This Actually Feels Like Magic"

### Goals

- Implement The Stack with priority
- Add proper combat (declare blockers)
- Support instant-speed interaction
- **Implement mana system (CRITICAL!)**
- **Add targeting system (CRITICAL!)**
- **Expand card library to 20-30 working cards**
- Build basic web UI

### Task 4-5: The Stack

**Tasks:**

- [x] Implement stack data structure (LIFO)
- [x] Add priority system (both players must pass to resolve)
- [x] Implement `PASS_PRIORITY` action
- [x] Add instant-speed spells
- [x] Implement `Counterspell` as test case

**New Cards:**

```
Counterspell (U) - Counter target spell
Giant Growth (G) - Target creature gets +3/+3
Unsummon (U) - Return target creature to hand
```

**Test Scenario:**

```
Player A: Cast Lightning Bolt targeting Player B
Player B: Pass priority
[Stack resolves, Player B takes 3 damage]

Player A: Cast Hill Giant
Player B: Cast Counterspell targeting Hill Giant
Player A: Pass priority
[Counterspell resolves, Hill Giant countered]
```

**Success Criteria:**

- ✅ Stack resolves in correct order (LIFO)
- ✅ Both players can respond to spells
- ✅ Counterspell works correctly

### Task 6: Proper Combat

**Tasks:**

- [x] Implement combat phases:
  - Beginning of Combat
  - Declare Attackers
  - Declare Blockers
  - Combat Damage
  - End of Combat
- [x] Add damage assignment for multiple blockers
- [x] Implement keywords: Flying, First Strike, Trample

**New Cards:**

```
Serra Angel (3WW) - 4/4 Flying, Vigilance
Shivan Dragon (4RR) - 5/5 Flying, {R}: +1/+0
Air Elemental (3UU) - 4/4 Flying
```

**Test Scenario:**

```
Player A attacks with Serra Angel (4/4 Flying)
Player B declares blockers: Air Elemental (4/4 Flying)
[Both deal 4 damage to each other, both die]
```

**Success Criteria:**

- ✅ Flying creatures can only be blocked by Flying/Reach
- ✅ First Strike damage happens before normal damage
- ✅ Trample damage goes through to player

### Task 7: State-Based Actions & Triggers

**Tasks:**

- [x] Implement state-based actions:
  - Creatures with 0 or less toughness die
  - Players at 0 or less life lose
  - Legendary rule (if needed)
- [x] Implement triggered abilities:
  - "When ~ enters the battlefield"
  - "When ~ dies"
- [x] Add activated abilities:
  - "Tap: Deal 1 damage" (Prodigal Sorcerer)

**New Cards:**

```
Prodigal Sorcerer (2U) - 1/1, Tap: Deal 1 damage
Nekrataal (2BB) - 2/1, When ~ ETB: Destroy target nonblack creature
```

**Success Criteria:**

- ✅ Creatures die immediately when toughness <= 0
- ✅ ETB triggers happen in correct order
- ✅ Activated abilities can be used at instant speed

### Task 9: Mana System ⚠️ CRITICAL

**Tasks:**

- [x] Implement mana pool system:
  - `ManaPool` type with `{W, U, B, R, G, C}` counts
  - Add mana to pool
  - Remove mana from pool
  - Empty pool at phase transitions
- [x] Add mana costs to all cards:
  - Parse mana cost strings (e.g., `"{2}{R}{R}"`)
  - Validate player can pay cost
  - Deduct mana when casting spell
- [x] Implement mana abilities:
  - "Tap: Add {R}" (basic lands)
  - Auto-tapping for mana
  - Color identity rules
- [x] Update validators to check mana costs
- [x] Update CLI/UI to show mana pools

**New Cards:**

```
Dark Ritual (B) - Add {B}{B}{B}
Llanowar Elves (G) - Creature, Tap: Add {G}
Birds of Paradise (G) - Creature, Tap: Add one mana of any color
```

**Test Scenario:**

```
Player A has 3 Mountains
Turn: Player A taps 2 Mountains for {R}{R}
Action: Cast Shivan Dragon (4RR) - FAIL (need 4 more mana)
Turn: Player A taps third Mountain
Action: Cast Hill Giant (3R) - SUCCESS
```

**Success Criteria:**

- ✅ Cannot cast spells without sufficient mana
- ✅ Mana pool empties between phases
- ✅ Color requirements enforced (can't cast {R}{R} with {U}{U})
- ✅ Mana abilities work correctly

**Why Critical:** The game is literally unplayable without mana costs - you can currently cast anything for free!

### Task 10: Targeting System ⚠️ CRITICAL

**Tasks:**

- [x] Implement target validation:
  - Valid target types (creature, player, "any target")
  - Legal targets (in play, controller restrictions)
  - Protection/Hexproof/Shroud (if needed)
- [x] Add targeting to actions:
  - `CastSpellAction.targets` array
  - `ActivateAbilityAction.targets` array
  - Target validation in validators
- [x] Implement "target" text parser:
  - "Target creature" → filter battlefield for creatures
  - "Target player" → return player list
  - "Any target" → creatures + players
- [x] Update reducers to use targets:
  - Apply effects to specified targets
  - Handle illegal targets (fizzle spell)
- [x] Add targeting to UI:
  - Click-to-target interface
  - Highlight valid targets
  - Cancel targeting

**New Cards:**

```
Lightning Bolt (R) - Deal 3 damage to any target
Giant Growth (G) - Target creature gets +3/+3 until EOT
Terror (1B) - Destroy target nonblack creature
Unsummon (U) - Return target creature to owner's hand
```

**Test Scenario:**

```
Player A casts Lightning Bolt
Game: "Choose target (any target)"
Player A: Clicks opponent's Grizzly Bears
Stack: Lightning Bolt targeting Grizzly Bears
[Resolves: Bears takes 3 damage, dies]
```

**Success Criteria:**

- ✅ Can only target legal targets
- ✅ Spell fizzles if target becomes illegal
- ✅ UI clearly shows valid targets
- ✅ Multi-target spells work (if needed)

**Why Critical:** Most Magic cards target something - without this, we can only play vanilla creatures!

### Task 11: Card Library Expansion

**Tasks:**

- [x] Implement 20-30 common 6th Edition cards (and check if all mentioned Cards from previous Tasks have been implemented):
  - **Creatures (10)**: Shivan Dragon, Serra Angel, Sengir Vampire, Mahamoti Djinn, etc.
  - **Removal (5)**: Swords to Plowshares, Terror, Disenchant, Fireball, etc.
  - **Card Draw (3)**: Ancestral Recall, Brainstorm, Jayemdae Tome
  - **Pump/Combat Tricks (4)**: Giant Growth, Weakness, Holy Strength, Unholy Strength
  - **Counterspells (2)**: Counterspell, Power Sink
  - **Disruption (3)**: Mind Rot, Hymn to Tourach, Icy Manipulator
  - **Enchantments (3)**: Pacifism, Weakness, Holy Strength
- [x] Test each card thoroughly
- [x] Add card-specific logic to:
  - `activatedAbilities.ts` (for activated abilities)
  - `triggers.ts` (for triggered abilities)
  - `reducer.ts` (for special effects)
- [x] Create test decks for each color
- [x] Run 100+ games with expanded card pool

**Card Categories:**

```typescript
// White: Removal, protection, weenie creatures
Swords to Plowshares, Disenchant, Pacifism, White Knight, Serra Angel

// Blue: Counterspells, card draw, flying
Counterspell, Ancestral Recall, Brainstorm, Air Elemental, Mahamoti Djinn

// Black: Removal, disruption, big creatures
Terror, Mind Rot, Hypnotic Specter, Sengir Vampire, Necropotence

// Red: Burn, haste, dragons
Lightning Bolt, Fireball, Ball Lightning, Shivan Dragon, Goblin King

// Green: Mana ramp, big creatures, pump
Llanowar Elves, Giant Growth, Erhnam Djinn, Force of Nature
```

**Success Criteria:**

- ✅ 20+ cards fully implemented and tested
- ✅ Each color has viable cards
- ✅ Can build functional mono-color decks
- ✅ All cards work correctly in combination

**Deliverable:** Complete playable Magic game with real cards and real mana costs!

---

## Phase 1.5: Integration Testing & Documentation

**Testing Tasks:**

- [ ] Run 1,000-game simulation with all cards
- [ ] Test each color pair combination (10 matchups)
- [ ] Verify all 300 cards work in actual games
- [ ] Create Test Decks so that every card gets played
- [ ] Identify and document remaining edge cases

**Documentation Tasks:**

- [ ] Update CARD_STATUS.md with final counts
- [ ] Finalize Phase 1.6 deferred list
- [ ] Update CLAUDE.md with Phase 1.5 completion, Rewrite for Phase 2 Focus
- [ ] Create release notes for Phase 1.5

**Final Verification:**

- [ ] RandomBot vs RandomBot: 500 games, no crashes
- [ ] Human playtesting: Each color viable
- [ ] Performance check: Still 500+ games/second

**Success Criteria:**

- ✅ 302+ cards (90%) fully implemented
- ✅ 1000-game simulation completes
- ✅ All documentation updated
- ✅ Phase 1.6 scope clearly defined

**Deliverable:** Full 6th Edition card pool playable!

---

## Phase 2: Hidden Information & Smart AI

**Theme:** "The AI Gets Dangerous"

### Goals

- Implement MCTS with hidden information handling
- Create heuristic evaluation function
- Add card advantage mechanics
- Build replay system for debugging

### Task 21-22: MCTS Core

**Tasks:**

- [ ] Implement MCTS algorithm
  - Selection (UCB1)
  - Expansion
  - Simulation (rollout)
  - Backpropagation
- [ ] Add determinization for hidden info
- [ ] Implement GreedyBot for rollout policy

**Success Criteria:**

- ✅ MCTS can run 1000 iterations in <5 seconds
- ✅ MCTS-Bot beats RandomBot 90%+ of games
- ✅ MCTS-Bot beats GreedyBot 60%+ of games

### Task 23: Evaluation Function

**Tasks:**

- [ ] Implement board evaluation heuristic:
  ```typescript
  evaluation =
    (myLife - oppLife) * 2.0 +
    (myBoardValue - oppBoardValue) * 1.5 +
    (myHandSize - oppHandSize) * 0.5 +
    myLandsInPlay * 0.3 +
    myCardAdvantage * 1.0;
  ```
- [ ] Tune weights through self-play
- [ ] Add tempo bonuses (untapped creatures > tapped)

**Test:**
Run 1000 games with different weight values, find optimal.

### Task 24-25: Card Advantage & Disruption

**Tasks:**

- [ ] Add card draw spells
- [ ] Add discard spells
- [ ] Add removal spells
- [ ] Implement Enchantments (Auras)

**New Cards:**

```
Ancestral Recall (U) - Draw 3 cards
Brainstorm (U) - Draw 3, put 2 back
Mind Rot (2B) - Target player discards 2 cards
Swords to Plowshares (W) - Exile target creature, controller gains life
Pacifism (1W) - Enchant creature, it can't attack or block
```

**Success Criteria:**

- ✅ MCTS values card draw correctly
- ✅ AI uses removal at appropriate times
- ✅ AI doesn't discard important cards

### Task 26: Replay System & Stats

**Tasks:**

- [ ] Implement game replay (save actions + seed)
- [ ] Build statistics dashboard:
  - Win rate by deck
  - Average game length
  - Cards played per game
  - Decision quality metrics
- [ ] Add match history viewer

**Deliverable:**

- Replay any game to debug AI decisions
- Dashboard showing AI performance metrics

---

## Phase 3: Advanced Visualization

**Theme:** "The Research Dashboard"

### Goals

- Full web visualization dashboard
- Deck construction lab
- Multiple AI Agent configurations
- Audio feedback for events
- Interactive documentation

### Task 27: Basic Web Dashboard

**Tasks:**

- [ ] Set up Vite + React + Tailwind project
- [ ] Implement `useGameState` hook to connect to engine
- [ ] Create `Card` component with Tailwind styling
- [ ] Create `Battlefield` grid layout
- [ ] Implement basic click-to-play actions
- [ ] Add "Inspector Panel" for viewing card JSON data
- [ ] Use fetched Image Data from `packages/web-client/public/assets/cards/` folder
  - Implement Placeholder if Data is not present

**Success Criteria:**

- ✅ Dashboard renders game state via React
- ✅ Responsive grid layout works
- ✅ Can play a full game via UI controls
- ✅ Clean, scientific aesthetic (Dark mode, monospace fonts)

**Deliverable:** Interactive research dashboard

### Task 28-29: Visualization Polish

**Tasks:**

- [ ] Add Framer Motion for simple state transitions
- [ ] Implement "Log View" with filterable action history
- [ ] Add "Mana Pool" visualization with charts
- [ ] Add "Targeting Mode" (click source -> click target)
- [ ] Implement keyboard shortcuts for common actions (Space to pass)

**Assets Needed:**

- Icons (Lucide React)
- Tailwind Config (Custom colors)

### Task 30-31: Deck Lab

**Tasks:**

- [ ] Build deck construction UI:
  - Browse all available cards
  - Filter by color, type, CMC
  - Configure Agent decks
  - View mana curve chart
  - Validate deck (60 cards minimum)
- [ ] Save/load test configurations
- [ ] Create 5-10 standard test decks:
  - Red Aggro
  - Blue Control
  - Green Midrange
  - White Weenie
  - Black Disruption

**Success Criteria:**

- ✅ User can configure test decks quickly
- ✅ Deck validation prevents illegal states
- ✅ Mana curve visualization aids analysis

### Task 32: AI Configuration & Final Polish

**Tasks:**

- [ ] Tune AI Agent profiles:
  - Baseline: RandomBot (random legal moves)
  - Heuristic: GreedyBot (1-ply lookahead)
  - Strong: MCTS-500 (500 iterations)
  - Expert: MCTS-2000 (2000 iterations)
- [ ] Test with researchers/developers
- [ ] Adjust evaluation function based on logs

**Target Win Rates (vs Baseline):**

- Heuristic: 90% win rate
- Strong: 95% win rate
- Expert: 99% win rate

**Additional Tasks:**

- [ ] Interactive guide for new users
- [ ] Rules reference integration
- [ ] Settings (visualization speed, debug mode)
- [ ] Bug fixes from stress testing
- [ ] Performance optimization
- [ ] Write technical documentation

**Deliverable:** 🔬 **RESEARCH PLATFORM v1.0**

---

## Phase 4: AI Research Tools

**Theme:** "The AI Research Laboratory"

### Goals

- Tournament simulator
- Deck analytics
- MCTS visualization
- Meta-game analysis

### Task 33-34: Tournament Simulator

**Tasks:**

- [ ] Implement Swiss-style tournament
- [ ] Implement Single-Elimination bracket
- [ ] Run large-scale simulations (10,000+ games)
- [ ] Generate reports:
  - Win rate by deck matchup
  - Top-performing cards
  - Meta-game breakdown

**Research Questions:**

```
1. Which deck archetype is strongest?
   Run: 10,000 games, Aggro vs Control vs Midrange

2. What's the optimal land count?
   Test: 20, 22, 24, 26 lands × 1000 games each

3. Which cards are format staples?
   Metric: Win% when card is in deck
```

### Task 35-36: Deck Analytics

**Tasks:**

- [ ] Implement deck scoring algorithms:
  - Mana curve optimization
  - Synergy detection (cards that work well together)
  - Consistency metrics (how often you draw what you need)
- [ ] Build card statistics:
  - Win% when drawn
  - Average turn played
  - Most common targets
- [ ] Create meta-game reports:
  - Most played decks
  - Counter-strategy recommendations

**Example Output:**

```
DECK: Red Burn
Mana Curve: A+ (optimal 1-3 CMC distribution)
Synergy Score: B (Lightning Bolt + creatures)
Win Rate: 58% (above average)

Top Performers:
- Lightning Bolt: 72% win rate when drawn
- Mountain: 60% win rate (baseline)

Weak Cards:
- Goblin King: 45% win rate (underperforming)

Recommendation: Replace Goblin King with more removal
```

### Task 37: MCTS Visualization

**Tasks:**

- [ ] Build decision tree visualizer
- [ ] Show node visit counts
- [ ] Highlight best path
- [ ] Display win rate estimates
- [ ] Animate tree growth in real-time

**Use Cases:**

- Understand why AI makes certain plays
- Debug evaluation function
- Discover novel strategies

**Example Visualization:**

```
                 [Root: 1000 visits, 55% WR]
                    /           |           \
        [Play Land: 400]  [Attack: 350]  [Cast Spell: 250]
           /     \             |              /        \
      [End: 200] [Attack: 200] ...      [Target A]  [Target B]
```

### Task 38: A/B Testing Framework

**Tasks:**

- [ ] Compare different MCTS configurations:
  - Exploration parameter (c value)
  - Rollout depth
  - Determinization count
- [ ] Compare evaluation functions:
  - Material-only
  - Material + tempo
  - Material + tempo + card advantage
- [ ] Statistical significance testing

**Example Test:**

```
Hypothesis: Increasing determinization samples improves win rate

Control: 5 determinizations per MCTS search
Variant: 10 determinizations per MCTS search

Run: 1000 games each
Result: 54% vs 57% win rate (p < 0.05, significant!)
```

**Deliverable:** Research platform for AI experimentation

---

## Phase 5: Machine Learning

**Theme:** "Skynet Learns Magic"

### Goals

- Neural network evaluation function
- Genetic algorithm deck building
- Self-play training
- Novel strategy discovery

### Task 39-42: Neural Network Evaluation

**Tasks:**

- [ ] Collect training data (100,000+ games)
- [ ] Design network architecture:
  ```
  Input: Game state (vectorized)
  Hidden: 3 layers (512, 256, 128 neurons)
  Output: Win probability [0, 1]
  ```
- [ ] Train model with supervised learning
- [ ] Replace heuristic evaluation in MCTS
- [ ] Benchmark: NN-MCTS vs Heuristic-MCTS

**Success Criteria:**

- ✅ NN evaluation is faster than rollout
- ✅ NN-MCTS beats Heuristic-MCTS by 10%+

### Task 43-46: Genetic Algorithm Deck Builder

**Tasks:**

- [ ] Implement GA framework:
  1. Generate random population (100 decks)
  2. Run tournament (fitness = win rate)
  3. Selection (top 20%)
  4. Crossover (combine decks)
  5. Mutation (swap 1-5 cards)
  6. Repeat for 50 generations
- [ ] Visualize deck evolution over generations
- [ ] Compare GA-decks to hand-crafted decks

**Research Questions:**

```
1. Can GA rediscover known archetypes?
   (e.g., does it create a burn deck?)

2. Can GA discover novel strategies?
   (e.g., combos we didn't think of)

3. How many generations to converge?
```

### Task 47+: Self-Play & AlphaZero

**Tasks:**

- [ ] Implement self-play loop:
  1. AI plays against itself
  2. Collect training data
  3. Train NN on outcomes
  4. Update MCTS with new NN
  5. Repeat
- [ ] Compare to AlphaZero paper methodology
- [ ] Measure improvement over time

---

### Phase 6: The "Power Creep" Experiment (Transfer Learning)

**Research Question:** _Can an agent trained on a "fair" environment (6th Edition) adapt to a "broken" environment (Urza’s Block) without starting from scratch?_

- **The Setup (The Control Group):**
- Establish a baseline "Nash Equilibrium" for the 6th Edition meta (e.g., Red Aggro vs. Blue Control win rates are stable).
- Save the weights/heuristics of the "Expert" 6th Edition Agent.

- **The Intervention (The "Urza" Injection):**
- Implement a **"Scenario Pack"** of only 10–15 high-impact cards from Urza's Saga.
- _Focus:_ "Paradigm Shifters" rather than complex rules.
- **Fast Mana:** _Tolarian Academy_ (or a simplified version like _Gaea's Cradle_ logic).
- **Combo Engines:** _High Tide_ or _Megrim_.
- **Consistency:** A few cards with **Cycling** (to test if AI values filtering).

- **The Experiment:**
- **Group A (Zero-Shot):** Throw the pre-trained 6th Ed Agent into the new environment. Does it recognize that _Tolarian Academy_ is a high-priority pick/target immediately, or does it undervalue it based on "fair" Magic heuristics?
- **Group B (Transfer Learning):** Allow the agent to update its weights. Measure the **"Time to Adaptation"** (number of games required to rediscover the new meta).
- **Group C (From Scratch):** Train a fresh agent on the new pool. Does the pre-trained agent (Group B) learn faster than the fresh one?

- **The Deliverable (The Paper):**
- **Title:** _"Plasticity of MCTS Agents in Evolving TCG Environments."_
- **Hypothesis:** Pre-training on Core Sets creates "General Magic Intuition" that accelerates learning of Power Creep mechanics.

## Maintenance & Future Work

### Post-Release Maintenance

- Bug fixes
- Balance patches (adjust card pool)
- Performance optimization
- User-requested features

---

**End of Roadmap**

_Let's build something amazing! 🎮🤖_
