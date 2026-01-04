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
import { addTemporaryModification, getEffectiveToughness } from '../state/CardInstance';
import type { PlayerId } from '../state/Zone';
import { getPlayer, findCard } from '../state/GameState';
import { CardLoader } from '../cards/CardLoader';
import { isInstant, isSorcery, isCreature, isEnchantment, isAura, hasFlying } from '../cards/CardTemplate';
import {
  parseTargetRequirements,
  shouldSpellFizzle,
} from './targeting';
import { registerTrigger } from './triggers';

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
  } else if (isAura(template)) {
    // Auras attach to their target
    const targetId = stackObj.targets[0];
    if (targetId) {
      const targetCreature = findPermanentByInstanceId(state, targetId);
      if (targetCreature) {
        // Attach aura to target
        card.zone = 'battlefield';
        card.attachedTo = targetId;
        targetCreature.attachments.push(card.instanceId);
        controller.battlefield.push(card);

        // Register ETB trigger
        registerTrigger(state, {
          type: 'ENTERS_BATTLEFIELD',
          cardId: card.instanceId,
          controller: stackObj.controller,
        });
      } else {
        // Target no longer valid - aura goes to graveyard
        card.zone = 'graveyard';
        controller.graveyard.push(card);
      }
    } else {
      // No target - aura goes to graveyard (shouldn't happen with valid cast)
      card.zone = 'graveyard';
      controller.graveyard.push(card);
    }
  } else {
    // Other permanents (creatures, etc.) go to battlefield
    card.zone = 'battlefield';
    card.summoningSick = true;
    controller.battlefield.push(card);

    // Register ETB trigger
    registerTrigger(state, {
      type: 'ENTERS_BATTLEFIELD',
      cardId: card.instanceId,
      controller: stackObj.controller,
    });
  }
}

/**
 * Spell effect types parsed from oracle text
 */
interface SpellEffect {
  type: 'damage' | 'destroy' | 'counter' | 'return_to_hand' | 'pump' | 'draw' | 'discard' | 'exile_with_lifegain' | 'targeted_discard' | 'gain_life';
  amount?: number;
  powerBoost?: number;
  toughnessBoost?: number;
  isXSpell?: boolean;
}

/**
 * Parse spell effects from oracle text
 */
function parseSpellEffect(oracleText: string): SpellEffect | null {
  const text = oracleText.toLowerCase();

  // Damage spells: "deals X damage" (only for targeted spells, not mass damage)
  // Mass damage effects like "each creature" or "each player" should fall through to specific handlers
  if (!text.includes('each creature') && !text.includes('each player')) {
    const damageMatch = text.match(/deals? (\d+|x) damage/i);
    if (damageMatch) {
      const amount = damageMatch[1] === 'x' ? 0 : parseInt(damageMatch[1]!, 10);
      return { type: 'damage', amount };
    }
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

  // Pump spells: "+X/+Y" or "gets +X/+Y" (including X values)
  // X pump spells like "gets +X/+0" fall through to specific card handling
  const pumpMatch = text.match(/gets? \+(\d+|x)\/\+(\d+)/i);
  if (pumpMatch) {
    const powerVal = pumpMatch[1]?.toLowerCase();
    const toughnessVal = pumpMatch[2];
    // If power is X, fall through to specific handler
    if (powerVal === 'x') {
      return null;
    }
    return {
      type: 'pump',
      powerBoost: parseInt(powerVal!, 10),
      toughnessBoost: parseInt(toughnessVal!, 10),
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

  // Exile with life gain: "exile ... gain life equal to its toughness"
  if (text.includes('exile') && text.includes('gain life') && text.includes('toughness')) {
    return { type: 'exile_with_lifegain' };
  }

  // Targeted discard: "reveals their hand. You choose a card from it. That player discards that card"
  if (text.includes('reveals') && text.includes('choose a card') && text.includes('discards that card')) {
    return { type: 'targeted_discard' };
  }

  // Life gain: "gain X life" or "gains X life"
  const lifeGainMatch = text.match(/gains? (\d+|x) life/i);
  if (lifeGainMatch) {
    const amount = lifeGainMatch[1]?.toLowerCase() === 'x' ? 0 : parseInt(lifeGainMatch[1]!, 10);
    return { type: 'gain_life', amount, isXSpell: lifeGainMatch[1]?.toLowerCase() === 'x' };
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
        // Apply temporary power/toughness modification
        const targetCard = findPermanentByInstanceId(state, targetId);
        if (targetCard && effect.powerBoost !== undefined && effect.toughnessBoost !== undefined) {
          addTemporaryModification(
            targetCard,
            effect.powerBoost,
            effect.toughnessBoost,
            'end_of_turn',
            stackObj.card.instanceId
          );
        }
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

      case 'exile_with_lifegain': {
        // Exile creature and gain life equal to its toughness
        exileWithLifegain(state, targetId, stackObj.controller);
        break;
      }

      case 'targeted_discard': {
        // Target opponent discards a card (random for now)
        if (targetId === 'player' || targetId === 'opponent') {
          discardCards(state, targetId, 1);
        }
        break;
      }

      case 'gain_life': {
        // For X spells like Stream of Life, use X value
        const lifeGain = effect.isXSpell
          ? (stackObj.xValue || 0)
          : (effect.amount || 0);
        if (targetId === 'player' || targetId === 'opponent') {
          state.players[targetId].life += lifeGain;
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
  const xValue = stackObj.xValue || 0;

  switch (cardName) {
    case 'Dark Ritual':
      // Add {B}{B}{B} to mana pool
      state.players[stackObj.controller].manaPool.black += 3;
      break;

    // X-cost spells
    case 'Earthquake':
      // Deal X damage to each creature without flying and each player
      applyEarthquake(state, xValue);
      break;

    case 'Hurricane':
      // Deal X damage to each creature with flying and each player
      applyHurricane(state, xValue);
      break;

    case 'Howl from Beyond':
      // Target creature gets +X/+0 until end of turn
      if (stackObj.targets[0]) {
        const target = findPermanentByInstanceId(state, stackObj.targets[0]);
        if (target) {
          addTemporaryModification(target, xValue, 0, 'end_of_turn', stackObj.card.instanceId);
        }
      }
      break;

    case 'Mind Warp':
      // Look at target player's hand and make them discard X cards
      if (stackObj.targets[0] === 'player' || stackObj.targets[0] === 'opponent') {
        discardCards(state, stackObj.targets[0], xValue);
      }
      break;

    case 'Prosperity':
      // Each player draws X cards
      drawCards(state, 'player', xValue);
      drawCards(state, 'opponent', xValue);
      break;

    case 'Power Sink':
      // Counter target spell unless controller pays X (simplified: counter if X >= CMC)
      applyPowerSink(state, stackObj, xValue);
      break;

    case 'Spell Blast':
      // Counter target spell with CMC X
      applySpellBlast(state, stackObj, xValue);
      break;

    case 'Recall':
      // Discard X cards, then return X cards from graveyard to hand
      // Simplified: just return X cards from graveyard (random)
      applyRecall(state, stackObj.controller, xValue);
      break;

    // ========================================
    // DAMAGE PREVENTION (Phase 1.5.1)
    // ========================================

    case 'Fog':
      // Prevent all combat damage that would be dealt this turn
      state.preventAllCombatDamage = true;
      break;

    case 'Healing Salve':
      // Choose one:
      // - Target player gains 3 life
      // - Prevent the next 3 damage that would be dealt to any target
      // For now, only implement life gain mode (targets[0] should be 'player' or 'opponent')
      if (stackObj.targets[0] === 'player' || stackObj.targets[0] === 'opponent') {
        state.players[stackObj.targets[0]].life += 3;
      }
      // TODO: Implement prevention mode with damage shields
      break;

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
 * Exile a creature and gain life equal to its toughness
 */
function exileWithLifegain(state: GameState, targetId: string, controller: PlayerId): void {
  for (const playerId of ['player', 'opponent'] as const) {
    const player = state.players[playerId];
    const index = player.battlefield.findIndex(c => c.instanceId === targetId);

    if (index !== -1) {
      const creature = player.battlefield[index]!;
      const template = CardLoader.getById(creature.scryfallId);

      // Get toughness for life gain
      const toughness = template?.toughness ? parseInt(template.toughness, 10) : 0;

      // Exile the creature (for now, move to a new 'exile' zone represented by removing entirely)
      player.battlefield.splice(index, 1);
      creature.zone = 'exile' as 'graveyard'; // Note: exile zone not fully implemented, treating as special removal

      // Gain life equal to toughness
      state.players[controller].life += toughness;

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

      // Check if creature should die (using effective toughness for pump effects)
      const template = CardLoader.getById(creature.scryfallId);
      if (template?.toughness) {
        const baseToughness = parseInt(template.toughness, 10);
        const effectiveToughness = getEffectiveToughness(creature, baseToughness);
        if (creature.damage >= effectiveToughness) {
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
 * Find a permanent on any player's battlefield by instance ID
 */
function findPermanentByInstanceId(state: GameState, instanceId: string): CardInstance | null {
  for (const playerId of ['player', 'opponent'] as const) {
    const card = state.players[playerId].battlefield.find(c => c.instanceId === instanceId);
    if (card) return card;
  }
  return null;
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

/**
 * Apply Earthquake: X damage to each creature without flying and each player
 */
function applyEarthquake(state: GameState, xDamage: number): void {
  if (xDamage <= 0) return;

  // Damage all players
  state.players.player.life -= xDamage;
  state.players.opponent.life -= xDamage;

  // Check for game over
  if (state.players.player.life <= 0 && state.players.opponent.life <= 0) {
    state.gameOver = true;
    state.winner = null; // Draw
  } else if (state.players.player.life <= 0) {
    state.gameOver = true;
    state.winner = 'opponent';
  } else if (state.players.opponent.life <= 0) {
    state.gameOver = true;
    state.winner = 'player';
  }

  // Damage all non-flying creatures
  for (const playerId of ['player', 'opponent'] as const) {
    const player = state.players[playerId];
    const toRemove: CardInstance[] = [];

    for (const creature of player.battlefield) {
      const template = CardLoader.getById(creature.scryfallId);
      if (!template || !isCreature(template)) continue;

      // Skip flyers
      if (hasFlying(template)) continue;

      creature.damage += xDamage;

      // Check lethal damage
      const baseToughness = parseInt(template.toughness || '0', 10);
      const effectiveToughness = getEffectiveToughness(creature, baseToughness);
      if (creature.damage >= effectiveToughness) {
        toRemove.push(creature);
      }
    }

    // Remove dead creatures
    for (const creature of toRemove) {
      const index = player.battlefield.indexOf(creature);
      if (index !== -1) {
        player.battlefield.splice(index, 1);
        creature.zone = 'graveyard';
        player.graveyard.push(creature);

        // Fire death trigger
        registerTrigger(state, {
          type: 'DIES',
          cardId: creature.instanceId,
          controller: playerId,
          wasController: playerId,
        });
      }
    }
  }
}

/**
 * Apply Hurricane: X damage to each creature with flying and each player
 */
function applyHurricane(state: GameState, xDamage: number): void {
  if (xDamage <= 0) return;

  // Damage all players
  state.players.player.life -= xDamage;
  state.players.opponent.life -= xDamage;

  // Check for game over
  if (state.players.player.life <= 0 && state.players.opponent.life <= 0) {
    state.gameOver = true;
    state.winner = null; // Draw
  } else if (state.players.player.life <= 0) {
    state.gameOver = true;
    state.winner = 'opponent';
  } else if (state.players.opponent.life <= 0) {
    state.gameOver = true;
    state.winner = 'player';
  }

  // Damage all flying creatures
  for (const playerId of ['player', 'opponent'] as const) {
    const player = state.players[playerId];
    const toRemove: CardInstance[] = [];

    for (const creature of player.battlefield) {
      const template = CardLoader.getById(creature.scryfallId);
      if (!template || !isCreature(template)) continue;

      // Only flyers
      if (!hasFlying(template)) continue;

      creature.damage += xDamage;

      // Check lethal damage
      const baseToughness = parseInt(template.toughness || '0', 10);
      const effectiveToughness = getEffectiveToughness(creature, baseToughness);
      if (creature.damage >= effectiveToughness) {
        toRemove.push(creature);
      }
    }

    // Remove dead creatures
    for (const creature of toRemove) {
      const index = player.battlefield.indexOf(creature);
      if (index !== -1) {
        player.battlefield.splice(index, 1);
        creature.zone = 'graveyard';
        player.graveyard.push(creature);

        // Fire death trigger
        registerTrigger(state, {
          type: 'DIES',
          cardId: creature.instanceId,
          controller: playerId,
          wasController: playerId,
        });
      }
    }
  }
}

/**
 * Apply Power Sink: Counter target spell unless controller pays X
 * Simplified: Counter if X >= spell's CMC (approximate the "can't pay" scenario)
 */
function applyPowerSink(state: GameState, stackObj: StackObject, xValue: number): void {
  const targetId = stackObj.targets[0];
  if (!targetId) return;

  const targetStackObj = state.stack.find(s => s.id === targetId);
  if (!targetStackObj) return;

  // Get the target spell's CMC
  const targetTemplate = CardLoader.getById(targetStackObj.card.scryfallId);
  if (!targetTemplate) return;

  // Calculate CMC from mana cost
  const manaCost = targetTemplate.mana_cost || '';
  let cmc = 0;
  const colorMatch = manaCost.match(/\{[WUBRGC]\}/gi);
  if (colorMatch) cmc += colorMatch.length;
  const genericMatch = manaCost.match(/\{(\d+)\}/);
  if (genericMatch) cmc += parseInt(genericMatch[1]!, 10);

  // If X >= CMC, counter the spell (simplified: assumes opponent can't pay)
  if (xValue >= cmc) {
    targetStackObj.countered = true;
  }
}

/**
 * Apply Spell Blast: Counter target spell with CMC X
 */
function applySpellBlast(state: GameState, stackObj: StackObject, xValue: number): void {
  const targetId = stackObj.targets[0];
  if (!targetId) return;

  const targetStackObj = state.stack.find(s => s.id === targetId);
  if (!targetStackObj) return;

  // Get the target spell's CMC
  const targetTemplate = CardLoader.getById(targetStackObj.card.scryfallId);
  if (!targetTemplate) return;

  // Calculate CMC from mana cost
  const manaCost = targetTemplate.mana_cost || '';
  let cmc = 0;
  const colorMatch = manaCost.match(/\{[WUBRGC]\}/gi);
  if (colorMatch) cmc += colorMatch.length;
  const genericMatch = manaCost.match(/\{(\d+)\}/);
  if (genericMatch) cmc += parseInt(genericMatch[1]!, 10);

  // Only counter if X matches the CMC exactly
  if (xValue === cmc) {
    targetStackObj.countered = true;
  }
}

/**
 * Apply Recall: Discard X cards, then return X cards from graveyard to hand
 * Simplified: Return X cards from graveyard (random selection)
 */
function applyRecall(state: GameState, controller: PlayerId, xValue: number): void {
  if (xValue <= 0) return;

  const player = state.players[controller];

  // First discard X cards (random)
  for (let i = 0; i < xValue && player.hand.length > 0; i++) {
    const index = Math.floor(Math.random() * player.hand.length);
    const card = player.hand.splice(index, 1)[0]!;
    card.zone = 'graveyard';
    player.graveyard.push(card);
  }

  // Then return X cards from graveyard to hand (random)
  for (let i = 0; i < xValue && player.graveyard.length > 0; i++) {
    const index = Math.floor(Math.random() * player.graveyard.length);
    const card = player.graveyard.splice(index, 1)[0]!;
    card.zone = 'hand';
    player.hand.push(card);
  }
}
