/**
 * Shared test helpers for card tests
 */

import {
  CardLoader,
  createCardInstance,
  createGameState,
  applyAction,
  type GameState,
  type CastSpellAction,
  type PassPriorityAction,
} from '../../src/index';

/**
 * Cast a spell and resolve it (both players pass priority)
 */
export function castAndResolve(
  state: GameState,
  playerId: 'player' | 'opponent',
  cardInstanceId: string,
  targets?: string[],
  xValue?: number
): GameState {
  // Cast the spell
  let newState = applyAction(state, {
    type: 'CAST_SPELL',
    playerId,
    payload: { cardInstanceId, targets, xValue },
  } as CastSpellAction);

  // Both players pass priority
  newState = applyAction(newState, {
    type: 'PASS_PRIORITY',
    playerId: 'opponent',
    payload: {},
  } as PassPriorityAction);

  newState = applyAction(newState, {
    type: 'PASS_PRIORITY',
    playerId: 'player',
    payload: {},
  } as PassPriorityAction);

  return newState;
}

/**
 * Mana color configuration for test setup
 */
export type ManaConfig = {
  W?: number;
  U?: number;
  B?: number;
  R?: number;
  G?: number;
};

/**
 * Set up a game state with mana sources on the battlefield
 */
export function setupGameWithMana(
  playerMana: ManaConfig,
  opponentMana: ManaConfig = {}
): GameState {
  const plains = CardLoader.getByName('Plains')!;
  const island = CardLoader.getByName('Island')!;
  const swamp = CardLoader.getByName('Swamp')!;
  const mountain = CardLoader.getByName('Mountain')!;
  const forest = CardLoader.getByName('Forest')!;

  const landMap = { W: plains, U: island, B: swamp, R: mountain, G: forest };

  const playerLibrary = [createCardInstance(plains.id, 'player', 'library')];
  const opponentLibrary = [createCardInstance(plains.id, 'opponent', 'library')];

  const state = createGameState(playerLibrary, opponentLibrary);
  state.phase = 'main1';
  state.step = 'main';

  // Add player's mana sources
  for (const [color, count] of Object.entries(playerMana)) {
    const land = landMap[color as keyof typeof landMap];
    for (let i = 0; i < count; i++) {
      state.players.player.battlefield.push(
        createCardInstance(land.id, 'player', 'battlefield')
      );
    }
  }

  // Add opponent's mana sources
  for (const [color, count] of Object.entries(opponentMana)) {
    const land = landMap[color as keyof typeof landMap];
    for (let i = 0; i < count; i++) {
      state.players.opponent.battlefield.push(
        createCardInstance(land.id, 'opponent', 'battlefield')
      );
    }
  }

  return state;
}

/**
 * Create a creature on the battlefield (not summoning sick)
 */
export function createCreatureOnBattlefield(
  state: GameState,
  cardName: string,
  controller: 'player' | 'opponent'
) {
  const template = CardLoader.getByName(cardName)!;
  const card = createCardInstance(template.id, controller, 'battlefield');
  card.summoningSick = false;
  state.players[controller].battlefield.push(card);
  return card;
}

/**
 * Create a card in a player's hand
 */
export function createCardInHand(
  state: GameState,
  cardName: string,
  controller: 'player' | 'opponent'
) {
  const template = CardLoader.getByName(cardName)!;
  const card = createCardInstance(template.id, controller, 'hand');
  state.players[controller].hand.push(card);
  return card;
}
