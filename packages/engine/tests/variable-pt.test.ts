/**
 * Variable Power/Toughness Tests
 *
 * Tests for creatures whose power and toughness are calculated at runtime
 * based on game state (Phase 1.5.4).
 *
 * Variable P/T creatures in 6th Edition:
 * - Maro: P/T = cards in hand
 * - Nightmare: P/T = Swamps you control
 * - Uktabi Wildcats: P/T = Forests you control
 * - Primal Clay: Choice on ETB (3/3, 2/2 flying, or 1/6 wall)
 */

import { describe, test, expect } from 'bun:test';
import {
  CardLoader,
  createCardInstance,
  createGameState,
  getEffectivePowerWithLords,
  getEffectiveToughnessWithLords,
  calculateVariablePT,
  applyAction,
  hasKeywordWithLords,
  getAllKeywords,
} from '../src/index';

// Helper to create a basic game state
function createTestState() {
  const plains = CardLoader.getByName('Plains')!;
  const state = createGameState(
    [createCardInstance(plains.id, 'player', 'library')],
    [createCardInstance(plains.id, 'opponent', 'library')]
  );
  return state;
}

// ==========================================
// MARO TESTS
// ==========================================

describe('Maro - Cards in Hand P/T', () => {
  test('Maro exists in database with star P/T', () => {
    const card = CardLoader.getByName('Maro');
    expect(card).toBeDefined();
    expect(card?.power).toBe('*');
    expect(card?.toughness).toBe('*');
  });

  test('Maro has P/T equal to cards in hand (0 cards)', () => {
    const state = createTestState();
    const card = CardLoader.getByName('Maro')!;
    const maro = createCardInstance(card.id, 'player', 'battlefield');
    state.players.player.battlefield.push(maro);

    // Empty hand
    state.players.player.hand = [];

    const power = getEffectivePowerWithLords(state, maro, 0);
    const toughness = getEffectiveToughnessWithLords(state, maro, 0);

    expect(power).toBe(0);
    expect(toughness).toBe(0);
  });

  test('Maro has P/T equal to cards in hand (3 cards)', () => {
    const state = createTestState();
    const card = CardLoader.getByName('Maro')!;
    const maro = createCardInstance(card.id, 'player', 'battlefield');
    state.players.player.battlefield.push(maro);

    // Add 3 cards to hand
    const mountain = CardLoader.getByName('Mountain')!;
    state.players.player.hand = [
      createCardInstance(mountain.id, 'player', 'hand'),
      createCardInstance(mountain.id, 'player', 'hand'),
      createCardInstance(mountain.id, 'player', 'hand'),
    ];

    const power = getEffectivePowerWithLords(state, maro, 0);
    const toughness = getEffectiveToughnessWithLords(state, maro, 0);

    expect(power).toBe(3);
    expect(toughness).toBe(3);
  });

  test('Maro P/T changes dynamically with hand size', () => {
    const state = createTestState();
    const card = CardLoader.getByName('Maro')!;
    const maro = createCardInstance(card.id, 'player', 'battlefield');
    state.players.player.battlefield.push(maro);

    // Start with 5 cards
    const forest = CardLoader.getByName('Forest')!;
    state.players.player.hand = Array(5).fill(null).map(() =>
      createCardInstance(forest.id, 'player', 'hand')
    );

    expect(getEffectivePowerWithLords(state, maro, 0)).toBe(5);
    expect(getEffectiveToughnessWithLords(state, maro, 0)).toBe(5);

    // Remove 2 cards (simulating discard or casting)
    state.players.player.hand.pop();
    state.players.player.hand.pop();

    expect(getEffectivePowerWithLords(state, maro, 0)).toBe(3);
    expect(getEffectiveToughnessWithLords(state, maro, 0)).toBe(3);

    // Add 4 more cards
    for (let i = 0; i < 4; i++) {
      state.players.player.hand.push(createCardInstance(forest.id, 'player', 'hand'));
    }

    expect(getEffectivePowerWithLords(state, maro, 0)).toBe(7);
    expect(getEffectiveToughnessWithLords(state, maro, 0)).toBe(7);
  });

  test('Maro with +1/+1 counter gets bonus on top of base P/T', () => {
    const state = createTestState();
    const card = CardLoader.getByName('Maro')!;
    const maro = createCardInstance(card.id, 'player', 'battlefield');
    state.players.player.battlefield.push(maro);

    // 4 cards in hand
    const island = CardLoader.getByName('Island')!;
    state.players.player.hand = Array(4).fill(null).map(() =>
      createCardInstance(island.id, 'player', 'hand')
    );

    // Add a +1/+1 counter
    maro.counters['+1/+1'] = 1;

    expect(getEffectivePowerWithLords(state, maro, 0)).toBe(5); // 4 + 1
    expect(getEffectiveToughnessWithLords(state, maro, 0)).toBe(5);
  });
});

// ==========================================
// NIGHTMARE TESTS
// ==========================================

describe('Nightmare - Swamps P/T', () => {
  test('Nightmare exists in database with star P/T', () => {
    const card = CardLoader.getByName('Nightmare');
    expect(card).toBeDefined();
    expect(card?.power).toBe('*');
    expect(card?.toughness).toBe('*');
    expect(card?.keywords).toContain('Flying');
  });

  test('Nightmare has P/T equal to Swamps controlled (0 Swamps)', () => {
    const state = createTestState();
    const card = CardLoader.getByName('Nightmare')!;
    const nightmare = createCardInstance(card.id, 'player', 'battlefield');
    state.players.player.battlefield.push(nightmare);

    // No swamps
    const power = getEffectivePowerWithLords(state, nightmare, 0);
    const toughness = getEffectiveToughnessWithLords(state, nightmare, 0);

    expect(power).toBe(0);
    expect(toughness).toBe(0);
  });

  test('Nightmare has P/T equal to Swamps controlled (3 Swamps)', () => {
    const state = createTestState();
    const card = CardLoader.getByName('Nightmare')!;
    const nightmare = createCardInstance(card.id, 'player', 'battlefield');
    state.players.player.battlefield.push(nightmare);

    // Add 3 Swamps
    const swamp = CardLoader.getByName('Swamp')!;
    for (let i = 0; i < 3; i++) {
      state.players.player.battlefield.push(
        createCardInstance(swamp.id, 'player', 'battlefield')
      );
    }

    const power = getEffectivePowerWithLords(state, nightmare, 0);
    const toughness = getEffectiveToughnessWithLords(state, nightmare, 0);

    expect(power).toBe(3);
    expect(toughness).toBe(3);
  });

  test('Nightmare counts only controller\'s Swamps', () => {
    const state = createTestState();
    const card = CardLoader.getByName('Nightmare')!;
    const nightmare = createCardInstance(card.id, 'player', 'battlefield');
    state.players.player.battlefield.push(nightmare);

    // Add 2 Swamps for player
    const swamp = CardLoader.getByName('Swamp')!;
    for (let i = 0; i < 2; i++) {
      state.players.player.battlefield.push(
        createCardInstance(swamp.id, 'player', 'battlefield')
      );
    }

    // Add 4 Swamps for opponent (should not count)
    for (let i = 0; i < 4; i++) {
      state.players.opponent.battlefield.push(
        createCardInstance(swamp.id, 'opponent', 'battlefield')
      );
    }

    const power = getEffectivePowerWithLords(state, nightmare, 0);
    expect(power).toBe(2); // Only controller's Swamps
  });

  test('Nightmare updates when Swamps enter/leave', () => {
    const state = createTestState();
    const card = CardLoader.getByName('Nightmare')!;
    const nightmare = createCardInstance(card.id, 'player', 'battlefield');
    state.players.player.battlefield.push(nightmare);

    const swamp = CardLoader.getByName('Swamp')!;

    // Initially no swamps
    expect(getEffectivePowerWithLords(state, nightmare, 0)).toBe(0);

    // Add a swamp
    const swampCard = createCardInstance(swamp.id, 'player', 'battlefield');
    state.players.player.battlefield.push(swampCard);
    expect(getEffectivePowerWithLords(state, nightmare, 0)).toBe(1);

    // Add 2 more swamps
    state.players.player.battlefield.push(
      createCardInstance(swamp.id, 'player', 'battlefield'),
      createCardInstance(swamp.id, 'player', 'battlefield')
    );
    expect(getEffectivePowerWithLords(state, nightmare, 0)).toBe(3);

    // Remove one swamp
    const swampIndex = state.players.player.battlefield.findIndex(
      c => c.instanceId === swampCard.instanceId
    );
    state.players.player.battlefield.splice(swampIndex, 1);
    expect(getEffectivePowerWithLords(state, nightmare, 0)).toBe(2);
  });
});

// ==========================================
// UKTABI WILDCATS TESTS
// ==========================================

describe('Uktabi Wildcats - Forests P/T', () => {
  test('Uktabi Wildcats exists in database with star P/T', () => {
    const card = CardLoader.getByName('Uktabi Wildcats');
    expect(card).toBeDefined();
    expect(card?.power).toBe('*');
    expect(card?.toughness).toBe('*');
  });

  test('Uktabi Wildcats has P/T equal to Forests controlled (0 Forests)', () => {
    const state = createTestState();
    const card = CardLoader.getByName('Uktabi Wildcats')!;
    const wildcats = createCardInstance(card.id, 'player', 'battlefield');
    state.players.player.battlefield.push(wildcats);

    // No forests
    const power = getEffectivePowerWithLords(state, wildcats, 0);
    const toughness = getEffectiveToughnessWithLords(state, wildcats, 0);

    expect(power).toBe(0);
    expect(toughness).toBe(0);
  });

  test('Uktabi Wildcats has P/T equal to Forests controlled (4 Forests)', () => {
    const state = createTestState();
    const card = CardLoader.getByName('Uktabi Wildcats')!;
    const wildcats = createCardInstance(card.id, 'player', 'battlefield');
    state.players.player.battlefield.push(wildcats);

    // Add 4 Forests
    const forest = CardLoader.getByName('Forest')!;
    for (let i = 0; i < 4; i++) {
      state.players.player.battlefield.push(
        createCardInstance(forest.id, 'player', 'battlefield')
      );
    }

    const power = getEffectivePowerWithLords(state, wildcats, 0);
    const toughness = getEffectiveToughnessWithLords(state, wildcats, 0);

    expect(power).toBe(4);
    expect(toughness).toBe(4);
  });

  test('Uktabi Wildcats counts only controller\'s Forests', () => {
    const state = createTestState();
    const card = CardLoader.getByName('Uktabi Wildcats')!;
    const wildcats = createCardInstance(card.id, 'player', 'battlefield');
    state.players.player.battlefield.push(wildcats);

    // Add 3 Forests for player
    const forest = CardLoader.getByName('Forest')!;
    for (let i = 0; i < 3; i++) {
      state.players.player.battlefield.push(
        createCardInstance(forest.id, 'player', 'battlefield')
      );
    }

    // Add 5 Forests for opponent (should not count)
    for (let i = 0; i < 5; i++) {
      state.players.opponent.battlefield.push(
        createCardInstance(forest.id, 'opponent', 'battlefield')
      );
    }

    const power = getEffectivePowerWithLords(state, wildcats, 0);
    expect(power).toBe(3); // Only controller's Forests
  });
});

// ==========================================
// PRIMAL CLAY TESTS
// ==========================================

describe('Primal Clay - ETB Choice P/T', () => {
  test('Primal Clay exists in database with star P/T', () => {
    const card = CardLoader.getByName('Primal Clay');
    expect(card).toBeDefined();
    expect(card?.power).toBe('*');
    expect(card?.toughness).toBe('*');
  });

  test('Primal Clay defaults to 3/3', () => {
    const state = createTestState();
    const card = CardLoader.getByName('Primal Clay')!;
    const clay = createCardInstance(card.id, 'player', 'battlefield');
    state.players.player.battlefield.push(clay);

    // No choice set - defaults to 3/3
    const power = getEffectivePowerWithLords(state, clay, 0);
    const toughness = getEffectiveToughnessWithLords(state, clay, 0);

    expect(power).toBe(3);
    expect(toughness).toBe(3);
  });

  test('Primal Clay with 3/3 choice', () => {
    const state = createTestState();
    const card = CardLoader.getByName('Primal Clay')!;
    const clay = createCardInstance(card.id, 'player', 'battlefield');
    clay.primalClayChoice = '3/3';
    state.players.player.battlefield.push(clay);

    expect(getEffectivePowerWithLords(state, clay, 0)).toBe(3);
    expect(getEffectiveToughnessWithLords(state, clay, 0)).toBe(3);
  });

  test('Primal Clay with 2/2 flying choice', () => {
    const state = createTestState();
    const card = CardLoader.getByName('Primal Clay')!;
    const clay = createCardInstance(card.id, 'player', 'battlefield');
    clay.primalClayChoice = '2/2 flying';
    state.players.player.battlefield.push(clay);

    expect(getEffectivePowerWithLords(state, clay, 0)).toBe(2);
    expect(getEffectiveToughnessWithLords(state, clay, 0)).toBe(2);
  });

  test('Primal Clay with 1/6 wall choice', () => {
    const state = createTestState();
    const card = CardLoader.getByName('Primal Clay')!;
    const clay = createCardInstance(card.id, 'player', 'battlefield');
    clay.primalClayChoice = '1/6 wall';
    state.players.player.battlefield.push(clay);

    expect(getEffectivePowerWithLords(state, clay, 0)).toBe(1);
    expect(getEffectiveToughnessWithLords(state, clay, 0)).toBe(6);
  });

  test('Primal Clay wall choice can still receive counters', () => {
    const state = createTestState();
    const card = CardLoader.getByName('Primal Clay')!;
    const clay = createCardInstance(card.id, 'player', 'battlefield');
    clay.primalClayChoice = '1/6 wall';
    clay.counters['+1/+1'] = 2;
    state.players.player.battlefield.push(clay);

    expect(getEffectivePowerWithLords(state, clay, 0)).toBe(3);  // 1 + 2
    expect(getEffectiveToughnessWithLords(state, clay, 0)).toBe(8);  // 6 + 2
  });

  test('Primal Clay with 2/2 flying choice has Flying keyword', () => {
    const state = createTestState();
    const card = CardLoader.getByName('Primal Clay')!;
    const clay = createCardInstance(card.id, 'player', 'battlefield');
    clay.primalClayChoice = '2/2 flying';
    state.players.player.battlefield.push(clay);

    expect(hasKeywordWithLords(state, clay, 'Flying')).toBe(true);
    expect(hasKeywordWithLords(state, clay, 'Defender')).toBe(false);

    const allKeywords = getAllKeywords(state, clay);
    expect(allKeywords).toContain('Flying');
  });

  test('Primal Clay with 1/6 wall choice has Defender keyword', () => {
    const state = createTestState();
    const card = CardLoader.getByName('Primal Clay')!;
    const clay = createCardInstance(card.id, 'player', 'battlefield');
    clay.primalClayChoice = '1/6 wall';
    state.players.player.battlefield.push(clay);

    expect(hasKeywordWithLords(state, clay, 'Defender')).toBe(true);
    expect(hasKeywordWithLords(state, clay, 'Flying')).toBe(false);

    const allKeywords = getAllKeywords(state, clay);
    expect(allKeywords).toContain('Defender');
  });

  test('Primal Clay with 3/3 choice has no special keywords', () => {
    const state = createTestState();
    const card = CardLoader.getByName('Primal Clay')!;
    const clay = createCardInstance(card.id, 'player', 'battlefield');
    clay.primalClayChoice = '3/3';
    state.players.player.battlefield.push(clay);

    expect(hasKeywordWithLords(state, clay, 'Flying')).toBe(false);
    expect(hasKeywordWithLords(state, clay, 'Defender')).toBe(false);
  });
});

// ==========================================
// VARIABLE P/T HELPER FUNCTION TESTS
// ==========================================

describe('calculateVariablePT helper', () => {
  test('Returns null for non-variable P/T creatures', () => {
    const state = createTestState();
    const template = CardLoader.getByName('Grizzly Bears')!;
    const bear = createCardInstance(template.id, 'player', 'battlefield');

    const result = calculateVariablePT(state, bear, template);
    expect(result).toBeNull();
  });

  test('Returns P/T for Maro', () => {
    const state = createTestState();
    const template = CardLoader.getByName('Maro')!;
    const maro = createCardInstance(template.id, 'player', 'battlefield');

    // 2 cards in hand
    const forest = CardLoader.getByName('Forest')!;
    state.players.player.hand = [
      createCardInstance(forest.id, 'player', 'hand'),
      createCardInstance(forest.id, 'player', 'hand'),
    ];

    const result = calculateVariablePT(state, maro, template);
    expect(result).toEqual({ power: 2, toughness: 2 });
  });

  test('Returns P/T for Nightmare', () => {
    const state = createTestState();
    const template = CardLoader.getByName('Nightmare')!;
    const nightmare = createCardInstance(template.id, 'player', 'battlefield');

    // 3 swamps
    const swamp = CardLoader.getByName('Swamp')!;
    for (let i = 0; i < 3; i++) {
      state.players.player.battlefield.push(
        createCardInstance(swamp.id, 'player', 'battlefield')
      );
    }

    const result = calculateVariablePT(state, nightmare, template);
    expect(result).toEqual({ power: 3, toughness: 3 });
  });
});

// ==========================================
// STATE-BASED ACTIONS WITH VARIABLE P/T
// ==========================================

describe('Variable P/T and State-Based Actions', () => {
  test('Maro with 0 cards in hand dies to SBA', () => {
    const state = createTestState();
    const card = CardLoader.getByName('Maro')!;
    const maro = createCardInstance(card.id, 'player', 'battlefield');
    state.players.player.battlefield.push(maro);

    // Empty hand - Maro is 0/0
    state.players.player.hand = [];

    // Pass priority to trigger SBAs
    const newState = applyAction(state, {
      type: 'PASS_PRIORITY',
      playerId: 'player',
    });

    // Maro should be dead (0 toughness)
    const maroOnBattlefield = newState.players.player.battlefield.find(
      c => c.instanceId === maro.instanceId
    );
    expect(maroOnBattlefield).toBeUndefined();

    // Should be in graveyard
    const maroInGraveyard = newState.players.player.graveyard.find(
      c => c.instanceId === maro.instanceId
    );
    expect(maroInGraveyard).toBeDefined();
  });

  test('Nightmare with 0 swamps dies to SBA', () => {
    const state = createTestState();
    const card = CardLoader.getByName('Nightmare')!;
    const nightmare = createCardInstance(card.id, 'player', 'battlefield');
    state.players.player.battlefield.push(nightmare);

    // No swamps - Nightmare is 0/0
    // Pass priority to trigger SBAs
    const newState = applyAction(state, {
      type: 'PASS_PRIORITY',
      playerId: 'player',
    });

    // Nightmare should be dead
    const nightmareOnBattlefield = newState.players.player.battlefield.find(
      c => c.instanceId === nightmare.instanceId
    );
    expect(nightmareOnBattlefield).toBeUndefined();
  });

  test('Maro survives when hand has cards', () => {
    const state = createTestState();
    const card = CardLoader.getByName('Maro')!;
    const maro = createCardInstance(card.id, 'player', 'battlefield');
    state.players.player.battlefield.push(maro);

    // 3 cards in hand
    const forest = CardLoader.getByName('Forest')!;
    state.players.player.hand = [
      createCardInstance(forest.id, 'player', 'hand'),
      createCardInstance(forest.id, 'player', 'hand'),
      createCardInstance(forest.id, 'player', 'hand'),
    ];

    // Pass priority to trigger SBAs
    const newState = applyAction(state, {
      type: 'PASS_PRIORITY',
      playerId: 'player',
    });

    // Maro should still be on battlefield
    const maroOnBattlefield = newState.players.player.battlefield.find(
      c => c.instanceId === maro.instanceId
    );
    expect(maroOnBattlefield).toBeDefined();
  });
});
