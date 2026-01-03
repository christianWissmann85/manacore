/**
 * Game Reducer - applies actions to game state
 *
 * Pure function: (state, action) => newState
 * Never mutates the original state.
 */

import type { GameState } from '../state/GameState';
import type { Action, PlayLandAction, CastSpellAction, DeclareAttackersAction, EndTurnAction } from './Action';
import { validateAction } from './validators';
import { getPlayer, findCard } from '../state/GameState';
import { CardLoader } from '../cards/CardLoader';
import { isCreature } from '../cards/CardTemplate';

/**
 * Apply an action to the game state
 */
export function applyAction(state: GameState, action: Action): GameState {
  // Validate action
  const errors = validateAction(state, action);
  if (errors.length > 0) {
    throw new Error(`Invalid action: ${errors.join(', ')}`);
  }

  // Clone state (immutable updates)
  const newState = structuredClone(state);

  // Record action in history
  newState.actionHistory.push(JSON.stringify(action));

  // Apply action based on type
  switch (action.type) {
    case 'PLAY_LAND':
      return applyPlayLand(newState, action);
    case 'CAST_SPELL':
      return applyCastSpell(newState, action);
    case 'DECLARE_ATTACKERS':
      return applyDeclareAttackers(newState, action);
    case 'END_TURN':
      return applyEndTurn(newState, action);
    case 'PASS_PRIORITY':
      return applyPassPriority(newState, action);
    case 'DRAW_CARD':
      return applyDrawCard(newState, action);
    case 'UNTAP':
      return applyUntap(newState, action);
    default:
      return newState;
  }
}

/**
 * Play a land from hand onto the battlefield
 */
function applyPlayLand(state: GameState, action: PlayLandAction): GameState {
  const player = getPlayer(state, action.playerId);
  const cardId = action.payload.cardInstanceId;

  // Find and remove from hand
  const cardIndex = player.hand.findIndex(c => c.instanceId === cardId);
  if (cardIndex === -1) return state;

  const card = player.hand[cardIndex]!;
  player.hand.splice(cardIndex, 1);

  // Add to battlefield
  card.zone = 'battlefield';
  card.tapped = false;  // Lands enter untapped
  player.battlefield.push(card);

  // Increment lands played this turn
  player.landsPlayedThisTurn++;

  return state;
}

/**
 * Cast a spell from hand
 * Phase 0: Simplified - creatures just go directly to battlefield
 */
function applyCastSpell(state: GameState, action: CastSpellAction): GameState {
  const player = getPlayer(state, action.playerId);
  const cardId = action.payload.cardInstanceId;

  // Find and remove from hand
  const cardIndex = player.hand.findIndex(c => c.instanceId === cardId);
  if (cardIndex === -1) return state;

  const card = player.hand[cardIndex]!;
  player.hand.splice(cardIndex, 1);

  // Get card template to determine type
  const template = CardLoader.getById(card.scryfallId);
  if (!template) return state;

  // Phase 0: Creatures go to battlefield, everything else to graveyard
  if (isCreature(template)) {
    card.zone = 'battlefield';
    card.summoningSick = true;  // Can't attack this turn
    player.battlefield.push(card);
  } else {
    // Sorceries/instants go to graveyard after resolving
    card.zone = 'graveyard';
    player.graveyard.push(card);
    // TODO: Apply spell effects (Lightning Bolt, etc.)
  }

  return state;
}

/**
 * Declare attackers
 */
function applyDeclareAttackers(state: GameState, action: DeclareAttackersAction): GameState {
  const player = getPlayer(state, action.playerId);
  const opponent = state.players[action.playerId === 'player' ? 'opponent' : 'player'];

  // Mark creatures as attacking and tap them
  for (const attackerId of action.payload.attackers) {
    const attacker = player.battlefield.find(c => c.instanceId === attackerId);
    if (attacker) {
      attacker.attacking = true;
      attacker.tapped = true;  // Attacking taps the creature
    }
  }

  // Phase 0: Simplified - no blockers, just deal damage
  // Calculate total damage
  let totalDamage = 0;
  for (const attackerId of action.payload.attackers) {
    const attacker = player.battlefield.find(c => c.instanceId === attackerId);
    if (attacker) {
      const template = CardLoader.getById(attacker.scryfallId);
      if (template?.power) {
        totalDamage += parseInt(template.power, 10);
      }
    }
  }

  // Deal damage to opponent
  opponent.life -= totalDamage;

  // Check for game over
  if (opponent.life <= 0) {
    state.gameOver = true;
    state.winner = action.playerId;
  }

  // Clean up attacking status
  for (const creature of player.battlefield) {
    creature.attacking = false;
  }

  // Move to main 2
  state.phase = 'main2';
  state.step = 'main';

  return state;
}

/**
 * End the turn
 */
function applyEndTurn(state: GameState, action: EndTurnAction): GameState {
  const currentPlayer = getPlayer(state, state.activePlayer);

  // Cleanup phase
  // 1. Remove damage from creatures
  for (const creature of currentPlayer.battlefield) {
    creature.damage = 0;
  }

  // 2. Remove summoning sickness
  for (const permanent of currentPlayer.battlefield) {
    permanent.summoningSick = false;
  }

  // 3. Clear "until end of turn" effects (Phase 1+)

  // Switch active player
  state.activePlayer = state.activePlayer === 'player' ? 'opponent' : 'player';
  state.priorityPlayer = state.activePlayer;

  // Reset to beginning phase
  state.phase = 'beginning';
  state.step = 'untap';
  state.turnCount++;

  // Reset lands played
  const newActivePlayer = getPlayer(state, state.activePlayer);
  newActivePlayer.landsPlayedThisTurn = 0;

  // Untap all permanents
  for (const permanent of newActivePlayer.battlefield) {
    permanent.tapped = false;
  }

  return state;
}

/**
 * Pass priority
 */
function applyPassPriority(state: GameState, action: Action): GameState {
  const player = getPlayer(state, action.playerId);
  player.hasPassedPriority = true;

  // If both players passed, resolve stack or move to next step
  const opponent = getPlayer(state, action.playerId === 'player' ? 'opponent' : 'player');

  if (opponent.hasPassedPriority) {
    // Both passed - resolve top of stack or move forward
    // Phase 0: Simplified turn structure
  }

  return state;
}

/**
 * Draw a card
 */
function applyDrawCard(state: GameState, action: Action): GameState {
  const player = getPlayer(state, action.playerId);
  const count = (action.payload as any).count || 1;

  for (let i = 0; i < count; i++) {
    const card = player.library.pop();
    if (card) {
      card.zone = 'hand';
      player.hand.push(card);
    } else {
      // No cards left - player loses
      state.gameOver = true;
      state.winner = action.playerId === 'player' ? 'opponent' : 'player';
    }
  }

  return state;
}

/**
 * Untap all permanents
 */
function applyUntap(state: GameState, action: Action): GameState {
  const player = getPlayer(state, action.playerId);

  for (const permanent of player.battlefield) {
    permanent.tapped = false;
  }

  return state;
}
