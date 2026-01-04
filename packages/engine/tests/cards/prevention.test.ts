/**
 * Damage Prevention Tests (Phase 1.5.1)
 *
 * Tests for:
 * - Fog: Prevent all combat damage this turn
 * - Healing Salve: Gain 3 life (modal - prevention mode TODO)
 */

import { test, expect, describe, beforeAll } from 'bun:test';
import {
  CardLoader,
  createCardInstance,
  createGameState,
  applyAction,
  getPlayer,
  type CastSpellAction,
  type PassPriorityAction,
  type DeclareAttackersAction,
  type DeclareBlockersAction,
  type GameState,
} from '../../src/index';

beforeAll(() => {
  CardLoader.initialize();
});

// Helper to create a test game state
function createTestState(): GameState {
  const plains = CardLoader.getByName('Plains')!;
  const library = [createCardInstance(plains.id, 'player', 'library')];
  const oppLibrary = [createCardInstance(plains.id, 'opponent', 'library')];
  return createGameState(library, oppLibrary);
}

// ============================================================
// Fog Tests
// ============================================================

describe('Fog', () => {
  test('Fog exists in card pool', () => {
    const fog = CardLoader.getByName('Fog');
    expect(fog).toBeDefined();
    expect(fog?.type_line).toContain('Instant');
  });

  test('Fog sets preventAllCombatDamage flag', () => {
    const fog = CardLoader.getByName('Fog')!;
    const forest = CardLoader.getByName('Forest')!;

    let state = createTestState();
    const player = getPlayer(state, 'player');

    // Add Forest for mana
    const forestCard = createCardInstance(forest.id, 'player', 'battlefield');
    player.battlefield.push(forestCard);

    // Add Fog to hand
    const fogCard = createCardInstance(fog.id, 'player', 'hand');
    player.hand.push(fogCard);

    state.phase = 'combat';
    state.step = 'declare_attackers';

    // Cast Fog (costs {G})
    state = applyAction(state, {
      type: 'CAST_SPELL',
      playerId: 'player',
      payload: {
        cardInstanceId: fogCard.instanceId,
      },
    } as CastSpellAction);

    // Resolve Fog
    state = applyAction(state, {
      type: 'PASS_PRIORITY',
      playerId: 'opponent',
      payload: {},
    } as PassPriorityAction);

    state = applyAction(state, {
      type: 'PASS_PRIORITY',
      playerId: 'player',
      payload: {},
    } as PassPriorityAction);

    // Flag should be set
    expect(state.preventAllCombatDamage).toBe(true);

    // Fog should be in graveyard
    expect(getPlayer(state, 'player').graveyard.length).toBe(1);
  });

  test('Fog prevents all combat damage', () => {
    const fog = CardLoader.getByName('Fog')!;
    const forest = CardLoader.getByName('Forest')!;
    const bears = CardLoader.getByName('Grizzly Bears')!;
    const tiger = CardLoader.getByName('Sabretooth Tiger')!;

    let state = createTestState();
    const player = getPlayer(state, 'player');
    const opponent = getPlayer(state, 'opponent');

    // Add Forest for mana
    const forestCard = createCardInstance(forest.id, 'player', 'battlefield');
    player.battlefield.push(forestCard);

    // Add Fog to hand
    const fogCard = createCardInstance(fog.id, 'player', 'hand');
    player.hand.push(fogCard);

    // Add attacker to opponent - Sabretooth Tiger (2/1 first strike)
    const tigerCard = createCardInstance(tiger.id, 'opponent', 'battlefield');
    tigerCard.summoningSick = false;
    opponent.battlefield.push(tigerCard);

    // Add blocker to player - Grizzly Bears (2/2)
    const bearsCard = createCardInstance(bears.id, 'player', 'battlefield');
    bearsCard.summoningSick = false;
    player.battlefield.push(bearsCard);

    state.phase = 'combat';
    state.step = 'declare_attackers';
    state.activePlayer = 'opponent'; // Opponent's turn

    // Opponent declares attack
    state = applyAction(state, {
      type: 'DECLARE_ATTACKERS',
      playerId: 'opponent',
      payload: {
        attackers: [tigerCard.instanceId],
      },
    } as DeclareAttackersAction);

    // Player casts Fog in response
    state = applyAction(state, {
      type: 'CAST_SPELL',
      playerId: 'player',
      payload: {
        cardInstanceId: fogCard.instanceId,
      },
    } as CastSpellAction);

    // Resolve Fog
    state = applyAction(state, {
      type: 'PASS_PRIORITY',
      playerId: 'opponent',
      payload: {},
    } as PassPriorityAction);

    state = applyAction(state, {
      type: 'PASS_PRIORITY',
      playerId: 'player',
      payload: {},
    } as PassPriorityAction);

    // Now declare blockers
    state = applyAction(state, {
      type: 'DECLARE_BLOCKERS',
      playerId: 'player',
      payload: {
        blocks: [
          { blockerId: bearsCard.instanceId, attackerId: tigerCard.instanceId },
        ],
      },
    } as DeclareBlockersAction);

    // Both creatures should survive (no combat damage dealt)
    const newPlayer = getPlayer(state, 'player');
    const newOpponent = getPlayer(state, 'opponent');

    // Bears should still be on battlefield (normally would die to first strike)
    expect(newPlayer.battlefield.find(c => c.instanceId === bearsCard.instanceId)).toBeDefined();

    // Tiger should also survive
    expect(newOpponent.battlefield.find(c => c.instanceId === tigerCard.instanceId)).toBeDefined();
  });

  test('Fog resets at end of turn', () => {
    let state = createTestState();
    state.preventAllCombatDamage = true;

    // End the turn
    state = applyAction(state, {
      type: 'END_TURN',
      playerId: 'player',
      payload: {},
    });

    expect(state.preventAllCombatDamage).toBe(false);
  });
});

// ============================================================
// Healing Salve Tests
// ============================================================

describe('Healing Salve', () => {
  test('Healing Salve exists in card pool', () => {
    const salve = CardLoader.getByName('Healing Salve');
    expect(salve).toBeDefined();
    expect(salve?.type_line).toContain('Instant');
  });

  test('Healing Salve grants 3 life to target player', () => {
    const salve = CardLoader.getByName('Healing Salve')!;
    const plains = CardLoader.getByName('Plains')!;

    let state = createTestState();
    const player = getPlayer(state, 'player');

    // Set player to 10 life
    player.life = 10;

    // Add Plains for mana
    const plainsCard = createCardInstance(plains.id, 'player', 'battlefield');
    player.battlefield.push(plainsCard);

    // Add Healing Salve to hand
    const salveCard = createCardInstance(salve.id, 'player', 'hand');
    player.hand.push(salveCard);

    state.phase = 'main1';
    state.step = 'main';

    // Cast Healing Salve targeting self
    state = applyAction(state, {
      type: 'CAST_SPELL',
      playerId: 'player',
      payload: {
        cardInstanceId: salveCard.instanceId,
        targets: ['player'],
      },
    } as CastSpellAction);

    // Resolve
    state = applyAction(state, {
      type: 'PASS_PRIORITY',
      playerId: 'opponent',
      payload: {},
    } as PassPriorityAction);

    state = applyAction(state, {
      type: 'PASS_PRIORITY',
      playerId: 'player',
      payload: {},
    } as PassPriorityAction);

    // Player should have gained 3 life
    expect(getPlayer(state, 'player').life).toBe(13);
  });

  test('Healing Salve can target opponent', () => {
    const salve = CardLoader.getByName('Healing Salve')!;
    const plains = CardLoader.getByName('Plains')!;

    let state = createTestState();
    const player = getPlayer(state, 'player');
    const opponent = getPlayer(state, 'opponent');

    // Set opponent to 5 life
    opponent.life = 5;

    // Add Plains for mana
    const plainsCard = createCardInstance(plains.id, 'player', 'battlefield');
    player.battlefield.push(plainsCard);

    // Add Healing Salve to hand
    const salveCard = createCardInstance(salve.id, 'player', 'hand');
    player.hand.push(salveCard);

    state.phase = 'main1';
    state.step = 'main';

    // Cast Healing Salve targeting opponent
    state = applyAction(state, {
      type: 'CAST_SPELL',
      playerId: 'player',
      payload: {
        cardInstanceId: salveCard.instanceId,
        targets: ['opponent'],
      },
    } as CastSpellAction);

    // Resolve
    state = applyAction(state, {
      type: 'PASS_PRIORITY',
      playerId: 'opponent',
      payload: {},
    } as PassPriorityAction);

    state = applyAction(state, {
      type: 'PASS_PRIORITY',
      playerId: 'player',
      payload: {},
    } as PassPriorityAction);

    // Opponent should have gained 3 life
    expect(getPlayer(state, 'opponent').life).toBe(8);
  });
});
