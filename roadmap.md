# MANACORE: Development Roadmap

**Version:** 1.0.0  
**Last Updated:** January 3, 2026  
**Total Estimated Duration:** 26+ weeks  
**Approach:** Agile, iterative, ship early and often

---

## Quick Reference

| Phase | Duration | Focus | Shippable? |
|-------|----------|-------|------------|
| **Phase 0** | Weeks 1-3 | Foundation | ❌ CLI only |
| **Phase 1** | Weeks 4-11 | Core MTG | ✅ Complete game |
| **Phase 2** | Weeks 12-17 | Smart AI | ✅ Challenging AI |
| **Phase 3** | Weeks 18-23 | Polish | ✅ **PUBLIC RELEASE** |
| **Phase 4** | Weeks 24-29 | Research Tools | ✅ AI Lab |
| **Phase 5** | Weeks 30+ | Machine Learning | ✅ Advanced AI |

---

## Phase 0: Foundation (Weeks 1-3)

**Theme:** "Prove the Architecture Works"

### Goals
- Set up monorepo with clean separation of concerns
- Implement minimal game loop (play cards, attack, win/lose)
- Validate that the engine can run headless at high speed
- Establish data pipeline from Scryfall

### Week 1: Project Setup

**Tasks:**
- [x] Initialize Bun workspace monorepo
- [x] Create `packages/engine`, `packages/ai`, `packages/cli-client`
- [x] Configure TypeScript for each package
- [x] Set up Git repo with proper `.gitignore`
- [x] Write project README

**Deliverable:** Empty but properly structured project

### Week 2: Data & Engine Core

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
    {"name": "Mountain", "count": 24},
    {"name": "Grizzly Bears", "count": 12},  // 2/2 for 1G
    {"name": "Hill Giant", "count": 12},     // 3/3 for 3R
    {"name": "Lightning Bolt", "count": 12}  // 3 damage
  ]
}
```

### Week 3: CLI & RandomBot

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

## Phase 1: Core MTG Rules (Weeks 4-11)

**Theme:** "This Actually Feels Like Magic"

### Goals
- Implement The Stack with priority
- Add proper combat (declare blockers)
- Support instant-speed interaction
- **Implement mana system (CRITICAL!)**
- **Add targeting system (CRITICAL!)**
- **Expand card library to 20-30 working cards**
- Build basic web UI

### Week 4-5: The Stack

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

### Week 6: Proper Combat

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

### Week 7: State-Based Actions & Triggers

**Tasks:**
- [ ] Implement state-based actions:
  - Creatures with 0 or less toughness die
  - Players at 0 or less life lose
  - Legendary rule (if needed)
- [ ] Implement triggered abilities:
  - "When ~ enters the battlefield"
  - "When ~ dies"
- [ ] Add activated abilities:
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

### Week 8: Basic Web UI

**Tasks:**
- [ ] Set up Vite + PixiJS project
- [ ] Load card images from Scryfall URLs
- [ ] Render battlefield zones
- [ ] Implement drag-and-drop for playing cards
- [ ] Add click-to-target for spells
- [ ] Connect UI to engine (same action system)

**Success Criteria:**
- ✅ Can play a full game in the browser
- ✅ UI updates when game state changes
- ✅ Card artwork loads correctly
- ✅ Smooth at 60 FPS

**Deliverable:** Playable web game (basic, but functional)

### Week 9: Mana System ⚠️ CRITICAL

**Tasks:**
- [ ] Implement mana pool system:
  - `ManaPool` type with `{W, U, B, R, G, C}` counts
  - Add mana to pool
  - Remove mana from pool
  - Empty pool at phase transitions
- [ ] Add mana costs to all cards:
  - Parse mana cost strings (e.g., `"{2}{R}{R}"`)
  - Validate player can pay cost
  - Deduct mana when casting spell
- [ ] Implement mana abilities:
  - "Tap: Add {R}" (basic lands)
  - Auto-tapping for mana
  - Color identity rules
- [ ] Update validators to check mana costs
- [ ] Update CLI/UI to show mana pools

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

### Week 10: Targeting System ⚠️ CRITICAL

**Tasks:**
- [ ] Implement target validation:
  - Valid target types (creature, player, "any target")
  - Legal targets (in play, controller restrictions)
  - Protection/Hexproof/Shroud (if needed)
- [ ] Add targeting to actions:
  - `CastSpellAction.targets` array
  - `ActivateAbilityAction.targets` array
  - Target validation in validators
- [ ] Implement "target" text parser:
  - "Target creature" → filter battlefield for creatures
  - "Target player" → return player list
  - "Any target" → creatures + players
- [ ] Update reducers to use targets:
  - Apply effects to specified targets
  - Handle illegal targets (fizzle spell)
- [ ] Add targeting to UI:
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

### Week 11: Card Library Expansion

**Tasks:**
- [ ] Implement 20-30 common 6th Edition cards:
  - **Creatures (10)**: Shivan Dragon, Serra Angel, Sengir Vampire, Mahamoti Djinn, etc.
  - **Removal (5)**: Swords to Plowshares, Terror, Disenchant, Fireball, etc.
  - **Card Draw (3)**: Ancestral Recall, Brainstorm, Jayemdae Tome
  - **Pump/Combat Tricks (4)**: Giant Growth, Weakness, Holy Strength, Unholy Strength
  - **Counterspells (2)**: Counterspell, Power Sink
  - **Disruption (3)**: Mind Rot, Hymn to Tourach, Icy Manipulator
  - **Enchantments (3)**: Pacifism, Weakness, Holy Strength
- [ ] Test each card thoroughly
- [ ] Add card-specific logic to:
  - `activatedAbilities.ts` (for activated abilities)
  - `triggers.ts` (for triggered abilities)
  - `reducer.ts` (for special effects)
- [ ] Create test decks for each color
- [ ] Run 100+ games with expanded card pool

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

## Phase 2: Hidden Information & Smart AI (Weeks 12-17)

**Theme:** "The AI Gets Dangerous"

### Goals
- Implement MCTS with hidden information handling
- Create heuristic evaluation function
- Add card advantage mechanics
- Build replay system for debugging

### Week 12-13: MCTS Core

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

### Week 14: Evaluation Function

**Tasks:**
- [ ] Implement board evaluation heuristic:
  ```typescript
  evaluation = 
    (myLife - oppLife) * 2.0 +
    (myBoardValue - oppBoardValue) * 1.5 +
    (myHandSize - oppHandSize) * 0.5 +
    (myLandsInPlay * 0.3) +
    (myCardAdvantage * 1.0)
  ```
- [ ] Tune weights through self-play
- [ ] Add tempo bonuses (untapped creatures > tapped)

**Test:**
Run 1000 games with different weight values, find optimal.

### Week 15-16: Card Advantage & Disruption

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

### Week 17: Replay System & Stats

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

## Phase 3: Polished Game Experience (Weeks 18-23)

**Theme:** "Ship a Real Game"

### Goals
- Full web UI with animations
- Deck builder
- Multiple AI difficulty levels
- Sound effects
- Tutorial/Help system

### Week 18-19: UI Polish

**Tasks:**
- [ ] Add animations:
  - Card sliding between zones
  - Attack animations (card moves forward)
  - Damage numbers (floating text)
  - Spell effects (particle effects)
- [ ] Add sound effects:
  - Card play sound
  - Attack sound
  - Damage sound
  - Win/lose music
- [ ] Improve visual feedback:
  - Highlight valid targets
  - Show mana cost on hover
  - Glow effect for playable cards

**Assets Needed:**
- Card play SFX
- Attack SFX
- Win/lose music
- Particle sprites

### Week 20-21: Deck Builder

**Tasks:**
- [ ] Build deck builder UI:
  - Browse all available cards
  - Filter by color, type, CMC
  - Add/remove cards from deck
  - View mana curve chart
  - Validate deck (60 cards minimum)
- [ ] Save/load custom decks
- [ ] Create 5-10 pre-built decks:
  - Red Aggro
  - Blue Control
  - Green Midrange
  - White Weenie
  - Black Disruption

**Success Criteria:**
- ✅ User can build a 60-card deck in <5 minutes
- ✅ Deck validation prevents illegal decks
- ✅ Mana curve visualization helps deck building

### Week 22: AI Difficulty Tuning

**Tasks:**
- [ ] Tune AI difficulty levels:
  - Easy: RandomBot (random legal moves)
  - Medium: GreedyBot (1-ply lookahead)
  - Hard: MCTS-500 (500 iterations)
  - Expert: MCTS-2000 (2000 iterations)
- [ ] Test with playtesters (get real humans to play!)
- [ ] Adjust evaluation function based on feedback

**Target Win Rates (for average player):**
- Easy: 90% player win rate
- Medium: 70% player win rate
- Hard: 50% player win rate
- Expert: 30% player win rate

### Week 23: Final Polish & Testing

**Tasks:**
- [ ] Tutorial for new players
- [ ] Help system (rules reference)
- [ ] Settings menu (sound, animation speed)
- [ ] Bug fixes from playtesting
- [ ] Performance optimization
- [ ] Write user documentation

**Deliverable:** 🚀 **PUBLIC RELEASE v1.0**

---

## Phase 4: AI Research Tools (Weeks 24-29)

**Theme:** "The AI Research Laboratory"

### Goals
- Tournament simulator
- Deck analytics
- MCTS visualization
- Meta-game analysis

### Week 24-25: Tournament Simulator

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

### Week 26-27: Deck Analytics

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

### Week 28: MCTS Visualization

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

### Week 29: A/B Testing Framework

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

## Phase 5: Machine Learning (Weeks 30+)

**Theme:** "Skynet Learns Magic"

### Goals
- Neural network evaluation function
- Genetic algorithm deck building
- Self-play training
- Novel strategy discovery

### Week 30-33: Neural Network Evaluation

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

### Week 34-37: Genetic Algorithm Deck Builder

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

### Week 38+: Self-Play & AlphaZero

**Tasks:**
- [ ] Implement self-play loop:
  1. AI plays against itself
  2. Collect training data
  3. Train NN on outcomes
  4. Update MCTS with new NN
  5. Repeat
- [ ] Compare to AlphaZero paper methodology
- [ ] Measure improvement over time

**Long-term Goal:**
- Discover optimal play for our card pool
- Generate new cards that are balanced
- Build tournament-winning decks automatically

---

## Milestones & Checkpoints

### Checkpoint 1: End of Phase 0 (Week 3)
**Demo:** Run `bun cli play --deck vanilla-red --opponent random`
**Outcome:** You can play a simple game in terminal

### Checkpoint 2: End of Phase 1 (Week 11)
**Demo:** Open browser, play real Magic with mana costs, targeting, and 20+ cards
**Outcome:** Game feels like Magic, not just generic card game

### Checkpoint 3: End of Phase 2 (Week 17)
**Demo:** MCTS-Bot vs GreedyBot (MCTS wins 70%+)
**Outcome:** AI is legitimately challenging

### Checkpoint 4: End of Phase 3 (Week 23)
**Demo:** 🎮 PUBLIC RELEASE - Full game on GitHub
**Outcome:** People can actually play and have fun

### Checkpoint 5: End of Phase 4 (Week 29)
**Demo:** Run 10,000 game tournament overnight
**Outcome:** Discover which deck is strongest in meta

### Checkpoint 6: Phase 5+ (Ongoing)
**Demo:** GA evolves a winning deck from scratch
**Outcome:** AI designs decks better than humans

---

## Risk Management

### High-Risk Items

**Risk 1: Rules complexity spirals out of control**
- **Mitigation:** Strict phase gating, curate card pool carefully
- **Fallback:** Skip complex cards (we don't need every 6th Ed card)

**Risk 2: MCTS is too slow for good play**
- **Mitigation:** Profile early, optimize hot paths, use Bun
- **Fallback:** Use shallower search, better heuristics

**Risk 3: Hidden info makes MCTS ineffective**
- **Mitigation:** Implement determinization, test thoroughly
- **Fallback:** Use imperfect info algorithms (ISMCTS)

**Risk 4: UI work takes forever**
- **Mitigation:** Keep Phase 1-2 UI minimal, polish in Phase 3
- **Fallback:** Ship CLI version first, web version later

### Medium-Risk Items

**Risk 5: Playtesting reveals unfun gameplay**
- **Mitigation:** Get feedback early (Phase 1), iterate quickly
- **Fallback:** Adjust card pool, AI difficulty

**Risk 6: Deck builder is confusing**
- **Mitigation:** Copy existing UIs (MTG Arena, Hearthstone)
- **Fallback:** Provide pre-built decks only

### Low-Risk Items

**Risk 7: Genetic algorithm doesn't converge**
- **Mitigation:** This is research, failure is acceptable
- **Outcome:** Learn from it, publish results

---

## Success Metrics

### Phase 0-3 (Game Development)
- ✅ Game runs at 60 FPS
- ✅ No crashes in 100+ consecutive games
- ✅ Players can learn rules in <15 minutes
- ✅ Average match length: 10-20 minutes
- ✅ AI difficulty feels distinct (Easy → Expert)

### Phase 4 (Research Tools)
- ✅ Can simulate 10,000 games in <12 hours
- ✅ Metrics are actionable (inform deck building)
- ✅ MCTS visualization helps understand decisions

### Phase 5 (Machine Learning)
- ✅ NN evaluation is faster than rollout
- ✅ NN-MCTS beats baseline by 10%+
- ✅ GA discovers known archetypes
- ✅ GA discovers 1+ novel competitive deck

---

## Maintenance & Future Work

### Post-Release Maintenance
- Bug fixes
- Balance patches (adjust card pool)
- Performance optimization
- User-requested features

### Potential Expansions
1. **Urza's Block** (Phase 6)
   - Add 300+ new cards
   - New mechanics (Cycling, Echo, Flashback)

2. **Draft Mode** (Phase 7)
   - AI-powered draft simulator
   - Learn draft archetypes

3. **Multiplayer** (Phase 8)
   - 4-player Commander-style
   - Requires major architecture changes

4. **Mobile App** (Phase 9)
   - React Native port
   - Touch-friendly UI

5. **Card Design Tool** (Phase 10)
   - Generate new cards
   - Test balance via simulation

---

## Getting Started

### Immediate Next Steps (This Week)

**Day 1-2: Setup**
```bash
# Create monorepo
mkdir mana-core && cd mana-core
bun init -y

# Create workspace structure
mkdir -p packages/{engine,ai,cli-client,data-scraper}

# Initialize each package
cd packages/engine && bun init -y
cd packages/ai && bun init -y
cd packages/cli-client && bun init -y
cd packages/data-scraper && bun init -y
```

**Day 3-4: Fetch Card Data**
```bash
# Run Scryfall scraper
cd packages/data-scraper
bun run ../scripts/fetch-cards.ts

# Verify output
cat ../engine/data/cards/6ed.json | wc -l
# Should show ~350 cards
```

**Day 5-7: First Playable**
```bash
# Implement minimal engine
cd packages/engine
# Code GameState, actions, reducer

# Build CLI
cd packages/cli-client
# Code game loop, display functions

# Test
bun cli play
```

---

## Appendix: Time Estimates by Component

| Component | Estimated Hours | Notes |
|-----------|----------------|-------|
| Project setup | 8h | Monorepo, TypeScript, tooling |
| Scryfall scraper | 4h | Straightforward API calls |
| Engine core (Phase 0) | 20h | GameState, actions, zones |
| Combat system | 16h | Declare attackers/blockers, damage |
| The Stack | 12h | Priority, LIFO resolution |
| State-based actions | 8h | Die triggers, cleanup |
| CLI client | 12h | ASCII art, input handling |
| RandomBot | 2h | Pick random legal action |
| GreedyBot | 8h | Board evaluation heuristic |
| MCTS core | 24h | UCB1, rollouts, determinization |
| Web UI (basic) | 40h | PixiJS setup, card rendering |
| Web UI (polish) | 60h | Animations, sounds, effects |
| Deck builder | 24h | UI, validation, persistence |
| Tournament simulator | 16h | Swiss, Single-Elim, stats |
| Analytics dashboard | 20h | Visualizations, reports |
| MCTS visualizer | 16h | Tree rendering, animations |
| Neural network | 40h | Data collection, training, integration |
| Genetic algorithm | 32h | GA loop, fitness function, mutations |

**Total Estimated:** ~402 hours (~10 weeks @ 40h/week)

This aligns with our 20-week timeline for Phases 0-3 (accounting for debugging, testing, iteration).

---

**End of Roadmap**

*Let's build something amazing! 🎮🤖*
