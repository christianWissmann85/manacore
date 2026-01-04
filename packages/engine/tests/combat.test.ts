/**
 * Combat system tests - Flying, First Strike, Trample, Vigilance
 */

import { describe, test, expect } from 'bun:test';
import {
  CardLoader,
  createCardInstance,
  createGameState,
  applyAction,
  getPlayer,
  type DeclareAttackersAction,
  type DeclareBlockersAction,
} from '../src/index';

describe('Combat System', () => {
  test('unblocked attacker deals damage to opponent', () => {
    const bears = CardLoader.getByName('Grizzly Bears'); // 2/2
    expect(bears).toBeDefined();

    const bearsCard = createCardInstance(bears!.id, 'player', 'battlefield');
    bearsCard.summoningSick = false;

    const playerLibrary = [createCardInstance(bears!.id, 'player', 'library')];
    const opponentLibrary = [createCardInstance(bears!.id, 'opponent', 'library')];

    let state = createGameState(playerLibrary, opponentLibrary);
    const player = getPlayer(state, 'player');
    player.battlefield.push(bearsCard);

    state.phase = 'main1';

    // Declare attackers
    state = applyAction(state, {
      type: 'DECLARE_ATTACKERS',
      playerId: 'player',
      payload: { attackers: [bearsCard.instanceId] },
    } as DeclareAttackersAction);

    expect(state.phase).toBe('combat');
    expect(state.step).toBe('declare_blockers');

    // Declare no blockers
    state = applyAction(state, {
      type: 'DECLARE_BLOCKERS',
      playerId: 'opponent',
      payload: { blocks: [] },
    } as DeclareBlockersAction);

    // Opponent should have taken 2 damage
    const opponent = getPlayer(state, 'opponent');
    expect(opponent.life).toBe(18);
    expect(state.phase).toBe('main2');
  });

  test('blocked attacker deals damage to blocker', () => {
    const bears = CardLoader.getByName('Grizzly Bears'); // 2/2
    expect(bears).toBeDefined();

    const attacker = createCardInstance(bears!.id, 'player', 'battlefield');
    attacker.summoningSick = false;

    const blocker = createCardInstance(bears!.id, 'opponent', 'battlefield');

    const playerLibrary = [createCardInstance(bears!.id, 'player', 'library')];
    const opponentLibrary = [createCardInstance(bears!.id, 'opponent', 'library')];

    let state = createGameState(playerLibrary, opponentLibrary);
    getPlayer(state, 'player').battlefield.push(attacker);
    getPlayer(state, 'opponent').battlefield.push(blocker);

    state.phase = 'main1';

    // Declare attackers
    state = applyAction(state, {
      type: 'DECLARE_ATTACKERS',
      playerId: 'player',
      payload: { attackers: [attacker.instanceId] },
    } as DeclareAttackersAction);

    // Declare blockers
    state = applyAction(state, {
      type: 'DECLARE_BLOCKERS',
      playerId: 'opponent',
      payload: {
        blocks: [
          {
            blockerId: blocker.instanceId,
            attackerId: attacker.instanceId,
          },
        ],
      },
    } as DeclareBlockersAction);

    // Both 2/2 creatures should have died
    expect(getPlayer(state, 'player').battlefield.length).toBe(0);
    expect(getPlayer(state, 'opponent').battlefield.length).toBe(0);
    expect(getPlayer(state, 'player').graveyard.length).toBe(1);
    expect(getPlayer(state, 'opponent').graveyard.length).toBe(1);

    // No damage to opponent
    expect(getPlayer(state, 'opponent').life).toBe(20);
  });

  test('Vigilance - attacking does not tap creature', () => {
    const archangel = CardLoader.getByName('Archangel'); // 5/5 Flying, Vigilance (6th Edition)

    const angel = createCardInstance(archangel!.id, 'player', 'battlefield');
    angel.summoningSick = false;

    const playerLibrary = [createCardInstance(archangel!.id, 'player', 'library')];
    const opponentLibrary = [createCardInstance(archangel!.id, 'opponent', 'library')];

    let state = createGameState(playerLibrary, opponentLibrary);
    getPlayer(state, 'player').battlefield.push(angel);

    state.phase = 'main1';

    // Declare attackers
    state = applyAction(state, {
      type: 'DECLARE_ATTACKERS',
      playerId: 'player',
      payload: { attackers: [angel.instanceId] },
    } as DeclareAttackersAction);

    // Archangel has Vigilance, so it should not be tapped
    const angelAfter = getPlayer(state, 'player').battlefield.find(
      (c) => c.instanceId === angel.instanceId,
    );
    expect(angelAfter?.tapped).toBe(false);
  });
});
