/**
 * Tests for X-cost spell handling
 *
 * Week 1.5.1: X-cost infrastructure and implementations
 */

import { test, expect, beforeAll } from 'bun:test';
import {
  CardLoader,
  createCardInstance,
  createGameState,
  applyAction,
  type CastSpellAction,
} from '../../src/index';
import {
  setupGameWithMana,
  createCreatureOnBattlefield,
  createCardInHand,
  castAndResolve,
} from './helpers';

beforeAll(() => {
  CardLoader.initialize();
});

// ============================================================
// Earthquake Tests
// ============================================================

test('Earthquake deals X damage to non-flying creatures and all players', () => {
  // Setup: Player has 3 mountains (X=2 + 1R = 3)
  const state = setupGameWithMana({ R: 3 });

  // Player's 2/2 ground creature (will take damage)
  createCreatureOnBattlefield(state, 'Grizzly Bears', 'player');

  // Opponent's ground creature
  createCreatureOnBattlefield(state, 'Grizzly Bears', 'opponent');

  // Opponent's flying creature (won't take damage)
  createCreatureOnBattlefield(state, 'Air Elemental', 'opponent');

  // Add Earthquake to hand
  const earthquake = createCardInHand(state, 'Earthquake', 'player');

  // Cast Earthquake with X=2 (3 mana total: {X=2}{R})
  // This should kill both Grizzly Bears and deal 2 damage to each player
  state.priorityPlayer = 'player';
  const finalState = castAndResolve(state, 'player', earthquake.instanceId, [], 2);

  // Check player life (20 - 2 = 18)
  expect(finalState.players.player.life).toBe(18);

  // Check opponent life (20 - 2 = 18)
  expect(finalState.players.opponent.life).toBe(18);

  // Both ground creatures should be dead (2 damage >= 2 toughness)
  expect(finalState.players.player.battlefield.filter(c =>
    CardLoader.getById(c.scryfallId)?.name === 'Grizzly Bears'
  ).length).toBe(0);

  expect(finalState.players.opponent.battlefield.filter(c =>
    CardLoader.getById(c.scryfallId)?.name === 'Grizzly Bears'
  ).length).toBe(0);

  // Flying creature should still be alive
  expect(finalState.players.opponent.battlefield.filter(c =>
    CardLoader.getById(c.scryfallId)?.name === 'Air Elemental'
  ).length).toBe(1);
});

test('Earthquake with X=0 does nothing', () => {
  // {X=0}{R} = 1 mana
  const state = setupGameWithMana({ R: 1 });
  createCreatureOnBattlefield(state, 'Grizzly Bears', 'player');

  const earthquake = createCardInHand(state, 'Earthquake', 'player');
  state.priorityPlayer = 'player';

  const finalState = castAndResolve(state, 'player', earthquake.instanceId, [], 0);

  // Life unchanged
  expect(finalState.players.player.life).toBe(20);
  expect(finalState.players.opponent.life).toBe(20);

  // Creature still alive (battlefield includes lands, so check for the bears specifically)
  expect(finalState.players.player.battlefield.filter(c =>
    CardLoader.getById(c.scryfallId)?.name === 'Grizzly Bears'
  ).length).toBe(1);
});

// ============================================================
// Hurricane Tests
// ============================================================

test('Hurricane deals X damage to flying creatures and all players', () => {
  // Hurricane is {X}{G}, so X=4 needs 5 green
  const state = setupGameWithMana({ G: 5 });

  // Ground creature (won't take damage from Hurricane)
  createCreatureOnBattlefield(state, 'Grizzly Bears', 'player');

  // Flying creature (will take damage) - Air Elemental is 4/4
  createCreatureOnBattlefield(state, 'Air Elemental', 'opponent');

  const hurricane = createCardInHand(state, 'Hurricane', 'player');
  state.priorityPlayer = 'player';

  // Cast Hurricane with X=4 (kills 4/4 Air Elemental)
  const finalState = castAndResolve(state, 'player', hurricane.instanceId, [], 4);

  // Both players take 4 damage
  expect(finalState.players.player.life).toBe(16);
  expect(finalState.players.opponent.life).toBe(16);

  // Ground creature still alive
  expect(finalState.players.player.battlefield.filter(c =>
    CardLoader.getById(c.scryfallId)?.name === 'Grizzly Bears'
  ).length).toBe(1);

  // Flying creature should be dead
  expect(finalState.players.opponent.battlefield.filter(c =>
    CardLoader.getById(c.scryfallId)?.name === 'Air Elemental'
  ).length).toBe(0);
});

// ============================================================
// Stream of Life Tests
// ============================================================

test('Stream of Life causes target player to gain X life', () => {
  // Stream of Life is {X}{G}, so X=5 needs 6 green
  const state = setupGameWithMana({ G: 6 });

  // Damage the player first
  state.players.player.life = 10;

  const streamOfLife = createCardInHand(state, 'Stream of Life', 'player');
  state.priorityPlayer = 'player';

  // Cast Stream of Life with X=5, targeting self
  const finalState = castAndResolve(state, 'player', streamOfLife.instanceId, ['player'], 5);

  // Player gains 5 life (10 + 5 = 15)
  expect(finalState.players.player.life).toBe(15);
});

test('Stream of Life can target opponent', () => {
  // {X=3}{G} = 4 mana
  const state = setupGameWithMana({ G: 4 });

  const streamOfLife = createCardInHand(state, 'Stream of Life', 'player');
  state.priorityPlayer = 'player';

  // Cast with X=3 targeting opponent
  const finalState = castAndResolve(state, 'player', streamOfLife.instanceId, ['opponent'], 3);

  // Opponent gains 3 life
  expect(finalState.players.opponent.life).toBe(23);
});

// ============================================================
// Blaze Tests
// ============================================================

test('Blaze deals X damage to target creature', () => {
  // Blaze is {X}{R}, so X=2 needs 3 mana to kill a 2/2
  const state = setupGameWithMana({ R: 3 });

  const creature = createCreatureOnBattlefield(state, 'Grizzly Bears', 'opponent');

  const blaze = createCardInHand(state, 'Blaze', 'player');
  state.priorityPlayer = 'player';

  // Cast Blaze with X=2 to kill the 2/2
  const finalState = castAndResolve(state, 'player', blaze.instanceId, [creature.instanceId], 2);

  // Grizzly Bears should be dead
  expect(finalState.players.opponent.battlefield.filter(c =>
    CardLoader.getById(c.scryfallId)?.name === 'Grizzly Bears'
  ).length).toBe(0);
});

test('Blaze deals X damage to target player', () => {
  // {X=5}{R} = 6 mana
  const state = setupGameWithMana({ R: 6 });

  const blaze = createCardInHand(state, 'Blaze', 'player');
  state.priorityPlayer = 'player';

  // Cast Blaze with X=5 targeting opponent
  const finalState = castAndResolve(state, 'player', blaze.instanceId, ['opponent'], 5);

  // Opponent takes 5 damage
  expect(finalState.players.opponent.life).toBe(15);
});

// ============================================================
// Howl from Beyond Tests
// ============================================================

test('Howl from Beyond gives +X/+0', () => {
  // Howl from Beyond is {X}{B}, so X=3 needs 4 black
  const state = setupGameWithMana({ B: 4 });

  const creature = createCreatureOnBattlefield(state, 'Grizzly Bears', 'player');

  const howl = createCardInHand(state, 'Howl from Beyond', 'player');
  state.priorityPlayer = 'player';

  // Cast with X=3
  const finalState = castAndResolve(state, 'player', howl.instanceId, [creature.instanceId], 3);

  // Find the creature on battlefield
  const pumpedCreature = finalState.players.player.battlefield.find(
    c => c.instanceId === creature.instanceId
  );

  // Should have +3/+0 modification
  expect(pumpedCreature?.temporaryModifications?.length).toBe(1);
  expect(pumpedCreature?.temporaryModifications?.[0]?.powerChange).toBe(3);
  expect(pumpedCreature?.temporaryModifications?.[0]?.toughnessChange).toBe(0);
});

// ============================================================
// Mind Warp Tests
// ============================================================

test('Mind Warp makes target player discard X cards', () => {
  // Mind Warp is {X}{3}{B}, so X=2 needs 2 + 3 + 1 = 6 mana
  const state = setupGameWithMana({ B: 6 });

  // Give opponent 5 cards in hand
  for (let i = 0; i < 5; i++) {
    createCardInHand(state, 'Grizzly Bears', 'opponent');
  }

  const mindWarp = createCardInHand(state, 'Mind Warp', 'player');
  state.priorityPlayer = 'player';

  // Cast with X=2 (total 6 mana: X2 + 3 + B)
  const finalState = castAndResolve(state, 'player', mindWarp.instanceId, ['opponent'], 2);

  // Opponent should have 3 cards left (5 - 2)
  expect(finalState.players.opponent.hand.length).toBe(3);
});

// ============================================================
// Prosperity Tests
// ============================================================

test('Prosperity makes each player draw X cards', () => {
  // Prosperity is {X}{U}, so X=3 needs 4 blue
  const state = setupGameWithMana({ U: 4 });

  // Add cards to libraries
  const plains = CardLoader.getByName('Plains')!;
  for (let i = 0; i < 5; i++) {
    state.players.player.library.push(createCardInstance(plains.id, 'player', 'library'));
    state.players.opponent.library.push(createCardInstance(plains.id, 'opponent', 'library'));
  }

  // Prosperity goes into hand (createCardInHand adds 1 to hand)
  const prosperity = createCardInHand(state, 'Prosperity', 'player');

  // Hand size is now 1 (prosperity)
  const playerHandBefore = state.players.player.hand.length; // 1
  const opponentHandBefore = state.players.opponent.hand.length; // 0

  state.priorityPlayer = 'player';

  // Cast with X=3 - prosperity leaves hand, then both draw 3
  const finalState = castAndResolve(state, 'player', prosperity.instanceId, [], 3);

  // Player: started with 1 (prosperity), cast it (-1), drew 3 = 3
  expect(finalState.players.player.hand.length).toBe(3);
  // Opponent: started with 0, drew 3 = 3
  expect(finalState.players.opponent.hand.length).toBe(3);
});

// ============================================================
// Volcanic Geyser Tests (instant-speed X damage)
// ============================================================

test('Volcanic Geyser deals X damage at instant speed', () => {
  // Volcanic Geyser is {X}{R}{R}, so X=3 needs 5 red
  const state = setupGameWithMana({ R: 5 });

  const geyser = createCardInHand(state, 'Volcanic Geyser', 'player');
  state.priorityPlayer = 'player';

  // Cast with X=3 targeting opponent (total 5 mana: X3 + R + R)
  const finalState = castAndResolve(state, 'player', geyser.instanceId, ['opponent'], 3);

  // Opponent takes 3 damage
  expect(finalState.players.opponent.life).toBe(17);
});
