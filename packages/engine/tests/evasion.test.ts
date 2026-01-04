/**
 * Evasion Keyword Tests (Phase 1.5.4)
 *
 * Tests for evasion abilities that restrict blocking:
 * - Fear: Can only be blocked by artifact creatures and/or black creatures
 * - Intimidate: Can only be blocked by artifact creatures and/or creatures that share a color
 * - Menace: Must be blocked by two or more creatures
 */

import { describe, test, expect } from 'bun:test';
import {
  CardLoader,
  createCardInstance,
  createGameState,
  applyAction,
  validateAction,
  hasFear,
  hasIntimidate,
  hasMenace,
} from '../src/index';

// Helper to create a basic game state
function createTestState() {
  const plains = CardLoader.getByName('Plains')!;
  const state = createGameState(
    [createCardInstance(plains.id, 'player', 'library')],
    [createCardInstance(plains.id, 'opponent', 'library')],
  );
  return state;
}

// ==========================================
// FEAR TESTS
// ==========================================

describe('Fear Evasion', () => {
  test('Razortooth Rats has Fear keyword', () => {
    const card = CardLoader.getByName('Razortooth Rats');
    expect(card).toBeDefined();
    expect(hasFear(card!)).toBe(true);
  });

  test('Fear creature can be blocked by black creature', () => {
    const state = createTestState();
    state.step = 'declare_blockers';
    state.activePlayer = 'player';
    state.priorityPlayer = 'opponent';

    // Add Razortooth Rats (black, Fear) as attacker
    const rats = CardLoader.getByName('Razortooth Rats')!;
    const ratsCard = createCardInstance(rats.id, 'player', 'battlefield');
    ratsCard.attacking = true;
    ratsCard.summoningSick = false;
    state.players.player.battlefield.push(ratsCard);

    // Add a black creature as potential blocker (Drudge Skeletons is black)
    const skeletons = CardLoader.getByName('Drudge Skeletons')!;
    const skeletonsCard = createCardInstance(skeletons.id, 'opponent', 'battlefield');
    skeletonsCard.summoningSick = false;
    state.players.opponent.battlefield.push(skeletonsCard);

    // Try to block with black creature
    const errors = validateAction(state, {
      type: 'DECLARE_BLOCKERS',
      playerId: 'opponent',
      payload: {
        blocks: [{ blockerId: skeletonsCard.instanceId, attackerId: ratsCard.instanceId }],
      },
    });

    expect(errors.length).toBe(0);
  });

  test('Fear creature cannot be blocked by non-black, non-artifact creature', () => {
    const state = createTestState();
    state.step = 'declare_blockers';
    state.activePlayer = 'player';
    state.priorityPlayer = 'opponent';

    // Add Razortooth Rats (black, Fear) as attacker
    const rats = CardLoader.getByName('Razortooth Rats')!;
    const ratsCard = createCardInstance(rats.id, 'player', 'battlefield');
    ratsCard.attacking = true;
    ratsCard.summoningSick = false;
    state.players.player.battlefield.push(ratsCard);

    // Add a non-black creature as potential blocker (Grizzly Bears is green)
    const bears = CardLoader.getByName('Grizzly Bears')!;
    const bearsCard = createCardInstance(bears.id, 'opponent', 'battlefield');
    bearsCard.summoningSick = false;
    state.players.opponent.battlefield.push(bearsCard);

    // Try to block with non-black creature
    const errors = validateAction(state, {
      type: 'DECLARE_BLOCKERS',
      playerId: 'opponent',
      payload: {
        blocks: [{ blockerId: bearsCard.instanceId, attackerId: ratsCard.instanceId }],
      },
    });

    expect(errors.some((e) => e.includes('Fear'))).toBe(true);
  });

  test('Fear creature can be blocked by artifact creature', () => {
    const state = createTestState();
    state.step = 'declare_blockers';
    state.activePlayer = 'player';
    state.priorityPlayer = 'opponent';

    // Add Razortooth Rats (black, Fear) as attacker
    const rats = CardLoader.getByName('Razortooth Rats')!;
    const ratsCard = createCardInstance(rats.id, 'player', 'battlefield');
    ratsCard.attacking = true;
    ratsCard.summoningSick = false;
    state.players.player.battlefield.push(ratsCard);

    // Add an artifact creature as potential blocker (Primal Clay defaults to 3/3 artifact creature)
    const clay = CardLoader.getByName('Primal Clay')!;
    const clayCard = createCardInstance(clay.id, 'opponent', 'battlefield');
    clayCard.summoningSick = false;
    clayCard.primalClayChoice = '3/3';
    state.players.opponent.battlefield.push(clayCard);

    // Try to block with artifact creature
    const errors = validateAction(state, {
      type: 'DECLARE_BLOCKERS',
      playerId: 'opponent',
      payload: {
        blocks: [{ blockerId: clayCard.instanceId, attackerId: ratsCard.instanceId }],
      },
    });

    expect(errors.length).toBe(0);
  });
});

// ==========================================
// INTIMIDATE TESTS
// ==========================================

describe('Intimidate Evasion', () => {
  test('hasIntimidate function works', () => {
    // Note: 6th Edition doesn't have Intimidate creatures natively (it was introduced later)
    // But we can verify the function works with a mock
    const mockCard = {
      keywords: ['Intimidate'],
      type_line: 'Creature',
    } as any;
    expect(hasIntimidate(mockCard)).toBe(true);
  });
});

// ==========================================
// MENACE TESTS
// ==========================================

describe('Menace Evasion', () => {
  test('Wind Spirit has Menace keyword', () => {
    const card = CardLoader.getByName('Wind Spirit');
    expect(card).toBeDefined();
    expect(hasMenace(card!)).toBe(true);
    expect(card?.keywords).toContain('Menace');
  });

  test('Menace creature cannot be blocked by single creature', () => {
    const state = createTestState();
    state.step = 'declare_blockers';
    state.activePlayer = 'player';
    state.priorityPlayer = 'opponent';

    // Wind Spirit has Flying and Menace
    const windSpirit = CardLoader.getByName('Wind Spirit')!;
    const spiritCard = createCardInstance(windSpirit.id, 'player', 'battlefield');
    spiritCard.attacking = true;
    spiritCard.summoningSick = false;
    state.players.player.battlefield.push(spiritCard);

    // Add a single blocker with Flying (to satisfy Flying restriction)
    const stormCrow = CardLoader.getByName('Storm Crow')!;
    const crowCard = createCardInstance(stormCrow.id, 'opponent', 'battlefield');
    crowCard.summoningSick = false;
    state.players.opponent.battlefield.push(crowCard);

    // Try to block with single creature - should fail due to Menace
    const errors = validateAction(state, {
      type: 'DECLARE_BLOCKERS',
      playerId: 'opponent',
      payload: {
        blocks: [{ blockerId: crowCard.instanceId, attackerId: spiritCard.instanceId }],
      },
    });

    expect(errors.some((e) => e.includes('Menace'))).toBe(true);
  });

  test('Menace creature can be blocked by two or more creatures', () => {
    const state = createTestState();
    state.step = 'declare_blockers';
    state.activePlayer = 'player';
    state.priorityPlayer = 'opponent';

    // Wind Spirit has Flying and Menace
    const windSpirit = CardLoader.getByName('Wind Spirit')!;
    const spiritCard = createCardInstance(windSpirit.id, 'player', 'battlefield');
    spiritCard.attacking = true;
    spiritCard.summoningSick = false;
    state.players.player.battlefield.push(spiritCard);

    // Add two flying blockers
    const stormCrow = CardLoader.getByName('Storm Crow')!;
    const crowCard1 = createCardInstance(stormCrow.id, 'opponent', 'battlefield');
    crowCard1.summoningSick = false;
    const crowCard2 = createCardInstance(stormCrow.id, 'opponent', 'battlefield');
    crowCard2.summoningSick = false;
    state.players.opponent.battlefield.push(crowCard1, crowCard2);

    // Block with two creatures - should be valid
    const errors = validateAction(state, {
      type: 'DECLARE_BLOCKERS',
      playerId: 'opponent',
      payload: {
        blocks: [
          { blockerId: crowCard1.instanceId, attackerId: spiritCard.instanceId },
          { blockerId: crowCard2.instanceId, attackerId: spiritCard.instanceId },
        ],
      },
    });

    // Should be valid when blocked by 2 creatures
    expect(errors.some((e) => e.includes('Menace'))).toBe(false);
  });
});

// ==========================================
// BATCH VERIFICATION
// ==========================================

describe('Evasion Creatures Batch Verification', () => {
  test('Razortooth Rats exists with Fear', () => {
    const card = CardLoader.getByName('Razortooth Rats');
    expect(card).toBeDefined();
    expect(card?.keywords).toContain('Fear');
  });

  test('Wind Spirit exists with Flying and Menace', () => {
    const card = CardLoader.getByName('Wind Spirit');
    expect(card).toBeDefined();
    expect(card?.keywords).toContain('Flying');
    expect(card?.keywords).toContain('Menace');
  });

  test('Storm Crow exists with Flying', () => {
    const card = CardLoader.getByName('Storm Crow');
    expect(card).toBeDefined();
    expect(card?.keywords).toContain('Flying');
  });
});
