/**
 * Action validators - check if actions are legal
 *
 * Returns an array of error messages (empty = valid)
 */

import type { GameState } from '../state/GameState';
import type { Action, PlayLandAction, CastSpellAction, DeclareAttackersAction } from './Action';
import { getPlayer, findCard } from '../state/GameState';
import { CardLoader } from '../cards/CardLoader';
import { isLand, isCreature } from '../cards/CardTemplate';

/**
 * Validate any action
 */
export function validateAction(state: GameState, action: Action): string[] {
  switch (action.type) {
    case 'PLAY_LAND':
      return validatePlayLand(state, action);
    case 'CAST_SPELL':
      return validateCastSpell(state, action);
    case 'DECLARE_ATTACKERS':
      return validateDeclareAttackers(state, action);
    default:
      return [];  // Other actions are always valid for now
  }
}

/**
 * Validate playing a land
 */
function validatePlayLand(state: GameState, action: PlayLandAction): string[] {
  const errors: string[] = [];
  const player = getPlayer(state, action.playerId);

  // Check if it's the player's turn
  if (state.activePlayer !== action.playerId) {
    errors.push('Not your turn');
  }

  // Check if in main phase
  if (state.phase !== 'main1' && state.phase !== 'main2') {
    errors.push('Can only play lands during main phase');
  }

  // Check if already played a land this turn
  if (player.landsPlayedThisTurn >= 1) {
    errors.push('Already played a land this turn');
  }

  // Check if card is in hand
  const card = findCard(state, action.payload.cardInstanceId);
  if (!card) {
    errors.push('Card not found');
    return errors;
  }

  if (card.zone !== 'hand') {
    errors.push('Card is not in hand');
  }

  if (card.controller !== action.playerId) {
    errors.push('You do not control this card');
  }

  // Check if card is actually a land
  const template = CardLoader.getById(card.scryfallId);
  if (!template) {
    errors.push('Card template not found');
    return errors;
  }

  if (!isLand(template)) {
    errors.push('Card is not a land');
  }

  return errors;
}

/**
 * Validate casting a spell
 * Phase 0: Only sorcery-speed (creatures, sorceries)
 */
function validateCastSpell(state: GameState, action: CastSpellAction): string[] {
  const errors: string[] = [];
  const player = getPlayer(state, action.playerId);

  // Check if it's the player's turn
  if (state.activePlayer !== action.playerId) {
    errors.push('Not your turn');
  }

  // Check if in main phase
  if (state.phase !== 'main1' && state.phase !== 'main2') {
    errors.push('Can only cast sorcery-speed spells during main phase');
  }

  // Check if stack is empty (Phase 0: no instant-speed interaction)
  if (state.stack.length > 0) {
    errors.push('Cannot cast spells while stack is not empty');
  }

  // Check if card is in hand
  const card = findCard(state, action.payload.cardInstanceId);
  if (!card) {
    errors.push('Card not found');
    return errors;
  }

  if (card.zone !== 'hand') {
    errors.push('Card is not in hand');
  }

  if (card.controller !== action.playerId) {
    errors.push('You do not control this card');
  }

  // Get card template to check mana cost
  const template = CardLoader.getById(card.scryfallId);
  if (!template) {
    errors.push('Card template not found');
    return errors;
  }

  // TODO Phase 0: Skip mana cost validation for now (will implement in Week 2)
  // For now, we'll allow casting any spell

  return errors;
}

/**
 * Validate declaring attackers
 */
function validateDeclareAttackers(state: GameState, action: DeclareAttackersAction): string[] {
  const errors: string[] = [];

  // Check if it's the player's turn
  if (state.activePlayer !== action.playerId) {
    errors.push('Not your turn');
  }

  // Phase 0: Can attack from main1 (simplified)
  // Phase 1+: Must be in declare_attackers step
  if (state.phase !== 'main1' && state.step !== 'declare_attackers') {
    errors.push('Can only declare attackers in main1 or declare_attackers step');
  }

  const player = getPlayer(state, action.playerId);

  // Validate each attacker
  for (const attackerId of action.payload.attackers) {
    const attacker = findCard(state, attackerId);

    if (!attacker) {
      errors.push(`Attacker ${attackerId} not found`);
      continue;
    }

    if (attacker.controller !== action.playerId) {
      errors.push(`You do not control ${attackerId}`);
    }

    if (attacker.zone !== 'battlefield') {
      errors.push(`${attackerId} is not on the battlefield`);
    }

    if (attacker.tapped) {
      errors.push(`${attackerId} is tapped`);
    }

    if (attacker.summoningSick) {
      errors.push(`${attackerId} has summoning sickness`);
    }

    // Check if it's a creature
    const template = CardLoader.getById(attacker.scryfallId);
    if (template && !isCreature(template)) {
      errors.push(`${attackerId} is not a creature`);
    }
  }

  return errors;
}
