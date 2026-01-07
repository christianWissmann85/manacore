/**
 * Edge Case Tests for Combat Damage and Land Drops
 *
 * These tests are designed to catch bugs reported during MCP server testing:
 * 1. Instant death bug (-1070 damage from a 1/1 creature)
 * 2. Land drops not working after turn 1
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import {
  CardLoader,
  createCardInstance,
  createGameState,
  applyAction,
  getPlayer,
  getLegalActions,
  validateAction,
  type GameState,
  type DeclareAttackersAction,
  type DeclareBlockersAction,
  type PlayLandAction,
  type PassPriorityAction,
  type EndTurnAction,
} from '../src/index';

// =============================================================================
// COMBAT DAMAGE EDGE CASES
// =============================================================================

describe('Combat Damage Edge Cases', () => {
  test('1/1 creature deals exactly 1 damage when unblocked', () => {
    const elves = CardLoader.getByName('Llanowar Elves'); // 1/1
    expect(elves).toBeDefined();

    const elvesCard = createCardInstance(elves!.id, 'player', 'battlefield');
    elvesCard.summoningSick = false;

    const playerLibrary = [createCardInstance(elves!.id, 'player', 'library')];
    const opponentLibrary = [createCardInstance(elves!.id, 'opponent', 'library')];

    let state = createGameState(playerLibrary, opponentLibrary);
    getPlayer(state, 'player').battlefield.push(elvesCard);

    state.phase = 'main1';
    const initialLife = getPlayer(state, 'opponent').life;
    expect(initialLife).toBe(20);

    // Declare attackers
    state = applyAction(state, {
      type: 'DECLARE_ATTACKERS',
      playerId: 'player',
      payload: { attackers: [elvesCard.instanceId] },
    } as DeclareAttackersAction);

    // No blockers
    state = applyAction(state, {
      type: 'DECLARE_BLOCKERS',
      playerId: 'opponent',
      payload: { blocks: [] },
    } as DeclareBlockersAction);

    // Should deal exactly 1 damage
    const finalLife = getPlayer(state, 'opponent').life;
    expect(finalLife).toBe(19);
    expect(initialLife - finalLife).toBe(1); // Exactly 1 damage
  });

  test('2/2 creature deals exactly 2 damage when unblocked', () => {
    const bears = CardLoader.getByName('Grizzly Bears'); // 2/2
    expect(bears).toBeDefined();

    const bearsCard = createCardInstance(bears!.id, 'player', 'battlefield');
    bearsCard.summoningSick = false;

    const playerLibrary = [createCardInstance(bears!.id, 'player', 'library')];
    const opponentLibrary = [createCardInstance(bears!.id, 'opponent', 'library')];

    let state = createGameState(playerLibrary, opponentLibrary);
    getPlayer(state, 'player').battlefield.push(bearsCard);

    state.phase = 'main1';

    // Attack
    state = applyAction(state, {
      type: 'DECLARE_ATTACKERS',
      playerId: 'player',
      payload: { attackers: [bearsCard.instanceId] },
    } as DeclareAttackersAction);

    state = applyAction(state, {
      type: 'DECLARE_BLOCKERS',
      playerId: 'opponent',
      payload: { blocks: [] },
    } as DeclareBlockersAction);

    expect(getPlayer(state, 'opponent').life).toBe(18);
  });

  test('multiple attackers deal cumulative damage correctly', () => {
    const bears = CardLoader.getByName('Grizzly Bears'); // 2/2
    const elves = CardLoader.getByName('Llanowar Elves'); // 1/1
    expect(bears).toBeDefined();
    expect(elves).toBeDefined();

    const bearsCard = createCardInstance(bears!.id, 'player', 'battlefield');
    bearsCard.summoningSick = false;
    const elvesCard = createCardInstance(elves!.id, 'player', 'battlefield');
    elvesCard.summoningSick = false;

    const playerLibrary = [createCardInstance(bears!.id, 'player', 'library')];
    const opponentLibrary = [createCardInstance(bears!.id, 'opponent', 'library')];

    let state = createGameState(playerLibrary, opponentLibrary);
    getPlayer(state, 'player').battlefield.push(bearsCard, elvesCard);

    state.phase = 'main1';

    // Attack with both
    state = applyAction(state, {
      type: 'DECLARE_ATTACKERS',
      playerId: 'player',
      payload: { attackers: [bearsCard.instanceId, elvesCard.instanceId] },
    } as DeclareAttackersAction);

    state = applyAction(state, {
      type: 'DECLARE_BLOCKERS',
      playerId: 'opponent',
      payload: { blocks: [] },
    } as DeclareBlockersAction);

    // 2 + 1 = 3 damage
    expect(getPlayer(state, 'opponent').life).toBe(17);
  });

  test('tapped creature cannot be declared as attacker', () => {
    const bears = CardLoader.getByName('Grizzly Bears');
    expect(bears).toBeDefined();

    const bearsCard = createCardInstance(bears!.id, 'player', 'battlefield');
    bearsCard.summoningSick = false;
    bearsCard.tapped = true; // Already tapped!

    const playerLibrary = [createCardInstance(bears!.id, 'player', 'library')];
    const opponentLibrary = [createCardInstance(bears!.id, 'opponent', 'library')];

    let state = createGameState(playerLibrary, opponentLibrary);
    getPlayer(state, 'player').battlefield.push(bearsCard);

    state.phase = 'main1';
    state.activePlayer = 'player';
    state.priorityPlayer = 'player';

    // Get legal actions - tapped creature should NOT be able to attack
    const legalActions = getLegalActions(state, 'player');

    // Find any DECLARE_ATTACKERS action that includes the tapped creature
    const attackActions = legalActions.filter(
      (a) =>
        a.type === 'DECLARE_ATTACKERS' &&
        (a as DeclareAttackersAction).payload.attackers.includes(bearsCard.instanceId),
    );

    // There should be no legal attack action with the tapped creature
    expect(attackActions.length).toBe(0);
  });

  test('summoning sick creature cannot attack', () => {
    const bears = CardLoader.getByName('Grizzly Bears');
    expect(bears).toBeDefined();

    const bearsCard = createCardInstance(bears!.id, 'player', 'battlefield');
    bearsCard.summoningSick = true; // Just entered!

    const playerLibrary = [createCardInstance(bears!.id, 'player', 'library')];
    const opponentLibrary = [createCardInstance(bears!.id, 'opponent', 'library')];

    let state = createGameState(playerLibrary, opponentLibrary);
    getPlayer(state, 'player').battlefield.push(bearsCard);

    state.phase = 'main1';
    state.activePlayer = 'player';
    state.priorityPlayer = 'player';

    const legalActions = getLegalActions(state, 'player');

    // Find any DECLARE_ATTACKERS action that includes the summoning sick creature
    const attackActions = legalActions.filter(
      (a) =>
        a.type === 'DECLARE_ATTACKERS' &&
        (a as DeclareAttackersAction).payload.attackers.includes(bearsCard.instanceId),
    );

    expect(attackActions.length).toBe(0);
  });

  test('damage never exceeds creature power', () => {
    // Use a big creature to test
    const fireElemental = CardLoader.getByName('Fire Elemental'); // 5/4
    expect(fireElemental).toBeDefined();

    const fireCard = createCardInstance(fireElemental!.id, 'player', 'battlefield');
    fireCard.summoningSick = false;

    const playerLibrary = [createCardInstance(fireElemental!.id, 'player', 'library')];
    const opponentLibrary = [createCardInstance(fireElemental!.id, 'opponent', 'library')];

    let state = createGameState(playerLibrary, opponentLibrary);
    getPlayer(state, 'player').battlefield.push(fireCard);

    state.phase = 'main1';

    state = applyAction(state, {
      type: 'DECLARE_ATTACKERS',
      playerId: 'player',
      payload: { attackers: [fireCard.instanceId] },
    } as DeclareAttackersAction);

    state = applyAction(state, {
      type: 'DECLARE_BLOCKERS',
      playerId: 'opponent',
      payload: { blocks: [] },
    } as DeclareBlockersAction);

    // Should deal exactly 5 damage
    expect(getPlayer(state, 'opponent').life).toBe(15);
  });

  test('life total changes are bounded and sensible', () => {
    const bears = CardLoader.getByName('Grizzly Bears');
    expect(bears).toBeDefined();

    const bearsCard = createCardInstance(bears!.id, 'player', 'battlefield');
    bearsCard.summoningSick = false;

    const playerLibrary = [createCardInstance(bears!.id, 'player', 'library')];
    const opponentLibrary = [createCardInstance(bears!.id, 'opponent', 'library')];

    let state = createGameState(playerLibrary, opponentLibrary);
    getPlayer(state, 'player').battlefield.push(bearsCard);

    state.phase = 'main1';
    const lifeBefore = getPlayer(state, 'opponent').life;

    state = applyAction(state, {
      type: 'DECLARE_ATTACKERS',
      playerId: 'player',
      payload: { attackers: [bearsCard.instanceId] },
    } as DeclareAttackersAction);

    state = applyAction(state, {
      type: 'DECLARE_BLOCKERS',
      playerId: 'opponent',
      payload: { blocks: [] },
    } as DeclareBlockersAction);

    const lifeAfter = getPlayer(state, 'opponent').life;
    const lifeDelta = lifeBefore - lifeAfter;

    // Damage should be reasonable (not more than 20 in a single combat with one 2/2)
    expect(lifeDelta).toBeGreaterThanOrEqual(0);
    expect(lifeDelta).toBeLessThanOrEqual(20);
    expect(lifeDelta).toBe(2); // Exactly 2 from the 2/2
  });
});

// =============================================================================
// LAND DROP EDGE CASES
// =============================================================================

describe('Land Drop Edge Cases', () => {
  test('can play land on turn 1', () => {
    const mountain = CardLoader.getByName('Mountain');
    const forest = CardLoader.getByName('Forest');
    expect(mountain).toBeDefined();

    const mountainCard = createCardInstance(mountain!.id, 'player', 'hand');

    const playerLibrary = [createCardInstance(forest!.id, 'player', 'library')];
    const opponentLibrary = [createCardInstance(forest!.id, 'opponent', 'library')];

    let state = createGameState(playerLibrary, opponentLibrary);
    getPlayer(state, 'player').hand.push(mountainCard);

    state.phase = 'main1';
    state.activePlayer = 'player';
    state.priorityPlayer = 'player';
    state.turnCount = 1;

    // Verify land play is legal
    const playLandAction: PlayLandAction = {
      type: 'PLAY_LAND',
      playerId: 'player',
      payload: { cardInstanceId: mountainCard.instanceId },
    };

    const errors = validateAction(state, playLandAction);
    expect(errors).toEqual([]);

    // Play the land
    state = applyAction(state, playLandAction);

    expect(getPlayer(state, 'player').battlefield.length).toBe(1);
    expect(getPlayer(state, 'player').landsPlayedThisTurn).toBe(1);
  });

  test('landsPlayedThisTurn resets when turn changes', () => {
    const mountain = CardLoader.getByName('Mountain');
    const forest = CardLoader.getByName('Forest');
    expect(mountain).toBeDefined();
    expect(forest).toBeDefined();

    const mountainCard = createCardInstance(mountain!.id, 'player', 'hand');
    const forestCard = createCardInstance(forest!.id, 'player', 'hand');

    const playerLibrary = Array(10)
      .fill(null)
      .map(() => createCardInstance(forest!.id, 'player', 'library'));
    const opponentLibrary = Array(10)
      .fill(null)
      .map(() => createCardInstance(forest!.id, 'opponent', 'library'));

    let state = createGameState(playerLibrary, opponentLibrary);
    getPlayer(state, 'player').hand.push(mountainCard, forestCard);

    state.phase = 'main1';
    state.activePlayer = 'player';
    state.priorityPlayer = 'player';
    state.turnCount = 1;

    // Play mountain on turn 1
    state = applyAction(state, {
      type: 'PLAY_LAND',
      playerId: 'player',
      payload: { cardInstanceId: mountainCard.instanceId },
    } as PlayLandAction);

    expect(getPlayer(state, 'player').landsPlayedThisTurn).toBe(1);

    // End turn (player -> opponent)
    state = applyAction(state, {
      type: 'END_TURN',
      playerId: 'player',
      payload: {},
    } as EndTurnAction);

    // Opponent's turn - their counter should be 0
    expect(state.activePlayer).toBe('opponent');
    expect(getPlayer(state, 'opponent').landsPlayedThisTurn).toBe(0);

    // Opponent ends turn
    state = applyAction(state, {
      type: 'END_TURN',
      playerId: 'opponent',
      payload: {},
    } as EndTurnAction);

    // Back to player's turn - counter should be reset to 0
    expect(state.activePlayer).toBe('player');
    expect(getPlayer(state, 'player').landsPlayedThisTurn).toBe(0);
  });

  test('can play land on turn 3 after proper turn transitions', () => {
    const mountain = CardLoader.getByName('Mountain');
    const forest = CardLoader.getByName('Forest');
    expect(mountain).toBeDefined();
    expect(forest).toBeDefined();

    const mountain1 = createCardInstance(mountain!.id, 'player', 'hand');
    const mountain2 = createCardInstance(mountain!.id, 'player', 'hand');

    const playerLibrary = Array(10)
      .fill(null)
      .map(() => createCardInstance(forest!.id, 'player', 'library'));
    const opponentLibrary = Array(10)
      .fill(null)
      .map(() => createCardInstance(forest!.id, 'opponent', 'library'));

    let state = createGameState(playerLibrary, opponentLibrary);
    getPlayer(state, 'player').hand.push(mountain1, mountain2);

    // Turn 1 - play first mountain
    state.phase = 'main1';
    state.activePlayer = 'player';
    state.priorityPlayer = 'player';
    state.turnCount = 1;

    state = applyAction(state, {
      type: 'PLAY_LAND',
      playerId: 'player',
      payload: { cardInstanceId: mountain1.instanceId },
    } as PlayLandAction);

    expect(getPlayer(state, 'player').battlefield.length).toBe(1);

    // End turn 1
    state = applyAction(state, {
      type: 'END_TURN',
      playerId: 'player',
      payload: {},
    } as EndTurnAction);

    // Turn 2 - opponent's turn
    expect(state.activePlayer).toBe('opponent');
    state = applyAction(state, {
      type: 'END_TURN',
      playerId: 'opponent',
      payload: {},
    } as EndTurnAction);

    // Turn 3 - back to player
    expect(state.activePlayer).toBe('player');
    expect(state.turnCount).toBe(3);

    // Advance to main phase (pass through beginning phase)
    state.phase = 'main1';
    state.priorityPlayer = 'player';

    // Verify we can play the second land
    const playLandAction: PlayLandAction = {
      type: 'PLAY_LAND',
      playerId: 'player',
      payload: { cardInstanceId: mountain2.instanceId },
    };

    const errors = validateAction(state, playLandAction);
    expect(errors).toEqual([]);

    state = applyAction(state, playLandAction);

    expect(getPlayer(state, 'player').battlefield.length).toBe(2);
  });

  test('cannot play two lands in one turn', () => {
    const mountain = CardLoader.getByName('Mountain');
    const forest = CardLoader.getByName('Forest');
    expect(mountain).toBeDefined();
    expect(forest).toBeDefined();

    const mountainCard = createCardInstance(mountain!.id, 'player', 'hand');
    const forestCard = createCardInstance(forest!.id, 'player', 'hand');

    const playerLibrary = [createCardInstance(forest!.id, 'player', 'library')];
    const opponentLibrary = [createCardInstance(forest!.id, 'opponent', 'library')];

    let state = createGameState(playerLibrary, opponentLibrary);
    getPlayer(state, 'player').hand.push(mountainCard, forestCard);

    state.phase = 'main1';
    state.activePlayer = 'player';
    state.priorityPlayer = 'player';

    // Play first land
    state = applyAction(state, {
      type: 'PLAY_LAND',
      playerId: 'player',
      payload: { cardInstanceId: mountainCard.instanceId },
    } as PlayLandAction);

    expect(getPlayer(state, 'player').landsPlayedThisTurn).toBe(1);

    // Try to play second land - should fail validation
    const secondLandAction: PlayLandAction = {
      type: 'PLAY_LAND',
      playerId: 'player',
      payload: { cardInstanceId: forestCard.instanceId },
    };

    const errors = validateAction(state, secondLandAction);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors).toContain('Already played a land this turn');
  });

  test('PLAY_LAND action appears in legal actions when valid', () => {
    const mountain = CardLoader.getByName('Mountain');
    const forest = CardLoader.getByName('Forest');
    expect(mountain).toBeDefined();

    const mountainCard = createCardInstance(mountain!.id, 'player', 'hand');

    const playerLibrary = [createCardInstance(forest!.id, 'player', 'library')];
    const opponentLibrary = [createCardInstance(forest!.id, 'opponent', 'library')];

    let state = createGameState(playerLibrary, opponentLibrary);
    getPlayer(state, 'player').hand.push(mountainCard);

    state.phase = 'main1';
    state.activePlayer = 'player';
    state.priorityPlayer = 'player';
    state.turnCount = 1;

    const legalActions = getLegalActions(state, 'player');

    // Should have a PLAY_LAND action
    const playLandActions = legalActions.filter((a) => a.type === 'PLAY_LAND');
    expect(playLandActions.length).toBe(1);
  });

  test('PLAY_LAND action NOT in legal actions after playing one', () => {
    const mountain = CardLoader.getByName('Mountain');
    const forest = CardLoader.getByName('Forest');
    expect(mountain).toBeDefined();
    expect(forest).toBeDefined();

    const mountainCard = createCardInstance(mountain!.id, 'player', 'hand');
    const forestCard = createCardInstance(forest!.id, 'player', 'hand');

    const playerLibrary = [createCardInstance(forest!.id, 'player', 'library')];
    const opponentLibrary = [createCardInstance(forest!.id, 'opponent', 'library')];

    let state = createGameState(playerLibrary, opponentLibrary);
    getPlayer(state, 'player').hand.push(mountainCard, forestCard);

    state.phase = 'main1';
    state.activePlayer = 'player';
    state.priorityPlayer = 'player';

    // Play first land
    state = applyAction(state, {
      type: 'PLAY_LAND',
      playerId: 'player',
      payload: { cardInstanceId: mountainCard.instanceId },
    } as PlayLandAction);

    // Get legal actions again
    const legalActions = getLegalActions(state, 'player');

    // Should NOT have any PLAY_LAND actions
    const playLandActions = legalActions.filter((a) => a.type === 'PLAY_LAND');
    expect(playLandActions.length).toBe(0);
  });
});

// =============================================================================
// FULL GAME SIMULATION
// =============================================================================

describe('Multi-Turn Game Simulation', () => {
  test('simulate 10 turns with land drops each turn', () => {
    const mountain = CardLoader.getByName('Mountain');
    const forest = CardLoader.getByName('Forest');
    expect(mountain).toBeDefined();
    expect(forest).toBeDefined();

    // Create lots of lands for both players
    const playerLibrary = Array(20)
      .fill(null)
      .map(() => createCardInstance(mountain!.id, 'player', 'library'));
    const opponentLibrary = Array(20)
      .fill(null)
      .map(() => createCardInstance(forest!.id, 'opponent', 'library'));

    let state = createGameState(playerLibrary, opponentLibrary);

    // Give player 10 mountains in hand
    for (let i = 0; i < 10; i++) {
      const land = createCardInstance(mountain!.id, 'player', 'hand');
      getPlayer(state, 'player').hand.push(land);
    }

    // Give opponent 10 forests in hand
    for (let i = 0; i < 10; i++) {
      const land = createCardInstance(forest!.id, 'opponent', 'hand');
      getPlayer(state, 'opponent').hand.push(land);
    }

    state.phase = 'main1';
    state.activePlayer = 'player';
    state.priorityPlayer = 'player';

    let playerLandsOnBattlefield = 0;
    let opponentLandsOnBattlefield = 0;

    // Simulate 5 full rounds (10 turns total)
    for (let round = 0; round < 5; round++) {
      // Player's turn
      expect(state.activePlayer).toBe('player');

      // Advance to main phase
      state.phase = 'main1';
      state.priorityPlayer = 'player';

      // Player should be able to play a land
      const playerLegalActions = getLegalActions(state, 'player');
      const playerLandActions = playerLegalActions.filter((a) => a.type === 'PLAY_LAND');

      expect(playerLandActions.length).toBeGreaterThan(0);

      // Play the land
      state = applyAction(state, playerLandActions[0]!);
      playerLandsOnBattlefield++;

      expect(getPlayer(state, 'player').battlefield.length).toBe(playerLandsOnBattlefield);

      // End player's turn
      state = applyAction(state, {
        type: 'END_TURN',
        playerId: 'player',
        payload: {},
      } as EndTurnAction);

      // Opponent's turn
      expect(state.activePlayer).toBe('opponent');

      // Advance to main phase
      state.phase = 'main1';
      state.priorityPlayer = 'opponent';

      // Opponent should be able to play a land
      const opponentLegalActions = getLegalActions(state, 'opponent');
      const opponentLandActions = opponentLegalActions.filter((a) => a.type === 'PLAY_LAND');

      expect(opponentLandActions.length).toBeGreaterThan(0);

      // Play the land
      state = applyAction(state, opponentLandActions[0]!);
      opponentLandsOnBattlefield++;

      expect(getPlayer(state, 'opponent').battlefield.length).toBe(opponentLandsOnBattlefield);

      // End opponent's turn
      state = applyAction(state, {
        type: 'END_TURN',
        playerId: 'opponent',
        payload: {},
      } as EndTurnAction);
    }

    // After 5 rounds, each player should have 5 lands
    expect(playerLandsOnBattlefield).toBe(5);
    expect(opponentLandsOnBattlefield).toBe(5);
    expect(getPlayer(state, 'player').battlefield.length).toBe(5);
    expect(getPlayer(state, 'opponent').battlefield.length).toBe(5);
  });
});
