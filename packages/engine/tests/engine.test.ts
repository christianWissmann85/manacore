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
  type PassPriorityAction,
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
    // Setup: Find Grizzly Bears (costs {1}{G})
    const bears = CardLoader.getByName('Grizzly Bears');
    const forest = CardLoader.getByName('Forest');
    expect(bears).toBeDefined();
    expect(forest).toBeDefined();

    const bearsCard = createCardInstance(bears!.id, 'player', 'hand');

    const playerLibrary = [
      createCardInstance(bears!.id, 'player', 'library'),
    ];

    let state = createGameState(playerLibrary, playerLibrary);

    // Put bears in hand
    const player = getPlayer(state, 'player');
    player.hand.push(bearsCard);

    // Add 2 Forests to battlefield for mana (Grizzly Bears costs {1}{G})
    const forest1 = createCardInstance(forest!.id, 'player', 'battlefield');
    const forest2 = createCardInstance(forest!.id, 'player', 'battlefield');
    player.battlefield.push(forest1, forest2);

    // Set to main phase
    state.phase = 'main1';
    state.step = 'main';

    // Cast spell action
    state = applyAction(state, {
      type: 'CAST_SPELL',
      playerId: 'player',
      payload: {
        cardInstanceId: bearsCard.instanceId,
      },
    } as CastSpellAction);

    // Spell is now on stack
    expect(state.stack.length).toBe(1);

    // Both players pass priority to resolve
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

    // Verify creature is on battlefield after resolution
    const newPlayer = getPlayer(state, 'player');
    expect(newPlayer.battlefield.length).toBe(3); // 2 forests + 1 creature
    expect(newPlayer.hand.length).toBe(0);

    const creature = newPlayer.battlefield.find(c => c.instanceId === bearsCard.instanceId)!;
    expect(creature).toBeDefined();
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

describe('The Stack', () => {
  test('casting a spell puts it on the stack', () => {
    const bears = CardLoader.getByName('Grizzly Bears');
    const forest = CardLoader.getByName('Forest');
    expect(bears).toBeDefined();
    expect(forest).toBeDefined();

    const bearsCard = createCardInstance(bears!.id, 'player', 'hand');
    const playerLibrary = [createCardInstance(bears!.id, 'player', 'library')];
    const state = createGameState(playerLibrary, playerLibrary);

    const player = getPlayer(state, 'player');
    player.hand.push(bearsCard);

    // Add mana sources for Grizzly Bears ({1}{G})
    player.battlefield.push(
      createCardInstance(forest!.id, 'player', 'battlefield'),
      createCardInstance(forest!.id, 'player', 'battlefield'),
    );

    state.phase = 'main1';
    state.step = 'main';

    const action: CastSpellAction = {
      type: 'CAST_SPELL',
      playerId: 'player',
      payload: { cardInstanceId: bearsCard.instanceId },
    };

    const newState = applyAction(state, action);

    // Spell should be on stack
    expect(newState.stack.length).toBe(1);
    expect(newState.stack[0]?.card.instanceId).toBe(bearsCard.instanceId);

    // Card should not be in hand
    const newPlayer = getPlayer(newState, 'player');
    expect(newPlayer.hand.length).toBe(0);
    // Note: battlefield now has tapped lands from mana payment
  });

  test('both players must pass priority before resolving', () => {
    const bears = CardLoader.getByName('Grizzly Bears');
    const forest = CardLoader.getByName('Forest');
    const bearsCard = createCardInstance(bears!.id, 'player', 'hand');
    const playerLibrary = [createCardInstance(bears!.id, 'player', 'library')];
    let state = createGameState(playerLibrary, playerLibrary);

    const player = getPlayer(state, 'player');
    player.hand.push(bearsCard);

    // Add mana sources for Grizzly Bears ({1}{G})
    player.battlefield.push(
      createCardInstance(forest!.id, 'player', 'battlefield'),
      createCardInstance(forest!.id, 'player', 'battlefield'),
    );

    state.phase = 'main1';

    // Cast spell
    state = applyAction(state, {
      type: 'CAST_SPELL',
      playerId: 'player',
      payload: { cardInstanceId: bearsCard.instanceId },
    } as CastSpellAction);

    expect(state.stack.length).toBe(1);

    // Priority should go to opponent after casting
    expect(state.priorityPlayer).toBe('opponent');

    // Opponent passes
    state = applyAction(state, {
      type: 'PASS_PRIORITY',
      playerId: 'opponent',
      payload: {},
    } as PassPriorityAction);

    // Priority back to active player
    expect(state.priorityPlayer).toBe('player');
    expect(state.stack.length).toBe(1); // Still on stack

    // Player passes - now both have passed
    state = applyAction(state, {
      type: 'PASS_PRIORITY',
      playerId: 'player',
      payload: {},
    } as PassPriorityAction);

    // Stack should have resolved
    expect(state.stack.length).toBe(0);

    // Creature should be on battlefield (along with 2 tapped lands)
    const newPlayer = getPlayer(state, 'player');
    expect(newPlayer.battlefield.length).toBe(3); // 2 lands + 1 creature
    const bearOnBattlefield = newPlayer.battlefield.find(c => c.instanceId === bearsCard.instanceId);
    expect(bearOnBattlefield).toBeDefined();
  });

  test('LIFO resolution - last in, first out', () => {
    const blast = CardLoader.getByName('Lightning Blast');
    const counterspell = CardLoader.getByName('Counterspell');
    const mountain = CardLoader.getByName('Mountain');
    const island = CardLoader.getByName('Island');

    expect(blast).toBeDefined();
    expect(counterspell).toBeDefined();
    expect(mountain).toBeDefined();
    expect(island).toBeDefined();

    const blastCard = createCardInstance(blast!.id, 'player', 'hand');
    const counterCard = createCardInstance(counterspell!.id, 'opponent', 'hand');

    const playerLibrary = [createCardInstance(blast!.id, 'player', 'library')];
    const opponentLibrary = [createCardInstance(counterspell!.id, 'opponent', 'library')];

    let state = createGameState(playerLibrary, opponentLibrary);

    const player = getPlayer(state, 'player');
    const opponent = getPlayer(state, 'opponent');

    player.hand.push(blastCard);
    opponent.hand.push(counterCard);

    // Add mana sources - Lightning Blast costs {3}{R}, Counterspell costs {U}{U}
    for (let i = 0; i < 4; i++) {
      player.battlefield.push(createCardInstance(mountain!.id, 'player', 'battlefield'));
    }
    for (let i = 0; i < 2; i++) {
      opponent.battlefield.push(createCardInstance(island!.id, 'opponent', 'battlefield'));
    }

    state.phase = 'main1';

    // Player casts Lightning Blast targeting opponent
    state = applyAction(state, {
      type: 'CAST_SPELL',
      playerId: 'player',
      payload: {
        cardInstanceId: blastCard.instanceId,
        targets: ['opponent'],
      },
    } as CastSpellAction);

    expect(state.stack.length).toBe(1);
    expect(state.priorityPlayer).toBe('opponent');

    // Opponent casts Counterspell targeting Lightning Blast
    const blastStackId = state.stack[0]!.id;
    state = applyAction(state, {
      type: 'CAST_SPELL',
      playerId: 'opponent',
      payload: {
        cardInstanceId: counterCard.instanceId,
        targets: [blastStackId],
      },
    } as CastSpellAction);

    expect(state.stack.length).toBe(2);
    expect(state.priorityPlayer).toBe('player');

    // Player passes
    state = applyAction(state, {
      type: 'PASS_PRIORITY',
      playerId: 'player',
      payload: {},
    } as PassPriorityAction);

    expect(state.priorityPlayer).toBe('opponent');

    // Opponent passes - Counterspell resolves first (LIFO)
    state = applyAction(state, {
      type: 'PASS_PRIORITY',
      playerId: 'opponent',
      payload: {},
    } as PassPriorityAction);

    // Counterspell resolved, Lightning Blast is still on stack but countered
    expect(state.stack.length).toBe(1);
    expect(state.stack[0]!.countered).toBe(true);

    // Both players pass again
    state = applyAction(state, {
      type: 'PASS_PRIORITY',
      playerId: 'player',
      payload: {},
    } as PassPriorityAction);

    state = applyAction(state, {
      type: 'PASS_PRIORITY',
      playerId: 'opponent',
      payload: {},
    } as PassPriorityAction);

    // Stack fully resolved - Lightning Blast was countered
    expect(state.stack.length).toBe(0);

    // Opponent should still have 20 life (Lightning Blast was countered)
    const finalOpponent = getPlayer(state, 'opponent');
    expect(finalOpponent.life).toBe(20);

    // Both spells in graveyards (get fresh references)
    const finalPlayer = getPlayer(state, 'player');
    expect(finalPlayer.graveyard.length).toBe(1);
    expect(finalOpponent.graveyard.length).toBe(1);
  });

  test('Lightning Blast deals damage when resolved', () => {
    const blast = CardLoader.getByName('Lightning Blast');
    const mountain = CardLoader.getByName('Mountain');
    expect(blast).toBeDefined();
    expect(mountain).toBeDefined();

    const blastCard = createCardInstance(blast!.id, 'player', 'hand');
    const playerLibrary = [createCardInstance(blast!.id, 'player', 'library')];
    const opponentLibrary = [createCardInstance(blast!.id, 'opponent', 'library')];

    let state = createGameState(playerLibrary, opponentLibrary);

    const player = getPlayer(state, 'player');
    player.hand.push(blastCard);

    // Add mana sources - Lightning Blast costs {3}{R}
    for (let i = 0; i < 4; i++) {
      player.battlefield.push(createCardInstance(mountain!.id, 'player', 'battlefield'));
    }

    state.phase = 'main1';

    // Cast Lightning Blast targeting opponent
    state = applyAction(state, {
      type: 'CAST_SPELL',
      playerId: 'player',
      payload: {
        cardInstanceId: blastCard.instanceId,
        targets: ['opponent'],
      },
    } as CastSpellAction);

    // Both players pass
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

    // Lightning Blast resolved
    expect(state.stack.length).toBe(0);

    // Opponent should have taken 3 damage
    const opponent = getPlayer(state, 'opponent');
    expect(opponent.life).toBe(17);
  });
});
