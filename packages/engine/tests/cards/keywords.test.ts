/**
 * Keyword Ability Tests
 *
 * Tests for creatures with keyword abilities (Flying, First Strike, etc.).
 * Keywords are handled automatically by the combat system.
 */

import { describe, test, expect } from 'bun:test';
import { CardLoader, createCardInstance, applyAction } from '../../src/index';
import { setupGameWithMana, castAndResolve } from './helpers';

describe('Flying', () => {
  describe('Air Elemental', () => {
    test('card has Flying keyword', () => {
      const card = CardLoader.getByName('Air Elemental');
      expect(card).toBeDefined();
      expect(card?.power).toBe('4');
      expect(card?.toughness).toBe('4');
      expect(card?.keywords).toContain('Flying');
    });
  });

  describe('Fog Elemental', () => {
    test('card has Flying keyword', () => {
      const card = CardLoader.getByName('Fog Elemental');
      expect(card).toBeDefined();
      expect(card?.power).toBe('4');
      expect(card?.toughness).toBe('4');
      expect(card?.keywords).toContain('Flying');
    });
  });

  describe('Birds of Paradise', () => {
    test('card has Flying keyword', () => {
      const card = CardLoader.getByName('Birds of Paradise');
      expect(card).toBeDefined();
      expect(card?.power).toBe('0');
      expect(card?.toughness).toBe('1');
      expect(card?.keywords).toContain('Flying');
    });
  });

  describe('Abyssal Specter', () => {
    test('card has Flying keyword', () => {
      const card = CardLoader.getByName('Abyssal Specter');
      expect(card).toBeDefined();
      expect(card?.keywords).toContain('Flying');
    });
  });
});

describe('Flying + Vigilance', () => {
  describe('Archangel', () => {
    test('card has correct stats and keywords', () => {
      const card = CardLoader.getByName('Archangel');
      expect(card).toBeDefined();
      expect(card?.power).toBe('5');
      expect(card?.toughness).toBe('5');
      expect(card?.keywords).toContain('Flying');
      expect(card?.keywords).toContain('Vigilance');
    });

    test('can be cast', () => {
      const archangel = CardLoader.getByName('Archangel')!;
      const state = setupGameWithMana({ W: 7 }); // {5}{W}{W}

      const card = createCardInstance(archangel.id, 'player', 'hand');
      state.players.player.hand.push(card);

      const newState = castAndResolve(state, 'player', card.instanceId);

      const creature = newState.players.player.battlefield.find(
        (c) => c.instanceId === card.instanceId,
      );
      expect(creature).toBeDefined();
      expect(creature?.summoningSick).toBe(true);
    });

    test('does not tap when attacking (Vigilance)', () => {
      const archangel = CardLoader.getByName('Archangel')!;
      const state = setupGameWithMana({ W: 7 });

      const card = createCardInstance(archangel.id, 'player', 'battlefield');
      card.summoningSick = false;
      state.players.player.battlefield.push(card);

      const newState = applyAction(state, {
        type: 'DECLARE_ATTACKERS',
        playerId: 'player',
        payload: { attackers: [card.instanceId] },
      });

      const attacker = newState.players.player.battlefield.find(
        (c) => c.instanceId === card.instanceId,
      );
      expect(attacker?.attacking).toBe(true);
      expect(attacker?.tapped).toBe(false); // Vigilance!
    });
  });
});

describe('First Strike', () => {
  describe('Anaba Bodyguard', () => {
    test('card has First Strike keyword', () => {
      const card = CardLoader.getByName('Anaba Bodyguard');
      expect(card).toBeDefined();
      expect(card?.keywords).toContain('First strike');
    });
  });
});

describe('Keyword Helper Functions', () => {
  test('hasFlying returns true for flying creatures', () => {
    const { hasFlying } = require('../../src/cards/CardTemplate');
    const airElemental = CardLoader.getByName('Air Elemental')!;
    const bears = CardLoader.getByName('Grizzly Bears')!;

    expect(hasFlying(airElemental)).toBe(true);
    expect(hasFlying(bears)).toBe(false);
  });

  test('hasVigilance returns true for vigilant creatures', () => {
    const { hasVigilance } = require('../../src/cards/CardTemplate');
    const archangel = CardLoader.getByName('Archangel')!;
    const bears = CardLoader.getByName('Grizzly Bears')!;

    expect(hasVigilance(archangel)).toBe(true);
    expect(hasVigilance(bears)).toBe(false);
  });

  test('hasFirstStrike returns true for first strikers', () => {
    const { hasFirstStrike } = require('../../src/cards/CardTemplate');
    const bodyguard = CardLoader.getByName('Anaba Bodyguard')!;
    const bears = CardLoader.getByName('Grizzly Bears')!;

    expect(hasFirstStrike(bodyguard)).toBe(true);
    expect(hasFirstStrike(bears)).toBe(false);
  });
});

// ============================================
// Phase 1.5.3: NEW KEYWORD TESTS
// ============================================

describe('Defender', () => {
  describe('Wall of Air', () => {
    test('card has Defender keyword', () => {
      const card = CardLoader.getByName('Wall of Air');
      expect(card).toBeDefined();
      expect(card?.type_line).toContain('Wall');
      expect(card?.keywords).toContain('Defender');
    });

    test('cannot attack', () => {
      const wallOfAir = CardLoader.getByName('Wall of Air')!;
      const state = setupGameWithMana({ U: 3 });

      const wall = createCardInstance(wallOfAir.id, 'player', 'battlefield');
      wall.summoningSick = false;
      state.players.player.battlefield.push(wall);

      // Try to declare the wall as an attacker
      const action = {
        type: 'DECLARE_ATTACKERS' as const,
        playerId: 'player' as const,
        payload: { attackers: [wall.instanceId] },
      };

      // Should throw or produce errors
      expect(() => applyAction(state, action)).toThrow(/Defender/i);
    });

    test('can still block', () => {
      const wallOfAir = CardLoader.getByName('Wall of Air')!;
      const bears = CardLoader.getByName('Grizzly Bears')!;

      const state = setupGameWithMana({ U: 3 });
      state.step = 'declare_blockers';
      state.activePlayer = 'opponent';
      state.priorityPlayer = 'player';

      // Player has Wall of Air (1/5)
      const wall = createCardInstance(wallOfAir.id, 'player', 'battlefield');
      wall.summoningSick = false;
      state.players.player.battlefield.push(wall);

      // Opponent has attacking Grizzly Bears (2/2)
      const attackingBears = createCardInstance(bears.id, 'opponent', 'battlefield');
      attackingBears.summoningSick = false;
      attackingBears.attacking = true;
      state.players.opponent.battlefield.push(attackingBears);

      // Wall should be able to block (no error thrown)
      // After combat: Wall (1/5) takes 2 damage from Bears, survives
      //               Bears (2/2) takes 1 damage from Wall, survives
      const newState = applyAction(state, {
        type: 'DECLARE_BLOCKERS',
        playerId: 'player',
        payload: {
          blocks: [{ blockerId: wall.instanceId, attackerId: attackingBears.instanceId }],
        },
      });

      // Combat resolves - both creatures survive (1 damage < 2 toughness for Bears)
      // The key test is that blocking succeeded (no error thrown) - Wall CAN block
      expect(
        newState.players.player.battlefield.some((c) => c.instanceId === wall.instanceId),
      ).toBe(true);
      expect(
        newState.players.opponent.battlefield.some(
          (c) => c.instanceId === attackingBears.instanceId,
        ),
      ).toBe(true);
    });
  });

  describe('Glacial Wall', () => {
    test('card has correct stats and Defender', () => {
      const card = CardLoader.getByName('Glacial Wall');
      expect(card).toBeDefined();
      expect(card?.power).toBe('0');
      expect(card?.toughness).toBe('7');
      expect(card?.keywords).toContain('Defender');
    });

    test('cannot attack', () => {
      const glacialWall = CardLoader.getByName('Glacial Wall')!;
      const state = setupGameWithMana({ U: 3 });

      const wall = createCardInstance(glacialWall.id, 'player', 'battlefield');
      wall.summoningSick = false;
      state.players.player.battlefield.push(wall);

      expect(() =>
        applyAction(state, {
          type: 'DECLARE_ATTACKERS',
          playerId: 'player',
          payload: { attackers: [wall.instanceId] },
        }),
      ).toThrow(/Defender/i);
    });
  });

  describe('hasDefender helper', () => {
    test('returns true for Defender creatures', () => {
      const { hasDefender } = require('../../src/cards/CardTemplate');
      const wallOfAir = CardLoader.getByName('Wall of Air')!;
      const bears = CardLoader.getByName('Grizzly Bears')!;

      expect(hasDefender(wallOfAir)).toBe(true);
      expect(hasDefender(bears)).toBe(false);
    });

    test('returns true for all Walls even without explicit Defender keyword', () => {
      const { hasDefender } = require('../../src/cards/CardTemplate');
      const wallOfFire = CardLoader.getByName('Wall of Fire')!;
      const wallOfSwords = CardLoader.getByName('Wall of Swords')!;

      expect(hasDefender(wallOfFire)).toBe(true);
      expect(hasDefender(wallOfSwords)).toBe(true);
    });
  });
});

describe('Landwalk', () => {
  describe('Swampwalk - Bog Wraith', () => {
    test('card has Swampwalk keyword', () => {
      const card = CardLoader.getByName('Bog Wraith');
      expect(card).toBeDefined();
      expect(card?.keywords).toContain('Swampwalk');
    });

    test('cannot be blocked if defender controls a Swamp', () => {
      const bogWraith = CardLoader.getByName('Bog Wraith')!;
      const bears = CardLoader.getByName('Grizzly Bears')!;
      const swamp = CardLoader.getByName('Swamp')!;

      const state = setupGameWithMana({ B: 3 });
      state.step = 'declare_blockers';
      state.activePlayer = 'player';
      state.priorityPlayer = 'opponent';

      // Player (attacker) has Bog Wraith attacking
      const wraith = createCardInstance(bogWraith.id, 'player', 'battlefield');
      wraith.summoningSick = false;
      wraith.attacking = true;
      state.players.player.battlefield.push(wraith);

      // Opponent (defender) has a Swamp
      const opponentSwamp = createCardInstance(swamp.id, 'opponent', 'battlefield');
      state.players.opponent.battlefield.push(opponentSwamp);

      // Opponent has a creature that could normally block
      const blockerBears = createCardInstance(bears.id, 'opponent', 'battlefield');
      blockerBears.summoningSick = false;
      state.players.opponent.battlefield.push(blockerBears);

      // Attempting to block should fail due to Swampwalk
      expect(() =>
        applyAction(state, {
          type: 'DECLARE_BLOCKERS',
          playerId: 'opponent',
          payload: {
            blocks: [{ blockerId: blockerBears.instanceId, attackerId: wraith.instanceId }],
          },
        }),
      ).toThrow(/Swampwalk/i);
    });

    test('CAN be blocked if defender does NOT control a Swamp', () => {
      const bogWraith = CardLoader.getByName('Bog Wraith')!;
      const bears = CardLoader.getByName('Grizzly Bears')!;
      const forest = CardLoader.getByName('Forest')!;

      const state = setupGameWithMana({ B: 3 });
      state.step = 'declare_blockers';
      state.activePlayer = 'player';
      state.priorityPlayer = 'opponent';

      // Player (attacker) has Bog Wraith (3/3) attacking
      const wraith = createCardInstance(bogWraith.id, 'player', 'battlefield');
      wraith.summoningSick = false;
      wraith.attacking = true;
      state.players.player.battlefield.push(wraith);

      // Opponent (defender) has only Forests, no Swamps
      const opponentForest = createCardInstance(forest.id, 'opponent', 'battlefield');
      state.players.opponent.battlefield.push(opponentForest);

      // Opponent has a creature that can block - Grizzly Bears (2/2)
      const blockerBears = createCardInstance(bears.id, 'opponent', 'battlefield');
      blockerBears.summoningSick = false;
      state.players.opponent.battlefield.push(blockerBears);

      // Blocking should succeed (no Swamp = no Swampwalk evasion)
      // Combat: Bog Wraith (3/3) vs Grizzly Bears (2/2)
      // Bears dies from 3 damage, Wraith takes 2 damage but survives
      const newState = applyAction(state, {
        type: 'DECLARE_BLOCKERS',
        playerId: 'opponent',
        payload: {
          blocks: [{ blockerId: blockerBears.instanceId, attackerId: wraith.instanceId }],
        },
      });

      // Verify blocking succeeded by checking combat results
      expect(
        newState.players.opponent.graveyard.some((c) => c.instanceId === blockerBears.instanceId),
      ).toBe(true);
      expect(
        newState.players.player.battlefield.some((c) => c.instanceId === wraith.instanceId),
      ).toBe(true);
    });
  });

  describe('Forestwalk - Cat Warriors', () => {
    test('card has Forestwalk keyword', () => {
      const card = CardLoader.getByName('Cat Warriors');
      expect(card).toBeDefined();
      expect(card?.keywords).toContain('Forestwalk');
    });

    test('cannot be blocked if defender controls a Forest', () => {
      const catWarriors = CardLoader.getByName('Cat Warriors')!;
      const bears = CardLoader.getByName('Grizzly Bears')!;
      const forest = CardLoader.getByName('Forest')!;

      const state = setupGameWithMana({ G: 3 });
      state.step = 'declare_blockers';
      state.activePlayer = 'player';
      state.priorityPlayer = 'opponent';

      // Attacker: Cat Warriors
      const cats = createCardInstance(catWarriors.id, 'player', 'battlefield');
      cats.summoningSick = false;
      cats.attacking = true;
      state.players.player.battlefield.push(cats);

      // Defender has a Forest
      const opponentForest = createCardInstance(forest.id, 'opponent', 'battlefield');
      state.players.opponent.battlefield.push(opponentForest);

      // Defender has a blocker
      const blockerBears = createCardInstance(bears.id, 'opponent', 'battlefield');
      blockerBears.summoningSick = false;
      state.players.opponent.battlefield.push(blockerBears);

      // Should fail due to Forestwalk
      expect(() =>
        applyAction(state, {
          type: 'DECLARE_BLOCKERS',
          playerId: 'opponent',
          payload: {
            blocks: [{ blockerId: blockerBears.instanceId, attackerId: cats.instanceId }],
          },
        }),
      ).toThrow(/Forestwalk/i);
    });
  });

  describe('Islandwalk - Segovian Leviathan', () => {
    test('card has Islandwalk keyword', () => {
      const card = CardLoader.getByName('Segovian Leviathan');
      expect(card).toBeDefined();
      expect(card?.keywords).toContain('Islandwalk');
    });
  });

  describe('Mountainwalk - Mountain Goat', () => {
    test('card has Mountainwalk keyword', () => {
      const card = CardLoader.getByName('Mountain Goat');
      expect(card).toBeDefined();
      expect(card?.keywords).toContain('Mountainwalk');
    });
  });

  describe('getLandwalkTypes helper', () => {
    test('returns correct land types for landwalkers', () => {
      const { getLandwalkTypes } = require('../../src/cards/CardTemplate');
      const bogWraith = CardLoader.getByName('Bog Wraith')!;
      const catWarriors = CardLoader.getByName('Cat Warriors')!;
      const bears = CardLoader.getByName('Grizzly Bears')!;

      expect(getLandwalkTypes(bogWraith)).toContain('Swamp');
      expect(getLandwalkTypes(catWarriors)).toContain('Forest');
      expect(getLandwalkTypes(bears)).toEqual([]);
    });
  });
});

describe('Fear', () => {
  describe('Razortooth Rats', () => {
    test('card has Fear keyword', () => {
      const card = CardLoader.getByName('Razortooth Rats');
      expect(card).toBeDefined();
      expect(card?.keywords).toContain('Fear');
    });

    test('cannot be blocked by non-black, non-artifact creatures', () => {
      const rats = CardLoader.getByName('Razortooth Rats')!;
      const bears = CardLoader.getByName('Grizzly Bears')!; // Green creature

      const state = setupGameWithMana({ B: 2 });
      state.step = 'declare_blockers';
      state.activePlayer = 'player';
      state.priorityPlayer = 'opponent';

      // Attacker: Razortooth Rats
      const attackingRats = createCardInstance(rats.id, 'player', 'battlefield');
      attackingRats.summoningSick = false;
      attackingRats.attacking = true;
      state.players.player.battlefield.push(attackingRats);

      // Defender: Grizzly Bears (green, not black, not artifact)
      const blockerBears = createCardInstance(bears.id, 'opponent', 'battlefield');
      blockerBears.summoningSick = false;
      state.players.opponent.battlefield.push(blockerBears);

      // Should fail - green creature cannot block Fear
      expect(() =>
        applyAction(state, {
          type: 'DECLARE_BLOCKERS',
          playerId: 'opponent',
          payload: {
            blocks: [{ blockerId: blockerBears.instanceId, attackerId: attackingRats.instanceId }],
          },
        }),
      ).toThrow(/Fear/i);
    });

    test('CAN be blocked by black creatures', () => {
      const rats = CardLoader.getByName('Razortooth Rats')!;
      const blackCreature = CardLoader.getByName('Scathe Zombies')!; // Black 2/2 creature

      const state = setupGameWithMana({ B: 2 });
      state.step = 'declare_blockers';
      state.activePlayer = 'player';
      state.priorityPlayer = 'opponent';

      // Attacker: Razortooth Rats (2/1)
      const attackingRats = createCardInstance(rats.id, 'player', 'battlefield');
      attackingRats.summoningSick = false;
      attackingRats.attacking = true;
      state.players.player.battlefield.push(attackingRats);

      // Defender: Scathe Zombies (2/2 black creature)
      const blocker = createCardInstance(blackCreature.id, 'opponent', 'battlefield');
      blocker.summoningSick = false;
      state.players.opponent.battlefield.push(blocker);

      // Should succeed - black creature CAN block Fear
      // Combat: Rats (2/1) vs Zombies (2/2)
      // Rats deals 2 damage to Zombies (2/2) -> Zombies dies (2 >= 2)
      // Zombies deals 2 damage to Rats (2/1) -> Rats dies (2 >= 1)
      const newState = applyAction(state, {
        type: 'DECLARE_BLOCKERS',
        playerId: 'opponent',
        payload: {
          blocks: [{ blockerId: blocker.instanceId, attackerId: attackingRats.instanceId }],
        },
      });

      // Verify blocking succeeded - both creatures die in combat
      expect(
        newState.players.player.graveyard.some((c) => c.instanceId === attackingRats.instanceId),
      ).toBe(true);
      expect(
        newState.players.opponent.graveyard.some((c) => c.instanceId === blocker.instanceId),
      ).toBe(true);
    });

    test('CAN be blocked by artifact creatures', () => {
      const rats = CardLoader.getByName('Razortooth Rats')!;
      const artifactCreature = CardLoader.getByName('Obsianus Golem')!; // Artifact 4/6 creature

      const state = setupGameWithMana({ B: 2 });
      state.step = 'declare_blockers';
      state.activePlayer = 'player';
      state.priorityPlayer = 'opponent';

      // Attacker: Razortooth Rats (2/1)
      const attackingRats = createCardInstance(rats.id, 'player', 'battlefield');
      attackingRats.summoningSick = false;
      attackingRats.attacking = true;
      state.players.player.battlefield.push(attackingRats);

      // Defender: Obsianus Golem (4/6 artifact creature)
      const blocker = createCardInstance(artifactCreature.id, 'opponent', 'battlefield');
      blocker.summoningSick = false;
      state.players.opponent.battlefield.push(blocker);

      // Should succeed - artifact creature CAN block Fear
      // Combat: Rats (2/1) vs Golem (4/6)
      // Rats dies from 4 damage, Golem takes 2 but survives
      const newState = applyAction(state, {
        type: 'DECLARE_BLOCKERS',
        playerId: 'opponent',
        payload: {
          blocks: [{ blockerId: blocker.instanceId, attackerId: attackingRats.instanceId }],
        },
      });

      // Verify blocking succeeded - Rats dead, Golem survives
      expect(
        newState.players.player.graveyard.some((c) => c.instanceId === attackingRats.instanceId),
      ).toBe(true);
      expect(
        newState.players.opponent.battlefield.some((c) => c.instanceId === blocker.instanceId),
      ).toBe(true);
    });
  });

  describe('hasFear helper', () => {
    test('returns true for Fear creatures', () => {
      const { hasFear } = require('../../src/cards/CardTemplate');
      const rats = CardLoader.getByName('Razortooth Rats')!;
      const bears = CardLoader.getByName('Grizzly Bears')!;

      expect(hasFear(rats)).toBe(true);
      expect(hasFear(bears)).toBe(false);
    });
  });
});
