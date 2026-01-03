/**
 * Generate all legal actions for the current game state
 *
 * This is used by both the CLI (to show options) and AI (to choose moves)
 */

import type { GameState } from '../state/GameState';
import type { Action, PlayLandAction, CastSpellAction, DeclareAttackersAction, EndTurnAction, PassPriorityAction } from './Action';
import { getPlayer } from '../state/GameState';
import { CardLoader } from '../cards/CardLoader';
import { isLand, isCreature, isSorcery, isInstant } from '../cards/CardTemplate';
import { validateAction } from './validators';

/**
 * Get all legal actions for a player
 */
export function getLegalActions(state: GameState, playerId: 'player' | 'opponent'): Action[] {
  const actions: Action[] = [];

  // Always can pass priority (Phase 1+) or end turn
  // For Phase 0, we'll just allow ending turn when it's your turn
  if (state.activePlayer === playerId) {
    actions.push({
      type: 'END_TURN',
      playerId,
      payload: {},
    } as EndTurnAction);
  }

  // Can't do anything if not your turn (Phase 0 simplification)
  if (state.activePlayer !== playerId) {
    return actions;
  }

  // Main phase actions
  if (state.phase === 'main1' || state.phase === 'main2') {
    // Play lands
    actions.push(...getLegalLandPlays(state, playerId));

    // Cast spells (Phase 0: sorcery speed only)
    actions.push(...getLegalSpellCasts(state, playerId));
  }

  // Phase 0: Simplified combat - can attack from main1
  if (state.phase === 'main1') {
    actions.push(...getLegalAttackerDeclarations(state, playerId));
  }

  // Combat phase actions
  if (state.phase === 'combat') {
    if (state.step === 'declare_attackers') {
      actions.push(...getLegalAttackerDeclarations(state, playerId));
    }
  }

  return actions;
}

/**
 * Get legal land plays
 */
function getLegalLandPlays(state: GameState, playerId: 'player' | 'opponent'): PlayLandAction[] {
  const actions: PlayLandAction[] = [];
  const player = getPlayer(state, playerId);

  // Can only play one land per turn
  if (player.landsPlayedThisTurn >= 1) {
    return actions;
  }

  // Find lands in hand
  for (const card of player.hand) {
    const template = CardLoader.getById(card.scryfallId);
    if (template && isLand(template)) {
      const action: PlayLandAction = {
        type: 'PLAY_LAND',
        playerId,
        payload: {
          cardInstanceId: card.instanceId,
        },
      };

      // Validate before adding
      if (validateAction(state, action).length === 0) {
        actions.push(action);
      }
    }
  }

  return actions;
}

/**
 * Get legal spell casts
 * Phase 0: Only sorcery-speed spells (creatures, sorceries)
 */
function getLegalSpellCasts(state: GameState, playerId: 'player' | 'opponent'): CastSpellAction[] {
  const actions: CastSpellAction[] = [];
  const player = getPlayer(state, playerId);

  // Stack must be empty for sorcery-speed spells
  if (state.stack.length > 0) {
    return actions;
  }

  // Find castable cards in hand
  for (const card of player.hand) {
    const template = CardLoader.getById(card.scryfallId);
    if (!template || isLand(template)) continue;

    // Phase 0: Allow all non-land cards (we'll add mana checking later)
    const action: CastSpellAction = {
      type: 'CAST_SPELL',
      playerId,
      payload: {
        cardInstanceId: card.instanceId,
        targets: [],  // TODO: Handle targeting in Phase 1
      },
    };

    // Validate before adding
    if (validateAction(state, action).length === 0) {
      actions.push(action);
    }
  }

  return actions;
}

/**
 * Get legal attacker declarations
 */
function getLegalAttackerDeclarations(state: GameState, playerId: 'player' | 'opponent'): DeclareAttackersAction[] {
  const actions: DeclareAttackersAction[] = [];
  const player = getPlayer(state, playerId);

  // Find creatures that can attack
  const potentialAttackers = player.battlefield.filter(card => {
    const template = CardLoader.getById(card.scryfallId);
    if (!template || !isCreature(template)) return false;
    if (card.tapped) return false;
    if (card.summoningSick) return false;
    return true;
  });

  if (potentialAttackers.length === 0) {
    // No attackers - can pass
    actions.push({
      type: 'DECLARE_ATTACKERS',
      playerId,
      payload: { attackers: [] },
    });
    return actions;
  }

  // Generate all possible combinations of attackers
  // For simplicity, we'll just generate: attack with all, attack with none, attack with each individually

  // Attack with none
  actions.push({
    type: 'DECLARE_ATTACKERS',
    playerId,
    payload: { attackers: [] },
  });

  // Attack with each creature individually
  for (const attacker of potentialAttackers) {
    actions.push({
      type: 'DECLARE_ATTACKERS',
      playerId,
      payload: { attackers: [attacker.instanceId] },
    });
  }

  // Attack with all
  if (potentialAttackers.length > 1) {
    actions.push({
      type: 'DECLARE_ATTACKERS',
      playerId,
      payload: {
        attackers: potentialAttackers.map(c => c.instanceId),
      },
    });
  }

  return actions;
}

/**
 * Describe an action in human-readable form
 */
export function describeAction(action: Action, state: GameState): string {
  switch (action.type) {
    case 'PLAY_LAND': {
      const card = state.players[action.playerId].hand.find(
        c => c.instanceId === action.payload.cardInstanceId
      );
      if (card) {
        const template = CardLoader.getById(card.scryfallId);
        return `Play ${template?.name || 'land'}`;
      }
      return 'Play land';
    }

    case 'CAST_SPELL': {
      const card = state.players[action.playerId].hand.find(
        c => c.instanceId === action.payload.cardInstanceId
      );
      if (card) {
        const template = CardLoader.getById(card.scryfallId);
        return `Cast ${template?.name || 'spell'}`;
      }
      return 'Cast spell';
    }

    case 'DECLARE_ATTACKERS': {
      const count = action.payload.attackers.length;
      if (count === 0) return 'Attack with no creatures';
      if (count === 1) return 'Attack with 1 creature';
      return `Attack with ${count} creatures`;
    }

    case 'END_TURN':
      return 'End turn';

    case 'PASS_PRIORITY':
      return 'Pass priority';

    default:
      return action.type;
  }
}
