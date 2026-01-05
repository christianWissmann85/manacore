# @manacore/engine

**Pure headless Magic: The Gathering rules engine**

> A deterministic, high-performance game logic layer with zero UI dependencies. Designed to run 1000+ games per second for AI training and Monte Carlo simulations.

---

## 📦 Overview

The `@manacore/engine` package is the **core rule implementation** of the ManaCore platform. It handles all game logic, state management, and card interactions in a pure, headless environment.

**Key Features:**
- 🎯 **Pure Logic:** Zero dependencies on UI libraries (React, DOM, etc.)
- ⚡ **High Performance:** Optimized for batch simulations (1000+ games/sec)
- 🔄 **Deterministic:** Seed-based RNG ensures 100% reproducible games
- 🧪 **Immutable State:** All state transitions are pure functions
- 📊 **335+ Cards:** Full 6th Edition card pool with ongoing implementation

---

## 🏗️ Architecture

### The Game Loop

```typescript
// 1. Initialize game state
const state = initializeGame(playerDeck, opponentDeck, seed);

// 2. Get legal actions for current player
const actions = getLegalActions(state);

// 3. Player/AI selects an action
const action = selectAction(actions);

// 4. Apply action → new state
const newState = applyAction(state, action);

// 5. Repeat until game ends
if (newState.gameOver) {
  console.log(`Winner: ${newState.winner}`);
}
```

### Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│  LAYER 1: Card Data (data/cards/6ed.json)                   │
│  - 335 cards from Scryfall API                              │
│  - Static data: name, cost, oracle_text, keywords           │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  LAYER 2: CardLoader (cards/CardLoader.ts)                  │
│  - CardLoader.getByName("Shock") → CardTemplate             │
│  - In-memory index for fast lookups                         │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  LAYER 3: GameState (state/GameState.ts)                    │
│  - Single source of truth for the entire game               │
│  - CardInstances (runtime state: tapped, damage, etc.)      │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  LAYER 4: Actions & Rules (actions/ + rules/)               │
│  - Pure functions: (state, action) → newState               │
│  - Combat resolution, stack, state-based actions            │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start

### Installation

```bash
# From monorepo root
bun install

# Or directly in engine package
cd packages/engine
bun install
```

### Basic Usage

```typescript
import {
  initializeGame,
  createWhiteDeck,
  createBlueDeck,
  getLegalActions,
  applyAction,
  type GameState,
} from '@manacore/engine';

// 1. Create decks
const playerDeck = createWhiteDeck();
const opponentDeck = createBlueDeck();

// 2. Initialize game with seed (for determinism)
let state: GameState = initializeGame(playerDeck, opponentDeck, 12345);

// 3. Game loop
while (!state.gameOver) {
  const actions = getLegalActions(state);
  
  // AI or player selects action
  const action = selectAction(actions);
  
  // Apply action
  state = applyAction(state, action);
}

console.log(`Winner: ${state.winner}`);
```

### Running Tests

```bash
bun test
```

---

## 📚 Core API

### State Management

#### `GameState`

The complete game state containing all information:

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
  
  // Game flow
  activePlayer: PlayerId;      // Whose turn it is
  priorityPlayer: PlayerId;    // Who has priority
  turnCount: number;
  phase: GamePhase;            // 'beginning' | 'main1' | 'combat' | 'main2' | 'end'
  step: GameStep;
  
  // Game status
  gameOver: boolean;
  winner: PlayerId | null;
  
  // Determinism
  rngSeed: number;
  actionHistory: string[];     // JSON of all actions
}
```

#### `PlayerState`

Per-player state:

```typescript
interface PlayerState {
  id: PlayerId;
  life: number;
  
  // Zones
  library: CardInstance[];
  hand: CardInstance[];
  battlefield: CardInstance[];
  graveyard: CardInstance[];
  
  // Resources
  manaPool: ManaPool;          // Available mana
  landsPlayedThisTurn: number;
  
  // Combat
  attackers: CardInstance[];
}
```

#### `CardInstance`

Runtime instance of a card in the game:

```typescript
interface CardInstance {
  instanceId: string;          // Unique ID for this copy
  scryfallId: string;          // Reference to CardTemplate
  
  controller: PlayerId;
  owner: PlayerId;
  zone: Zone;                  // 'library' | 'hand' | 'battlefield' | 'graveyard' | 'exile'
  
  // State
  tapped: boolean;
  summoningSick: boolean;
  damage: number;
  
  // Modifications
  counters: Partial<Record<CounterType, number>>;
  temporaryModifications: TemporaryModification[];
  temporaryKeywords?: Array<{ keyword: string; until: string }>;
  
  // Attachments
  attachments: string[];       // Auras/Equipment on this
  attachedTo?: string;         // What this Aura is attached to
  
  // Combat
  attacking?: boolean;
  blocking?: string;
  blockedBy?: string[];
  
  // Tokens
  isToken?: boolean;
  tokenType?: string;
  createdBy?: string;
}
```

### Actions

All game progression happens through actions:

#### Core Actions

```typescript
// Play a land from hand
interface PlayLandAction {
  type: 'PLAY_LAND';
  playerId: PlayerId;
  payload: {
    cardInstanceId: string;
  };
}

// Cast a spell
interface CastSpellAction {
  type: 'CAST_SPELL';
  playerId: PlayerId;
  payload: {
    cardInstanceId: string;
    targets?: string[];        // Target instance IDs
    xValue?: number;           // For X-cost spells
  };
}

// Declare attackers
interface DeclareAttackersAction {
  type: 'DECLARE_ATTACKERS';
  playerId: PlayerId;
  payload: {
    attackers: string[];       // Attacking creature IDs
  };
}

// Declare blockers
interface DeclareBlockersAction {
  type: 'DECLARE_BLOCKERS';
  playerId: PlayerId;
  payload: {
    blocks: Array<{
      blockerId: string;
      attackerId: string;
    }>;
  };
}

// Activate ability
interface ActivateAbilityAction {
  type: 'ACTIVATE_ABILITY';
  playerId: PlayerId;
  payload: {
    cardInstanceId: string;
    abilityId: string;
    targets?: string[];
  };
}

// Pass priority
interface PassPriorityAction {
  type: 'PASS_PRIORITY';
  playerId: PlayerId;
  payload: {};
}

// End turn
interface EndTurnAction {
  type: 'END_TURN';
  playerId: PlayerId;
  payload: {};
}
```

#### Action Functions

```typescript
// Get all legal actions for current player
function getLegalActions(state: GameState): Action[]

// Validate an action
function validateAction(state: GameState, action: Action): string[]

// Apply action to state (returns new state)
function applyAction(state: GameState, action: Action): GameState
```

### Card System

#### CardLoader

Access the card database:

```typescript
import { CardLoader } from '@manacore/engine';

// Initialize (loads 335 cards into memory)
CardLoader.initialize();

// Lookup by name
const shock = CardLoader.getByName('Shock');
// Returns: CardTemplate

// Lookup by Scryfall ID
const card = CardLoader.getById('abc123...');

// Get all cards of a type
const creatures = CardLoader.getCardsByType('Creature');
const lands = CardLoader.getCardsByType('Land');

// Get all cards
const allCards = CardLoader.getAllCards();
```

#### CardTemplate

Static card data from Scryfall:

```typescript
interface CardTemplate {
  id: string;                  // Scryfall UUID
  name: string;
  mana_cost?: string;          // "{2}{R}{R}"
  cmc: number;                 // Converted mana cost
  type_line: string;           // "Creature — Dragon"
  oracle_text?: string;
  power?: string;
  toughness?: string;
  colors: string[];            // ["R"]
  keywords: string[];          // ["Flying", "Haste"]
  rarity: string;
  set: string;
}
```

#### Card Type Checkers

```typescript
import {
  isCreature,
  isLand,
  isInstant,
  isSorcery,
  isEnchantment,
  isAura,
  isArtifact,
} from '@manacore/engine';

const template = CardLoader.getByName('Shock');
if (isInstant(template)) {
  // Can be cast at instant speed
}
```

#### Keyword Checkers

```typescript
import {
  hasFlying,
  hasFirstStrike,
  hasDoubleStrike,
  hasTrample,
  hasVigilance,
  hasHaste,
  hasReach,
  hasDefender,
  hasFear,
  hasIntimidate,
  hasMenace,
  // ... and more
} from '@manacore/engine';

const dragon = CardLoader.getByName('Shivan Dragon');
if (hasFlying(dragon)) {
  console.log('This creature can fly!');
}
```

### Game Initialization

#### Pre-built Test Decks

```typescript
import {
  createWhiteDeck,
  createBlueDeck,
  createBlackDeck,
  createRedDeck,
  createGreenDeck,
  createAzoriusDeck,
  createBorosDeck,
  // ... 15+ prebuilt decks
  getRandomTestDeck,
  TEST_DECKS,
} from '@manacore/engine';

// Get a mono-colored deck
const whiteDeck = createWhiteDeck();
// Returns: CardTemplate[] (60 cards)

// Get a random deck
const randomDeck = getRandomTestDeck();

// Access deck registry
console.log(TEST_DECKS);
// ['white', 'blue', 'black', 'red', 'green', 'azorius', ...]
```

#### Custom Deck Creation

```typescript
import { createSimpleDeck, CardLoader } from '@manacore/engine';

const myDeck = createSimpleDeck([
  { name: 'Forest', count: 24 },
  { name: 'Grizzly Bears', count: 20 },
  { name: 'Giant Growth', count: 16 },
]);

// Or build manually
const customDeck: CardTemplate[] = [];
for (let i = 0; i < 24; i++) {
  customDeck.push(CardLoader.getByName('Mountain')!);
}
for (let i = 0; i < 36; i++) {
  customDeck.push(CardLoader.getByName('Lightning Bolt')!);
}
```

#### Initialize Game

```typescript
import { initializeGame } from '@manacore/engine';

// With random seed
const state = initializeGame(playerDeck, opponentDeck);

// With specific seed (for determinism)
const replayableState = initializeGame(
  playerDeck,
  opponentDeck,
  12345 // Same seed = same game
);

// Game starts at main1 phase with 7-card hands drawn
```

---

## 🎮 Building a Bot

### Basic Bot Structure

```typescript
import type { GameState, Action } from '@manacore/engine';
import { getLegalActions } from '@manacore/engine';

class MyBot {
  selectAction(state: GameState): Action {
    const legalActions = getLegalActions(state);
    
    if (legalActions.length === 0) {
      throw new Error('No legal actions available');
    }
    
    // Your decision logic here
    return legalActions[0];
  }
}
```

### Random Bot

```typescript
import { getLegalActions } from '@manacore/engine';

function selectRandomAction(state: GameState): Action {
  const actions = getLegalActions(state);
  return actions[Math.floor(Math.random() * actions.length)];
}
```

### Greedy Bot (Material Evaluation)

```typescript
import {
  getLegalActions,
  applyAction,
  getPlayer,
  getEffectivePowerWithLords,
  getEffectiveToughnessWithLords,
} from '@manacore/engine';

function evaluateState(state: GameState, playerId: PlayerId): number {
  const player = getPlayer(state, playerId);
  const opponent = getPlayer(state, playerId === 'player' ? 'opponent' : 'player');
  
  let score = 0;
  
  // Life total
  score += player.life * 2;
  score -= opponent.life * 2;
  
  // Creature count and power
  for (const creature of player.battlefield) {
    score += getEffectivePowerWithLords(state, creature, playerId);
    score += getEffectiveToughnessWithLords(state, creature, playerId);
  }
  
  // Card advantage
  score += player.hand.length * 3;
  score -= opponent.hand.length * 3;
  
  return score;
}

function selectGreedyAction(state: GameState): Action {
  const actions = getLegalActions(state);
  const playerId = state.priorityPlayer;
  
  let bestAction = actions[0];
  let bestScore = -Infinity;
  
  for (const action of actions) {
    const nextState = applyAction(state, action);
    const score = evaluateState(nextState, playerId);
    
    if (score > bestScore) {
      bestScore = score;
      bestAction = action;
    }
  }
  
  return bestAction!;
}
```

---

## 🔧 Adding New Cards

The engine already has **335 6th Edition cards** loaded. Most vanilla creatures and basic spells work automatically.

### Step 1: Check if Card Works

```typescript
import { CardLoader } from '@manacore/engine';

const card = CardLoader.getByName('Serra Angel');
console.log(card);
// If it exists and has keywords, it probably works!
```

### Step 2: Identify Implementation Type

| Card Type | Implementation |
|-----------|---------------|
| Vanilla creatures | Already works |
| Keyword creatures (Flying, Haste, etc.) | Already works |
| Basic lands | Already works |
| Simple burn/removal | Check `src/spells/registry.ts` |
| Activated abilities | Add to `src/rules/abilities/` |
| Triggered abilities | Add trigger in `src/rules/triggers.ts` |

### Step 3: Implement Complex Cards

See [docs/CARD_IMPLEMENTATION.md](docs/CARD_IMPLEMENTATION.md) for detailed guide.

**Example: Simple Burn Spell**

```typescript
// In src/spells/categories/damage.ts
case 'Shock': {
  const target = resolveTarget(state, payload.targets?.[0]);
  if (target.type === 'creature') {
    dealDamageToCreature(newState, target.card, 2);
  } else {
    dealDamageToPlayer(newState, target.playerId, 2);
  }
  break;
}
```

---

## 🧪 Testing

### Running Tests

```bash
# Run all tests
bun test

# Run specific test file
bun test tests/combat.test.ts

# Watch mode
bun test --watch
```

### Test Structure

```
tests/
  engine.test.ts           # Basic engine functionality
  combat.test.ts           # Combat mechanics
  decks.test.ts            # Deck validation
  full-game-flow.test.ts   # Complete game simulations
  mana.test.ts             # Mana system
  spells-week152.test.ts   # Spell implementations
  targeting.test.ts        # Targeting system
  cards/                   # Individual card tests
  expansions/              # Set-specific tests
```

### Writing Tests

```typescript
import { describe, test, expect } from 'bun:test';
import {
  createGameState,
  createCardInstance,
  applyAction,
  CardLoader,
} from '../src/index';

describe('My Feature', () => {
  test('should work correctly', () => {
    // Setup
    const forest = CardLoader.getByName('Forest')!;
    const library = [createCardInstance(forest.id, 'player', 'library')];
    const state = createGameState(library, library);
    
    // Execute
    const newState = applyAction(state, {
      type: 'PLAY_LAND',
      playerId: 'player',
      payload: { cardInstanceId: library[0].instanceId },
    });
    
    // Assert
    expect(newState.players.player.battlefield.length).toBe(1);
  });
});
```

---

## 📖 Key Systems

### Combat System

Combat is handled automatically through action sequence:

```typescript
// 1. Declare attackers
const attackAction: DeclareAttackersAction = {
  type: 'DECLARE_ATTACKERS',
  playerId: 'player',
  payload: {
    attackers: [creatureId1, creatureId2],
  },
};
state = applyAction(state, attackAction);

// 2. Declare blockers
const blockAction: DeclareBlockersAction = {
  type: 'DECLARE_BLOCKERS',
  playerId: 'opponent',
  payload: {
    blocks: [
      { blockerId: blockerId, attackerId: creatureId1 },
    ],
  },
};
state = applyAction(state, blockAction);

// 3. Combat damage is resolved automatically
// - First strike damage
// - Regular damage
// - Trample
// - Lifelink
// - State-based actions (creatures die)
```

### Stack System

```typescript
import { pushToStack, resolveTopOfStack } from '@manacore/engine';

// Spells go on stack automatically when cast
state = applyAction(state, castSpellAction);
// Stack now has spell

// Resolve when both players pass priority
state = applyAction(state, { type: 'PASS_PRIORITY', playerId: 'player' });
state = applyAction(state, { type: 'PASS_PRIORITY', playerId: 'opponent' });
// Stack resolves automatically
```

### Mana System

```typescript
import {
  parseManaCost,
  canPayManaCost,
  payManaCost,
  addManaToPool,
} from '@manacore/engine';

// Parse mana cost
const cost = parseManaCost('{2}{R}{R}');
// { generic: 2, red: 2, green: 0, ... }

// Check if player can pay
const canPay = canPayManaCost(state, 'player', cost);

// Pay mana (automatically taps lands)
const newState = payManaCost(state, 'player', cost);
```

### Targeting System

```typescript
import {
  requiresTargets,
  getLegalTargets,
  validateTargets,
} from '@manacore/engine';

const shock = CardLoader.getByName('Shock')!;

// Check if spell requires targets
if (requiresTargets(shock.oracle_text)) {
  // Get legal targets
  const targets = getLegalTargets(state, shock, 'player');
  
  // Validate selected targets
  const errors = validateTargets(state, shock, 'player', [targetId]);
}
```

---

## 🎯 Design Principles

### 1. Pure Functions

All state transitions are pure:

```typescript
// ✅ GOOD: Returns new state
function applyAction(state: GameState, action: Action): GameState {
  const newState = structuredClone(state);
  // ... modify newState
  return newState;
}

// ❌ BAD: Mutates state
function applyAction(state: GameState, action: Action): GameState {
  state.turnCount++; // MUTATION!
  return state;
}
```

### 2. Immutable State

State is never mutated, always cloned:

```typescript
const newState = structuredClone(state);
// Now safe to modify newState
```

### 3. Deterministic Simulation

Same seed = same game:

```typescript
const game1 = initializeGame(deck1, deck2, 12345);
const game2 = initializeGame(deck1, deck2, 12345);
// game1 and game2 will be identical
```

### 4. Zero Dependencies

The engine has ZERO runtime dependencies. Only dev dependencies:

```json
{
  "dependencies": {},
  "devDependencies": {
    "@types/bun": "latest"
  }
}
```

---

## 📊 Performance

The engine is optimized for batch simulations:

- **1000+ games/second** on typical hardware
- **Pure TypeScript** (no WASM, no native code)
- **Efficient cloning** using `structuredClone`
- **Indexed lookups** for cards and instances
- **Minimal allocations** in hot paths

### Benchmarking

```bash
cd packages/cli-client
bun src/index.ts benchmark 100
```

---

## 🤝 Contributing

See the main [CONTRIBUTING.md](../../CONTRIBUTING.md) for guidelines.

### Engine-Specific Guidelines

1. **All state transitions must be pure functions**
2. **Never mutate GameState or CardInstance**
3. **Add tests for new features**
4. **Document complex card interactions**
5. **Keep zero runtime dependencies**

---

## 📚 Further Reading

- [CARD_IMPLEMENTATION.md](docs/CARD_IMPLEMENTATION.md) - How to add new cards
- [CARD_STATUS.md](docs/CARD_STATUS.md) - Implementation status of all cards
- [ARCHITECTURE.md](../../ARCHITECTURE.md) - Overall system architecture
- [SPEC.md](../../SPEC.md) - Game rules specification

---

## 📝 License

MIT © 2026 ManaCore

**Disclaimer:** This is unofficial Fan Content permitted under the Fan Content Policy. Not approved/endorsed by Wizards. Portions of materials used are property of Wizards of the Coast. ©Wizards of the Coast LLC.
