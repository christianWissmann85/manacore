/**
 * The Stack - LIFO spell and ability resolution
 *
 * Key concepts:
 * - Last In, First Out (LIFO) - top of stack resolves first
 * - Both players must pass priority in succession for stack to resolve
 * - Adding to stack resets priority passes
 */

import type { GameState, StackObject } from '../state/GameState';
import type { CardInstance } from '../state/CardInstance';
import type { PlayerId } from '../state/Zone';
import { getPlayer } from '../state/GameState';
import { CardLoader } from '../cards/CardLoader';
import { isInstant, isSorcery } from '../cards/CardTemplate';

/**
 * Add a spell to the stack
 */
export function pushToStack(
  state: GameState,
  card: CardInstance,
  controller: PlayerId,
  targets: string[] = []
): void {
  const stackObj: StackObject = {
    id: `stack_${Date.now()}_${Math.random()}`,
    controller,
    card,
    targets,
    resolved: false,
    countered: false,
  };

  state.stack.push(stackObj);

  // Reset priority passes when something is added to stack
  state.players.player.hasPassedPriority = false;
  state.players.opponent.hasPassedPriority = false;
  state.players.player.consecutivePasses = 0;
  state.players.opponent.consecutivePasses = 0;

  // Priority goes to the other player after spell is cast
  state.priorityPlayer = controller === 'player' ? 'opponent' : 'player';
}

/**
 * Resolve the top spell on the stack
 */
export function resolveTopOfStack(state: GameState): void {
  if (state.stack.length === 0) return;

  const stackObj = state.stack[state.stack.length - 1]!;

  if (stackObj.countered) {
    // Countered spells go to graveyard without resolving
    const controller = getPlayer(state, stackObj.controller);
    stackObj.card.zone = 'graveyard';
    controller.graveyard.push(stackObj.card);
  } else {
    // Resolve the spell
    resolveSpell(state, stackObj);
  }

  // Remove from stack
  state.stack.pop();

  // Reset priority passes after resolution
  state.players.player.hasPassedPriority = false;
  state.players.opponent.hasPassedPriority = false;
  state.players.player.consecutivePasses = 0;
  state.players.opponent.consecutivePasses = 0;

  // Priority returns to active player after resolution
  state.priorityPlayer = state.activePlayer;
}

/**
 * Resolve a spell's effects
 */
function resolveSpell(state: GameState, stackObj: StackObject): void {
  const controller = getPlayer(state, stackObj.controller);
  const card = stackObj.card;
  const template = CardLoader.getById(card.scryfallId);

  if (!template) return;

  // Phase 1: Basic spell resolution
  if (isInstant(template) || isSorcery(template)) {
    // Apply spell effects
    applySpellEffects(state, stackObj);

    // Instants and sorceries go to graveyard
    card.zone = 'graveyard';
    controller.graveyard.push(card);
  } else {
    // Permanents (creatures, enchantments, etc.) go to battlefield
    card.zone = 'battlefield';
    card.summoningSick = true;
    controller.battlefield.push(card);
  }
}

/**
 * Apply spell effects based on card name/type
 * Phase 1: Implement specific spells as needed
 */
function applySpellEffects(state: GameState, stackObj: StackObject): void {
  const template = CardLoader.getById(stackObj.card.scryfallId);
  if (!template) return;

  // Check for specific cards we know how to handle
  switch (template.name) {
    case 'Lightning Blast':
    case 'Lightning Bolt':
      // Deal damage to target
      if (stackObj.targets.length > 0) {
        const targetId = stackObj.targets[0]!;
        applyDamage(state, targetId, 3);
      }
      break;

    case 'Counterspell':
      // Counter target spell
      if (stackObj.targets.length > 0) {
        const targetStackId = stackObj.targets[0]!;
        const targetStackObj = state.stack.find(s => s.id === targetStackId);
        if (targetStackObj) {
          targetStackObj.countered = true;
        }
      }
      break;

    case 'Giant Growth':
      // +3/+3 until end of turn (Phase 1+)
      // For now, do nothing
      break;

    // Add more spells as needed
    default:
      // Unknown spell - no effect
      break;
  }
}

/**
 * Apply damage to a target (creature or player)
 */
function applyDamage(state: GameState, targetId: string, damage: number): void {
  // Check if target is a player
  if (targetId === 'player' || targetId === 'opponent') {
    state.players[targetId].life -= damage;

    // Check for game over
    if (state.players[targetId].life <= 0) {
      state.gameOver = true;
      state.winner = targetId === 'player' ? 'opponent' : 'player';
    }
    return;
  }

  // Otherwise, target is a creature
  for (const playerId of ['player', 'opponent'] as const) {
    const player = state.players[playerId];
    const creature = player.battlefield.find(c => c.instanceId === targetId);

    if (creature) {
      creature.damage += damage;

      // Check if creature should die
      const template = CardLoader.getById(creature.scryfallId);
      if (template?.toughness) {
        const toughness = parseInt(template.toughness, 10);
        if (creature.damage >= toughness) {
          // Creature dies
          const index = player.battlefield.indexOf(creature);
          player.battlefield.splice(index, 1);
          creature.zone = 'graveyard';
          player.graveyard.push(creature);
        }
      }
      break;
    }
  }
}

/**
 * Check if both players have passed priority
 */
export function bothPlayersPassedPriority(state: GameState): boolean {
  return (
    state.players.player.hasPassedPriority &&
    state.players.opponent.hasPassedPriority
  );
}

/**
 * Check if stack can resolve
 */
export function canResolveStack(state: GameState): boolean {
  return state.stack.length > 0 && bothPlayersPassedPriority(state);
}
