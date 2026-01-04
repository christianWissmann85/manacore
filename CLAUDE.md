# ManaCore - Project Guide

## Project Overview

ManaCore is a high-fidelity implementation of Magic: The Gathering rules, built specifically for AI research. The project prioritizes:

## Architecture

### Design Principles

1. **Pure Functions**: The game engine uses pure, immutable state transformations
2. **Zero UI Dependencies**: Engine package has zero dependencies on UI libraries
3. **Type Safety**: Comprehensive TypeScript types throughout
4. **Testability**: Every feature backed by automated tests
5. **Simulation-First**: Optimized for running thousands of games for AI training

### Core Concepts

```
Action → Validator → Reducer → New State
```

- **GameState**: Immutable snapshot of the entire game (cloned via `structuredClone`)
- **Actions**: Typed commands representing player choices (PLAY_LAND, CAST_SPELL, etc.)
- **Validators**: Pure functions that check if actions are legal
- **Reducers**: Pure functions that apply actions to produce new state
- **State-Based Actions**: Automatic game rules checked after every action

### Package Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Clients                              │
│  ┌────────────────┐  ┌────────────────┐  ┌──────────────┐  │
│  │  CLI Client    │  │  Web Client    │  │ Data Scraper │  │
│  │   (readline)   │  │    (React)     │  │  (Scryfall)  │  │
│  └────────┬───────┘  └────────┬───────┘  └──────┬───────┘  │
└───────────┼──────────────────┼──────────────────┼──────────┘
            │                  │                  │
┌───────────┼──────────────────┼──────────────────┘
│           ▼                  ▼
│  ┌─────────────────────────────────────┐
│  │          AI Package                 │
│  │  ┌──────────┐  ┌──────────────┐   │
│  │  │ Bot      │  │  Advanced    │   │
│  │  │ Interface│  │  AI Agents   │   │
│  │  └──────────┘  └──────────────┘   │
│  └────────────────┬────────────────────┘
│                   │
│                   ▼
│  ┌─────────────────────────────────────────────────┐
│  │            Engine Package                       │
│  │  ┌────────────┐  ┌────────────┐  ┌──────────┐ │
│  │  │   State    │  │  Actions   │  │  Rules   │ │
│  │  │ Management │  │ & Reducers │  │  Engine  │ │
│  │  └────────────┘  └────────────┘  └──────────┘ │
│  │  ┌────────────┐  ┌────────────┐               │
│  │  │   Cards    │  │   Utils    │               │
│  │  │   Loader   │  │            │               │
│  │  └────────────┘  └────────────┘               │
│  └─────────────────────────────────────────────────┘
│
│  ┌─────────────────────────────────────┐
│  │         Data Layer                  │
│  │   packages/engine/data/cards/       │
│  │   - 6ed.json (6th Edition cards)    │
│  └─────────────────────────────────────┘
└──────────────────────────────────────────
```

---

## Development Philosophy

### Incremental Implementation

ManaCore follows a **phased development approach**, implementing Magic rules incrementally to maintain correctness at each stage:

- **Phase 0**: Foundation (vanilla creatures, basic combat)
- **Phase 1**: Core systems (stack, priority, combat mechanics, abilities)
- **Phase 2**: Advanced rules (instant-speed interactions, complex triggers)
- **Phase 3**: Full card pool and interactions

### Quality Gates

Every feature must pass three gates before completion:

1. **Unit Tests**: Feature-specific tests in `tests/`
2. **Linting**: `bun run lint` passes with zero errors
3. **Simulation**: 100+ bot games run without errors

### Immutability Pattern

All state updates use `structuredClone` for deep immutability:

```typescript
export function applyAction(state: GameState, action: Action): GameState {
  // Validate first
  const errors = validateAction(state, action);
  if (errors.length > 0) {
    throw new Error(`Invalid action: ${errors.join(', ')}`);
  }

  // Clone entire state (immutable update)
  const newState = structuredClone(state);

  // Apply mutations to the clone
  switch (action.type) {
    case 'PLAY_LAND':
      applyPlayLand(newState, action);
      break;
    // ...
  }

  // Check state-based actions
  while (checkStateBasedActions(newState)) {
    resolveTriggers(newState);
  }

  return newState;
}
```

---

## Monorepo Structure

```
manacore/
├── packages/
│   ├── engine/              # Pure game logic (ZERO dependencies)
│   │   ├── src/
│   │   │   ├── state/       # GameState, PlayerState, CardInstance
│   │   │   ├── actions/     # Action types, validators, reducers
│   │   │   ├── rules/       # Game rules (stack, combat, SBAs, triggers)
│   │   │   │   ├── abilities/  # Activated ability registry (O(1) lookup)
│   │   │   │   ├── effects.ts  # Reusable effect helpers
│   │   │   │   └── tokens.ts   # Token creation helpers
│   │   │   ├── spells/      # Spell registry (O(1) lookup, 70 spells)
│   │   │   │   └── categories/ # damage, destruction, counters, etc.
│   │   │   ├── cards/       # CardLoader, card templates
│   │   │   └── utils/       # Game initialization, deck building
│   │   ├── data/
│   │   │   └── cards/       # Scryfall card data (JSON)
│   │   └── tests/           # Engine tests
│   │
│   ├── ai/                  # Bot implementations
│   │   ├── src/
│   │   │   ├── bots/        # RandomBot, etc.
│   │   │   └── index.ts     # Bot interface
│   │   └── tests/
│   │
│   ├── cli-client/          # Command-line interface
│   │   ├── src/
│   │   │   ├── commands/    # play, simulate
│   │   │   ├── display/     # ASCII rendering
│   │   │   └── index.ts     # CLI entry point
│   │
│   ├── web-client/          # React web interface (future)
│   │
│   └── data-scraper/        # Scryfall data fetcher
│       └── src/
│           ├── fetchCards.ts
│           └── validateCards.ts
│
├── CLAUDE.md                # This file
├── eslint.config.js         # Linting configuration
└── package.json             # Workspace configuration
```

---

## Development Phases

### ✅ Phase 0: Foundation COMPLETE

### ✅ Phase 1: Core MTG Rules COMPLETE

### 🔄 Phase 1.5: Complete Card Library - NEXT

**Goal**: "Every Card Works"

- Week 1.5.1: **Infrastructure** ✅
- Week 1.5.2: **Instants & Sorceries** ✅
- Week 1.5.3: **Creatures Part 1** ✅
- Week 1.5.4: **Creatures Part 2** ✅
- Week 1.5.5: **Auras & Enchantments** (22 auras + 34 enchantments)
- Week 1.5.6: **Artifacts** (41 artifacts)
- Week 1.5.7: **Integration Testing** (1000-game simulation, documentation)

**Deliverable**: 302+ cards (90% of 6th Edition) fully playable

> **Tracking:** See [CARD_STATUS.md](./CARD_STATUS.md) for detailed implementation status. Always update the Tracker after Implementing a Task.

### 🔜 Phase 1.6: Complex Card Mechanics 

**Goal**: "The Last 10%"

- Control-changing effects (Abduction, Juxtapose)
- Replacement effects (Forbidden Crypt, Teferi's Puzzle Box)
- Type/color changing (Celestial Dawn, Living Lands)
- Complex interactions (Doomsday, Polymorph)

**Deliverable**: 100% of 6th Edition (335 cards) complete

### 🔜 Phase 2: Hidden Information & Smart AI 

**Goal**: "The AI Gets Dangerous"

- Week 21-22: **MCTS Core** (Monte Carlo Tree Search with hidden information handling)
- Week 23: **Evaluation Function** (heuristic board evaluation, weight tuning)
- Week 24-25: **Card Advantage & Disruption** (draw spells, removal, enchantments)
- Week 26: **Replay System & Stats** (game replay, statistics dashboard, match history)

**Key Deliverables**:

- MCTS bot that beats RandomBot 90%+ of games
- Evaluation function tuned through self-play
- Game replay system for debugging AI decisions

### 🔜 Phase 3: Interactive Visualization 

**Goal**: "Advanced Research Dashboard" 🔬

- Week 27: **Basic Web Dashboard** (Vite + PixiJS, state visualization, debug controls)
- Week 28-29: **Visualization Polish** (action history, decision tree rendering)
- Week 30-31: **Deck Lab** (browse cards, build test decks, mana curve analytics)
- Week 32: **Final Polish** (Agent config, interactive tutorial, documentation)

**Deliverable**: 🔬 **RESEARCH PLATFORM v1.0**

### 🔜 Phase 4: AI Research Tools 

**Goal**: "The AI Research Laboratory"

- Week 33-34: **Tournament Simulator** (Swiss/Single-Elimination, large-scale simulations)
- Week 35-36: **Deck Analytics** (deck scoring, card statistics, meta-game reports)
- Week 37: **MCTS Visualization** (decision tree visualizer, win rate estimates)
- Week 38: **A/B Testing Framework** (compare MCTS configs, evaluation functions)

**Deliverable**: Research platform for AI experimentation

### 🔜 Phase 5: Machine Learning

**Goal**: "Skynet Learns Magic"

- Week 39-42: **Neural Network Evaluation** (100k+ game dataset, NN-based evaluation)
- Week 43-46: **Genetic Algorithm Deck Builder** (evolve decks through generations)
- Week 47+: **Self-Play & AlphaZero** (self-play loop, discover optimal strategies)

**Long-term Goal**: AI discovers optimal play and designs tournament-winning decks

---

## Technical Stack

### Runtime: Bun

**Always use Bun instead of Node.js**:

```bash
# Running files
bun <file>                    # NOT: node, ts-node

# Testing
bun test                      # NOT: jest, vitest

# Full TypeScript compilation check (catches import/export issues, type errors)
# and
# ESLint with type-aware rules (catches code style, patterns, unsafe any usage)
bun run check

# Formatting
bun run format:check
bun run format

# Package management
bun install                   # NOT: npm install, yarn
bun add <package>
bun run <script>

# Building
bun build <file>              # NOT: webpack, esbuild
```

### Bun Built-in APIs

Prefer Bun's built-in APIs over npm packages:

```typescript
// SQLite - Use bun:sqlite
import { Database } from 'bun:sqlite';
// NOT: better-sqlite3

// File I/O - Use Bun.file
const file = Bun.file('data.json');
const text = await file.text();
// NOT: node:fs readFile/writeFile

// Shell commands - Use Bun.$
await Bun.$`ls -la`;
// NOT: execa, child_process

// WebSocket - Built-in
// NOT: ws package

// Env variables - Auto-loaded from .env
process.env.API_KEY;
// NOT: dotenv
```

### Testing

```typescript
import { test, expect } from 'bun:test';

test('creature takes damage', () => {
  const state = createTestGameState();
  const creature = state.players.player.battlefield[0]!;

  creature.damage = 2;
  const template = CardLoader.getById(creature.scryfallId);
  const toughness = parseInt(template.toughness, 10);

  expect(creature.damage < toughness).toBe(true);
});
```

Run tests:

```bash
cd packages/engine
bun test
```

### Frontend (Visualization)

We use a standard React stack for the research dashboard:

```typescript
// App.tsx
import { Card } from './components/Card';

export function Battlefield({ cards }) {
  return (
    <div className="grid grid-cols-6 gap-2">
      {cards.map(card => <Card key={card.id} data={card} />)}
    </div>
  );
}
```

No complex game loop - just reactive UI updates.

---

## Code Conventions

### TypeScript Style

1. **Explicit Types**: Always type function parameters and return values
2. **Const Assertions**: Use `as const` for literal arrays
3. **Type Guards**: Create type guards for discriminated unions
4. **No Any**: Avoid `any` - use `unknown` or proper types

```typescript
// Good
export function validateAction(state: GameState, action: Action): string[] {
  const errors: string[] = [];
  // ...
  return errors;
}

// Bad - missing return type
export function validateAction(state: GameState, action: Action) {
  // ...
}
```

### Naming Conventions

- **Files**: camelCase for files, PascalCase for types
  - `gameState.ts` (contains `GameState` type)
  - `cardLoader.ts` (contains `CardLoader` class)

- **Functions**: Descriptive action verbs
  - `createGameState()`, `applyAction()`, `validatePlayLand()`

- **Types**: PascalCase with descriptive names
  - `GameState`, `CardInstance`, `PlayLandAction`

- **Constants**: UPPER_SNAKE_CASE
  - `MAX_HAND_SIZE`, `DEFAULT_LIFE_TOTAL`

### Action Types

All actions follow this pattern:

```typescript
export interface SomeAction extends GameAction {
  type: 'SOME_ACTION'; // UPPER_SNAKE_CASE
  payload: {
    // Action-specific data
    fieldName: string;
  };
}
```

### State Updates

**CRITICAL**: Never mutate the original state

```typescript
// ❌ BAD - mutates original state
export function applyAction(state: GameState, action: Action): GameState {
  state.turnCount++; // WRONG!
  return state;
}

// ✅ GOOD - clones first
export function applyAction(state: GameState, action: Action): GameState {
  const newState = structuredClone(state);
  newState.turnCount++;
  return newState;
}
```

### Helper Functions

Apply functions modify state in-place (on the cloned state):

```typescript
// These modify the state parameter (void return)
function applyPlayLand(state: GameState, action: PlayLandAction): void {
  const player = getPlayer(state, action.playerId);
  // ... mutations here
}

// These return new values (pure)
function getPlayer(state: GameState, playerId: PlayerId): PlayerState {
  return state.players[playerId];
}
```

### File Organization

Each module should have a clear, single responsibility:

```
actions/
├── Action.ts           # Type definitions only
├── validators.ts       # Validation logic
├── reducer.ts          # State update logic
└── getLegalActions.ts  # Action generation
```

---

## Testing Strategy

### Test Organization

```
packages/engine/tests/
├── engine.test.ts      # Core game mechanics
├── combat.test.ts      # Combat-specific tests
└── cards.test.ts       # Card-specific behavior
```

### Test Categories

1. **Unit Tests**: Test individual functions
2. **Integration Tests**: Test full action→reducer→state flow
3. **Simulation Tests**: Run full games to ensure stability

### Writing Tests

```typescript
import { test, expect } from 'bun:test';
import { createGameState, applyAction } from '@manacore/engine';

test('playing a land adds it to battlefield', () => {
  // Setup
  const state = createTestGameState();
  const player = state.players.player;
  const land = player.hand[0]!;

  // Execute
  const action: PlayLandAction = {
    type: 'PLAY_LAND',
    playerId: 'player',
    payload: { cardInstanceId: land.instanceId },
  };
  const newState = applyAction(state, action);

  // Verify
  expect(newState.players.player.battlefield.length).toBe(1);
  expect(newState.players.player.hand.length).toBe(0);
  expect(newState.players.player.landsPlayedThisTurn).toBe(1);
});
```

### Running Tests

```bash
# Run all tests
cd packages/engine
bun test

# Run with watch mode
bun test --watch

# Run specific test file
bun test combat.test.ts
```

---

## Common Tasks

### Adding a New Action Type

1. **Define the action interface** in `packages/engine/src/actions/Action.ts`:

   ```typescript
   export interface NewAction extends GameAction {
     type: 'NEW_ACTION';
     payload: {
       someField: string;
     };
   }
   ```

2. **Add to Action union**:

   ```typescript
   export type Action =
     | PlayLandAction
     | NewAction  // Add here
     | ...;
   ```

3. **Create validator** in `packages/engine/src/actions/validators.ts`:

   ```typescript
   function validateNewAction(state: GameState, action: NewAction): string[] {
     const errors: string[] = [];
     // Validation logic
     return errors;
   }
   ```

4. **Add to validateAction switch**:

   ```typescript
   case 'NEW_ACTION':
     return validateNewAction(state, action);
   ```

5. **Create reducer** in `packages/engine/src/actions/reducer.ts`:

   ```typescript
   function applyNewAction(state: GameState, action: NewAction): void {
     // Apply state changes
   }
   ```

6. **Add to applyAction switch**:

   ```typescript
   case 'NEW_ACTION':
     applyNewAction(newState, action);
     break;
   ```

7. **Add to legal actions** in `packages/engine/src/actions/getLegalActions.ts`

8. **Write tests** in `packages/engine/tests/`

### Adding a New Card

1. **Ensure card data exists** in `packages/engine/data/cards/6ed.json`

2. **For keyword abilities**, check if helper exists in `packages/engine/src/cards/CardTemplate.ts`:

   ```typescript
   export function hasFlying(card: CardTemplate): boolean {
     return card.keywords?.includes('Flying') || false;
   }
   ```

3. **For instant/sorcery spells**, add to the spell registry in `packages/engine/src/spells/categories/`:

   Choose the appropriate category file:
   - `damage.ts` - Damage spells (Tremor, Inferno)
   - `destruction.ts` - Destroy effects (Wrath of God, Armageddon)
   - `counters.ts` - Counterspells (Memory Lapse, Remove Soul)
   - `xcost.ts` - X-cost spells (Earthquake, Hurricane)
   - `tutors.ts` - Library search (Enlightened Tutor)
   - `card-draw.ts` - Draw/discard (Inspiration)
   - `graveyard.ts` - Graveyard recursion (Raise Dead)
   - `untap.ts` - Tap/untap effects (Vitalize)
   - `prevention.ts` - Prevention/lifegain (Fog)
   - `misc.ts` - Other effects (Boomerang, tokens)

   ```typescript
   // In spells/categories/damage.ts
   {
     cardName: 'Lightning Bolt',
     resolve: (state, stackObj) => {
       const target = stackObj.targets[0];
       if (target) applyDamage(state, target, 3);
     },
   },
   ```

   Use helpers from `rules/effects.ts` (applyDamage, destroyPermanent, drawCards, etc.)
   For tokens, use `createTokens()` from `rules/tokens.ts`

4. **For activated abilities**, add to `packages/engine/src/rules/abilities/sets/6ed/*.ts`:

   Use templates from `abilities/templates/` when possible:

   ```typescript
   // In abilities/sets/6ed/mana-creatures.ts
   registerAbilities('Llanowar Elves', (card) => [createTapForMana(card, ['G'])]);
   ```

5. **For triggered abilities**, add to `packages/engine/src/rules/triggers.ts`

6. **For new targeting patterns**, add to `packages/engine/src/rules/targeting/parser/patterns.ts`:

   ```typescript
   // Add to TARGET_PATTERNS array (priority determines specificity)
   {
     regex: /target tapped creature/i,
     priority: 81,  // Higher = more specific, checked first
     handler: (match, idx) =>
       createRequirement(idx, 'creature', 'target tapped creature', {
         restrictions: [{ type: 'tapped' }],
       }),
   },
   ```

7. **For new target restrictions**, add validator to `packages/engine/src/rules/targeting/validation/validators.ts`:

   ```typescript
   export function validateNewRestriction(...): string | null {
     if (restriction.type !== 'newtype') return null;
     // validation logic
     return null; // or error string
   }

   // Register in RESTRICTION_VALIDATORS
   export const RESTRICTION_VALIDATORS = {
     // ...existing validators
     newtype: validateNewRestriction,
   };
   ```

8. **Write card-specific tests**

### Running a Simulation

```bash
cd packages/cli-client
bun src/index.ts simulate 100  # Run 100 bot games
```

### Playing Interactively

```bash
cd packages/cli-client
bun src/index.ts play
```

### Linting

```bash
# From project root
bun run lint

# Auto-fix issues
bun run lint:fix
```

### Fetching Card Data

```bash
cd packages/data-scraper
bun src/fetchCards.ts 6ed  # Fetch 6th Edition
```

---

## Best Practices

### 1. Read Before Writing

**ALWAYS** read existing code before making changes:

```typescript
// Before adding a function, check if it exists
// Before modifying a file, read it completely
```

### 2. Validate Early

Validation happens BEFORE state changes:

```typescript
export function applyAction(state: GameState, action: Action): GameState {
  // ✅ Validate first
  const errors = validateAction(state, action);
  if (errors.length > 0) {
    throw new Error(`Invalid action: ${errors.join(', ')}`);
  }

  // Then clone and modify
  const newState = structuredClone(state);
  // ...
}
```

### 3. Keep Engine Pure

The `engine` package must have **ZERO** dependencies on UI:

- No console.log in production code
- No React, readline, or other UI libraries
- Engine functions should be 100% testable headlessly

### 4. Export Properly

Update `packages/engine/src/index.ts` when adding new public APIs:

```typescript
// Export types
export type { NewType } from './path/to/module';

// Export functions
export { newFunction } from './path/to/module';
```

### 5. Document Complex Logic

Add comments for Magic-specific rules:

```typescript
// SBA: Creature dies if damage >= toughness (CR 704.5g)
if (creature.damage >= toughness) {
  // Move to graveyard
}
```

### 6. Use Type Guards

For discriminated unions:

```typescript
export function isPlayLandAction(action: Action): action is PlayLandAction {
  return action.type === 'PLAY_LAND';
}
```

---

## Performance Considerations

### Why Speed Matters

ManaCore is designed for **AI training**, which requires:

- Running 10,000+ games for evaluation
- Simulating thousands of possible futures (MCTS)
- Training neural networks with millions of game states

### Optimization Guidelines

1. **Avoid Unnecessary Cloning**: Only clone at action boundaries
2. **Batch Operations**: Process multiple state checks in one pass
3. **Cache Card Data**: CardLoader caches templates in memory
4. **Minimize Allocations**: Reuse arrays/objects when safe
5. **Profile Before Optimizing**: Use `console.time()` for bottlenecks

Current Performance:

- **1000+ games/second** in simulation mode
- **<1ms per action** for typical moves
- **<30ms for full game** (50 turns, 100 actions)

---

## Debugging Tips

### Common Issues

**1. "Card not found" errors**

```typescript
// Check if card data is loaded
console.log(CardLoader.getByName('Mountain')); // Should return template
```

**2. State mutation bugs**

```typescript
// Verify you're cloning:
const newState = structuredClone(state); // Must be first line
```

**3. Validation errors**

```typescript
// Check validation messages:
const errors = validateAction(state, action);
console.log(errors); // Shows why action is invalid
```

### Useful Debug Commands

```bash
# Check what cards are loaded
bun -e "import {CardLoader} from '@manacore/engine'; console.log(CardLoader.getAllCards().length);"

# Run single test
bun test -t "creature takes damage"

# Check types
bun tsc --noEmit
```

---

## Contributing Guidelines

### Before Starting Work

1. **Read** relevant existing code
2. **Check** if feature already exists
3. **Plan** the implementation approach
4. **Test** existing functionality

### During Development

1. **Write tests first** (TDD when possible)
2. **Lint frequently**: `bun run lint`
3. **Run tests**: `bun test`
4. **Simulate**: Run 100+ bot games to verify stability

### Before Committing

1. ✅ All tests pass (`bun test`)
2. ✅ Linter clean (`bun run lint`)
3. ✅ Simulations run without errors
4. ✅ Documentation updated if needed

---

## Quick Reference

### Commands Cheat Sheet

```bash
# Development
bun install                              # Install dependencies
bun run lint                            # Run linter
bun run lint:fix                        # Fix lint issues
cd packages/engine && bun test          # Run tests

# Playing
cd packages/cli-client
bun src/index.ts play                   # Play vs bot
bun src/index.ts simulate 100           # Run 100 games

# Data
cd packages/data-scraper
bun src/fetchCards.ts 6ed               # Fetch card data
bun src/validateCards.ts                # Validate card data

# Building
bun build src/index.ts                  # Build a file
```

### File Location Quick Reference

| What                | Where                                                        |
| ------------------- | ------------------------------------------------------------ |
| Game state types    | `packages/engine/src/state/`                                 |
| Action definitions  | `packages/engine/src/actions/Action.ts`                      |
| Validators          | `packages/engine/src/actions/validators.ts`                  |
| Reducers            | `packages/engine/src/actions/reducer.ts`                     |
| Combat rules        | `packages/engine/src/rules/combat.ts`                        |
| Stack system        | `packages/engine/src/rules/stack.ts`                         |
| Targeting system    | `packages/engine/src/rules/targeting/` (modular)             |
| Target patterns     | `packages/engine/src/rules/targeting/parser/patterns.ts`     |
| Target validators   | `packages/engine/src/rules/targeting/validation/validators.ts` |
| Spell registry      | `packages/engine/src/spells/` (O(1) lookup for 70 spells)    |
| Spell categories    | `packages/engine/src/spells/categories/*.ts`                 |
| Ability registry    | `packages/engine/src/rules/abilities/` (O(1) lookup)         |
| Ability templates   | `packages/engine/src/rules/abilities/templates/*.ts`         |
| Effect helpers      | `packages/engine/src/rules/effects.ts`                       |
| Token helpers       | `packages/engine/src/rules/tokens.ts`                        |
| Triggers            | `packages/engine/src/rules/triggers.ts`                      |
| State-based actions | `packages/engine/src/rules/stateBasedActions.ts`             |
| Legacy abilities    | `packages/engine/src/rules/activatedAbilities.ts` (fallback) |
| Card data           | `packages/engine/data/cards/6ed.json`                        |
| Tests               | `packages/engine/tests/*.test.ts`                            |
| CLI display         | `packages/cli-client/src/display/board.ts`                   |

**Happy coding! 🎴✨**
