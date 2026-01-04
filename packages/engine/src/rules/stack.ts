/**
 * The Stack - LIFO spell and ability resolution
 *
 * Key concepts:
 * - Last In, First Out (LIFO) - top of stack resolves first
 * - Both players must pass priority in succession for stack to resolve
 * - Adding to stack resets priority passes
 * - Spells fizzle if all targets become illegal
 */

import type { GameState, StackObject } from '../state/GameState';
import type { CardInstance } from '../state/CardInstance';
import type { PlayerId } from '../state/Zone';
import { getPlayer, findCard } from '../state/GameState';
import { CardLoader } from '../cards/CardLoader';
import { isInstant, isSorcery, isCreature, isEnchantment } from '../cards/CardTemplate';
import {
  parseTargetRequirements,
  shouldSpellFizzle,
} from './targeting';

/**
 * Add a spell to the stack
 */
export function pushToStack(
  state: GameState,
  card: CardInstance,
  controller: PlayerId,
  targets: string[] = [],
  xValue?: number
): void {
  const stackObj: StackObject = {
    id: `stack_${Date.now()}_${Math.random()}`,
    controller,
    card,
    targets,
    resolved: false,
    countered: false,
    xValue,
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
  const controller = getPlayer(state, stackObj.controller);
  const template = CardLoader.getById(stackObj.card.scryfallId);

  if (stackObj.countered) {
    // Countered spells go to graveyard without resolving
    stackObj.card.zone = 'graveyard';
    controller.graveyard.push(stackObj.card);
  } else if (template && checkSpellFizzles(state, stackObj)) {
    // Spell fizzles - all targets became illegal
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
 * Check if a spell should fizzle (all targets became illegal)
 */
function checkSpellFizzles(state: GameState, stackObj: StackObject): boolean {
  if (stackObj.targets.length === 0) {
    return false; // No targets = can't fizzle
  }

  const template = CardLoader.getById(stackObj.card.scryfallId);
  if (!template) return false;

  const targetRequirements = parseTargetRequirements(template.oracle_text || '');
  if (targetRequirements.length === 0) {
    return false; // No targeting requirements
  }

  return shouldSpellFizzle(
    state,
    stackObj.targets,
    targetRequirements,
    stackObj.controller,
    stackObj.card
  );
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
 * Spell effect types parsed from oracle text
 */
interface SpellEffect {
  type: 'damage' | 'destroy' | 'counter' | 'return_to_hand' | 'pump' | 'draw' | 'discard';
  amount?: number;
  powerBoost?: number;
  toughnessBoost?: number;
}

/**
 * Parse spell effects from oracle text
 */
function parseSpellEffect(oracleText: string): SpellEffect | null {
  const text = oracleText.toLowerCase();

  // Damage spells: "deals X damage"
  const damageMatch = text.match(/deals? (\d+|x) damage/i);
  if (damageMatch) {
    const amount = damageMatch[1] === 'x' ? 0 : parseInt(damageMatch[1]!, 10);
    return { type: 'damage', amount };
  }

  // Counter spells: "counter target"
  if (text.includes('counter target')) {
    return { type: 'counter' };
  }

  // Destroy spells: "destroy target"
  if (text.includes('destroy target')) {
    return { type: 'destroy' };
  }

  // Return to hand: "return target ... to ... hand"
  if (/return target .+ to .+ hand/i.test(text)) {
    return { type: 'return_to_hand' };
  }

  // Pump spells: "+X/+Y" or "gets +X/+Y"
  const pumpMatch = text.match(/gets? \+(\d+)\/\+(\d+)/i);
  if (pumpMatch) {
    return {
      type: 'pump',
      powerBoost: parseInt(pumpMatch[1]!, 10),
      toughnessBoost: parseInt(pumpMatch[2]!, 10),
    };
  }

  // Draw cards: "draw X cards" or "draw a card"
  const drawMatch = text.match(/draw (\d+|a|an) cards?/i);
  if (drawMatch) {
    const amount = drawMatch[1] === 'a' || drawMatch[1] === 'an' ? 1 : parseInt(drawMatch[1]!, 10);
    return { type: 'draw', amount };
  }

  // Discard: "discards X cards"
  const discardMatch = text.match(/discards? (\d+|a) cards?/i);
  if (discardMatch) {
    const amount = discardMatch[1] === 'a' ? 1 : parseInt(discardMatch[1]!, 10);
    return { type: 'discard', amount };
  }

  return null;
}

/**
 * Apply spell effects based on oracle text parsing
 */
function applySpellEffects(state: GameState, stackObj: StackObject): void {
  const template = CardLoader.getById(stackObj.card.scryfallId);
  if (!template) return;

  const oracleText = template.oracle_text || '';
  const effect = parseSpellEffect(oracleText);

  if (!effect) {
    // No recognized effect - fall back to specific card handling
    applySpecificCardEffect(state, stackObj, template.name);
    return;
  }

  // Apply the parsed effect to targets
  for (const targetId of stackObj.targets) {
    switch (effect.type) {
      case 'damage': {
        // For X spells, use the X value from the stack object
        const damage = oracleText.toLowerCase().includes('x damage')
          ? (stackObj.xValue || 0)
          : (effect.amount || 0);
        applyDamage(state, targetId, damage);
        break;
      }

      case 'counter': {
        const targetStackObj = state.stack.find(s => s.id === targetId);
        if (targetStackObj) {
          targetStackObj.countered = true;
        }
        break;
      }

      case 'destroy': {
        destroyPermanent(state, targetId);
        break;
      }

      case 'return_to_hand': {
        returnToHand(state, targetId);
        break;
      }

      case 'pump': {
        // TODO: Track temporary power/toughness modifiers
        // For now, we'll skip this as it requires end-of-turn tracking
        break;
      }

      case 'draw': {
        if (targetId === 'player' || targetId === 'opponent') {
          drawCards(state, targetId, effect.amount || 1);
        }
        break;
      }

      case 'discard': {
        if (targetId === 'player' || targetId === 'opponent') {
          // Random discard for now
          discardCards(state, targetId, effect.amount || 1);
        }
        break;
      }
    }
  }

  // Handle non-targeted effects (e.g., "draw 3 cards" without targeting)
  if (stackObj.targets.length === 0) {
    if (effect.type === 'draw') {
      drawCards(state, stackObj.controller, effect.amount || 1);
    }
  }
}

/**
 * Fallback for cards with specific/complex effects
 */
function applySpecificCardEffect(state: GameState, stackObj: StackObject, cardName: string): void {
  switch (cardName) {
    case 'Dark Ritual':
      // Add {B}{B}{B} to mana pool
      state.players[stackObj.controller].manaPool.black += 3;
      break;

    // Add more specific cards as needed
    default:
      // Unknown spell - no effect
      break;
  }
}

/**
 * Destroy a permanent
 */
function destroyPermanent(state: GameState, targetId: string): void {
  for (const playerId of ['player', 'opponent'] as const) {
    const player = state.players[playerId];
    const index = player.battlefield.findIndex(c => c.instanceId === targetId);

    if (index !== -1) {
      const permanent = player.battlefield[index]!;
      player.battlefield.splice(index, 1);
      permanent.zone = 'graveyard';
      player.graveyard.push(permanent);
      return;
    }
  }
}

/**
 * Return a permanent to its owner's hand
 */
function returnToHand(state: GameState, targetId: string): void {
  for (const playerId of ['player', 'opponent'] as const) {
    const player = state.players[playerId];
    const index = player.battlefield.findIndex(c => c.instanceId === targetId);

    if (index !== -1) {
      const permanent = player.battlefield[index]!;
      player.battlefield.splice(index, 1);
      permanent.zone = 'hand';
      permanent.tapped = false;
      permanent.damage = 0;
      permanent.summoningSick = false;
      // Return to owner's hand
      state.players[permanent.owner].hand.push(permanent);
      return;
    }
  }
}

/**
 * Draw cards for a player
 */
function drawCards(state: GameState, playerId: PlayerId, count: number): void {
  const player = state.players[playerId];

  for (let i = 0; i < count; i++) {
    if (player.library.length === 0) {
      // Can't draw from empty library - player loses (handled elsewhere)
      return;
    }
    const card = player.library.pop()!;
    card.zone = 'hand';
    player.hand.push(card);
  }
}

/**
 * Discard cards from a player's hand (random)
 */
function discardCards(state: GameState, playerId: PlayerId, count: number): void {
  const player = state.players[playerId];

  for (let i = 0; i < count && player.hand.length > 0; i++) {
    // Random discard
    const index = Math.floor(Math.random() * player.hand.length);
    const card = player.hand.splice(index, 1)[0]!;
    card.zone = 'graveyard';
    player.graveyard.push(card);
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
