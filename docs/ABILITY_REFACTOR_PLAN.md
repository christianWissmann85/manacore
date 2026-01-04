# Activated Abilities Architecture Refactor

> **Goal**: Transform the monolithic 2240-line `activatedAbilities.ts` into a scalable, maintainable system that can grow to support thousands of cards across multiple sets.

---

## Table of Contents

1. [Current State Analysis](#current-state-analysis)
2. [Target Architecture](#target-architecture)
3. [Implementation Phases](#implementation-phases)
4. [File Structure](#file-structure)
5. [Template Definitions](#template-definitions)
6. [Registry Pattern](#registry-pattern)
7. [Auto-Parser Specification](#auto-parser-specification)
8. [Migration Strategy](#migration-strategy)
9. [Testing Strategy](#testing-strategy)
10. [Success Metrics](#success-metrics)

---

## Current State Analysis

### Problems

| Issue                  | Current Impact                | Future Impact                  |
| ---------------------- | ----------------------------- | ------------------------------ |
| Single 2240-line file  | Hard to navigate              | 10,000+ lines for Urza's block |
| Giant switch statement | O(n) lookup per card          | Performance degradation        |
| No code reuse          | ~25-40 lines per card         | Massive duplication            |
| Tight coupling         | Can't test cards in isolation | Harder to debug                |
| No set separation      | Can't add/remove expansions   | Expansion management nightmare |

### Repeated Patterns Identified

From analyzing the current code, these patterns appear frequently:

1. **Tap for Mana** (~15 cards): Llanowar Elves, Birds of Paradise, Fyndhorn Elder, etc.
2. **Tap for Damage** (~8 cards): Prodigal Sorcerer, Anaba Shaman, Suq'Ata Firewalker, etc.
3. **Sacrifice for Mana** (~5 cards): Blood Pet, Ashnod's Altar, etc.
4. **Sacrifice for Effect** (~10 cards): Fallen Angel, Blighted Shaman, etc.
5. **Pump Self** (~8 cards): Frozen Shade, Firebreathing creatures, etc.
6. **Regeneration** (~6 cards): Drudge Skeletons, Will-o'-the-Wisp, etc.
7. **Damage Prevention** (~4 cards): Samite Healer, Master Healer, etc.
8. **Tap to Buff Other** (~3 cards): Infantry Veteran, Wyluli Wolf _(added from review)_
9. **Tap to Counter Colored Spell** (~3 cards): Order of Sacred Torch, Stromgald Cabal _(added from review)_
10. **Life Payment Abilities** (~2 cards): Mischievous Poltergeist _(added from review)_

### Current `canActivate` Pattern

Most abilities share this exact pattern:

```typescript
canActivate: (state: GameState, sourceId: string, controller: PlayerId) => {
  const source = state.players[controller].battlefield.find((c) => c.instanceId === sourceId);
  if (!source) return false;
  if (source.tapped) return false;
  if (source.summoningSick) return false;
  return true;
};
```

This is duplicated 50+ times in the file.

---

## Target Architecture

### Design Principles

1. **DRY**: Common patterns extracted into reusable templates
2. **Separation of Concerns**: Cards organized by set, templates by ability type
3. **Registry Pattern**: Central lookup with O(1) access
4. **Composable**: Complex abilities built from simple building blocks
5. **Testable**: Each card/template testable in isolation
6. **Extensible**: New sets add new folders, not modify existing files

### Architecture Diagram

```
getActivatedAbilities(card, state)
         │
         ▼
┌─────────────────────┐
│   Ability Registry  │ ◄── Map<cardName, AbilityFactory>
│   (O(1) lookup)     │
└─────────┬───────────┘
          │
          │ not found?
          ▼
┌─────────────────────┐
│   Auto-Parser       │ ◄── Parse oracle text for simple patterns
│   (fallback)        │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│   Ability Templates │ ◄── Reusable factories
│   (building blocks) │
└─────────────────────┘
```

---

## Implementation Phases

### Phase 1: Extract Templates (Est. LOC reduction: 50%)

Create reusable template functions for common patterns.

**Deliverables:**

- `templates/mana.ts` - Mana-producing abilities
- `templates/damage.ts` - Damage-dealing abilities
- `templates/pump.ts` - Power/toughness modification
- `templates/combat.ts` - Combat-related abilities (regeneration, etc.)
- `templates/sacrifice.ts` - Sacrifice-based abilities
- `templates/common.ts` - Shared utilities (canActivate checks)

### Phase 2: Create Registry

Implement the central registry pattern.

**Deliverables:**

- `registry.ts` - Central Map and registration functions
- `index.ts` - Main entry point that delegates to registry

### Phase 3: Migrate Cards by Set

Move card definitions to set-specific files.

**Deliverables:**

- `sets/6ed/index.ts` - Re-exports all 6ed abilities
- `sets/6ed/mana-creatures.ts` - Llanowar Elves, Birds, etc.
- `sets/6ed/pingers.ts` - Prodigal Sorcerer, etc.
- `sets/6ed/pumpers.ts` - Firebreathing creatures, etc.
- `sets/6ed/utility.ts` - Misc activated abilities

### Phase 4: Auto-Parser (Optional Enhancement)

Add automatic ability detection for simple patterns.

**Deliverables:**

- `auto/parser.ts` - Oracle text pattern matching
- `auto/patterns.ts` - Regex patterns for common abilities

---

## File Structure

```
packages/engine/src/rules/abilities/
├── index.ts                    # Main entry: getActivatedAbilities()
├── registry.ts                 # Central Map<string, AbilityFactory>
├── types.ts                    # Shared type definitions
│
├── templates/
│   ├── index.ts               # Re-export all templates
│   ├── common.ts              # Shared utilities (canActivate checks)
│   ├── mana.ts                # createTapForMana, createSacForMana
│   ├── damage.ts              # createTapForDamage, createPingAbility
│   ├── pump.ts                # createPumpSelf, createFirebreathing
│   ├── combat.ts              # createRegenerate, createPreventDamage
│   └── sacrifice.ts           # createSacrificeForEffect
│
├── auto/
│   ├── parser.ts              # Auto-detect abilities from oracle
│   └── patterns.ts            # Regex patterns
│
└── sets/
    ├── index.ts               # Aggregates all sets
    └── 6ed/
        ├── index.ts           # Register all 6ed cards
        ├── mana-creatures.ts  # ~15 cards
        ├── pingers.ts         # ~8 cards
        ├── pumpers.ts         # ~10 cards
        ├── sacrifice.ts       # ~10 cards
        ├── combat.ts          # ~10 cards
        └── utility.ts         # ~20 cards (misc)
```

---

## Template Definitions

### Common Utilities (`templates/common.ts`)

```typescript
import type { GameState } from '../../state/GameState';
import type { PlayerId } from '../../state/Zone';
import type { CardInstance } from '../../state/CardInstance';
import { CardLoader } from '../../cards/CardLoader';
import { isLand } from '../../cards/CardTemplate';

/**
 * Standard tap ability activation check
 * - Source must exist on battlefield
 * - Source must not be tapped
 * - Source must not have summoning sickness (for creatures)
 */
export function standardTapCheck(
  state: GameState,
  sourceId: string,
  controller: PlayerId,
): boolean {
  const source = state.players[controller].battlefield.find((c) => c.instanceId === sourceId);
  if (!source) return false;
  if (source.tapped) return false;
  if (source.summoningSick) return false;
  return true;
}

/**
 * Check if source exists (for sacrifice abilities that don't require untapped)
 */
export function sourceExistsCheck(
  state: GameState,
  sourceId: string,
  controller: PlayerId,
): boolean {
  const source = state.players[controller].battlefield.find((c) => c.instanceId === sourceId);
  return source !== undefined;
}

/**
 * Check if player can pay a mana cost
 */
export function canPayMana(state: GameState, controller: PlayerId, manaCost: string): boolean {
  // Parse mana cost and check available mana
  const player = state.players[controller];
  // ... implementation
  return true; // Simplified
}

/**
 * Count available mana of a specific color
 */
export function countAvailableMana(
  state: GameState,
  controller: PlayerId,
  color: 'W' | 'U' | 'B' | 'R' | 'G' | 'C',
): number {
  const player = state.players[controller];
  let total = 0;

  // Count mana pool
  switch (color) {
    case 'W':
      total += player.manaPool.white;
      break;
    case 'U':
      total += player.manaPool.blue;
      break;
    case 'B':
      total += player.manaPool.black;
      break;
    case 'R':
      total += player.manaPool.red;
      break;
    case 'G':
      total += player.manaPool.green;
      break;
    case 'C':
      total += player.manaPool.colorless;
      break;
  }

  // Count untapped lands that can produce this color
  // ... implementation

  return total;
}
```

### Mana Templates (`templates/mana.ts`)

```typescript
import type { CardInstance } from '../../state/CardInstance';
import type { ActivatedAbility } from '../types';
import { standardTapCheck, sourceExistsCheck } from './common';

type ManaColor = 'W' | 'U' | 'B' | 'R' | 'G' | 'C';

/**
 * Create a tap-for-mana ability
 * Used for: Llanowar Elves, Birds of Paradise, etc.
 */
export function createTapForMana(
  card: CardInstance,
  colors: ManaColor[],
  options: {
    amount?: number;
    name?: string;
  } = {},
): ActivatedAbility {
  const { amount = 1, name } = options;
  const colorStr = colors.map((c) => `{${c}}`).join('');
  const displayAmount = amount > 1 ? colorStr.repeat(amount) : colorStr;

  return {
    id: `${card.instanceId}_tap_mana`,
    name: name || `{T}: Add ${displayAmount}`,
    cost: { tap: true },
    effect: {
      type: 'ADD_MANA',
      amount: colors.length * amount,
      manaColors: colors,
    },
    isManaAbility: true,
    canActivate: standardTapCheck,
  };
}

/**
 * Create a sacrifice-for-mana ability
 * Used for: Blood Pet, Ashnod's Altar
 */
export function createSacrificeForMana(
  card: CardInstance,
  colors: ManaColor[],
  sacrificeType: 'self' | 'creature' | 'artifact',
  options: {
    amount?: number;
    name?: string;
  } = {},
): ActivatedAbility {
  const { amount = 1, name } = options;

  return {
    id: `${card.instanceId}_sac_mana`,
    name: name || `Sacrifice: Add ${colors.map((c) => `{${c}}`).join('')}`,
    cost: { sacrifice: { type: sacrificeType } },
    effect: {
      type: 'ADD_MANA',
      amount: colors.length * amount,
      manaColors: colors,
    },
    isManaAbility: true,
    canActivate: sourceExistsCheck,
  };
}

/**
 * Create a Birds of Paradise style any-color mana ability
 */
export function createTapForAnyColor(card: CardInstance): ActivatedAbility {
  return createTapForMana(card, ['W', 'U', 'B', 'R', 'G'], {
    name: '{T}: Add one mana of any color',
  });
}
```

### Damage Templates (`templates/damage.ts`)

```typescript
import type { CardInstance } from '../../state/CardInstance';
import type { GameState } from '../../state/GameState';
import type { PlayerId } from '../../state/Zone';
import type { ActivatedAbility, TargetRequirement } from '../types';
import { standardTapCheck, countAvailableMana } from './common';

/**
 * Create a tap-to-deal-damage ability (pinger)
 * Used for: Prodigal Sorcerer, Anaba Shaman, etc.
 */
export function createTapForDamage(
  card: CardInstance,
  damage: number,
  options: {
    manaCost?: string;
    targetType?: 'any' | 'creature' | 'player';
    targetRestrictions?: TargetRequirement['restrictions'];
    name?: string;
  } = {},
): ActivatedAbility {
  const { manaCost, targetType = 'any', targetRestrictions = [], name } = options;

  const costStr = manaCost ? `${manaCost}, {T}` : '{T}';
  const targetDesc =
    targetType === 'any'
      ? 'any target'
      : targetType === 'creature'
        ? 'target creature'
        : 'target player';

  return {
    id: `${card.instanceId}_tap_damage`,
    name: name || `${costStr}: Deal ${damage} damage to ${targetDesc}`,
    cost: {
      tap: true,
      ...(manaCost && { mana: manaCost }),
    },
    effect: { type: 'DAMAGE', amount: damage },
    isManaAbility: false,
    targetRequirements: [
      {
        id: 'target_0',
        count: 1,
        targetType,
        zone: 'battlefield',
        restrictions: targetRestrictions,
        optional: false,
        description: targetDesc,
      },
    ],
    canActivate: (state: GameState, sourceId: string, controller: PlayerId) => {
      if (!standardTapCheck(state, sourceId, controller)) return false;

      // Check mana if required
      if (manaCost) {
        // Extract color from mana cost (e.g., '{R}' -> 'R')
        const colorMatch = manaCost.match(/\{([WUBRG])\}/);
        if (colorMatch) {
          const color = colorMatch[1] as 'W' | 'U' | 'B' | 'R' | 'G';
          if (countAvailableMana(state, controller, color) < 1) {
            return false;
          }
        }
      }

      return true;
    },
  };
}

/**
 * Create Prodigal Sorcerer style ability (Tim)
 */
export function createTimAbility(card: CardInstance): ActivatedAbility {
  return createTapForDamage(card, 1, {
    targetType: 'any',
    name: '{T}: Deal 1 damage to any target',
  });
}

/**
 * Create Anaba Shaman style ability (Tim with mana cost)
 */
export function createPaidTimAbility(
  card: CardInstance,
  damage: number,
  manaCost: string,
): ActivatedAbility {
  return createTapForDamage(card, damage, {
    manaCost,
    targetType: 'any',
  });
}
```

### Pump Templates (`templates/pump.ts`)

```typescript
import type { CardInstance } from '../../state/CardInstance';
import type { GameState } from '../../state/GameState';
import type { ActivatedAbility } from '../types';
import { standardTapCheck, countAvailableMana } from './common';

/**
 * Create a pump-self ability (Firebreathing, Shade abilities)
 * Used for: Frozen Shade, Shivan Dragon, etc.
 */
export function createPumpSelf(
  card: CardInstance,
  powerBoost: number,
  toughnessBoost: number,
  manaCost: string,
  options: {
    name?: string;
    repeatable?: boolean;
  } = {},
): ActivatedAbility {
  const { name, repeatable = true } = options;
  const boostStr = `+${powerBoost}/+${toughnessBoost}`;

  return {
    id: `${card.instanceId}_pump_self`,
    name: name || `${manaCost}: ${boostStr} until end of turn`,
    cost: { mana: manaCost },
    effect: {
      type: 'CUSTOM',
      custom: (state: GameState) => {
        // Find self and add modification
        for (const playerId of ['player', 'opponent'] as const) {
          const creature = state.players[playerId].battlefield.find(
            (c) => c.instanceId === card.instanceId,
          );
          if (creature) {
            creature.temporaryModifications.push({
              id: `pump_${Date.now()}_${Math.random()}`,
              powerChange: powerBoost,
              toughnessChange: toughnessBoost,
              expiresAt: 'end_of_turn',
              source: card.instanceId,
            });
            break;
          }
        }
      },
    },
    isManaAbility: false,
    canActivate: (state: GameState, sourceId: string, controller) => {
      const source = state.players[controller].battlefield.find((c) => c.instanceId === sourceId);
      if (!source) return false;

      // Check mana availability
      const colorMatch = manaCost.match(/\{([WUBRG])\}/);
      if (colorMatch) {
        const color = colorMatch[1] as 'W' | 'U' | 'B' | 'R' | 'G';
        return countAvailableMana(state, controller, color) >= 1;
      }
      return true;
    },
  };
}

/**
 * Create Firebreathing ability ({R}: +1/+0)
 */
export function createFirebreathing(card: CardInstance): ActivatedAbility {
  return createPumpSelf(card, 1, 0, '{R}', {
    name: '{R}: +1/+0 until end of turn',
  });
}

/**
 * Create Shade ability ({B}: +1/+1)
 */
export function createShadeAbility(card: CardInstance): ActivatedAbility {
  return createPumpSelf(card, 1, 1, '{B}', {
    name: '{B}: +1/+1 until end of turn',
  });
}
```

---

## Registry Pattern

### Registry Implementation (`registry.ts`)

```typescript
import type { CardInstance } from '../state/CardInstance';
import type { GameState } from '../state/GameState';
import type { ActivatedAbility } from './types';

/**
 * Factory function type for creating abilities
 */
export type AbilityFactory = (card: CardInstance, state: GameState) => ActivatedAbility[];

/**
 * Central registry of card abilities
 */
const abilityRegistry = new Map<string, AbilityFactory>();

/**
 * Register abilities for a card
 */
export function registerAbilities(cardName: string, factory: AbilityFactory): void {
  if (abilityRegistry.has(cardName)) {
    console.warn(`Warning: Overwriting abilities for ${cardName}`);
  }
  abilityRegistry.set(cardName, factory);
}

/**
 * Register multiple cards with the same ability pattern
 */
export function registerBulk(cardNames: string[], factory: AbilityFactory): void {
  for (const name of cardNames) {
    registerAbilities(name, factory);
  }
}

/**
 * Get abilities for a card from the registry
 */
export function getFromRegistry(
  cardName: string,
  card: CardInstance,
  state: GameState,
): ActivatedAbility[] | null {
  const factory = abilityRegistry.get(cardName);
  if (factory) {
    return factory(card, state);
  }
  return null;
}

/**
 * Check if a card has registered abilities
 */
export function hasRegisteredAbilities(cardName: string): boolean {
  return abilityRegistry.has(cardName);
}

/**
 * Get all registered card names (for debugging)
 */
export function getRegisteredCards(): string[] {
  return Array.from(abilityRegistry.keys());
}
```

### Main Entry Point (`index.ts`)

```typescript
import type { CardInstance } from '../state/CardInstance';
import type { GameState } from '../state/GameState';
import type { ActivatedAbility } from './types';
import { CardLoader } from '../cards/CardLoader';
import { getFromRegistry } from './registry';
import { parseAbilitiesFromOracle } from './auto/parser';

// Import and initialize all sets
import './sets';

/**
 * Get all activated abilities for a card
 *
 * Resolution order:
 * 1. Check registry for card-specific abilities
 * 2. Fall back to auto-parser for simple patterns
 * 3. Return empty array if no abilities found
 */
export function getActivatedAbilities(card: CardInstance, state: GameState): ActivatedAbility[] {
  const template = CardLoader.getById(card.scryfallId);
  if (!template) return [];

  // 1. Check registry first (O(1) lookup)
  const registeredAbilities = getFromRegistry(template.name, card, state);
  if (registeredAbilities !== null) {
    return registeredAbilities;
  }

  // 2. Try auto-parser for simple patterns
  const parsedAbilities = parseAbilitiesFromOracle(card, template.oracle_text || '', state);
  if (parsedAbilities.length > 0) {
    return parsedAbilities;
  }

  // 3. No abilities found
  return [];
}

// Re-export types
export type { ActivatedAbility } from './types';
export { registerAbilities, registerBulk } from './registry';
```

---

## Auto-Parser Specification

### Oracle Text Patterns (`auto/patterns.ts`)

```typescript
/**
 * Patterns for auto-detecting abilities from oracle text
 */
export const ABILITY_PATTERNS = {
  // Mana abilities: "{T}: Add {G}." or "{T}: Add {G}{G}."
  TAP_FOR_MANA: /\{T\}:\s*Add\s+(\{[WUBRGC]\})+\.?/i,

  // Sacrifice for mana: "Sacrifice ~: Add {B}."
  SAC_FOR_MANA: /Sacrifice\s+[^:]+:\s*Add\s+(\{[WUBRGC]\})+\.?/i,

  // Simple ping: "{T}: ~ deals 1 damage to any target."
  TAP_FOR_DAMAGE:
    /\{T\}:\s*~?\s*deals?\s+(\d+)\s+damage\s+to\s+(any target|target creature|target player)/i,

  // Paid ping: "{R}, {T}: ~ deals 1 damage to any target."
  PAID_TAP_FOR_DAMAGE: /(\{[WUBRGC]\}),?\s*\{T\}:\s*~?\s*deals?\s+(\d+)\s+damage/i,

  // Firebreathing: "{R}: ~ gets +1/+0 until end of turn."
  PUMP_SELF: /(\{[WUBRGC]\}):\s*~?\s*gets?\s+\+(\d+)\/\+(\d+)\s+until\s+end\s+of\s+turn/i,

  // Regenerate: "{G}: Regenerate ~."
  REGENERATE: /(\{[WUBRGC]\}):\s*Regenerate\s+~/i,
} as const;
```

### Parser Implementation (`auto/parser.ts`)

```typescript
import type { CardInstance } from '../../state/CardInstance';
import type { GameState } from '../../state/GameState';
import type { ActivatedAbility } from '../types';
import { ABILITY_PATTERNS } from './patterns';
import { createTapForMana } from '../templates/mana';
import { createTapForDamage, createPaidTimAbility } from '../templates/damage';
import { createPumpSelf } from '../templates/pump';

/**
 * Parse oracle text and generate abilities for simple patterns
 */
export function parseAbilitiesFromOracle(
  card: CardInstance,
  oracleText: string,
  _state: GameState,
): ActivatedAbility[] {
  const abilities: ActivatedAbility[] = [];

  // Normalize oracle text
  const text = oracleText.replace(/~/g, 'CARDNAME');

  // Check for tap-for-mana
  const tapManaMatch = text.match(ABILITY_PATTERNS.TAP_FOR_MANA);
  if (tapManaMatch) {
    const colors = extractManaColors(tapManaMatch[0]);
    abilities.push(createTapForMana(card, colors));
  }

  // Check for simple ping
  const pingMatch = text.match(ABILITY_PATTERNS.TAP_FOR_DAMAGE);
  if (pingMatch) {
    const damage = parseInt(pingMatch[1], 10);
    const targetType = pingMatch[2].includes('creature')
      ? 'creature'
      : pingMatch[2].includes('player')
        ? 'player'
        : 'any';
    abilities.push(createTapForDamage(card, damage, { targetType }));
  }

  // Check for paid ping
  const paidPingMatch = text.match(ABILITY_PATTERNS.PAID_TAP_FOR_DAMAGE);
  if (paidPingMatch && !pingMatch) {
    const manaCost = paidPingMatch[1];
    const damage = parseInt(paidPingMatch[2], 10);
    abilities.push(createPaidTimAbility(card, damage, manaCost));
  }

  // Check for pump self
  const pumpMatch = text.match(ABILITY_PATTERNS.PUMP_SELF);
  if (pumpMatch) {
    const manaCost = pumpMatch[1];
    const power = parseInt(pumpMatch[2], 10);
    const toughness = parseInt(pumpMatch[3], 10);
    abilities.push(createPumpSelf(card, power, toughness, manaCost));
  }

  return abilities;
}

/**
 * Extract mana colors from a mana string like "{G}{G}"
 */
function extractManaColors(manaStr: string): ('W' | 'U' | 'B' | 'R' | 'G' | 'C')[] {
  const matches = manaStr.matchAll(/\{([WUBRGC])\}/g);
  return Array.from(matches).map((m) => m[1] as 'W' | 'U' | 'B' | 'R' | 'G' | 'C');
}
```

---

## Migration Strategy

### Step 1: Create Infrastructure (No Breaking Changes)

1. Create the new directory structure
2. Implement `templates/common.ts` with shared utilities
3. Implement `registry.ts` with registration functions
4. Create empty `sets/6ed/index.ts`

### Step 2: Extract Templates

1. Implement mana templates (`templates/mana.ts`)
2. Implement damage templates (`templates/damage.ts`)
3. Implement pump templates (`templates/pump.ts`)
4. Add tests for each template

### Step 3: Migrate Cards Incrementally

For each card category:

1. Create set file (e.g., `sets/6ed/mana-creatures.ts`)
2. Register cards using templates
3. Remove corresponding switch case from old file
4. Run tests to verify behavior unchanged

**Migration Order:**

1. Mana creatures (simplest, most template-able)
2. Pingers (damage templates)
3. Pumpers (pump templates)
4. Sacrifice effects
5. Combat abilities
6. Complex/unique cards (last)

### Step 4: Deprecate Old File

1. Once all cards migrated, old switch statement should be empty
2. Remove `activatedAbilities.ts`
3. Update imports throughout codebase

---

## Testing Strategy

### Unit Tests for Templates

```typescript
// tests/abilities/templates/mana.test.ts
import { test, expect } from 'bun:test';
import { createTapForMana } from '../../../src/rules/abilities/templates/mana';
import { createMockCard } from '../../helpers';

test('createTapForMana creates correct ability structure', () => {
  const card = createMockCard('llanowar-elves');
  const ability = createTapForMana(card, ['G']);

  expect(ability.id).toContain('tap_mana');
  expect(ability.isManaAbility).toBe(true);
  expect(ability.cost.tap).toBe(true);
  expect(ability.effect.type).toBe('ADD_MANA');
  expect(ability.effect.manaColors).toEqual(['G']);
});

test('createTapForMana handles multiple colors', () => {
  const card = createMockCard('birds-of-paradise');
  const ability = createTapForMana(card, ['W', 'U', 'B', 'R', 'G']);

  expect(ability.effect.manaColors).toHaveLength(5);
});
```

### Integration Tests

```typescript
// tests/abilities/integration.test.ts
import { test, expect } from 'bun:test';
import { getActivatedAbilities } from '../../src/rules/abilities';
import { createTestGameState } from '../helpers';

test('Llanowar Elves has tap-for-mana ability', () => {
  const state = createTestGameState();
  const elves = state.players.player.battlefield.find((c) => c.name === 'Llanowar Elves')!;

  const abilities = getActivatedAbilities(elves, state);

  expect(abilities).toHaveLength(1);
  expect(abilities[0].isManaAbility).toBe(true);
});
```

### Regression Tests

Run all existing tests after each migration step to ensure no behavioral changes.

---

## Success Metrics

| Metric                    | Before  | Target                  |
| ------------------------- | ------- | ----------------------- |
| Lines in main file        | 2240    | <200 (index + registry) |
| Lines per card (avg)      | 25-40   | 3-5                     |
| Time to add new mana dork | ~10 min | ~1 min                  |
| Test isolation            | Low     | High                    |
| Set separation            | None    | Full                    |

### Definition of Done

- [ ] All 80+ cards migrated to new system
- [ ] Zero changes in test behavior
- [ ] Templates cover 80%+ of ability patterns
- [ ] Each set in its own directory
- [ ] Documentation updated
- [ ] Old `activatedAbilities.ts` deleted

---

## Appendix: Card Categories for 6th Edition

### Mana Creatures (~15 cards)

- Llanowar Elves, Fyndhorn Elves, Elvish Mystic
- Birds of Paradise
- Fyndhorn Elder
- Blood Pet (sacrifice)
- Ashnod's Altar (artifact)

### Pingers (~8 cards)

- Prodigal Sorcerer
- Anaba Shaman
- Suq'Ata Firewalker
- Heavy Ballista
- Rathi Dragon (conditional)

### Pumpers (~10 cards)

- Frozen Shade ({B}: +1/+1)
- Shivan Dragon ({R}: +1/+0)
- Phantasmal Forces
- Various firebreathing creatures

### Combat/Regeneration (~10 cards)

- Drudge Skeletons
- Will-o'-the-Wisp
- Uthden Troll

### Sacrifice Effects (~10 cards)

- Fallen Angel
- Phyrexian Ghoul
- Blighted Shaman

### Utility/Complex (~20 cards)

- Prodigal Sorcerer variants
- Royal Assassin
- Master Decoy
- Samite Healer

---

## Review Findings (Post-Validation)

> _This section added after codebase review by task agent_

### Additional Templates Required

Based on codebase analysis, these additional template files are needed:

**`templates/counter.ts`** - For spell countering abilities:

```typescript
export function createCounterColoredAbility(
  card: CardInstance,
  targetColor: MtgColor,
  cost: { tap?: boolean; life?: number; sacrifice?: boolean },
): ActivatedAbility;
```

Cards: Order of Sacred Torch, Stromgald Cabal, Unyaro Griffin

**`templates/targeting.ts`** - For tap-to-buff/debuff other creatures:

```typescript
export function createTapToBuffOther(
  card: CardInstance,
  power: number,
  toughness: number,
  targetRestriction?: TargetRestriction,
): ActivatedAbility;

export function createTapToDebuff(
  card: CardInstance,
  power: number,
  toughness: number,
  manaCost: string,
): ActivatedAbility;
```

Cards: Infantry Veteran, Wyluli Wolf, Pradesh Gypsies

**`templates/special.ts`** - For complex patterns:

```typescript
export function createOncePerTurnWrapper(baseAbility: ActivatedAbility): ActivatedAbility;

export function createLifePaymentAbility(
  card: CardInstance,
  lifeCost: number,
  effect: AbilityEffect,
): ActivatedAbility;
```

Cards: Spitting Drake, Mischievous Poltergeist

### Type Extensions Required

Extend `AbilityCost` interface in `types.ts`:

```typescript
interface ExtendedSacrificeCost {
  type: 'self' | 'creature' | 'permanent' | 'artifact' | 'land';
  count?: number; // For "Sacrifice 2 lands"
  landType?: string; // For "Sacrifice a Swamp"
  creatureSubtype?: string; // For "Sacrifice a Goblin"
  restriction?: { notSelf?: boolean };
}
```

### Cards Requiring Custom Implementation

These cards have unique logic that can't be templated:

| Card                  | Reason                            |
| --------------------- | --------------------------------- |
| Orcish Artillery      | Damages controller as side effect |
| Abyssal Hunter        | Damage = target's power (dynamic) |
| Crimson Hellkite      | X cost (not yet supported)        |
| Kjeldoran Royal Guard | Damage redirection effect         |
| Rag Man               | Random opponent discard           |
| Harmattan Efreet      | Grants keyword to target          |
| Soldevi Sage          | Multi-step: draw 3, discard 1     |

### Revised File Structure

```
packages/engine/src/rules/abilities/
├── index.ts
├── registry.ts
├── types.ts
│
├── templates/
│   ├── index.ts
│   ├── common.ts
│   ├── mana.ts
│   ├── damage.ts
│   ├── pump.ts
│   ├── combat.ts
│   ├── sacrifice.ts
│   ├── counter.ts       # NEW
│   ├── targeting.ts     # NEW
│   └── special.ts       # NEW
│
├── auto/
│   ├── parser.ts
│   └── patterns.ts
│
└── sets/
    ├── index.ts
    └── 6ed/
        ├── index.ts
        ├── mana-creatures.ts
        ├── pingers.ts
        ├── pumpers.ts
        ├── regeneration.ts
        ├── sacrifice.ts
        ├── combat.ts
        ├── counters.ts   # NEW
        └── custom.ts     # Cards with unique logic
```

### Updated Metrics

| Metric               | Before  | After Refactor |
| -------------------- | ------- | -------------- |
| Total lines          | 2,428   | ~1,000-1,200   |
| Lines per card (avg) | 25-40   | 5-7            |
| Template coverage    | 0%      | ~80%           |
| Card addition time   | ~10 min | ~1 min         |

---

## Implementation Phases (Detailed)

### Phase 1A: Infrastructure (2-3 hours)

**Scope**: Create foundation without breaking existing code

1. Create directory structure under `src/rules/abilities/`
2. Create `types.ts` with ActivatedAbility, AbilityCost, AbilityEffect
3. Create `templates/common.ts` with standardTapCheck, sourceExistsCheck
4. Create `registry.ts` with Map and registration functions
5. Create `index.ts` that delegates to registry OR falls back to old switch

**Exit Criteria**:

- [ ] Directory structure exists
- [ ] Types compile without errors
- [ ] `getActivatedAbilities` still works (falls back to old code)
- [ ] All 624 tests pass

### Phase 1B: Core Templates (4-5 hours)

**Scope**: Implement 6 core template files

1. `templates/mana.ts` - createTapForMana, createSacForMana
2. `templates/damage.ts` - createTapForDamage, createPaidTimAbility
3. `templates/pump.ts` - createPumpSelf, createFirebreathing
4. `templates/combat.ts` - createRegenerate, createPreventDamage
5. `templates/sacrifice.ts` - createSacrificeForEffect
6. Unit tests for each template

**Exit Criteria**:

- [ ] 6 template files implemented
- [ ] Template unit tests pass
- [ ] Templates create valid ActivatedAbility objects

### Phase 1C: Card Migration (6-8 hours)

**Scope**: Migrate 60+ cards to new system

1. Create `sets/6ed/mana-creatures.ts` - migrate ~15 cards
2. Create `sets/6ed/pingers.ts` - migrate ~8 cards
3. Create `sets/6ed/pumpers.ts` - migrate ~10 cards
4. Create `sets/6ed/regeneration.ts` - migrate ~6 cards
5. Create `sets/6ed/sacrifice.ts` - migrate ~10 cards
6. Create `sets/6ed/custom.ts` - implement ~7 unique cards

**Exit Criteria**:

- [ ] 60+ cards migrated
- [ ] All 624 tests still pass
- [ ] Old switch cases removed for migrated cards

### Phase 1D: Polish & Cleanup (2-3 hours)

**Scope**: Finish migration and cleanup

1. Implement auto-parser for simple patterns
2. Delete old activatedAbilities.ts switch statement
3. Update CLAUDE.md documentation
4. Performance verification

**Exit Criteria**:

- [ ] Old file deleted or reduced to <100 lines
- [ ] Documentation updated
- [ ] No performance regression

---

_Document Version: 2.0_
_Created: Phase 1.5.4_
_Status: Reviewed and Approved_
_Last Updated: Post-codebase validation_
