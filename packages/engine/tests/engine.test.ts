/**
 * Basic engine tests - verify core functionality
 */

import { describe, test, expect } from 'bun:test';
import {
  CardLoader,
  createCardInstance,
  createGameState,
  applyAction,
  getPlayer,
  type PlayLandAction,
  type CastSpellAction,
} from '../src/index';

describe('CardLoader', () => {
  test('loads 6th Edition cards', () => {
    const allCards = CardLoader.getAllCards();
    expect(allCards.length).toBe(335);
  });

  test('can find Lightning Blast by name', () => {
    const blast = CardLoader.getByName('Lightning Blast');
    expect(blast).toBeDefined();
    expect(blast?.name).toBe('Lightning Blast');
    expect(blast?.colors).toContain('R');
  });

  test('can find cards by type', () => {
    const creatures = CardLoader.getCardsByType('Creature');
    expect(creatures.length).toBeGreaterThan(0);

    const lands = CardLoader.getCardsByType('Land');
    expect(lands.length).toBeGreaterThan(0);
  });
});

describe('Game State', () => {
  test('creates initial game state', () => {
    const library = [
      createCardInstance('test-id-1', 'player', 'library'),
      createCardInstance('test-id-2', 'player', 'library'),
    ];

    const state = createGameState(library, library);

    expect(state.turnCount).toBe(1);
    expect(state.activePlayer).toBe('player');
    expect(state.players.player.life).toBe(20);
    expect(state.players.opponent.life).toBe(20);
  });
});

describe('Actions', () => {
  test('can play a land', () => {
    // Setup: Find a basic land
    const mountain = CardLoader.getByName('Mountain');
    expect(mountain).toBeDefined();

    // Create a card instance in hand
    const mountainCard = createCardInstance(mountain!.id, 'player', 'hand');

    // Create minimal game state
    const playerLibrary = [
      createCardInstance(mountain!.id, 'player', 'library'),
    ];

    const state = createGameState(playerLibrary, playerLibrary);

    // Put mountain in hand
    const player = getPlayer(state, 'player');
    player.hand.push(mountainCard);

    // Set to main phase
    state.phase = 'main1';
    state.step = 'main';

    // Play land action
    const action: PlayLandAction = {
      type: 'PLAY_LAND',
      playerId: 'player',
      payload: {
        cardInstanceId: mountainCard.instanceId,
      },
    };

    const newState = applyAction(state, action);

    // Verify land is on battlefield
    const newPlayer = getPlayer(newState, 'player');
    expect(newPlayer.battlefield.length).toBe(1);
    expect(newPlayer.hand.length).toBe(0);
    expect(newPlayer.landsPlayedThisTurn).toBe(1);
  });

  test('can cast a creature', () => {
    // Setup: Find Grizzly Bears
    const bears = CardLoader.getByName('Grizzly Bears');
    expect(bears).toBeDefined();

    const bearsCard = createCardInstance(bears!.id, 'player', 'hand');

    const playerLibrary = [
      createCardInstance(bears!.id, 'player', 'library'),
    ];

    const state = createGameState(playerLibrary, playerLibrary);

    // Put bears in hand
    const player = getPlayer(state, 'player');
    player.hand.push(bearsCard);

    // Set to main phase
    state.phase = 'main1';
    state.step = 'main';

    // Cast spell action
    const action: CastSpellAction = {
      type: 'CAST_SPELL',
      playerId: 'player',
      payload: {
        cardInstanceId: bearsCard.instanceId,
      },
    };

    const newState = applyAction(state, action);

    // Verify creature is on battlefield
    const newPlayer = getPlayer(newState, 'player');
    expect(newPlayer.battlefield.length).toBe(1);
    expect(newPlayer.hand.length).toBe(0);

    const creature = newPlayer.battlefield[0]!;
    expect(creature.summoningSick).toBe(true);
  });

  test('validates actions correctly', () => {
    const mountain = CardLoader.getByName('Mountain');
    const mountainCard = createCardInstance(mountain!.id, 'player', 'hand');

    const playerLibrary = [
      createCardInstance(mountain!.id, 'player', 'library'),
    ];

    const state = createGameState(playerLibrary, playerLibrary);
    const player = getPlayer(state, 'player');
    player.hand.push(mountainCard);

    // Try to play land during opponent's turn
    state.activePlayer = 'opponent';

    const action: PlayLandAction = {
      type: 'PLAY_LAND',
      playerId: 'player',
      payload: {
        cardInstanceId: mountainCard.instanceId,
      },
    };

    expect(() => applyAction(state, action)).toThrow();
  });
});
