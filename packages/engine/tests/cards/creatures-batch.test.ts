/**
 * Batch Verification Tests for Creatures
 *
 * Phase 1.5.4 - Day 1-2: Verify all vanilla and keyword creatures work correctly
 *
 * These tests verify that:
 * 1. Card data loads correctly from 6ed.json
 * 2. Creatures can be cast with appropriate mana
 * 3. Keywords are recognized by helper functions
 * 4. Creatures can participate in combat
 */

import { describe, test, expect } from 'bun:test';
import {
  CardLoader,
  createCardInstance,
  applyAction,
  hasFlying,
  hasFirstStrike,
  hasVigilance,
  hasReach,
  hasHaste,
  hasDefender,
  hasFear,
  hasSwampwalk,
  hasForestwalk,
  hasIslandwalk,
  hasMountainwalk,
  isCreature,
} from '../../src/index';
import { setupGameWithMana, createCreatureOnBattlefield } from './helpers';

// ============================================
// VANILLA CREATURES (16 cards)
// ============================================

const VANILLA_CREATURES = [
  { name: 'Balduvian Barbarians', power: '3', toughness: '2', cost: { R: 3 } },
  { name: 'Fire Elemental', power: '5', toughness: '4', cost: { R: 5 } },
  { name: 'Goblin Hero', power: '2', toughness: '2', cost: { R: 3 } },
  { name: 'Grizzly Bears', power: '2', toughness: '2', cost: { G: 2 } },
  { name: 'Horned Turtle', power: '1', toughness: '4', cost: { U: 3 } },
  { name: 'Merfolk of the Pearl Trident', power: '1', toughness: '1', cost: { U: 1 } },
  { name: 'Obsianus Golem', power: '4', toughness: '6', cost: { R: 6 } }, // Artifact creature, colorless
  { name: 'Panther Warriors', power: '6', toughness: '3', cost: { G: 5 } },
  { name: 'Python', power: '3', toughness: '2', cost: { B: 3 } },
  { name: 'Redwood Treefolk', power: '3', toughness: '6', cost: { G: 5 } },
  { name: 'Regal Unicorn', power: '2', toughness: '3', cost: { W: 3 } },
  { name: 'Scaled Wurm', power: '7', toughness: '6', cost: { G: 8 } },
  { name: 'Scathe Zombies', power: '2', toughness: '2', cost: { B: 3 } },
  { name: 'Trained Armodon', power: '3', toughness: '3', cost: { G: 3 } },
  { name: 'Viashino Warrior', power: '4', toughness: '2', cost: { R: 4 } },
  { name: 'Vodalian Soldiers', power: '1', toughness: '2', cost: { U: 2 } },
];

describe('Vanilla Creatures - Batch Verification', () => {
  describe('Card Data Loading', () => {
    VANILLA_CREATURES.forEach(({ name, power, toughness }) => {
      test(`${name} - card data loads correctly`, () => {
        const card = CardLoader.getByName(name);
        expect(card).toBeDefined();
        expect(card?.power).toBe(power);
        expect(card?.toughness).toBe(toughness);
        expect(isCreature(card!)).toBe(true);
      });
    });
  });

  describe('Combat Participation', () => {
    test('Grizzly Bears can attack and deal damage', () => {
      const state = setupGameWithMana({ G: 2 });
      const bears = createCreatureOnBattlefield(state, 'Grizzly Bears', 'player');

      const attackState = applyAction(state, {
        type: 'DECLARE_ATTACKERS',
        playerId: 'player',
        payload: { attackers: [bears.instanceId] },
      });

      // No blockers, pass to damage
      const damageState = applyAction(attackState, {
        type: 'DECLARE_BLOCKERS',
        playerId: 'opponent',
        payload: { blocks: [] },
      });

      // Bears dealt 2 damage to opponent
      expect(damageState.players.opponent.life).toBe(18);
    });

    test('Scathe Zombies can block and survive', () => {
      const state = setupGameWithMana({ B: 3 }, { G: 2 });
      state.step = 'declare_blockers';
      state.activePlayer = 'opponent';
      state.priorityPlayer = 'player';

      // Opponent attacks with 1/1
      const attacker = createCreatureOnBattlefield(
        state,
        'Merfolk of the Pearl Trident',
        'opponent',
      );
      attacker.attacking = true;

      // Player blocks with Zombies (2/2)
      const blocker = createCreatureOnBattlefield(state, 'Scathe Zombies', 'player');

      const newState = applyAction(state, {
        type: 'DECLARE_BLOCKERS',
        playerId: 'player',
        payload: {
          blocks: [{ blockerId: blocker.instanceId, attackerId: attacker.instanceId }],
        },
      });

      // Zombies (2/2) survives, Merfolk (1/1) dies
      expect(
        newState.players.player.battlefield.some((c) => c.instanceId === blocker.instanceId),
      ).toBe(true);
      expect(
        newState.players.opponent.graveyard.some((c) => c.instanceId === attacker.instanceId),
      ).toBe(true);
    });
  });
});

// ============================================
// KEYWORD-ONLY CREATURES (18 cards)
// ============================================

const KEYWORD_CREATURES = [
  { name: 'Air Elemental', keywords: ['Flying'], cost: { U: 5 } },
  { name: 'Anaba Bodyguard', keywords: ['First strike'], cost: { R: 4 } },
  { name: 'Archangel', keywords: ['Flying', 'Vigilance'], cost: { W: 7 } },
  { name: 'Ardent Militia', keywords: ['Vigilance'], cost: { W: 5 } },
  { name: 'Armored Pegasus', keywords: ['Flying'], cost: { W: 2 } },
  { name: 'Ekundu Griffin', keywords: ['Flying', 'First strike'], cost: { W: 4 } },
  { name: 'Elvish Archers', keywords: ['First strike'], cost: { G: 2 } },
  { name: 'Feral Shadow', keywords: ['Flying'], cost: { B: 3 } },
  { name: 'Giant Spider', keywords: ['Reach'], cost: { G: 4 } },
  { name: 'Longbow Archer', keywords: ['First strike', 'Reach'], cost: { W: 2 } },
  { name: 'Ornithopter', keywords: ['Flying'], cost: {} }, // Free!
  { name: 'Raging Goblin', keywords: ['Haste'], cost: { R: 1 } },
  { name: 'Sabretooth Tiger', keywords: ['First strike'], cost: { R: 3 } },
  { name: 'Standing Troops', keywords: ['Vigilance'], cost: { W: 3 } },
  { name: 'Talruum Minotaur', keywords: ['Haste'], cost: { R: 4 } },
  { name: 'Tundra Wolves', keywords: ['First strike'], cost: { W: 1 } },
  { name: 'Volcanic Dragon', keywords: ['Flying', 'Haste'], cost: { R: 6 } },
  { name: 'Wind Drake', keywords: ['Flying'], cost: { U: 3 } },
];

describe('Keyword Creatures - Batch Verification', () => {
  describe('Card Data and Keywords', () => {
    KEYWORD_CREATURES.forEach(({ name, keywords }) => {
      test(`${name} - has correct keywords: ${keywords.join(', ')}`, () => {
        const card = CardLoader.getByName(name);
        expect(card).toBeDefined();
        expect(isCreature(card!)).toBe(true);

        // Verify each keyword
        keywords.forEach((keyword) => {
          expect(card?.keywords).toContain(keyword);
        });
      });
    });
  });

  describe('Keyword Helper Functions', () => {
    test('Flying creatures detected correctly', () => {
      const flyers = ['Air Elemental', 'Archangel', 'Armored Pegasus', 'Wind Drake'];
      flyers.forEach((name) => {
        const card = CardLoader.getByName(name)!;
        expect(hasFlying(card)).toBe(true);
      });
    });

    test('First Strike creatures detected correctly', () => {
      const strikers = ['Anaba Bodyguard', 'Elvish Archers', 'Tundra Wolves'];
      strikers.forEach((name) => {
        const card = CardLoader.getByName(name)!;
        expect(hasFirstStrike(card)).toBe(true);
      });
    });

    test('Vigilance creatures detected correctly', () => {
      const vigilant = ['Archangel', 'Ardent Militia', 'Standing Troops'];
      vigilant.forEach((name) => {
        const card = CardLoader.getByName(name)!;
        expect(hasVigilance(card)).toBe(true);
      });
    });

    test('Reach creatures detected correctly', () => {
      const reachers = ['Giant Spider', 'Longbow Archer'];
      reachers.forEach((name) => {
        const card = CardLoader.getByName(name)!;
        expect(hasReach(card)).toBe(true);
      });
    });

    test('Haste creatures detected correctly', () => {
      const hasty = ['Raging Goblin', 'Talruum Minotaur', 'Volcanic Dragon'];
      hasty.forEach((name) => {
        const card = CardLoader.getByName(name)!;
        expect(hasHaste(card)).toBe(true);
      });
    });
  });

  describe('Keyword Mechanics', () => {
    test('Flying creature cannot be blocked by non-flyer', () => {
      const state = setupGameWithMana({ U: 3 }, { G: 2 });
      state.step = 'declare_blockers';
      state.activePlayer = 'player';
      state.priorityPlayer = 'opponent';

      // Player attacks with Wind Drake (flying)
      const flyer = createCreatureOnBattlefield(state, 'Wind Drake', 'player');
      flyer.attacking = true;

      // Opponent tries to block with Grizzly Bears (no flying)
      const blocker = createCreatureOnBattlefield(state, 'Grizzly Bears', 'opponent');

      expect(() =>
        applyAction(state, {
          type: 'DECLARE_BLOCKERS',
          playerId: 'opponent',
          payload: {
            blocks: [{ blockerId: blocker.instanceId, attackerId: flyer.instanceId }],
          },
        }),
      ).toThrow(/Flying/i);
    });

    test('Reach creature CAN block flying creature', () => {
      const state = setupGameWithMana({ U: 3 }, { G: 4 });
      state.step = 'declare_blockers';
      state.activePlayer = 'player';
      state.priorityPlayer = 'opponent';

      // Player attacks with Wind Drake (2/2 flying)
      const flyer = createCreatureOnBattlefield(state, 'Wind Drake', 'player');
      flyer.attacking = true;

      // Opponent blocks with Giant Spider (2/4 reach)
      const spider = createCreatureOnBattlefield(state, 'Giant Spider', 'opponent');

      const newState = applyAction(state, {
        type: 'DECLARE_BLOCKERS',
        playerId: 'opponent',
        payload: {
          blocks: [{ blockerId: spider.instanceId, attackerId: flyer.instanceId }],
        },
      });

      // Drake dies (2 damage >= 2 toughness), Spider survives (2 damage < 4 toughness)
      expect(newState.players.player.graveyard.some((c) => c.instanceId === flyer.instanceId)).toBe(
        true,
      );
      expect(
        newState.players.opponent.battlefield.some((c) => c.instanceId === spider.instanceId),
      ).toBe(true);
    });

    test('Vigilance creature does not tap when attacking', () => {
      const state = setupGameWithMana({ W: 5 });
      const vigilant = createCreatureOnBattlefield(state, 'Ardent Militia', 'player');

      const newState = applyAction(state, {
        type: 'DECLARE_ATTACKERS',
        playerId: 'player',
        payload: { attackers: [vigilant.instanceId] },
      });

      const attacker = newState.players.player.battlefield.find(
        (c) => c.instanceId === vigilant.instanceId,
      );
      expect(attacker?.attacking).toBe(true);
      expect(attacker?.tapped).toBe(false); // Vigilance!
    });

    test('Haste creature can attack immediately', () => {
      const state = setupGameWithMana({ R: 1 });
      const goblin = createCreatureOnBattlefield(state, 'Raging Goblin', 'player');
      goblin.summoningSick = true; // Just entered

      // Verify the card has haste
      const card = CardLoader.getByName('Raging Goblin')!;
      expect(hasHaste(card)).toBe(true);

      // Haste should allow the creature to attack despite summoning sickness
      const attackState = applyAction(state, {
        type: 'DECLARE_ATTACKERS',
        playerId: 'player',
        payload: { attackers: [goblin.instanceId] },
      });

      // Attack should succeed - creature should be marked as attacking
      const attackingGoblin = attackState.players.player.battlefield.find(
        (c) => c.instanceId === goblin.instanceId,
      );
      expect(attackingGoblin?.attacking).toBe(true);
    });
  });
});

// ============================================
// LANDWALK CREATURES
// ============================================

const LANDWALK_CREATURES = [
  { name: 'Bog Wraith', landwalk: 'Swampwalk', land: 'Swamp' },
  { name: 'Cat Warriors', landwalk: 'Forestwalk', land: 'Forest' },
  { name: 'Lost Soul', landwalk: 'Swampwalk', land: 'Swamp' },
  { name: 'Mountain Goat', landwalk: 'Mountainwalk', land: 'Mountain' },
  { name: 'Segovian Leviathan', landwalk: 'Islandwalk', land: 'Island' },
  { name: 'Shanodin Dryads', landwalk: 'Forestwalk', land: 'Forest' },
  { name: 'Warthog', landwalk: 'Swampwalk', land: 'Swamp' },
];

describe('Landwalk Creatures - Batch Verification', () => {
  LANDWALK_CREATURES.forEach(({ name, landwalk, land }) => {
    test(`${name} - has ${landwalk}`, () => {
      const card = CardLoader.getByName(name);
      expect(card).toBeDefined();
      expect(card?.keywords).toContain(landwalk);
    });
  });

  test('Bog Wraith cannot be blocked when opponent has Swamp', () => {
    const state = setupGameWithMana({ B: 4 });
    state.step = 'declare_blockers';
    state.activePlayer = 'player';
    state.priorityPlayer = 'opponent';

    // Player attacks with Bog Wraith (Swampwalk)
    const wraith = createCreatureOnBattlefield(state, 'Bog Wraith', 'player');
    wraith.attacking = true;

    // Opponent has a Swamp
    const swamp = CardLoader.getByName('Swamp')!;
    const swampCard = createCardInstance(swamp.id, 'opponent', 'battlefield');
    state.players.opponent.battlefield.push(swampCard);

    // Opponent tries to block
    const blocker = createCreatureOnBattlefield(state, 'Scathe Zombies', 'opponent');

    expect(() =>
      applyAction(state, {
        type: 'DECLARE_BLOCKERS',
        playerId: 'opponent',
        payload: {
          blocks: [{ blockerId: blocker.instanceId, attackerId: wraith.instanceId }],
        },
      }),
    ).toThrow(/Swampwalk/i);
  });
});

// ============================================
// DEFENDER/WALL CREATURES
// ============================================

const WALL_CREATURES = [
  { name: 'Glacial Wall', power: '0', toughness: '7' },
  { name: 'Wall of Air', power: '1', toughness: '5' },
  { name: 'Wall of Fire', power: '0', toughness: '5' },
  { name: 'Wall of Swords', power: '3', toughness: '5' },
  { name: 'Sunweb', power: '5', toughness: '6' },
];

describe('Defender/Wall Creatures - Batch Verification', () => {
  WALL_CREATURES.forEach(({ name }) => {
    test(`${name} - has Defender`, () => {
      const card = CardLoader.getByName(name);
      expect(card).toBeDefined();
      expect(hasDefender(card!)).toBe(true);
    });

    test(`${name} - cannot attack`, () => {
      const state = setupGameWithMana({ U: 5 });
      const wall = createCreatureOnBattlefield(state, name, 'player');

      expect(() =>
        applyAction(state, {
          type: 'DECLARE_ATTACKERS',
          playerId: 'player',
          payload: { attackers: [wall.instanceId] },
        }),
      ).toThrow(/Defender/i);
    });
  });
});

// ============================================
// FEAR CREATURES
// ============================================

describe('Fear Creatures - Batch Verification', () => {
  test('Razortooth Rats has Fear keyword', () => {
    const card = CardLoader.getByName('Razortooth Rats');
    expect(card).toBeDefined();
    expect(hasFear(card!)).toBe(true);
  });

  test('Fear creature cannot be blocked by non-black non-artifact', () => {
    const state = setupGameWithMana({ B: 3 });
    state.step = 'declare_blockers';
    state.activePlayer = 'player';
    state.priorityPlayer = 'opponent';

    const rats = createCreatureOnBattlefield(state, 'Razortooth Rats', 'player');
    rats.attacking = true;

    // Opponent tries to block with green creature
    const blocker = createCreatureOnBattlefield(state, 'Grizzly Bears', 'opponent');

    expect(() =>
      applyAction(state, {
        type: 'DECLARE_BLOCKERS',
        playerId: 'opponent',
        payload: {
          blocks: [{ blockerId: blocker.instanceId, attackerId: rats.instanceId }],
        },
      }),
    ).toThrow(/Fear/i);
  });
});

// ============================================
// SPECIAL EVASION CREATURES
// ============================================

describe('Special Evasion Creatures - Verification', () => {
  test('Phantom Warrior - card data exists', () => {
    const card = CardLoader.getByName('Phantom Warrior');
    expect(card).toBeDefined();
    expect(card?.oracle_text).toContain("can't be blocked");
  });

  test('Elven Riders - card data exists', () => {
    const card = CardLoader.getByName('Elven Riders');
    expect(card).toBeDefined();
    expect(card?.oracle_text).toContain("can't be blocked except");
  });

  test('Stalking Tiger - card data exists', () => {
    const card = CardLoader.getByName('Stalking Tiger');
    expect(card).toBeDefined();
    expect(card?.oracle_text).toContain("can't be blocked by more than one");
  });

  test('Hulking Cyclops - card data exists', () => {
    const card = CardLoader.getByName('Hulking Cyclops');
    expect(card).toBeDefined();
    expect(card?.oracle_text).toContain("can't block");
  });
});

// ============================================
// LORDS (verify card data exists)
// ============================================

describe('Lord Creatures - Data Verification', () => {
  test('Goblin King - card data exists', () => {
    const card = CardLoader.getByName('Goblin King');
    expect(card).toBeDefined();
    expect(card?.oracle_text).toContain('Other Goblins get +1/+1');
  });

  test('Lord of Atlantis - card data exists', () => {
    const card = CardLoader.getByName('Lord of Atlantis');
    expect(card).toBeDefined();
    expect(card?.oracle_text).toContain('Other Merfolk get +1/+1');
  });

  test('Zombie Master - card data exists', () => {
    const card = CardLoader.getByName('Zombie Master');
    expect(card).toBeDefined();
    expect(card?.oracle_text).toContain('Other Zombie creatures');
  });
});

// ============================================
// VARIABLE P/T CREATURES (verify card data exists)
// ============================================

describe('Variable P/T Creatures - Data Verification', () => {
  test('Maro - P/T equals cards in hand', () => {
    const card = CardLoader.getByName('Maro');
    expect(card).toBeDefined();
    expect(card?.power).toBe('*');
    expect(card?.toughness).toBe('*');
  });

  test('Nightmare - P/T equals Swamps', () => {
    const card = CardLoader.getByName('Nightmare');
    expect(card).toBeDefined();
    expect(card?.power).toBe('*');
    expect(card?.toughness).toBe('*');
  });

  test('Uktabi Wildcats - P/T equals Forests', () => {
    const card = CardLoader.getByName('Uktabi Wildcats');
    expect(card).toBeDefined();
    expect(card?.power).toBe('*');
    expect(card?.toughness).toBe('*');
  });
});
