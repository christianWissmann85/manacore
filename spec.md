# MANACORE: Project Specification

**Version:** 1.0.0  
**Last Updated:** January 3, 2026  
**Project Type:** Digital MTG Implementation + AI Research Platform  
**Primary Tech Stack:** TypeScript, Bun, PixiJS  

---

## 1. Project Vision

ManaCore is a **playable Magic: The Gathering digital implementation** with an **AI research platform** for studying game theory, deck building, and strategy optimization through simulation.

### 1.1 Primary Goals

1. **Playable Game**: Fun MTG experience with AI opponents
2. **AI Research**: MCTS-driven gameplay that discovers optimal strategies
3. **ML Applications**: Tournament simulation, deck evolution, and meta-game analysis
4. **Educational**: Learn AI/ML techniques through a real-world game engine

### 1.2 Core Philosophy

- **Code-First**: Game logic in pure TypeScript, data-driven card definitions
- **Simulation-Heavy**: Headless engine can run 1000+ games/second
- **Incremental Complexity**: Ship working game early, add features iteratively
- **Research-Oriented**: Every design decision supports AI experimentation

---

## 2. Game Rules (MVP Scope)

### 2.1 Card Pool: 6th Edition Core Set

We will implement a **curated subset** of Magic: The Gathering's 6th Edition Core Set, chosen for:
- Mechanical clarity (avoid complex layer interactions)
- Strategic depth (support multiple archetypes)
- AI tractability (cards the MCTS can reason about)

**Phase 0 (Vanilla Cube)**: ~20 cards (vanilla creatures + basic lands)  
**Phase 1 (Core Mechanics)**: ~50 cards (add keywords + simple spells)  
**Phase 2 (Strategic Depth)**: ~100 cards (add card draw, disruption)  
**Phase 3 (Full Experience)**: ~200 cards (polished card pool)

### 2.2 Implemented Mechanics

#### Phase 0: Foundation
- ✅ Creature combat (simplified blocking: attacker chooses)
- ✅ Sorcery-speed spells
- ✅ Basic lands (tap for mana)
- ✅ Life totals (20 starting)
- ✅ Deck, hand, graveyard, battlefield zones

#### Phase 1: Core MTG
- ✅ **The Stack** (LIFO resolution, priority passing)
- ✅ **Proper Combat** (declare attackers → blockers → damage assignment)
- ✅ **Keywords**: Flying, First Strike, Trample, Vigilance, Haste
- ✅ **Instant-speed spells**
- ✅ **State-Based Actions** (creatures die at 0 toughness, players lose at 0 life)
- ✅ **Triggered abilities** ("When ~ enters the battlefield")
- ✅ **Activated abilities** ("Tap: deal 1 damage")

#### Phase 2: Strategic Complexity
- ✅ **Card Draw** (cantrips, draw spells)
- ✅ **Enchantments** (Auras with targeting)
- ✅ **Disruption** (Counterspell, discard)
- ✅ **Mana abilities** (Dark Ritual, mana acceleration)

#### Phase 3+: Advanced
- ✅ **Multiple blockers** (damage assignment order)
- ✅ **Combat tricks** (pump spells, removal in combat)
- ✅ **Complex triggers** (dies triggers, attack triggers)

### 2.3 Explicitly NOT Implemented (Too Complex for MVP)

❌ **Phasing** (rarely used, complex rules)  
❌ **Banding** (unintuitive mechanic)  
❌ **Layer system edge cases** (Humility + Opalescence)  
❌ **Wishes** (cards outside game)  
❌ **Ante** (not used in modern Magic)  
❌ **Mana burn** (removed in modern rules, but was in 6th Ed - we'll skip it)

---

## 3. Technical Requirements

### 3.1 Performance Targets

| Metric | Target | Rationale |
|--------|--------|-----------|
| Headless simulation speed | 1000+ games/sec | Enables overnight AI training |
| MCTS iterations per move | 1000-2000 | Balance quality vs latency |
| UI frame rate | 60 FPS | Smooth animations |
| Game state clone time | <1ms | Critical for MCTS |
| API response time | <100ms | Card data fetching |

### 3.2 Compatibility

- **Runtime**: Bun 1.0+ (for speed + TypeScript native support)
- **Browser**: Chrome/Firefox/Safari (modern ES2022+ features)
- **Screen sizes**: 1280x720 minimum (desktop-first, mobile later)

### 3.3 Data Requirements

All card data must be stored locally to support:
- Offline development
- Fast lookups (no API latency)
- Consistent game state (no network failures mid-game)

**Required Fields from Scryfall:**
- Card name, mana cost, type line
- Oracle text (official current wording)
- Power/toughness (creatures)
- Artwork (high-res image URL)
- Flavor text
- Set code + collector number
- Color identity
- Rulings (for complex interactions)

**NOT Needed:**
- Pricing data
- Legality in other formats
- Foil availability
- Market trends

---

## 4. User Experience

### 4.1 Play Modes

**Single Player**
- Play against AI (Easy/Medium/Hard/Expert)
- Choose from pre-built decks or build custom
- View game statistics after match

**AI vs AI (Research Mode)**
- Watch two AIs play
- Visualize MCTS decision trees
- Pause/step through game
- Export game logs for analysis

**Deck Builder**
- Browse available cards (filter by color, type, CMC)
- Build 60-card decks
- See mana curve visualization
- Validate deck (minimum size, legal cards)

### 4.2 UI Zones (Based on MTG Layout)

```
┌─────────────────────────────────────────┐
│  OPPONENT                               │
│  [Library] [Graveyard] [Exile]          │
│  Life: 20  Mana: 3/5                   │
├─────────────────────────────────────────┤
│  BATTLEFIELD (Shared)                   │
│  [Opponent Creatures/Permanents]        │
│  ─────────────────────────────────      │
│  [Your Creatures/Permanents]            │
├─────────────────────────────────────────┤
│  STACK (when active)                    │
│  [Spell 3]                              │
│  [Spell 2]                              │
│  [Spell 1] ← Resolves first             │
├─────────────────────────────────────────┤
│  YOU                                    │
│  Life: 20  Mana: 5/5                   │
│  [Hand: 7 cards]                        │
│  [Library] [Graveyard] [Exile]          │
└─────────────────────────────────────────┘
```

### 4.3 Visual Feedback

- **Zones**: Clear visual separation
- **Targeting**: Arrow from source to target
- **Mana costs**: Color-coded mana symbols
- **Tapped state**: 90° rotation
- **Valid actions**: Highlighted/glowing
- **Damage**: Red flash + floating damage numbers
- **Card movement**: Smooth animations between zones

---

## 5. AI Specifications

### 5.1 Bot Difficulty Levels

**Easy (RandomBot)**
- Picks random legal move
- No lookahead
- Good for testing/debugging

**Medium (GreedyBot)**
- Evaluates immediate board state
- Picks move with best material advantage
- 1-ply lookahead

**Hard (MCTS-Bot 500)**
- 500 MCTS iterations per decision
- 3-5 ply effective depth
- Should beat GreedyBot 70%+ of the time

**Expert (MCTS-Bot 2000)**
- 2000 MCTS iterations
- Discovers complex lines
- Near-optimal play

### 5.2 MCTS Implementation Details

**Algorithm**: UCT (Upper Confidence Bound for Trees)

**Phases**:
1. **Selection**: UCB1 formula to balance exploration/exploitation
2. **Expansion**: Add unexplored child nodes
3. **Simulation**: Rollout using GreedyBot policy
4. **Backpropagation**: Update win rates up the tree

**Hidden Information Handling**:
- **Determinization**: Sample N possible opponent hands
- **Information Set MCTS**: Cluster game states by visible info
- **Conservative play**: Assume opponent has answers unless proven otherwise

**Evaluation Function** (for non-terminal states):
```typescript
score = 
  (myLife - opponentLife) * 2.0 +
  (myBoardValue - opponentBoardValue) * 1.5 +
  (myHandSize - opponentHandSize) * 0.5 +
  (myLandsInPlay * 0.3) +
  (myCardsInGraveyard * -0.1)  // Slight penalty for using resources
```

---

## 6. Research Applications

### 6.1 Tournament Simulation

**Capabilities**:
- Run Swiss-style or Single-Elimination tournaments
- Test 1000s of games to determine meta
- Identify dominant deck archetypes
- Discover counter-strategies

**Metrics**:
- Win rate by matchup (Deck A vs Deck B)
- Average game length
- Most impactful cards (by win% when drawn)
- Mana efficiency (unused mana per turn)

### 6.2 Deck Optimization

**Genetic Algorithm**:
1. Generate population of random decks
2. Run tournament to evaluate fitness
3. Select top performers
4. Crossover (combine two decks) + Mutation (swap cards)
5. Repeat for N generations

**Optimization Targets**:
- Maximize win rate vs meta
- Minimize variance (consistent performance)
- Optimize mana curve
- Balance threats vs answers

### 6.3 Strategy Discovery

**Questions to Answer**:
- "What's the optimal land count for aggro/control/midrange?"
- "Does the AI discover tempo plays (e.g., bounce + replay)?"
- "Can MCTS find Counterspell + card draw lock?"
- "What's the value of going first vs drawing a card?"

---

## 7. Data Structures

### 7.1 Card Schema

```typescript
interface ScryfallCard {
  // Identity
  id: string;                    // Scryfall UUID
  name: string;
  set: string;                   // "6ed"
  collector_number: string;
  
  // Game Data
  mana_cost: string;             // "{2}{R}{R}"
  cmc: number;                   // 4
  type_line: string;             // "Creature — Dragon"
  oracle_text: string;           // Rules text
  power?: string;
  toughness?: string;
  colors: string[];              // ["R"]
  color_identity: string[];      // For deck building
  keywords: string[];            // ["Flying", "Haste"]
  
  // Visual
  image_uris: {
    small: string;
    normal: string;
    large: string;
    art_crop: string;
  };
  flavor_text?: string;
  
  // Optional
  rulings_uri?: string;          // Link to rulings
}
```

### 7.2 Game State Schema

```typescript
interface GameState {
  // Players
  players: {
    player: PlayerState;
    opponent: PlayerState;
  };
  
  // Shared zones
  stack: StackObject[];
  exile: CardInstance[];
  
  // Game metadata
  activePlayer: PlayerId;
  priorityPlayer: PlayerId;
  turnCount: number;
  phase: GamePhase;
  step: GameStep;
  
  // State
  gameOver: boolean;
  winner: PlayerId | null;
  
  // Determinism
  rngSeed: number;
}

interface PlayerState {
  id: PlayerId;
  life: number;
  manaPool: ManaPool;
  library: CardInstance[];
  hand: CardInstance[];
  battlefield: CardInstance[];
  graveyard: CardInstance[];
  exile: CardInstance[];
}

interface CardInstance {
  instanceId: string;            // Unique for this game
  scryfallId: string;            // Reference to card data
  controller: PlayerId;
  owner: PlayerId;
  
  // State
  zone: Zone;
  tapped: boolean;
  summoningSick: boolean;
  damage: number;                // Marked damage
  
  // Modifications
  counters: Record<CounterType, number>;
  attachments: CardInstance[];  // Auras, Equipment
  
  // Combat
  attacking?: boolean;
  blocking?: string;             // instanceId of attacker
}
```

---

## 8. Success Criteria

### Phase 0 (Week 3)
- ✅ Two RandomBots can play a complete game
- ✅ CLI shows readable game state
- ✅ Games complete in <50 turns
- ✅ Scryfall data cached locally

### Phase 1 (Week 8)
- ✅ Human can play vs RandomBot and win reliably
- ✅ Stack resolves correctly (Counterspell works)
- ✅ Combat feels like MTG (blocking matters)
- ✅ Basic web UI displays game

### Phase 2 (Week 14)
- ✅ MCTS-Bot beats GreedyBot 70%+ of games
- ✅ AI doesn't make obvious blunders
- ✅ Game replay system works
- ✅ Can run 1000 games in <10 minutes

### Phase 3 (Week 20)
- ✅ Game is fun to play (subjective, but get feedback!)
- ✅ UI is intuitive (playtesters can learn in <5 minutes)
- ✅ Can play a full match in <15 minutes
- ✅ Multiple AI difficulties feel distinct

### Phase 4 (Week 26)
- ✅ Tournament simulator runs 10,000 games overnight
- ✅ Dashboard shows actionable insights
- ✅ MCTS discovers non-obvious plays (analyzed via tree visualization)

### Phase 5 (Open-ended)
- ✅ ML-enhanced MCTS beats hand-crafted version
- ✅ Genetic algorithm discovers known archetypes
- ✅ Novel deck discovered that wins >55% of games

---

## 9. Non-Goals (Out of Scope)

- ❌ Multiplayer (>2 players)
- ❌ Online matchmaking
- ❌ Trading/Collection management
- ❌ Mobile app (web only for now)
- ❌ Full MTG Comprehensive Rules compliance
- ❌ All sets (just 6th Edition)
- ❌ Monetization/Economy

---

## 10. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Rules complexity spirals | High | Strict phase gating, avoid complex cards |
| MCTS too slow | High | Profile early, optimize hot paths, use Bun's speed |
| Hidden info makes MCTS weak | Medium | Implement determinization, test vs known decks |
| Card interactions break engine | Medium | Comprehensive test suite, replay system for bugs |
| Scope creep | High | Ruthlessly prioritize, ship Phase 3 before Phase 4 |

---

## 11. Future Expansions (Post-MVP)

- **Urza's Block**: Add Urza's Saga, Legacy, Destiny
- **Draft Mode**: AI-powered draft simulator
- **Deck Recommender**: "You might like..." based on play history
- **Card Design Tool**: Generate balanced custom cards
- **Multiplayer**: 4-player Commander-style
- **Mobile Client**: React Native port

---

## Appendix A: Key Decisions

**Why 6th Edition?**
- Last core set before major rules changes (6th Ed rules are cleaner)
- Good mix of classic cards and strategic depth
- Manageable size (~350 cards total, we'll use ~200)

**Why MCTS over Deep Learning?**
- MCTS is interpretable (we can see why it makes decisions)
- Works with limited data (don't need millions of games to train)
- Good baseline for comparing to ML approaches later

**Why Bun over Node?**
- Native TypeScript support (no build step for CLI)
- ~3x faster than Node (critical for simulations)
- Built-in test runner, bundler

**Why PixiJS over React/Canvas?**
- High-performance 2D rendering (WebGL)
- Great for card game UIs (sprite batching)
- Active community, good docs

---

**End of Specification**

*Next Steps: See `architecture.md` for technical implementation details and `roadmap.md` for development timeline.*
