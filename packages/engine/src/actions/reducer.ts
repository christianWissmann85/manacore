/**
 * Game Reducer - applies actions to game state
 *
 * Pure function: (state, action) => newState
 * Never mutates the original state.
 */

import type { GameState } from '../state/GameState';
import type { Action, PlayLandAction, CastSpellAction, DeclareAttackersAction, DeclareBlockersAction, EndTurnAction, PassPriorityAction } from './Action';
import { validateAction } from './validators';
import { getPlayer } from '../state/GameState';
import { CardLoader } from '../cards/CardLoader';
import { hasVigilance } from '../cards/CardTemplate';
import { pushToStack, resolveTopOfStack, canResolveStack, bothPlayersPassedPriority } from '../rules/stack';
import { resolveCombatDamage, cleanupCombat } from '../rules/combat';

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
    case 'DECLARE_BLOCKERS':
      return applyDeclareBlockers(newState, action);
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
 * Phase 1: Put spell on the stack
 */
function applyCastSpell(state: GameState, action: CastSpellAction): GameState {
  const player = getPlayer(state, action.playerId);
  const cardId = action.payload.cardInstanceId;

  // Find and remove from hand
  const cardIndex = player.hand.findIndex(c => c.instanceId === cardId);
  if (cardIndex === -1) return state;

  const card = player.hand[cardIndex]!;
  player.hand.splice(cardIndex, 1);

  // Card is now on the stack (not in any zone yet)
  card.zone = 'stack';

  // Push to stack
  pushToStack(state, card, action.playerId, action.payload.targets || []);

  return state;
}

/**
 * Declare attackers
 * Phase 1+: Move to declare_blockers step
 */
function applyDeclareAttackers(state: GameState, action: DeclareAttackersAction): GameState {
  const player = getPlayer(state, action.playerId);

  // Mark creatures as attacking and tap them (unless they have Vigilance)
  for (const attackerId of action.payload.attackers) {
    const attacker = player.battlefield.find(c => c.instanceId === attackerId);
    if (attacker) {
      attacker.attacking = true;

      // Check for Vigilance keyword
      const template = CardLoader.getById(attacker.scryfallId);
      if (template && !hasVigilance(template)) {
        attacker.tapped = true;  // Attacking taps the creature (unless Vigilance)
      }
    }
  }

  // Move to declare blockers step
  state.phase = 'combat';
  state.step = 'declare_blockers';

  // Priority goes to defending player for blockers
  state.priorityPlayer = state.activePlayer === 'player' ? 'opponent' : 'player';

  return state;
}

/**
 * Declare blockers
 * Phase 1+: Assign blockers to attackers, then resolve combat damage
 */
function applyDeclareBlockers(state: GameState, action: DeclareBlockersAction): GameState {
  // Assign each blocker to its attacker
  for (const block of action.payload.blocks) {
    const blocker = state.players[action.playerId].battlefield.find(
      c => c.instanceId === block.blockerId
    );
    const attacker = state.players[state.activePlayer].battlefield.find(
      c => c.instanceId === block.attackerId
    );

    if (blocker && attacker) {
      // Mark blocker as blocking this attacker
      blocker.blocking = block.attackerId;

      // Add blocker to attacker's blockedBy list
      if (!attacker.blockedBy) {
        attacker.blockedBy = [];
      }
      attacker.blockedBy.push(block.blockerId);
    }
  }

  // Resolve combat damage (handles First Strike, Trample, etc.)
  resolveCombatDamage(state);

  // Clean up combat state
  cleanupCombat(state);

  // Move to second main phase
  state.phase = 'main2';
  state.step = 'main';

  // Priority returns to active player
  state.priorityPlayer = state.activePlayer;

  return state;
}

/**
 * End the turn
 */
function applyEndTurn(state: GameState, _action: EndTurnAction): GameState {
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
function applyPassPriority(state: GameState, action: PassPriorityAction): GameState {
  const player = getPlayer(state, action.playerId);
  player.hasPassedPriority = true;
  player.consecutivePasses++;

  // Phase 0: During beginning phase, auto-advance to main1
  if (state.phase === 'beginning' && state.activePlayer === action.playerId) {
    state.phase = 'main1';
    state.step = 'main';
    // Reset priority passes
    state.players.player.hasPassedPriority = false;
    state.players.opponent.hasPassedPriority = false;
    state.players.player.consecutivePasses = 0;
    state.players.opponent.consecutivePasses = 0;
    return state;
  }

  // Switch priority to opponent
  state.priorityPlayer = action.playerId === 'player' ? 'opponent' : 'player';

  // Check if both players passed
  if (bothPlayersPassedPriority(state)) {
    // Both passed - resolve stack if there's anything on it
    if (canResolveStack(state)) {
      resolveTopOfStack(state);
      // After resolution, priority returns to active player
      // Stack resets priority passes
    } else if (state.stack.length === 0) {
      // Stack is empty and both passed - move to next phase/step
      // For now, just reset passes
      state.players.player.hasPassedPriority = false;
      state.players.opponent.hasPassedPriority = false;
      state.players.player.consecutivePasses = 0;
      state.players.opponent.consecutivePasses = 0;
    }
  }

  return state;
}

/**
 * Draw a card
 */
function applyDrawCard(state: GameState, action: Action): GameState {
  const player = getPlayer(state, action.playerId);
  const count = (action.payload as { count?: number }).count || 1;

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
