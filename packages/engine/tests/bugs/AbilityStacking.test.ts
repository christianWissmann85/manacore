import { describe, test, expect, beforeEach } from 'bun:test';
import {
  createGameState,
  applyAction,
  CardLoader,
  createCardInstance,
  getPlayer,
  getActivatedAbilities,
  type GameState,
} from '../../src/index';

describe('Bug: Activated Abilities Skipping Stack', () => {
  let state: GameState;

  beforeEach(() => {
    const island = CardLoader.getByName('Island');
    if (!island) throw new Error('Basic lands not found');

    const pDeck = Array(40).fill(null).map(() => createCardInstance(island.id, 'player', 'library'));
    const oDeck = Array(40).fill(null).map(() => createCardInstance(island.id, 'opponent', 'library'));

    state = createGameState(pDeck, oDeck);
  });

  test('Activated ability should use the stack', () => {
    // Prodigal Sorcerer: {T}: Deal 1 damage to any target.
    const sorcerer = CardLoader.getByName('Prodigal Sorcerer');
    if (!sorcerer) {
        console.warn("Prodigal Sorcerer not found, skipping test");
        return; 
    }

    const player = getPlayer(state, 'player');
    const opponent = getPlayer(state, 'opponent');

    // Setup: Player has Prodigal Sorcerer on battlefield without summoning sickness
    const timInstance = createCardInstance(sorcerer.id, 'player', 'battlefield');
    timInstance.summoningSick = false;
    player.battlefield.push(timInstance);

    state.phase = 'main1';
    state.priorityPlayer = 'player';

    // Verify ability exists
    const abilities = getActivatedAbilities(timInstance, state);
    const ability = abilities[0];
    if (!ability) throw new Error("Tim has no ability!");

    const initialLife = opponent.life;

    // 1. Activate Tim targeting Opponent
    state = applyAction(state, {
      type: 'ACTIVATE_ABILITY',
      playerId: 'player',
      payload: {
        sourceId: timInstance.instanceId,
        abilityId: ability.id,
        targets: ['opponent']
      }
    });

    // EXPECTATION (Correct Rules): 
    // - Ability should be on the stack
    // - Damage should NOT be dealt yet
    
    // CURRENT BUG:
    // - Ability resolves immediately
    // - Stack is empty
    // - Damage is dealt immediately

    // This assertion should FAIL if the bug is present
    expect(state.stack.length).toBe(1);
    expect(state.stack[0].sourceId).toBe(timInstance.instanceId);
    expect(opponent.life).toBe(initialLife); // Damage happens on resolution
  });
});