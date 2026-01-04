# Card Implementation Guide

This document explains how to add and implement cards in ManaCore.

## Quick Reference

| Card Type | Implementation Effort | Location |
|-----------|----------------------|----------|
| Vanilla creatures | None - already works | - |
| Keyword creatures | None - already works | - |
| Basic lands | None - already works | - |
| Mana dorks | Low - add mana ability | `activatedAbilities.ts` |
| Burn spells | Low - add damage effect | `reducer.ts` |
| Removal spells | Low - add destroy effect | `reducer.ts` |
| Activated abilities | Medium - add ability | `activatedAbilities.ts` |
| Triggered abilities | Medium - add trigger | `triggers.ts` |
| Auras | Medium - targeting + attachment | `reducer.ts` |
| Counterspells | High - stack interaction | `stack.ts` |
| Complex cards | High - custom logic | Multiple files |

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
│  LAYER 4: Ability Implementation (rules/*.ts)                   │
│  - THIS IS WHERE YOU ADD CARD-SPECIFIC LOGIC                    │
│  - Keywords: automatic via keywords[] array                     │
│  - Activated: switch(name) in activatedAbilities.ts            │
│  - Triggered: switch(name) in triggers.ts                       │
│  - Spells: switch(name) in reducer.ts                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6th Edition Card Status

### Summary (335 total cards)

| Category | Count | Status |
|----------|-------|--------|
| Vanilla creatures | 16 | ✅ Working |
| Keyword-only creatures | 48 | ✅ Working |
| Basic lands | 5 | ✅ Working |
| Other lands | 12 | ⚠️ Need mana abilities |
| Creatures with abilities | 66 | ⚠️ Need implementation |
| Instants | 38 | ⚠️ Need spell effects |
| Sorceries | 53 | ⚠️ Need spell effects |
| Enchantments | 56 | ⚠️ Need effects |
| Artifacts | 48 | ⚠️ Need abilities |

### Already Working (No Implementation Needed)

These cards work out of the box:

**Vanilla Creatures (16):**
- Balduvian Barbarians (3/2)
- Fire Elemental (5/4)
- Goblin Hero (2/2)
- Grizzly Bears (2/2)
- Horned Turtle (1/4)
- And 11 more...

**Keyword-Only Creatures (48):**
- Air Elemental (4/4 Flying)
- Archangel (5/5 Flying, Vigilance)
- Fog Elemental (4/4 Flying)
- Hurloon Minotaur (2/3)
- And 44 more...

**Basic Lands (5):**
- Plains, Island, Swamp, Mountain, Forest

### Implemented Cards (20)

These cards have full ability implementations:

| Card | Type | Abilities |
|------|------|-----------|
| Llanowar Elves | Creature | {T}: Add {G} |
| Birds of Paradise | Creature | {T}: Add any color |
| Anaba Shaman | Creature | {R}, {T}: 1 damage |
| Shock | Instant | 2 damage to any target |
| Lightning Blast | Instant | 4 damage to any target |
| Terror | Instant | Destroy creature |
| Unsummon | Instant | Return creature to hand |
| Counterspell | Instant | Counter spell |
| Giant Growth | Instant | +3/+3 until EOT |
| Disenchant | Instant | Destroy artifact/enchantment |
| Exile | Instant | Exile attacking creature |
| Coercion | Sorcery | Target discard |
| Pacifism | Aura | Can't attack or block |
| Gravedigger | Creature | ETB: Return creature from graveyard |
| Abyssal Specter | Creature | Damage trigger: discard |

### Cards Needing Implementation

#### Priority 1: Simple Effects (Easy)

**Burn Spells:**
- Blaze ({X}{R}: X damage)
- Fireball ({X}{R}: X damage, splits)
- Incinerate (3 damage, no regen)

**Removal:**
- Dark Banishing (Destroy nonblack)
- Nekrataal (ETB: destroy)
- Wrath of God (Destroy all creatures)

**Creature Buffs:**
- Unholy Strength (+2/+1 aura)
- Holy Strength (+1/+2 aura)

#### Priority 2: Mana Dorks (Medium)

These need mana ability implementations:

- Quirion Elves ({T}: Add {G} or chosen color)
- Manakin ({T}: Add {C})
- Charcoal Diamond ({T}: Add {B})
- Fire Diamond ({T}: Add {R})
- Marble Diamond ({T}: Add {W})
- Moss Diamond ({T}: Add {G})
- Sky Diamond ({T}: Add {U})
- Sol Ring ({T}: Add {C}{C})

#### Priority 3: Activated Abilities (Medium)

- Prodigal Sorcerer ({T}: 1 damage)
- Royal Assassin ({T}: Destroy tapped creature)
- Hypnotic Specter (damage → random discard)
- Nettling Imp ({T}: Force attack)
- Icy Manipulator ({1}, {T}: Tap permanent)

#### Priority 4: Triggered Abilities (Medium-Hard)

- Nekrataal (ETB: destroy nonblack)
- Man-o'-War (ETB: bounce creature)
- Uktabi Orangutan (ETB: destroy artifact)
- Vampire Bats (Upkeep: pay or sacrifice)
- Ball Lightning (EOT: sacrifice)

#### Priority 5: Complex Cards (Hard)

- Control Magic (Steal creature)
- Animate Dead (Return from graveyard)
- Nevinyrral's Disk (Destroy all)
- Howling Mine (All players draw)
- Winter Orb (Lands don't untap)

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

| Oracle Text Pattern | Ability Type | Location |
|---------------------|--------------|----------|
| No text | Vanilla | No implementation needed |
| Flying, Haste, etc. | Keyword | Automatic |
| "{cost}: {effect}" | Activated | `activatedAbilities.ts` |
| "When/Whenever/At" | Triggered | `triggers.ts` |
| Spell effect text | Spell | `reducer.ts` |

### Step 3: Implement the Ability

#### Example: Mana Dork (Elvish Mystic pattern)

```typescript
// In src/rules/activatedAbilities.ts

case 'Fyndhorn Elves':  // {T}: Add {G}
  abilities.push({
    id: `${card.instanceId}_tap_mana`,
    name: '{T}: Add {G}',
    cost: { tap: true },
    effect: { type: 'ADD_MANA', manaColors: ['G'] },
    isManaAbility: true,
    canActivate: (state, sourceId, controller) => {
      const card = findCard(state, sourceId);
      return card !== null && !card.tapped && !card.summoningSick;
    },
  });
  break;
```

#### Example: Damage Ability (Prodigal Sorcerer pattern)

```typescript
// In src/rules/activatedAbilities.ts

case 'Prodigal Sorcerer':  // {T}: Deal 1 damage to any target
  abilities.push({
    id: `${card.instanceId}_tap_damage`,
    name: '{T}: Deal 1 damage',
    cost: { tap: true },
    effect: { type: 'DAMAGE', amount: 1 },
    isManaAbility: false,
    targetRequirements: [{
      type: 'any',
      count: 1,
      restriction: {},
    }],
    canActivate: (state, sourceId, controller) => {
      const card = findCard(state, sourceId);
      return card !== null && !card.tapped && !card.summoningSick;
    },
  });
  break;
```

#### Example: Burn Spell (Shock pattern)

```typescript
// In src/actions/reducer.ts (in spell resolution)

case 'Incinerate':
  // Deal 3 damage to any target, it can't regenerate
  if (spell.targets?.[0]) {
    dealDamage(state, spell.targets[0], 3, spell.instanceId);
    // TODO: Add "can't regenerate" flag
  }
  break;
```

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
    const manaAbility = abilities.find(a => a.isManaAbility);

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
    { name: 'Fyndhorn Elves', count: 4 },  // Add new card
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

## Keyword Reference

These keywords work automatically (no implementation needed):

| Keyword | Effect | Status |
|---------|--------|--------|
| Flying | Can only be blocked by flyers/reach | ✅ |
| First Strike | Deals damage first | ✅ |
| Double Strike | Deals damage twice | ✅ |
| Trample | Excess damage to player | ✅ |
| Vigilance | Doesn't tap to attack | ✅ |
| Reach | Can block flyers | ✅ |
| Haste | No summoning sickness | ✅ |
| Hexproof | Can't be targeted by opponents | ✅ |
| Shroud | Can't be targeted | ✅ |
| Protection | Can't be targeted/blocked/damaged | ⚠️ Partial |
| Regenerate | Prevent destruction | ❌ Not implemented |
| Banding | Complex blocking | ❌ Not implemented |

---

## File Reference

| File | Purpose |
|------|---------|
| `data/cards/6ed.json` | Card data from Scryfall |
| `cards/CardLoader.ts` | Loads and indexes cards |
| `cards/CardTemplate.ts` | Type definitions, keyword helpers |
| `state/CardInstance.ts` | Runtime card state |
| `rules/activatedAbilities.ts` | "{cost}: {effect}" abilities |
| `rules/triggers.ts` | "When/Whenever" abilities |
| `rules/combat.ts` | Combat damage, keywords |
| `rules/stateBasedActions.ts` | Death, player loss checks |
| `actions/reducer.ts` | Spell resolution |
| `actions/validators.ts` | Action legality checks |
| `utils/gameInit.ts` | Test deck creation |

---

## Contributing a Card

1. **Pick a card** from the "Needing Implementation" section
2. **Identify the ability type** (activated, triggered, spell)
3. **Find a similar implemented card** as a pattern
4. **Add the implementation** in the appropriate file
5. **Write tests** for the card's behavior
6. **Run simulations** to verify stability
7. **Update this document** to mark the card as implemented

---

##  New Test Organization

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

* Benefits

  | Before                             | After                       |
  |------------------------------------|-----------------------------|
  | 1 monolithic file (1000+ lines)    | 10 focused files            |
  | Named after milestone ("week11")   | Named after functionality   |
  | Hard to find related tests         | Easy to locate by mechanic  |
  | Adding expansion = modify existing | Adding expansion = new file |

* Adding New Content

  - New mechanic: Add to appropriate cards/*.test.ts file
  - New expansion: Create expansions/m10.test.ts (or similar)
  - New card: Find the matching mechanic file and add tests

---

## Resources

- [Comprehensive Rules](https://magic.wizards.com/en/rules)
- [Scryfall API](https://scryfall.com/docs/api)
- [6th Edition Card List](https://scryfall.com/sets/6ed)
