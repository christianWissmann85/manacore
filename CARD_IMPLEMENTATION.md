# Card Implementation Guide

This document explains how to add and implement cards in ManaCore.

> **Card Status Tracking:** For current implementation status of all 335 6th Edition cards, see [CARD_STATUS.md](./CARD_STATUS.md).

---

## Quick Reference

| Card Type           | Implementation Effort           | Location                        |
| ------------------- | ------------------------------- | ------------------------------- |
| Vanilla creatures   | None - already works            | -                               |
| Keyword creatures   | None - already works            | -                               |
| Basic lands         | None - already works            | -                               |
| Mana dorks          | Low - use template              | `rules/abilities/sets/6ed/*.ts` |
| Burn spells         | Low - add to spell registry     | `spells/categories/damage.ts`   |
| Removal spells      | Low - add to spell registry     | `spells/categories/destruction.ts` |
| X-cost spells       | Medium - add to spell registry  | `spells/categories/xcost.ts`    |
| Tutors              | Medium - add to spell registry  | `spells/categories/tutors.ts`   |
| Card draw spells    | Low - add to spell registry     | `spells/categories/card-draw.ts`|
| Activated abilities | Low-Medium - use templates      | `rules/abilities/sets/6ed/*.ts` |
| Triggered abilities | Medium - add trigger            | `triggers.ts`                   |
| Auras               | Medium - targeting + attachment | `reducer.ts`                    |
| Counterspells       | Medium - add to spell registry  | `spells/categories/counters.ts` |
| Complex cards       | High - custom logic             | Multiple files                  |

---

## Card Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 1: Card Data (data/cards/6ed.json)                       │
│  - 335 cards from Scryfall                                      │
│  - Static data: name, cost, power/toughness, oracle_text        │
│  - All 6th Edition cards are already here                       │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 2: CardLoader (cards/CardLoader.ts)                      │
│  - Loads JSON into memory at startup                            │
│  - CardLoader.getByName("Shock") → CardTemplate                 │
│  - No changes needed to add cards                               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 3: CardInstance (state/CardInstance.ts)                  │
│  - Runtime state: tapped, damage, attachments                   │
│  - Created when card enters a zone                              │
│  - No changes needed to add cards                               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 4: Ability Implementation                                │
│  - THIS IS WHERE YOU ADD CARD-SPECIFIC LOGIC                    │
│  - Keywords: automatic via keywords[] array                     │
│  - Activated: register in rules/abilities/sets/6ed/*.ts         │
│  - Triggered: switch(name) in triggers.ts                       │
│  - Spells: switch(name) in reducer.ts                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## How to Implement a Card

### Step 1: Check if Already Working

```typescript
// In a test file
import { CardLoader } from '@manacore/engine';

const card = CardLoader.getByName('Goblin Hero');
console.log(card); // If it exists, data is loaded
console.log(card.keywords); // If empty, it's vanilla
```

### Step 2: Identify Ability Type

| Oracle Text Pattern | Ability Type | Location                        |
| ------------------- | ------------ | ------------------------------- |
| No text             | Vanilla      | No implementation needed        |
| Flying, Haste, etc. | Keyword      | Automatic                       |
| "{cost}: {effect}"  | Activated    | `rules/abilities/sets/6ed/*.ts` |
| "When/Whenever/At"  | Triggered    | `triggers.ts`                   |
| Spell effect text   | Spell        | `reducer.ts`                    |

### Step 3: Implement the Ability

The ability system uses **templates** for common patterns and a **registry** for O(1) lookup.

#### Example: Mana Dork (using template)

```typescript
// In src/rules/abilities/sets/6ed/mana-creatures.ts

import { registerAbilities, registerBulk } from '../../registry';
import { createTapForMana } from '../../templates';

// Single card registration
registerAbilities('Fyndhorn Elves', (card) => [createTapForMana(card, ['G'])]);

// Bulk registration for cards with identical abilities
registerBulk(['Llanowar Elves', 'Fyndhorn Elves', 'Elvish Mystic'], (card) => [
  createTapForMana(card, ['G']),
]);
```

#### Example: Damage Ability (using template)

```typescript
// In src/rules/abilities/sets/6ed/pingers.ts

import { registerAbilities } from '../../registry';
import { createTimAbility, createPaidTimAbility, createTapForDamage } from '../../templates';

// Simple pinger: {T}: Deal 1 damage to any target
registerAbilities('Prodigal Sorcerer', (card) => [createTimAbility(card)]);

// Paid pinger: {R}, {T}: Deal 1 damage to any target
registerAbilities('Anaba Shaman', (card) => [createPaidTimAbility(card, 1, '{R}')]);

// Conditional pinger: {T}: Deal 2 damage to attacking/blocking creature
registerAbilities('Heavy Ballista', (card) => [
  createTapForDamage(card, 2, {
    targetType: 'creature',
    targetRestrictions: [{ type: 'combat', status: 'attacking_or_blocking' }],
    name: '{T}: 2 damage to attacker/blocker',
  }),
]);
```

---

## Spell Registry System

The spell registry provides O(1) lookup for instant and sorcery implementations. This system reduced `stack.ts` from 1,760 lines to 437 lines (75% reduction) by moving 70 spell implementations to organized category files.

### Architecture

```
resolveSpell() in stack.ts
         │
         ▼
┌─────────────────────┐
│   Spell Registry    │ ◄── getSpellImplementation(cardName)
│   (O(1) Map lookup) │     Returns SpellImplementation or null
└─────────┬───────────┘
          │
          │ not found?
          ▼
┌─────────────────────┐
│  Generic Parsing    │ ◄── parseSpellEffect() for simple spells
└─────────────────────┘
```

### Category Files

| Category File    | Spell Types                         | Example Cards                           |
| ---------------- | ----------------------------------- | --------------------------------------- |
| `damage.ts`      | AoE damage, conditional damage      | Dry Spell, Tremor, Inferno, Vertigo     |
| `destruction.ts` | Mass/targeted destruction           | Wrath of God, Armageddon, Shatterstorm  |
| `counters.ts`    | Counterspells                       | Memory Lapse, Remove Soul               |
| `xcost.ts`       | X-cost spells, mana rituals         | Earthquake, Hurricane, Dark Ritual      |
| `tutors.ts`      | Library search effects              | Enlightened, Mystical, Vampiric Tutor   |
| `card-draw.ts`   | Draw/discard effects                | Inspiration, Ancestral Memories, Stupor |
| `graveyard.ts`   | Graveyard recursion                 | Raise Dead, Elven Cache, Relearn        |
| `untap.ts`       | Tap/untap effects                   | Early Harvest, Vitalize, Mana Short     |
| `prevention.ts`  | Damage prevention, life gain        | Fog, Healing Salve, Remedy              |
| `misc.ts`        | Tokens, bounce, other effects       | Boomerang, Icatian Town, Summer Bloom   |

### Implementing a New Spell

#### Step 1: Choose the Correct Category File

Find the appropriate category in `packages/engine/src/spells/categories/`:

```
spells/categories/
├── damage.ts         # Damage spells
├── destruction.ts    # Destroy effects
├── counters.ts       # Counterspells
├── xcost.ts          # X-cost spells
├── tutors.ts         # Search/tutor effects
├── card-draw.ts      # Draw/discard
├── graveyard.ts      # Graveyard recursion
├── untap.ts          # Tap/untap effects
├── prevention.ts     # Prevention/lifegain
└── misc.ts           # Everything else
```

#### Step 2: Add the Spell Implementation

```typescript
// In spells/categories/damage.ts

import type { SpellImplementation } from '../SpellImplementation';
import { registerSpells } from '../registry';
import { applyDamage, dealDamageToAll } from '../../rules/effects';

export const damageSpells: SpellImplementation[] = [
  // ... existing spells ...

  // Add your new spell:
  {
    cardName: 'Volcanic Hammer', // Must match CardTemplate.name exactly
    resolve: (state, stackObj) => {
      // Deal 3 damage to any target
      const target = stackObj.targets[0];
      if (target) {
        applyDamage(state, target, 3);
      }
    },
  },
];

// Registration happens at the bottom of the file:
registerSpells(damageSpells);
```

#### Step 3: Use Helper Functions

Import helpers from `rules/effects.ts`:

```typescript
import {
  // Destruction
  destroyPermanent,
  destroyAllCreatures,
  destroyAllLands,
  destroyAllArtifacts,
  destroyAllEnchantments,

  // Damage
  applyDamage,
  dealDamageToAll,

  // Card manipulation
  drawCards,
  discardCards,
  searchLibrary,
  returnFromGraveyard,

  // Movement
  returnToHand,

  // Life
  gainLife,
  loseLife,
  drainLife,

  // Utilities
  findPermanentByInstanceId,
} from '../../rules/effects';
```

For tokens, use `rules/tokens.ts`:

```typescript
import { createTokens, TOKEN_DEFINITIONS } from '../../rules/tokens';

// Create 4 Citizen tokens (1/1 white)
createTokens(state, stackObj.controller, 'citizen', 4);
```

### Spell Implementation Examples

#### Simple Targeted Damage

```typescript
{
  cardName: 'Lightning Bolt',
  resolve: (state, stackObj) => {
    const target = stackObj.targets[0];
    if (target) {
      applyDamage(state, target, 3);
    }
  },
}
```

#### Mass Destruction

```typescript
{
  cardName: 'Wrath of God',
  resolve: (state) => {
    destroyAllCreatures(state);
  },
}
```

#### X-Cost Spell

```typescript
{
  cardName: 'Earthquake',
  resolve: (state, stackObj) => {
    const xValue = stackObj.xValue || 0;
    if (xValue <= 0) return;

    // Damage all players
    state.players.player.life -= xValue;
    state.players.opponent.life -= xValue;

    // Damage all non-flying creatures
    dealDamageToAll(state, xValue, {
      creatures: true,
      players: false,
      excludeFlyers: true,
    });
  },
}
```

#### Counterspell

```typescript
{
  cardName: 'Memory Lapse',
  resolve: (state, stackObj) => {
    const targetId = stackObj.targets[0];
    if (!targetId) return;

    const targetStackObj = state.stack.find(s => s.id === targetId);
    if (targetStackObj) {
      targetStackObj.countered = true;
      // Put on top of library instead of graveyard
      const owner = state.players[targetStackObj.card.owner];
      owner.library.push(targetStackObj.card);
    }
  },
}
```

#### Token Creation

```typescript
{
  cardName: 'Icatian Town',
  resolve: (state, stackObj) => {
    // Create four 1/1 white Citizen creature tokens
    createTokens(state, stackObj.controller, 'citizen', 4);
  },
}
```

#### Tutor/Search

```typescript
{
  cardName: 'Worldly Tutor',
  resolve: (state, stackObj) => {
    searchLibrary(
      state,
      stackObj.controller,
      stackObj.controller,
      (card) => {
        const template = CardLoader.getById(card.scryfallId);
        return template ? isCreature(template) : false;
      },
      'library_top', // Put on top of library
      { shuffle: false }
    );
  },
}
```

### SpellImplementation Interface

```typescript
interface SpellImplementation {
  /** Card name - must match CardTemplate.name exactly */
  cardName: string;

  /** Resolve the spell's effects */
  resolve: (state: GameState, stackObj: StackObject) => void;

  /** Optional custom fizzle logic */
  shouldFizzle?: (state: GameState, stackObj: StackObject) => boolean;
}
```

The `resolve` function receives:
- `state`: The mutable GameState (modifications apply directly)
- `stackObj`: Contains `targets[]`, `xValue`, `controller`, `card`, etc.

#### Example: ETB Trigger (Gravedigger pattern)

```typescript
// In src/rules/triggers.ts

case 'Nekrataal':
  // When Nekrataal enters, destroy target nonartifact, nonblack creature
  triggers.push({
    id: `${card.instanceId}_etb_destroy`,
    type: 'ETB',
    source: card.instanceId,
    effect: {
      type: 'DESTROY',
      targetRequirements: [{
        type: 'creature',
        count: 1,
        restriction: { notColors: ['B'], notTypes: ['Artifact'] },
      }],
    },
  });
  break;
```

### Step 4: Write Tests

```typescript
// In tests/cards.test.ts

describe('Fyndhorn Elves', () => {
  test('can tap for green mana', () => {
    const elves = CardLoader.getByName('Fyndhorn Elves')!;
    const state = setupGameWithMana({ G: 1 });

    const elvesCard = createCardInstance(elves.id, 'player', 'battlefield');
    elvesCard.summoningSick = false;
    state.players.player.battlefield.push(elvesCard);

    const abilities = getActivatedAbilities(elvesCard, state);
    const manaAbility = abilities.find((a) => a.isManaAbility);

    expect(manaAbility).toBeDefined();
    expect(manaAbility.effect.manaColors).toContain('G');
  });
});
```

### Step 5: Add to Test Deck (Optional)

```typescript
// In src/utils/gameInit.ts

export function createGreenDeck(): CardTemplate[] {
  return createSimpleDeck([
    { name: 'Forest', count: 20 },
    { name: 'Fyndhorn Elves', count: 4 }, // Add new card
    // ...
  ]);
}
```

### Step 6: Run Simulation

```bash
cd packages/cli-client
bun src/index.ts simulate 100
```

---

## Ability Templates Reference

The ability system provides reusable templates for common ability patterns. Templates are located in `src/rules/abilities/templates/`.

### Mana Templates (`templates/mana.ts`)

| Template                   | Description                        | Example Cards                    |
| -------------------------- | ---------------------------------- | -------------------------------- |
| `createTapForMana`         | Tap to add mana of specified color | Llanowar Elves, Forest           |
| `createTapForSingleMana`   | Tap to add one mana of a color     | Birds of Paradise (any color)    |
| `createTapForAnyColor`     | Tap to add any color mana          | Birds of Paradise                |
| `createTapForMultipleMana` | Tap to add multiple mana           | Fyndhorn Elder ({G}{G})          |
| `createSacrificeForMana`   | Sacrifice self to add mana         | Blood Pet                        |
| `createTapForColorless`    | Tap to add colorless mana          | Sol Ring                         |
| `createPainLandAbilities`  | Pain land dual mana                | City of Brass, Sulfurous Springs |
| `createCityOfBrassAbility` | Tap for any color + damage         | City of Brass                    |

### Damage Templates (`templates/damage.ts`)

| Template                      | Description                       | Example Cards     |
| ----------------------------- | --------------------------------- | ----------------- |
| `createTapForDamage`          | Tap to deal damage                | Any pinger        |
| `createTimAbility`            | {T}: 1 damage to any target       | Prodigal Sorcerer |
| `createPaidTimAbility`        | {mana}, {T}: damage to any target | Anaba Shaman      |
| `createScalableDamageAbility` | X damage ability                  | Crimson Hellkite  |
| `createDamageWithSelfDamage`  | Damage target + damage self       | Orcish Artillery  |

### Pump Templates (`templates/pump.ts`)

| Template               | Description                    | Example Cards    |
| ---------------------- | ------------------------------ | ---------------- |
| `createPumpSelf`       | Pay mana for +X/+Y until EOT   | Frozen Shade     |
| `createFirebreathing`  | {R}: +1/+0 until EOT           | Shivan Dragon    |
| `createShadeAbility`   | {B}: +1/+1 until EOT           | Frozen Shade     |
| `createTapToBuffOther` | Tap to buff another creature   | Infantry Veteran |
| `createTapToDebuff`    | Tap to debuff another creature | Pradesh Gypsies  |

### Combat Templates (`templates/combat.ts`)

| Template                        | Description                  | Example Cards           |
| ------------------------------- | ---------------------------- | ----------------------- |
| `createRegenerate`              | Pay mana to regenerate       | Drudge Skeletons        |
| `createLifeRegenerate`          | Pay life to regenerate       | Mischievous Poltergeist |
| `createLandSacrificeRegenerate` | Sacrifice land to regenerate | Uthden Troll            |
| `createTapToPrevent`            | Tap to prevent damage        | Samite Healer           |
| `createLifeToPrevent`           | Pay life to prevent damage   | -                       |
| `createSacrificeToPrevent`      | Sacrifice to prevent damage  | -                       |

### Sacrifice Templates (`templates/sacrifice.ts`)

| Template                           | Description                  | Example Cards      |
| ---------------------------------- | ---------------------------- | ------------------ |
| `createSacrificeForPump`           | Sacrifice creature for +X/+X | Fallen Angel       |
| `createSacrificeToDestroy`         | Sacrifice to destroy target  | Attrition          |
| `createSacrificeToCounter`         | Sacrifice to counter spell   | Stromgald Cabal    |
| `createSacrificeCreatureForDamage` | Sac creature to deal damage  | Goblin Bombardment |
| `createSacrificeCreatureForDraw`   | Sac creature to draw cards   | -                  |
| `createSacrificeLandForBuff`       | Sacrifice land for buff      | Blighted Shaman    |

### Custom Abilities

For cards with unique abilities, create a custom ability directly:

```typescript
// In src/rules/abilities/sets/6ed/utility.ts

import { registerAbilities } from '../../registry';
import type { ActivatedAbility } from '../../types';
import { standardTapCheck, countAvailableMana } from '../../templates';

registerAbilities('Royal Assassin', (card) => {
  const ability: ActivatedAbility = {
    id: `${card.instanceId}_assassinate`,
    name: '{T}: Destroy target tapped creature',
    cost: { tap: true },
    effect: { type: 'DESTROY' },
    isManaAbility: false,
    targetRequirements: [
      {
        id: 'target_0',
        count: 1,
        targetType: 'creature',
        zone: 'battlefield',
        restrictions: [{ type: 'status', status: 'tapped' }],
        optional: false,
        description: 'target tapped creature',
      },
    ],
    canActivate: (state, sourceId, controller) => {
      return standardTapCheck(state, sourceId, controller);
    },
  };
  return [ability];
});
```

### Set File Organization

Cards are organized by category in `src/rules/abilities/sets/6ed/`:

| File                | Card Types                              | ~Count |
| ------------------- | --------------------------------------- | ------ |
| `lands.ts`          | Pain lands, City of Brass, Crystal Vein | 8      |
| `mana-creatures.ts` | Llanowar Elves, Birds of Paradise       | 6      |
| `pingers.ts`        | Prodigal Sorcerer, Anaba Shaman         | 8      |
| `pumpers.ts`        | Flame Spirit, Dragon Engine             | 6      |
| `regeneration.ts`   | Drudge Skeletons, River Boa             | 10     |
| `sacrifice.ts`      | Fallen Angel, Skull Catapult            | 8      |
| `utility.ts`        | Samite Healer, Royal Assassin           | 15+    |

Each file exports a count constant (e.g., `PINGERS_COUNT`) for debugging.

---

## Keyword Reference

These keywords work automatically (no implementation needed):

| Keyword       | Effect                              | Status             |
| ------------- | ----------------------------------- | ------------------ |
| Flying        | Can only be blocked by flyers/reach | ✅                 |
| First Strike  | Deals damage first                  | ✅                 |
| Double Strike | Deals damage twice                  | ✅                 |
| Trample       | Excess damage to player             | ✅                 |
| Vigilance     | Doesn't tap to attack               | ✅                 |
| Reach         | Can block flyers                    | ✅                 |
| Haste         | No summoning sickness               | ✅                 |
| Hexproof      | Can't be targeted by opponents      | ✅                 |
| Shroud        | Can't be targeted                   | ✅                 |
| Protection    | Can't be targeted/blocked/damaged   | ⚠️ Partial         |
| Regenerate    | Prevent destruction                 | ❌ Not implemented |
| Banding       | Complex blocking                    | ❌ Not implemented |

---

## File Reference

| File                             | Purpose                            |
| -------------------------------- | ---------------------------------- |
| `data/cards/6ed.json`            | Card data from Scryfall            |
| `cards/CardLoader.ts`            | Loads and indexes cards            |
| `cards/CardTemplate.ts`          | Type definitions, keyword helpers  |
| `state/CardInstance.ts`          | Runtime card state                 |
| **Spell Registry**               |                                    |
| `spells/index.ts`                | Spell registry entry point         |
| `spells/registry.ts`             | O(1) spell lookup Map              |
| `spells/SpellImplementation.ts`  | SpellImplementation interface      |
| `spells/categories/*.ts`         | Spell implementations by type      |
| **Ability Registry**             |                                    |
| `rules/abilities/index.ts`       | Main entry for activated abilities |
| `rules/abilities/registry.ts`    | Card ability registration          |
| `rules/abilities/types.ts`       | Ability type definitions           |
| `rules/abilities/templates/*.ts` | Reusable ability templates         |
| `rules/abilities/sets/6ed/*.ts`  | 6th Edition card abilities         |
| **Helper Modules**               |                                    |
| `rules/effects.ts`               | Reusable spell/ability effects     |
| `rules/tokens.ts`                | Token creation helpers             |
| `rules/triggers.ts`              | "When/Whenever" abilities          |
| `rules/stack.ts`                 | Stack system, spell resolution     |
| `rules/combat.ts`                | Combat damage, keywords            |
| `rules/stateBasedActions.ts`     | Death, player loss checks          |
| **Legacy/Other**                 |                                    |
| `rules/activatedAbilities.ts`    | Legacy abilities (fallback)        |
| `actions/reducer.ts`             | Action application                 |
| `actions/validators.ts`          | Action legality checks             |
| `utils/gameInit.ts`              | Test deck creation                 |

---

## Contributing a Card

1. **Pick a card** from [CARD_STATUS.md](./CARD_STATUS.md)
2. **Identify the ability type** (spell, activated, triggered)
3. **Find a similar implemented card** as a pattern

4. **For instant/sorcery spells:**
   - Choose the appropriate category file in `spells/categories/`
   - Add a `SpellImplementation` object to the array
   - Use helpers from `rules/effects.ts` and `rules/tokens.ts`
   - The spell auto-registers via `registerSpells()` at file bottom

5. **For activated abilities:**
   - Check if a template exists in `rules/abilities/templates/`
   - Add registration to appropriate file in `rules/abilities/sets/6ed/`
   - Update the count constant in the file

6. **For triggered abilities:**
   - Add a case in `rules/triggers.ts`

7. **Write tests** for the card's behavior
8. **Run simulations** to verify stability
9. **Update CARD_STATUS.md** to mark the card as implemented

---

## New Test Organization

```python
  tests/
  ├── cards/                      # Card mechanic tests
  │   ├── helpers.ts              # Shared test utilities
  │   ├── data-loading.test.ts    # CardLoader functionality
  │   ├── vanilla-creatures.test.ts
  │   ├── keywords.test.ts        # Flying, First Strike, Vigilance
  │   ├── mana-abilities.test.ts  # Lands, mana dorks
  │   ├── damage-effects.test.ts  # Burn spells, ping abilities
  │   ├── removal.test.ts         # Destroy, exile, bounce, discard
  │   ├── combat-tricks.test.ts   # Giant Growth, pump spells
  │   ├── auras.test.ts           # Pacifism
  │   └── triggers.test.ts        # ETB, damage triggers, counterspells
  ├── expansions/                 # Expansion data validation
  │   └── 6ed.test.ts             # 6th Edition cards
  ├── combat.test.ts              # Combat system
  ├── decks.test.ts               # Test deck validation
  ├── engine.test.ts              # Core engine
  ├── mana.test.ts                # Mana system
  └── targeting.test.ts           # Targeting system
```

- Benefits

  | Before                             | After                       |
  | ---------------------------------- | --------------------------- |
  | 1 monolithic file (1000+ lines)    | 10 focused files            |
  | Named after milestone ("week11")   | Named after functionality   |
  | Hard to find related tests         | Easy to locate by mechanic  |
  | Adding expansion = modify existing | Adding expansion = new file |

- Adding New Content
  - New mechanic: Add to appropriate cards/\*.test.ts file
  - New expansion: Create expansions/m10.test.ts (or similar)
  - New card: Find the matching mechanic file and add tests

---

## Resources

- [Comprehensive Rules](https://magic.wizards.com/en/rules)
- [Scryfall API](https://scryfall.com/docs/api)
- [6th Edition Card List](https://scryfall.com/sets/6ed)
