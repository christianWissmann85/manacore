# Stack.ts Refactor Plan

**Date:** January 4, 2026  
**Status:** Planning Phase  
**Goal:** Reduce stack.ts from 1,760 lines to ~300-400 lines by extracting card-specific logic

---

## Problem Statement

### Current Issues

1. **Size**: 1,760 lines and growing exponentially
2. **Giant switch statement**: `applySpecificCardEffect()` contains **78 case statements** for individual cards
3. **Poor scalability**: Each new card requires editing this monolithic file
4. **Mixed responsibilities**: 
   - Stack management logic (LIFO, priority, fizzling)
   - Generic spell effect parsing
   - Card-specific implementations (78+ cards)
   - Helper functions for various effect types

### Impact

- **Maintenance burden**: Hard to find and modify card implementations
- **Merge conflicts**: Multiple developers editing same massive file
- **Testing complexity**: Changes to one card can affect others
- **Onboarding friction**: New contributors overwhelmed by file size

---

## Solution: Registry-Based Spell System

### Inspiration

We've already successfully used this pattern in:
- ✅ `activatedAbilities.ts` → `abilities/` registry (O(1) lookup)
- ✅ Mass destruction effects → `effects.ts` reusable functions
- ✅ Ability templates → `abilities/templates/` folder

### Core Concept

**Separate "what cards do" from "how the stack works"**

```
Stack Mechanics (stack.ts)    Card Implementations (spells/)
        ↓                              ↓
   Push to stack              Shock deals 2 damage
   Resolve LIFO          →    Lightning Bolt deals 3
   Check fizzle               Earthquake does X to all
   Pass priority              Memory Lapse counters + library
```

---

## Proposed Architecture

### New Directory Structure

```
packages/engine/src/
├── rules/
│   ├── stack.ts                    # 300-400 lines (core logic only)
│   └── effects.ts                  # Existing - reusable helpers
└── spells/                         # NEW - Card registry system
    ├── index.ts                    # Registry + lookup (50 lines)
    ├── SpellImplementation.ts      # Type definitions (30 lines)
    └── categories/                 # Organized by effect type
        ├── damage.ts               # Shock, Lightning Bolt, Pyrotechnics (~100 lines)
        ├── destruction.ts          # Wrath, Armageddon, Shatter (~150 lines)
        ├── counters.ts             # Memory Lapse, Remove Soul (~80 lines)
        ├── card-draw.ts            # Inspiration, Ancestral Memories (~100 lines)
        ├── tutors.ts               # Enlightened/Mystical/Vampiric Tutor (~120 lines)
        ├── graveyard.ts            # Raise Dead, Ashen Powder, Relearn (~100 lines)
        ├── untap.ts                # Early Harvest, Vitalize, Mana Short (~80 lines)
        ├── prevention.ts           # Fog, Healing Salve, Remedy (~80 lines)
        ├── xcost.ts                # Earthquake, Hurricane, Power Sink (~150 lines)
        └── misc.ts                 # Tariff, Summer Bloom, tokens (~150 lines)
```

**Total Lines**: ~1,340 lines spread across 12 files (avg 110 lines each)  
**vs Current**: 1,760 lines in 1 file

---

## Implementation Details

### Phase 1: Create Registry Infrastructure

#### 1.1 Type Definitions

**File**: `spells/SpellImplementation.ts`

```typescript
import type { GameState } from '../state/GameState';
import type { StackObject } from '../rules/stack';

/**
 * Spell implementation for a specific card
 */
export interface SpellImplementation {
  /** Card name (must match CardTemplate.name exactly) */
  cardName: string;
  
  /** 
   * Resolve the spell's effects
   * @param state - Current game state (mutable)
   * @param stackObj - The stack object being resolved
   */
  resolve: (state: GameState, stackObj: StackObject) => void;
  
  /**
   * Optional: Custom fizzle logic
   * If omitted, uses default targeting-based fizzle check
   */
  shouldFizzle?: (state: GameState, stackObj: StackObject) => boolean;
}

/**
 * Spell category for organization
 */
export interface SpellCategory {
  name: string;
  description: string;
  spells: SpellImplementation[];
}
```

#### 1.2 Registry Implementation

**File**: `spells/index.ts`

```typescript
import type { SpellImplementation } from './SpellImplementation';

// Import all categories
import { damageSpells } from './categories/damage';
import { destructionSpells } from './categories/destruction';
import { counterSpells } from './categories/counters';
import { cardDrawSpells } from './categories/card-draw';
import { tutorSpells } from './categories/tutors';
import { graveyardSpells } from './categories/graveyard';
import { untapSpells } from './categories/untap';
import { preventionSpells } from './categories/prevention';
import { xcostSpells } from './categories/xcost';
import { miscSpells } from './categories/misc';

/**
 * Global spell registry - O(1) lookup by card name
 */
const registry = new Map<string, SpellImplementation>();

/**
 * Register all spell implementations
 */
function initializeRegistry() {
  const allSpells = [
    ...damageSpells,
    ...destructionSpells,
    ...counterSpells,
    ...cardDrawSpells,
    ...tutorSpells,
    ...graveyardSpells,
    ...untapSpells,
    ...preventionSpells,
    ...xcostSpells,
    ...miscSpells,
  ];

  for (const spell of allSpells) {
    if (registry.has(spell.cardName)) {
      console.warn(`Duplicate spell registration: ${spell.cardName}`);
    }
    registry.set(spell.cardName, spell);
  }
}

// Initialize on module load
initializeRegistry();

/**
 * Get spell implementation by card name
 * Returns null if card not in registry (will use generic parsing)
 */
export function getSpellImplementation(cardName: string): SpellImplementation | null {
  return registry.get(cardName) ?? null;
}

/**
 * Check if a card has a custom implementation
 */
export function hasCustomImplementation(cardName: string): boolean {
  return registry.has(cardName);
}

/**
 * Get all registered spell names (for testing/debugging)
 */
export function getAllRegisteredSpells(): string[] {
  return Array.from(registry.keys()).sort();
}
```

### Phase 2: Simplify stack.ts

#### Key Changes

1. **Remove `applySpecificCardEffect()` entirely** (78 cases → 0 cases)
2. **Import spell registry** for O(1) lookup
3. **Delegate to registry** with fallback to generic parsing
4. **Keep only core stack mechanics**

#### Modified `resolveSpell()` Function

```typescript
// In stack.ts
import { getSpellImplementation } from '../spells';

function resolveSpell(state: GameState, stackObj: StackObject): void {
  const controller = getPlayer(state, stackObj.controller);
  const card = stackObj.card;
  const template = CardLoader.getById(card.scryfallId);

  if (!template) return;

  // Phase 1: Basic spell resolution
  if (isInstant(template) || isSorcery(template)) {
    // Try registry first (O(1) lookup)
    const spellImpl = getSpellImplementation(template.name);
    
    if (spellImpl) {
      // Custom implementation exists - use it
      spellImpl.resolve(state, stackObj);
    } else {
      // No custom impl - use generic parsing
      applyGenericSpellEffect(state, stackObj);
    }

    // Instants and sorceries go to graveyard
    card.zone = 'graveyard';
    controller.graveyard.push(card);
  } else if (isAura(template)) {
    // ... existing aura logic
  } else {
    // ... existing permanent logic
  }
}

/**
 * Generic spell effect parsing (renamed from applySpellEffects)
 * Used as fallback for cards not in registry
 */
function applyGenericSpellEffect(state: GameState, stackObj: StackObject): void {
  const template = CardLoader.getById(stackObj.card.scryfallId);
  if (!template) return;

  const oracleText = template.oracle_text || '';
  const effect = parseSpellEffect(oracleText);

  if (!effect) {
    // No recognized effect - spell does nothing
    // (This is better than silently failing)
    console.warn(`Unknown spell effect: ${template.name}`);
    return;
  }

  // Apply the parsed effect to targets
  // ... existing generic effect logic
}
```

### Phase 3: Category Implementation Examples

#### Example: damage.ts

```typescript
// spells/categories/damage.ts
import type { SpellImplementation } from '../SpellImplementation';
import type { GameState } from '../../state/GameState';
import type { StackObject } from '../../rules/stack';
import { dealDamage } from '../../rules/effects';

/**
 * Simple targeted damage spells
 */
export const damageSpells: SpellImplementation[] = [
  {
    cardName: 'Shock',
    resolve: (state, stackObj) => {
      const target = stackObj.targets[0];
      if (target) dealDamage(state, target, 2);
    },
  },
  {
    cardName: 'Lightning Bolt',
    resolve: (state, stackObj) => {
      const target = stackObj.targets[0];
      if (target) dealDamage(state, target, 3);
    },
  },
  {
    cardName: 'Incinerate',
    resolve: (state, stackObj) => {
      const target = stackObj.targets[0];
      if (target) {
        dealDamage(state, target, 3);
        // TODO: Add "can't regenerate" flag
      }
    },
  },
  {
    cardName: 'Pyrotechnics',
    resolve: (state, stackObj) => {
      // 4 damage divided among any number of targets
      const targets = stackObj.targets;
      if (targets.length === 0) return;
      
      const damagePerTarget = Math.floor(4 / targets.length);
      const remainder = 4 % targets.length;
      
      for (let i = 0; i < targets.length; i++) {
        const damage = damagePerTarget + (i === 0 ? remainder : 0);
        dealDamage(state, targets[i]!, damage);
      }
    },
  },
  {
    cardName: 'Vertigo',
    resolve: (state, stackObj) => {
      const target = stackObj.targets[0];
      if (target) {
        dealDamage(state, target, 2);
        // Target can't be regenerated (already handled by damage system)
      }
    },
  },
];
```

#### Example: xcost.ts

```typescript
// spells/categories/xcost.ts
import type { SpellImplementation } from '../SpellImplementation';
import { isCreature } from '../../cards/CardTemplate';
import { CardLoader } from '../../cards/CardLoader';
import { hasKeyword } from '../../cards/CardTemplate';

export const xcostSpells: SpellImplementation[] = [
  {
    cardName: 'Earthquake',
    resolve: (state, stackObj) => {
      const xDamage = stackObj.xValue || 0;
      if (xDamage <= 0) return;

      // Damage all players
      state.players.player.life -= xDamage;
      state.players.opponent.life -= xDamage;

      // Check for game over
      if (state.players.player.life <= 0 && state.players.opponent.life <= 0) {
        state.gameOver = true;
        state.winner = null; // Draw
      } else if (state.players.player.life <= 0) {
        state.gameOver = true;
        state.winner = 'opponent';
      } else if (state.players.opponent.life <= 0) {
        state.gameOver = true;
        state.winner = 'player';
      }

      // Damage all non-flying creatures
      for (const playerId of ['player', 'opponent'] as const) {
        const player = state.players[playerId];
        const toRemove: CardInstance[] = [];

        for (const creature of player.battlefield) {
          const template = CardLoader.getById(creature.scryfallId);
          if (!template || !isCreature(template)) continue;
          
          const hasFlying = hasKeyword(template, 'Flying');
          if (!hasFlying) {
            creature.damage += xDamage;
            if (creature.damage >= getEffectiveToughness(creature)) {
              toRemove.push(creature);
            }
          }
        }

        // Remove dead creatures
        for (const creature of toRemove) {
          const index = player.battlefield.indexOf(creature);
          if (index !== -1) {
            player.battlefield.splice(index, 1);
            creature.zone = 'graveyard';
            creature.damage = 0;
            player.graveyard.push(creature);
          }
        }
      }
    },
  },
  {
    cardName: 'Hurricane',
    resolve: (state, stackObj) => {
      // Similar to Earthquake but damages flying creatures
      // ... implementation
    },
  },
  {
    cardName: 'Howl from Beyond',
    resolve: (state, stackObj) => {
      const xValue = stackObj.xValue || 0;
      const target = stackObj.targets[0];
      if (!target || xValue <= 0) return;

      const creature = findPermanentByInstanceId(state, target);
      if (creature) {
        addTemporaryModification(creature, {
          powerModifier: xValue,
          toughnessModifier: 0,
          duration: 'end_of_turn',
        });
      }
    },
  },
];
```

---

## Migration Strategy

### 3-Phase Rollout (Low Risk)

#### Phase 1: Infrastructure (Week 1)
- ✅ Create `spells/` directory structure
- ✅ Implement registry system
- ✅ Add type definitions
- ✅ Write unit tests for registry

**Risk**: None - no existing code changes

#### Phase 2: Proof of Concept (Week 1-2)
- ✅ Migrate **X-cost spells** (most complex)
  - Earthquake, Hurricane, Howl from Beyond
  - Power Sink, Spell Blast, Recall
- ✅ Migrate **counter spells** (special stack logic)
  - Memory Lapse, Remove Soul
- ✅ Test both migrated and non-migrated cards
- ✅ Validate no regressions

**Success Criteria**: 10 cards migrated, all tests passing

#### Phase 3: Full Migration (Week 2-4)
- ✅ Migrate by category:
  1. Destruction spells (Wrath, Armageddon) - 20 cards
  2. Damage spells (Shock, Lightning Bolt) - 8 cards
  3. Tutors (Enlightened, Mystical) - 6 cards
  4. Card draw/discard - 10 cards
  5. Graveyard recursion - 8 cards
  6. Untap effects - 5 cards
  7. Prevention - 5 cards
  8. Misc effects - 16 cards
- ✅ Remove `applySpecificCardEffect()` switch statement
- ✅ Update documentation

**Success Criteria**: All 78 cards migrated, stack.ts < 500 lines

---

## Benefits

### Developer Experience
- ✅ **Easy to find**: Card implementations grouped by effect type
- ✅ **Easy to add**: Create new spell in appropriate category file
- ✅ **Easy to test**: Test individual categories in isolation
- ✅ **Fewer conflicts**: Multiple devs work on different categories

### Code Quality
- ✅ **Separation of concerns**: Stack logic ≠ card logic
- ✅ **Type safety**: Strong typing with SpellImplementation interface
- ✅ **Maintainability**: Small files (50-150 lines) vs giant file (1,760 lines)
- ✅ **Extensibility**: Add new categories without touching core

### Performance
- ✅ **O(1) lookup**: Registry uses Map for instant card lookup
- ✅ **Tree shaking**: Bundlers can optimize unused categories
- ✅ **No regression**: Fallback to generic parsing preserves existing behavior

---

## Comparison: Before & After

### Before (Current)
```typescript
// stack.ts - 1,760 lines
function applySpecificCardEffect(state, stackObj, cardName) {
  const xValue = stackObj.xValue || 0;

  switch (cardName) {
    case 'Dark Ritual':
      // 3 lines of code
      break;

    case 'Earthquake':
      // 45 lines of code
      break;

    case 'Hurricane':
      // 45 lines of code
      break;

    case 'Howl from Beyond':
      // 12 lines of code
      break;

    // ... 74 more cases (1,200+ lines)

    default:
      break;
  }
}
```

**Problems:**
- All cards in one function
- Hard to navigate
- Merge conflict nightmare
- Can't test individual cards

### After (Proposed)
```typescript
// stack.ts - 350 lines
import { getSpellImplementation } from '../spells';

function resolveSpell(state, stackObj) {
  // ... type checks
  
  const impl = getSpellImplementation(template.name);
  impl?.resolve(state, stackObj) ?? applyGenericEffect(state, stackObj);
  
  // ... cleanup
}
```

```typescript
// spells/categories/xcost.ts - 150 lines
export const xcostSpells: SpellImplementation[] = [
  {
    cardName: 'Earthquake',
    resolve: (state, stackObj) => {
      // 45 lines of focused code
    },
  },
  {
    cardName: 'Hurricane',
    resolve: (state, stackObj) => {
      // 45 lines of focused code
    },
  },
];
```

**Benefits:**
- Clean separation
- Easy to find Earthquake: `spells/categories/xcost.ts`
- Can test just X-cost spells
- Multiple devs work on different categories

---

## Testing Strategy

### Unit Tests
```typescript
// spells/__tests__/xcost.test.ts
describe('X-cost spells', () => {
  it('Earthquake damages non-flying creatures', () => {
    const state = createTestState();
    // ... test logic
  });

  it('Hurricane damages flying creatures', () => {
    const state = createTestState();
    // ... test logic
  });
});
```

### Integration Tests
```typescript
// Ensure registry integration works
describe('Spell registry', () => {
  it('resolves registered spells', () => {
    const impl = getSpellImplementation('Earthquake');
    expect(impl).toBeDefined();
  });

  it('falls back to generic parsing for unregistered spells', () => {
    // Test that new/unknown spells still work
  });
});
```

### Migration Tests
```typescript
// Ensure no regressions during migration
describe('Migration parity', () => {
  it('Earthquake behavior unchanged', () => {
    // Compare old vs new implementation
  });
});
```

---

## Future Enhancements

### Short Term
1. **Helper factories**: `createSimpleDamageSpell(name, amount)`
2. **Validation**: Ensure all registered cards exist in CardLoader
3. **Documentation**: Auto-generate spell catalog from registry

### Long Term
1. **Dynamic loading**: Load spell categories on-demand
2. **Mod support**: Allow external spell definitions
3. **Visual editor**: GUI for creating spell implementations
4. **AI assistance**: Generate implementations from oracle text

---

## Questions & Decisions

### Open Questions
- [ ] Should we keep `parseSpellEffect()` for simple cards?
  - **Pro**: Automatic handling of common patterns
  - **Con**: Magic behavior can be confusing
  - **Decision**: TBD

- [ ] Migration order: Most complex first or easiest first?
  - **Option A**: X-cost (hardest) → validates system works for complex cases
  - **Option B**: Simple damage → quick wins, build confidence
  - **Decision**: TBD

- [ ] Should helpers like `applyDamage()` stay in stack.ts or move to effects.ts?
  - **Current**: Some in stack.ts, some in effects.ts
  - **Proposal**: All reusable helpers in effects.ts
  - **Decision**: TBD

### Agreed Decisions
- ✅ Use registry pattern (same as activated abilities)
- ✅ Organize by effect category (not alphabetically)
- ✅ Keep generic parsing as fallback
- ✅ Migrate in phases (not all at once)

---

## Success Metrics

### Quantitative
- Stack.ts size: 1,760 lines → < 500 lines (71% reduction)
- Number of files: 1 → 12 (more maintainable)
- Average file size: 1,760 lines → 110 lines (94% reduction)
- Card registration: O(n) switch → O(1) Map lookup

### Qualitative
- Easier to find card implementations ✅
- Faster onboarding for new contributors ✅
- Fewer merge conflicts ✅
- Better test coverage per category ✅

---

## References

- **Activated Abilities Refactor**: `packages/engine/src/rules/abilities/`
- **Effects Library**: `packages/engine/src/rules/effects.ts`
- **Card Implementation Guide**: `CARD_IMPLEMENTATION.md`
- **Architecture Documentation**: `ARCHITECTURE.md`

---

## Timeline

| Week | Phase | Deliverables |
|------|-------|--------------|
| 1 | Infrastructure | Registry system, types, tests |
| 1-2 | Proof of Concept | 10 cards migrated, validation |
| 2-3 | Category Migration | Destruction, damage, tutors, etc. |
| 3-4 | Cleanup | Remove old code, documentation |

**Estimated Completion**: End of Week 4

---

## Appendix: Full Card List to Migrate

### X-Cost Spells (8 cards)
- Earthquake, Hurricane, Howl from Beyond
- Mind Warp, Prosperity
- Power Sink, Spell Blast, Recall

### Counter Spells (2 cards)
- Memory Lapse, Remove Soul

### Destruction (20 cards)
- Wrath of God, Armageddon, Shatterstorm, Tranquility
- Perish, Flashfires, Boil, Jokulhaups
- Shatter, Stone Rain, Pillage, Creeping Mold
- Fatal Blow, Reprisal
- + 6 more

### Damage (8 cards)
- Shock, Lightning Bolt, Incinerate
- Dry Spell, Tremor, Inferno, Vertigo
- Spitting Earth, Pyrotechnics

### Tutors (6 cards)
- Enlightened Tutor, Mystical Tutor
- Vampiric Tutor, Worldly Tutor
- Rampant Growth, Untamed Wilds

### Card Draw/Discard (10 cards)
- Inspiration, Ancestral Memories, Dream Cache
- Agonizing Memories, Forget, Painful Memories
- Stupor, Infernal Contract
- + 2 more

### Graveyard Recursion (8 cards)
- Raise Dead, Elven Cache, Relearn
- Nature's Resurgence, Hammer of Bogardan
- Ashen Powder
- + 2 more

### Untap/Tap (5 cards)
- Early Harvest, Vitalize, Mana Short
- Warrior's Honor, Tidal Surge

### Prevention (5 cards)
- Fog, Healing Salve, Remedy
- Reverse Damage
- + 1 more

### Misc (16 cards)
- Dark Ritual, Syphon Soul, Tariff
- Library of Lat-Nam, Summer Bloom
- Relentless Assault, Icatian Town
- Waiting in the Weeds
- + 8 more

**Total**: 78 cards
