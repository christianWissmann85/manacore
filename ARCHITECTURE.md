# MANACORE: Technical Architecture

**Version:** 1.0.0  
**Last Updated:** January 3, 2026

---

## 1. System Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                 VISUALIZATION DASHBOARD                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │    React     │  │   Zustand    │  │  Tailwind    │ │
│  │  Components  │  │    Store     │  │    CSS       │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘ │
│         │                 │                 │          │
│         └─────────────────┴─────────────────┘          │
│                           │                            │
└───────────────────────────┼────────────────────────────┘
                            │
                    ┌───────▼────────┐
                    │  ENGINE API    │
                    └───────┬────────┘
                            │
┌───────────────────────────┼────────────────────────────┐
│                     GAME ENGINE                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │   GameState  │  │   Actions    │  │    Rules     │ │
│  │   (Source of │  │   (Commands) │  │   (Logic)    │ │
│  │    Truth)    │  │              │  │              │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
│                                                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ Card Loader  │  │  Validators  │  │   Zones      │ │
│  │ (Scryfall)   │  │              │  │   Manager    │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────┼────────────────────────────┐
│                        AI LAYER                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │  MCTS Core   │  │  Evaluation  │  │  Simulation  │ │
│  │              │  │  Functions   │  │  Policy      │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
│                                                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ Random Bot   │  │  Greedy Bot  │  │   Opening    │ │
│  │              │  │              │  │     Book     │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
└────────────────────────────────────────────────────────┘
```

---

## 2. Monorepo Structure

```
mana-core/
├── package.json                    # Bun workspaces config
├── bun.lockb                       # Bun lock file
├── tsconfig.json                   # Root TypeScript config
├── .gitignore
├── README.md
│
├── packages/
│   │
│   ├── engine/                     # PURE GAME LOGIC (No UI deps)
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── index.ts           # Public API
│   │   │   ├── state/
│   │   │   │   ├── GameState.ts
│   │   │   │   ├── PlayerState.ts
│   │   │   │   ├── CardInstance.ts
│   │   │   │   └── Zone.ts
│   │   │   ├── actions/
│   │   │   │   ├── Action.ts      # Action types
│   │   │   │   ├── reducer.ts     # Main game reducer
│   │   │   │   └── validators.ts
│   │   │   ├── rules/
│   │   │   │   ├── combat.ts
│   │   │   │   ├── stack.ts
│   │   │   │   ├── state-based-actions.ts
│   │   │   │   └── mana.ts
│   │   │   ├── cards/
│   │   │   │   ├── CardLoader.ts
│   │   │   │   ├── CardTemplate.ts
│   │   │   │   └── keywords.ts
│   │   │   └── utils/
│   │   │       ├── random.ts      # Seedable RNG
│   │   │       └── clone.ts       # Fast state cloning
│   │   ├── data/
│   │   │   ├── cards/
│   │   │   │   └── 6ed.json      # Cached Scryfall data
│   │   │   └── decks/
│   │   │       ├── red-burn.json
│   │   │       └── blue-control.json
│   │   └── tests/
│   │       ├── combat.test.ts
│   │       └── stack.test.ts
│   │
│   ├── ai/                         # AI BOTS & SEARCH
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── bots/
│   │   │   │   ├── Bot.ts         # Interface
│   │   │   │   ├── RandomBot.ts
│   │   │   │   ├── GreedyBot.ts
│   │   │   │   └── MCTSBot.ts
│   │   │   ├── search/
│   │   │   │   ├── MCTS.ts        # Core algorithm
│   │   │   │   ├── Node.ts
│   │   │   │   ├── UCB1.ts        # Selection policy
│   │   │   │   └── determinization.ts
│   │   │   ├── evaluation/
│   │   │   │   ├── Evaluator.ts   # Interface
│   │   │   │   ├── heuristic.ts   # Hand-crafted
│   │   │   │   └── material.ts    # Simple board value
│   │   │   └── simulation/
│   │   │       └── rollout.ts     # Playout policy
│   │   └── tests/
│   │       └── mcts.test.ts
│   │
│   ├── cli-client/                 # CLI TOOL
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── index.ts           # Main entry
│   │   │   ├── commands/
│   │   │   │   ├── play.ts        # Interactive mode
│   │   │   │   └── sim.ts         # Run simulations
│   │   │   └── display/
│   │   │       ├── board.ts       # ASCII art renderer
│   │   │       └── log.ts         # Pretty printing
│   │   └── README.md
│   │
│   ├── web-client/                 # VISUALIZATION DASHBOARD
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vite.config.ts         # Vite bundler
│   │   ├── index.html
│   │   ├── postcss.config.js      # Tailwind config
│   │   ├── tailwind.config.js
│   │   ├── src/
│   │   │   ├── main.tsx           # Entry point
│   │   │   ├── App.tsx            # Main layout
│   │   │   ├── components/
│   │   │   │   ├── Card.tsx       # Card component
│   │   │   │   ├── Zone.tsx       # Battlefield/Hand zones
│   │   │   │   └── ManaPool.tsx
│   │   │   ├── hooks/
│   │   │   │   └── useGame.ts     # Game state hook
│   │   │   └── styles/
│   │   │       └── index.css      # Global styles
│   │   └── public/
│   │       └── assets/
│   │
│   ├── research/                   # AI RESEARCH TOOLS (Phase 4+)
│   │   ├── package.json
│   │   ├── src/
│   │   │   ├── tournament/
│   │   │   │   └── simulator.ts
│   │   │   ├── analytics/
│   │   │   │   ├── deck-stats.ts
│   │   │   │   └── card-stats.ts
│   │   │   └── genetic/
│   │   │       └── deck-evolution.ts
│   │   └── tests/
│   │
│   └── data-scraper/               # SCRYFALL API TOOL
│       ├── package.json
│       ├── src/
│       │   ├── index.ts
│       │   ├── scraper.ts
│       │   └── types.ts
│       └── README.md
│
├── scripts/
│   ├── fetch-cards.ts              # Run the scraper
│   └── validate-data.ts            # Check card data integrity
│
└── docs/
    ├── API.md                      # Engine API reference
    ├── RULES.md                    # Implemented MTG rules
    └── CONTRIBUTING.md
```

---

## 3. Data Layer: Scryfall Integration

### 3.1 Overview

We'll fetch all 6th Edition cards once, cache them locally, and version-control the JSON. This ensures:

- No runtime API calls (fast, offline-capable)
- Deterministic builds (data doesn't change under us)
- No rate limiting issues

### 3.2 Scryfall API Endpoints

**Bulk Data (Recommended)**

```
GET https://api.scryfall.com/bulk-data
```

Returns download links for complete card databases. We'll use the "Default Cards" file.

**Set-Specific Search**

```
GET https://api.scryfall.com/cards/search?q=set:6ed
```

Returns paginated results (175 cards per page).

### 3.3 Card Data Schema

```typescript
// packages/data-scraper/src/types.ts

export interface ScryfallCard {
  // Core Identity
  id: string; // UUID: "f5b6c9e4-..."
  oracle_id: string; // Shared across printings
  name: string; // "Lightning Bolt"
  lang: string; // "en"
  released_at: string; // "1999-04-21"

  // Set Information
  set: string; // "6ed"
  set_name: string; // "Classic Sixth Edition"
  set_type: string; // "core"
  collector_number: string; // "198"
  rarity: string; // "common" | "uncommon" | "rare" | "mythic"

  // Game Mechanics
  mana_cost: string; // "{R}"
  cmc: number; // 1
  type_line: string; // "Instant"
  oracle_text: string; // "Lightning Bolt deals 3 damage..."
  power?: string; // "2" (creatures only)
  toughness?: string; // "2" (creatures only)
  loyalty?: string; // For planeswalkers (not in 6ed)
  colors: string[]; // ["R"]
  color_identity: string[]; // ["R"]
  keywords: string[]; // ["Flying", "Haste"]

  // Legality (we don't need this, but it's there)
  legalities: Record<string, string>;

  // Visual Assets
  image_uris?: {
    small: string; // 146x204
    normal: string; // 488x680
    large: string; // 672x936
    png: string; // Full resolution
    art_crop: string; // Just the artwork
    border_crop: string; // Includes border
  };

  // Multi-faced cards have card_faces instead of image_uris
  card_faces?: Array<{
    name: string;
    mana_cost: string;
    type_line: string;
    oracle_text: string;
    image_uris: ScryfallCard['image_uris'];
  }>;

  // Flavor
  flavor_text?: string; // Italic text

  // Rulings
  rulings_uri: string; // Link to official rulings

  // Layout (for detecting special cards)
  layout: string; // "normal" | "split" | "flip" | etc.
}
```

### 3.4 Scraper Implementation

```typescript
// packages/data-scraper/src/scraper.ts

import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

interface ScryfallResponse {
  object: 'list';
  total_cards: number;
  has_more: boolean;
  next_page?: string;
  data: ScryfallCard[];
}

export class ScryfallScraper {
  private baseUrl = 'https://api.scryfall.com';
  private delayMs = 100; // Scryfall requests 100ms between requests

  async fetchSet(setCode: string): Promise<ScryfallCard[]> {
    const allCards: ScryfallCard[] = [];
    let url = `${this.baseUrl}/cards/search?q=set:${setCode}`;

    while (url) {
      console.log(`Fetching: ${url}`);

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Scryfall API error: ${response.statusText}`);
      }

      const data: ScryfallResponse = await response.json();
      allCards.push(...data.data);

      if (data.has_more && data.next_page) {
        url = data.next_page;
        await this.delay(this.delayMs);
      } else {
        url = '';
      }
    }

    console.log(`Fetched ${allCards.length} cards from ${setCode}`);
    return allCards;
  }

  async fetchRulings(card: ScryfallCard): Promise<Ruling[]> {
    const response = await fetch(card.rulings_uri);
    const data = await response.json();
    await this.delay(this.delayMs);
    return data.data;
  }

  async saveToFile(cards: ScryfallCard[], outputPath: string): Promise<void> {
    const dir = join(process.cwd(), 'packages/engine/data/cards');
    await mkdir(dir, { recursive: true });

    const filePath = join(dir, outputPath);
    await writeFile(filePath, JSON.stringify(cards, null, 2));

    console.log(`Saved ${cards.length} cards to ${filePath}`);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

interface Ruling {
  published_at: string;
  comment: string;
  source: string;
}
```

### 3.5 Main Scraper Script

```typescript
// scripts/fetch-cards.ts

import { ScryfallScraper } from '../packages/data-scraper/src/scraper';

async function main() {
  const scraper = new ScryfallScraper();

  console.log('Fetching 6th Edition cards...');
  const cards = await scraper.fetchSet('6ed');

  // Filter to English only
  const englishCards = cards.filter((card) => card.lang === 'en');

  // Save raw data
  await scraper.saveToFile(englishCards, '6ed.json');

  // Optionally fetch rulings for complex cards
  // const cardsWithRulings = await Promise.all(
  //   englishCards.slice(0, 10).map(async card => ({
  //     ...card,
  //     rulings: await scraper.fetchRulings(card)
  //   }))
  // );

  console.log('Done! Check packages/engine/data/cards/6ed.json');
}

main().catch(console.error);
```

### 3.6 Running the Scraper

```bash
# Install dependencies
cd packages/data-scraper
bun install

# Run the scraper
bun run ../scripts/fetch-cards.ts

# Output: packages/engine/data/cards/6ed.json
```

### 3.7 Card Loader (Engine Side)

```typescript
// packages/engine/src/cards/CardLoader.ts

import cards6ed from '../data/cards/6ed.json';
import type { ScryfallCard } from './CardTemplate';

export class CardLoader {
  private static cache: Map<string, ScryfallCard> = new Map();

  static initialize() {
    for (const card of cards6ed as ScryfallCard[]) {
      this.cache.set(card.id, card);
      // Also index by name for easy lookup
      this.cache.set(card.name.toLowerCase(), card);
    }
    console.log(`Loaded ${this.cache.size / 2} cards from 6th Edition`);
  }

  static getById(id: string): ScryfallCard | undefined {
    return this.cache.get(id);
  }

  static getByName(name: string): ScryfallCard | undefined {
    return this.cache.get(name.toLowerCase());
  }

  static getAllCards(): ScryfallCard[] {
    return Array.from(this.cache.values()).filter(
      (card, index, array) => array.indexOf(card) === index,
    );
  }

  static getCardsByColor(color: string): ScryfallCard[] {
    return this.getAllCards().filter((card) => card.colors.includes(color));
  }

  static getCardsByType(type: string): ScryfallCard[] {
    return this.getAllCards().filter((card) =>
      card.type_line.toLowerCase().includes(type.toLowerCase()),
    );
  }
}

// Auto-initialize on import
CardLoader.initialize();
```

### 3.8 Example Usage

```typescript
// In your game code
import { CardLoader } from '@manacore/engine';

// Get a specific card
const bolt = CardLoader.getByName('Lightning Bolt');
console.log(bolt.oracle_text); // "Lightning Bolt deals 3 damage to any target."

// Get all red cards
const redCards = CardLoader.getCardsByColor('R');

// Get all creatures
const creatures = CardLoader.getCardsByType('Creature');
```

---

## 4. Ability System Architecture

The activated abilities system uses a **registry-based pattern** for O(1) card lookup, replacing the previous monolithic switch statement.

### 4.1 Architecture Overview

```
getActivatedAbilities(card, state)
         │
         ▼
┌─────────────────────┐
│   Ability Registry  │ ◄── Map<cardName, AbilityFactory>
│   (O(1) lookup)     │     ~80+ cards registered
└─────────┬───────────┘
          │
          │ not found?
          ▼
┌─────────────────────┐
│   Legacy Fallback   │ ◄── Original switch statement
│   (activatedAbilities.ts)
└─────────────────────┘
```

### 4.2 Directory Structure

```
packages/engine/src/rules/abilities/
├── index.ts                    # Main entry: getActivatedAbilities()
├── registry.ts                 # Central Map<string, AbilityFactory>
├── types.ts                    # ActivatedAbility, AbilityCost, AbilityEffect
│
├── templates/
│   ├── index.ts               # Re-export all templates
│   ├── common.ts              # Shared utilities (standardTapCheck, etc.)
│   ├── mana.ts                # createTapForMana, createSacrificeForMana
│   ├── damage.ts              # createTapForDamage, createTimAbility
│   ├── pump.ts                # createPumpSelf, createFirebreathing
│   ├── combat.ts              # createRegenerate, createPreventDamage
│   └── sacrifice.ts           # createSacrificeForEffect
│
└── sets/
    ├── index.ts               # Aggregates all sets
    └── 6ed/
        ├── index.ts           # Register all 6ed cards
        ├── lands.ts           # Pain lands, City of Brass, etc.
        ├── mana-creatures.ts  # Llanowar Elves, Birds of Paradise
        ├── pingers.ts         # Prodigal Sorcerer, Anaba Shaman
        ├── pumpers.ts         # Flame Spirit, Dragon Engine
        ├── regeneration.ts    # Drudge Skeletons, River Boa
        ├── sacrifice.ts       # Fallen Angel, Blood Pet
        └── utility.ts         # Samite Healer, Elder Druid
```

### 4.3 Key Components

**Registry (`registry.ts`)**

- Central `Map<string, AbilityFactory>` for O(1) lookup
- `registerAbilities(cardName, factory)` - register a single card
- `registerBulk(cardNames, factory)` - register multiple cards with same pattern
- `getFromRegistry(cardName, card, state)` - retrieve abilities

**Templates (`templates/*.ts`)**

- Factory functions that create `ActivatedAbility` objects
- Eliminate code duplication across similar cards
- Examples: `createTapForMana()`, `createTimAbility()`, `createRegenerate()`

**Set Files (`sets/6ed/*.ts`)**

- Organize cards by category (mana creatures, pingers, etc.)
- Call `registerAbilities()` during module initialization
- Export a count for debugging purposes

### 4.4 Resolution Order

1. **Registry lookup (O(1))**: Check if card has registered abilities
2. **Legacy fallback**: Fall back to `activatedAbilities.ts` for non-migrated cards
3. **Return empty**: If no abilities found anywhere

---

## 5. Spell Registry System

The spell resolution system uses a **registry-based pattern** for O(1) card lookup, similar to the activated abilities registry. This refactor reduced `stack.ts` from 1,760 lines to 437 lines (75% reduction).

### 5.1 Architecture Overview

```
resolveSpell(state, stackObj)
         │
         ▼
┌─────────────────────┐
│   Spell Registry    │ ◄── Map<cardName, SpellImplementation>
│   (O(1) lookup)     │     ~70 spells registered
└─────────┬───────────┘
          │
          │ not found?
          ▼
┌─────────────────────┐
│  Generic Parsing    │ ◄── Oracle text parsing for simple spells
│  (parseSpellEffect) │
└─────────────────────┘
```

### 5.2 Directory Structure

```
packages/engine/src/spells/
├── SpellImplementation.ts      # Type definitions (SpellImplementation interface)
├── registry.ts                 # Central Map<string, SpellImplementation> registry
├── index.ts                    # Entry point, imports all categories
└── categories/                 # Organized by effect type
    ├── damage.ts               # Dry Spell, Tremor, Inferno, Vertigo, etc. (6 spells)
    ├── destruction.ts          # Wrath of God, Armageddon, Tranquility, etc. (14 spells)
    ├── counters.ts             # Memory Lapse, Remove Soul (2 spells)
    ├── xcost.ts                # Earthquake, Hurricane, Dark Ritual, etc. (9 spells)
    ├── tutors.ts               # Enlightened/Mystical/Vampiric/Worldly Tutor (6 spells)
    ├── card-draw.ts            # Inspiration, Ancestral Memories, etc. (10 spells)
    ├── graveyard.ts            # Raise Dead, Elven Cache, etc. (5 spells)
    ├── untap.ts                # Early Harvest, Vitalize, etc. (5 spells)
    ├── prevention.ts           # Fog, Healing Salve, etc. (4 spells)
    └── misc.ts                 # Boomerang, Icatian Town, etc. (9 spells)
```

### 5.3 Key Components

**SpellImplementation Interface (`SpellImplementation.ts`)**

```typescript
interface SpellImplementation {
  cardName: string;                                         // Must match CardTemplate.name exactly
  resolve: (state: GameState, stackObj: StackObject) => void;  // Apply spell effects
  shouldFizzle?: (state: GameState, stackObj: StackObject) => boolean;  // Custom fizzle logic
}
```

**Registry (`registry.ts`)**

- Central `Map<string, SpellImplementation>` for O(1) lookup
- `registerSpell(impl)` - register a single spell
- `registerSpells(impls[])` - register multiple spells
- `getSpellImplementation(cardName)` - retrieve implementation

**Category Files (`categories/*.ts`)**

- Each file exports a `SpellImplementation[]` array
- Calls `registerSpells()` during module initialization
- Organized by spell effect type for easy discovery

### 5.4 Resolution Order

When resolving a spell, `stack.ts` follows this order:

1. **Registry lookup (O(1))**: Check if card has registered implementation
2. **Generic parsing**: Fall back to `parseSpellEffect()` for unregistered spells
3. **No effect**: If neither works, spell resolves doing nothing

```typescript
function applySpellEffects(state: GameState, stackObj: StackObject): void {
  const impl = getSpellImplementation(template.name);
  if (impl) {
    impl.resolve(state, stackObj);
    return;
  }
  // Fall back to generic oracle text parsing
  const effect = parseSpellEffect(oracleText);
  if (effect) { /* apply parsed effect */ }
}
```

### 5.5 Helper Modules

**Effects Library (`rules/effects.ts`)**

Reusable effect functions used by spell implementations:
- `destroyPermanent()`, `destroyAllCreatures()`, `destroyAllLands()`
- `applyDamage()`, `dealDamageToAll()`
- `drawCards()`, `discardCards()`
- `searchLibrary()`, `returnFromGraveyard()`
- `returnToHand()`, `gainLife()`, `loseLife()`

**Token Creation (`rules/tokens.ts`)**

Token creation for spells like Icatian Town:
- `createTokens(state, controller, tokenType, count)`
- `TOKEN_DEFINITIONS` - predefined token types (Citizen, Cat, Goblin, etc.)
- `createCustomTokens()` - for non-standard tokens

---

## 6. Engine Architecture

### 6.1 Immutable State Pattern

The engine uses **pure functions** and **immutable data** to enable:

- Easy debugging (state history)
- Fast cloning (for MCTS simulations)
- Deterministic replays (given actions + RNG seed)

```typescript
// BAD: Mutable state
class Game {
  state: GameState;

  playCard(cardId: string) {
    this.state.hand.splice(index, 1); // Mutates state!
  }
}

// GOOD: Immutable state
function playCard(state: GameState, cardId: string): GameState {
  const newState = structuredClone(state);
  const cardIndex = newState.hand.findIndex((c) => c.id === cardId);
  newState.hand.splice(cardIndex, 1);
  newState.battlefield.push(newState.hand[cardIndex]);
  return newState;
}
```

### 6.2 Action System

All game logic flows through the **reducer**:

```typescript
// packages/engine/src/actions/Action.ts

export type ActionType =
  | 'PLAY_LAND'
  | 'CAST_SPELL'
  | 'ACTIVATE_ABILITY'
  | 'DECLARE_ATTACKERS'
  | 'DECLARE_BLOCKERS'
  | 'PASS_PRIORITY'
  | 'END_TURN';

export interface GameAction {
  type: ActionType;
  playerId: PlayerId;
  payload: any; // Type varies by action
}

export interface PlaySpellAction extends GameAction {
  type: 'CAST_SPELL';
  payload: {
    cardId: string;
    targets?: string[];
  };
}
```

### 6.3 The Reducer

```typescript
// packages/engine/src/actions/reducer.ts

export function applyAction(state: GameState, action: GameAction): GameState {
  // 1. Validate
  const errors = validateAction(state, action);
  if (errors.length > 0) {
    throw new Error(`Invalid action: ${errors.join(', ')}`);
  }

  // 2. Clone state (cheap with structuredClone)
  const newState = structuredClone(state);

  // 3. Apply action
  switch (action.type) {
    case 'CAST_SPELL':
      return applyCastSpell(newState, action as PlaySpellAction);
    case 'DECLARE_ATTACKERS':
      return applyDeclareAttackers(newState, action);
    // ... etc
  }

  // 4. Check state-based actions
  return checkStateBasedActions(newState);
}
```

### 6.4 Zone Management

```typescript
// packages/engine/src/state/Zone.ts

export type Zone = 'library' | 'hand' | 'battlefield' | 'graveyard' | 'stack' | 'exile';

export class ZoneManager {
  static moveCard(
    state: GameState,
    cardId: string,
    fromZone: Zone,
    toZone: Zone,
    playerId: PlayerId,
  ): GameState {
    const newState = structuredClone(state);
    const player = newState.players[playerId];

    // Find card in source zone
    const sourceZone = player[fromZone] as CardInstance[];
    const cardIndex = sourceZone.findIndex((c) => c.instanceId === cardId);

    if (cardIndex === -1) {
      throw new Error(`Card ${cardId} not found in ${fromZone}`);
    }

    const card = sourceZone[cardIndex];

    // Remove from source
    sourceZone.splice(cardIndex, 1);

    // Add to destination
    const destZone = player[toZone] as CardInstance[];
    destZone.push(card);

    // Update card state
    card.zone = toZone;

    return newState;
  }
}
```

---

## 7. AI Architecture

### 7.1 MCTS Node Structure

```typescript
// packages/ai/src/search/Node.ts

export class MCTSNode {
  state: GameState;
  parent: MCTSNode | null;
  children: MCTSNode[] = [];

  // MCTS statistics
  visits: number = 0;
  totalReward: number = 0;

  // Unexplored actions
  untriedActions: GameAction[] = [];

  // The action that led to this state
  action: GameAction | null = null;

  constructor(state: GameState, parent: MCTSNode | null, action: GameAction | null) {
    this.state = state;
    this.parent = parent;
    this.action = action;
    this.untriedActions = this.getLegalActions(state);
  }

  getLegalActions(state: GameState): GameAction[] {
    // Generate all legal actions from this state
    // This is game-specific logic
    return [];
  }

  isFullyExpanded(): boolean {
    return this.untriedActions.length === 0;
  }

  isLeaf(): boolean {
    return this.children.length === 0;
  }

  winRate(): number {
    return this.visits === 0 ? 0 : this.totalReward / this.visits;
  }
}
```

### 7.2 UCB1 Selection

```typescript
// packages/ai/src/search/UCB1.ts

export function selectBestChild(node: MCTSNode, explorationParam: number = Math.sqrt(2)): MCTSNode {
  return node.children.reduce((best, child) => {
    const ucb1 = calculateUCB1(child, node.visits, explorationParam);
    const bestUcb1 = calculateUCB1(best, node.visits, explorationParam);
    return ucb1 > bestUcb1 ? child : best;
  });
}

function calculateUCB1(node: MCTSNode, parentVisits: number, c: number): number {
  if (node.visits === 0) {
    return Infinity; // Prioritize unvisited nodes
  }

  const exploitation = node.winRate();
  const exploration = c * Math.sqrt(Math.log(parentVisits) / node.visits);

  return exploitation + exploration;
}
```

### 7.3 Determinization for Hidden Information

```typescript
// packages/ai/src/search/determinization.ts

export function determinize(state: GameState, playerId: PlayerId): GameState {
  const newState = structuredClone(state);
  const opponent = playerId === 'player' ? 'opponent' : 'player';

  // Shuffle opponent's unknown cards back into library
  const unknownCards = newState.players[opponent].hand;
  newState.players[opponent].hand = [];
  newState.players[opponent].library.push(...unknownCards);

  // Shuffle library
  shuffle(newState.players[opponent].library, newState.rngSeed);

  // Redraw hand
  for (let i = 0; i < unknownCards.length; i++) {
    const card = newState.players[opponent].library.pop()!;
    newState.players[opponent].hand.push(card);
  }

  return newState;
}

function shuffle<T>(array: T[], seed: number): void {
  const rng = seedRandom(seed);
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}
```

---

## 8. Visualization Architecture

### 8.1 React Component Structure

We use a standard React component tree to render the game state. This provides a "Scientific Dashboard" look rather than a game engine look.

```tsx
// packages/web-client/src/App.tsx

import { useGameState } from './hooks/useGameState';
import { Battlefield } from './components/Battlefield';
import { AgentPanel } from './components/AgentPanel';

export function App() {
  const state = useGameState();

  return (
    <div className="flex h-screen bg-gray-900 text-white font-mono">
      {/* Main Game Area */}
      <main className="flex-1 flex flex-col p-4">
        <OpponentZone player={state.players.opponent} />
        <Battlefield />
        <PlayerZone player={state.players.player} />
      </main>

      {/* Research Sidebar */}
      <aside className="w-96 border-l border-gray-700 p-4 bg-gray-800">
        <AgentPanel stats={state.aiStats} />
        <ActionLog history={state.actionLog} />
      </aside>
    </div>
  );
}
```

### 8.2 Card Component

Cards are rendered as DOM elements, allowing easy CSS styling and debugging.

```tsx
// packages/web-client/src/components/Card.tsx

import clsx from 'clsx';
import type { CardInstance } from '@manacore/engine';

interface CardProps {
  data: CardInstance;
  onClick?: () => void;
}

export function Card({ data, onClick }: CardProps) {
  // Dynamic styling based on state
  const classes = clsx('relative w-32 h-44 rounded-lg shadow-md transition-all duration-200', {
    'ring-2 ring-yellow-400': data.canPlay, // Highlight playable
    'rotate-90': data.tapped, // Tapped state
    'hover:scale-105 z-10': !data.tapped, // Hover effect
  });

  return (
    <div className={classes} onClick={onClick}>
      <img
        src={`/assets/cards/${data.scryfallId}.jpg`}
        alt={data.name}
        className="w-full h-full object-cover rounded-lg"
      />
      {/* Data Overlay for Debugging */}
      <div className="absolute top-0 right-0 bg-black/50 text-xs px-1">
        ID: {data.instanceId.slice(0, 4)}
      </div>
    </div>
  );
}
```

---

## 9. Performance Optimizations

### 9.1 Fast State Cloning

```typescript
// Use structuredClone for deep cloning
const newState = structuredClone(state);

// For shallow clones (when safe)
const newState = { ...state };
```

### 9.2 MCTS Optimizations

- **Transposition Table**: Cache evaluated positions
- **Move Ordering**: Try high-value moves first
- **Early Termination**: Stop search when one move is clearly best
- **Parallel MCTS**: Run multiple searches concurrently (Phase 5)

### 9.3 Visualization Optimizations

- **React Memo**: Prevent re-rendering cards that haven't changed
- **Virtualization**: Use `react-window` for large log lists
- **CSS Transforms**: Use hardware-accelerated transforms for animations
- **Selector Optimization**: Select minimal state slices in Zustand

---

## 10. Testing Strategy

### 10.1 Unit Tests

```typescript
// packages/engine/tests/combat.test.ts

import { describe, test, expect } from 'bun:test';
import { applyAction } from '../src/actions/reducer';

describe('Combat', () => {
  test('2/2 attacks, gets blocked by 3/3, attacker dies', () => {
    const state = setupCombat();
    const newState = resolveCombat(state);

    expect(newState.players.player.graveyard).toHaveLength(1);
    expect(newState.players.opponent.battlefield).toHaveLength(1);
  });
});
```

### 10.2 Integration Tests

Run full games between bots to catch edge cases:

```bash
bun test:integration
```

### 10.3 Simulation Replay System

To support scientific peer review and debugging, the platform can reproduce any simulation:

```json
{
  "simulation_metadata": {
    "version": "0.0.1",
    "seed": 12345,
    "timestamp": "2026-01-04T12:00:00Z"
  },
  "agent_log": [
    {"type": "PLAY_LAND", "playerId": "player", "payload": {...}},
    {"type": "CAST_SPELL", "playerId": "player", "payload": {...}}
  ]
}
```

This JSON allows researchers to perfectly reconstruct the state at any point in the timeline.

---

## 11. Deployment

### 11.1 CLI Tool

```bash
# Install globally
bun install -g @manacore/cli

# Run a game
manacore play --deck red-burn --opponent mcts
```

### 11.2 Web Client

```bash
# Build for production
cd packages/web-client
bun run build

# Output: dist/ folder ready for static hosting
```

Deploy to Vercel/Netlify/GitHub Pages.

---

**End of Architecture Document**

_Next: See `roadmap.md` for development timeline and milestones._
