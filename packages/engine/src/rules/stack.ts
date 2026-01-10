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
import { addTemporaryModification } from '../state/CardInstance';
import type { PlayerId } from '../state/Zone';
import { getPlayer, findCard } from '../state/GameState';
import { CardLoader } from '../cards/CardLoader';
import { isInstant, isSorcery, isAura } from '../cards/CardTemplate';
import { parseTargetRequirements, shouldSpellFizzle } from './targeting';
import { registerTrigger } from './triggers';
import { getSpellImplementation } from '../spells';
import {
  // Single target effects (used by generic parsing)
  destroyPermanent,
  returnToHand,
  exileWithLifegain,
  applyDamage,
  findPermanentByInstanceId,
  // Card draw/discard
  drawCards,
  discardCards,
} from './effects';
import { applyAbilityEffect, type ActivatedAbility } from './activatedAbilities';
import { getActivatedAbilities } from './activatedAbilities'; // Needed to re-fetch ability definition if needed

/**
 * Counter for stack IDs (for determinism)
 */
let stackCounter = 0;

/**
 * Reset stack counter (for test isolation)
 * @internal - Only use in tests
 */
export function _resetStackCounter(): void {
  stackCounter = 0;
}

/**
 * Add a spell to the stack
 */
export function pushToStack(
  state: GameState,
  card: CardInstance,
  controller: PlayerId,
  targets: string[] = [],
  xValue?: number,
): void {
  const stackObj: StackObject = {
    id: `stack_${stackCounter++}`,
    controller,
    card,
    targets,
    resolved: false,
    countered: false,
    xValue,
    type: 'spell',
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
 * Add an activated ability to the stack
 */
export function pushAbilityToStack(
  state: GameState,
  sourceId: string,
  ability: ActivatedAbility,
  controller: PlayerId,
  targets: string[] = [],
  xValue?: number,
): void {
  const sourceCard = findCard(state, sourceId);
  if (!sourceCard) return;

  const stackObj: StackObject = {
    id: `stack_${stackCounter++}`,
    controller,
    card: sourceCard,
    targets,
    resolved: false,
    countered: false,
    xValue,
    type: 'ability',
    abilityId: ability.id,
    sourceId: sourceId,
  };

  state.stack.push(stackObj);

  // Reset priority passes
  state.players.player.hasPassedPriority = false;
  state.players.opponent.hasPassedPriority = false;
  state.players.player.consecutivePasses = 0;
  state.players.opponent.consecutivePasses = 0;

  // Priority goes to the other player
  state.priorityPlayer = controller === 'player' ? 'opponent' : 'player';
}

/**
 * Resolve the top spell on the stack
 */
export function resolveTopOfStack(state: GameState): void {
  if (state.stack.length === 0) return;

  const stackObj = state.stack[state.stack.length - 1]!;
  const controller = getPlayer(state, stackObj.controller);
  
  // Check for fizzling
  if (stackObj.countered) {
    // Countered objects are removed. 
    // Spells go to GY. Abilities just vanish.
    if (stackObj.type !== 'ability') {
        stackObj.card.zone = 'graveyard';
        controller.graveyard.push(stackObj.card);
    }
  } else if (checkSpellFizzles(state, stackObj)) {
    // Fizzled (illegal targets).
    // Spells go to GY. Abilities just vanish.
    if (stackObj.type !== 'ability') {
        stackObj.card.zone = 'graveyard';
        controller.graveyard.push(stackObj.card);
    }
  } else {
    // Resolve
    if (stackObj.type === 'ability') {
        resolveAbility(state, stackObj);
    } else {
        resolveSpell(state, stackObj);
    }
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
 * Resolve an activated ability
 */
function resolveAbility(state: GameState, stackObj: StackObject): void {
  if (!stackObj.abilityId || !stackObj.sourceId) return;

  const card = findCard(state, stackObj.sourceId);
  if (!card) return; // Source might be gone, but ability still resolves (LKA)
  // Actually, for simple implementation, we assume ability definition is retrievable.
  // If card is gone, we might need to look up LKA or just re-fetch abilities from template if possible?
  // But abilities are instance-specific often.
  // For now, if card is gone, let's try to proceed if we can find the ability definition?
  // We don't store the full ability definition on the stack, just the ID.
  
  // Re-fetch abilities to find the definition
  // Note: if card is in GY, `getActivatedAbilities` might not work as expected if it filters by zone.
  // But `getActivatedAbilities` checks registry using card name.
  
  // Workaround: We really should store the AbilityEffect on the stack object or the full Ability definition 
  // to be safe against source removal.
  // But `StackObject` in GameState is serializable JSON, `ActivatedAbility` contains functions (`canActivate`).
  // We can't store functions in GameState.
  
  // So we must re-derive the ability.
  const abilities = getActivatedAbilities(card, state);
  const ability = abilities.find(a => a.id === stackObj.abilityId);

  if (!ability) {
      // Ability not found? Maybe source changed zones and ID changed?
      // Or maybe it was a one-shot ability?
      return;
  }

  // Temporarily patch the ability target to be the specific target chosen
  // This is a hack because `applyAbilityEffect` takes `AbilityEffect` which has a single `target` string
  // but `StackObject` has `targets[]`.
  // We need to map stack targets to the effect.
  
  // If the ability has targets, we pass them.
  // `applyAbilityEffect` signature: 
  // applyAbilityEffect(state, effect, controller, manaColorChoice, sourceId)
  
  // Wait, `applyAbilityEffect` inside `reducer.ts` handled mapping targets:
  // `ability.effect.target = action.payload.targets[0];`
  // We shouldn't mutate the ability definition itself as it might be shared/cached?
  // `getActivatedAbilities` returns new objects usually.
  
  const effectToApply = { ...ability.effect };
  if (stackObj.targets.length > 0) {
      effectToApply.target = stackObj.targets[0];
  }
  
  applyAbilityEffect(state, effectToApply, stackObj.controller, undefined, stackObj.sourceId);
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
    stackObj.card,
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
  type:
    | 'damage'
    | 'destroy'
    | 'counter'
    | 'return_to_hand'
    | 'pump'
    | 'draw'
    | 'discard'
    | 'exile_with_lifegain'
    | 'targeted_discard'
    | 'gain_life';
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
  if (
    !text.includes('each creature') &&
    !text.includes('each player') &&
    !text.includes('each other player')
  ) {
    const damageMatch = text.match(/deals? (\d+|x) damage/i);
    if (damageMatch) {
      const amount = damageMatch[1] === 'x' ? 0 : parseInt(damageMatch[1]!, 10);
      return { type: 'damage', amount };
    }
  }

  // Counter spells: "counter target spell" (generic counters only)
  // Specific counters like "counter target creature spell" should fall through
  if (text.includes('counter target spell') && !text.includes('counter target creature')) {
    return { type: 'counter' };
  }

  // Destroy spells: "destroy target"
  if (text.includes('destroy target')) {
    return { type: 'destroy' };
  }

  // Return to hand: "return target permanent/creature to ... hand" (bounce effects)
  // Graveyard recursion like "return target creature card from your graveyard" should fall through
  if (/return target .+ to .+ hand/i.test(text) && !text.includes('graveyard')) {
    return { type: 'return_to_hand' };
  }

  // Pump spells: "+X/+Y" or "gets +X/+Y" (including X values)
  // X pump spells like "gets +X/+0" fall through to specific card handling
  // Team pump effects like "creatures you control get +1/+1" should also fall through
  if (!text.includes('creatures you control') && !text.includes('each creature')) {
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
  if (
    text.includes('reveals') &&
    text.includes('choose a card') &&
    text.includes('discards that card')
  ) {
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
 *
 * Resolution order:
 * 1. Check spell registry for card-specific implementation (O(1) lookup)
 * 2. Try generic oracle text parsing
 * 3. Fall back to legacy applySpecificCardEffect switch statement
 */
function applySpellEffects(state: GameState, stackObj: StackObject): void {
  const template = CardLoader.getById(stackObj.card.scryfallId);
  if (!template) return;

  // 1. Check spell registry first (new system - O(1) lookup)
  const spellImpl = getSpellImplementation(template.name);
  if (spellImpl) {
    spellImpl.resolve(state, stackObj);
    return;
  }

  // 2. Try generic oracle text parsing
  const oracleText = template.oracle_text || '';
  const effect = parseSpellEffect(oracleText);

  if (!effect) {
    // No recognized effect - spell resolves with no effect
    // All specific cards should be handled by the spell registry
    return;
  }

  // Apply the parsed effect to targets
  for (const targetId of stackObj.targets) {
    switch (effect.type) {
      case 'damage': {
        // For X spells, use the X value from the stack object
        const damage = oracleText.toLowerCase().includes('x damage')
          ? stackObj.xValue || 0
          : effect.amount || 0;
        applyDamage(state, targetId, damage);
        break;
      }

      case 'counter': {
        const targetStackObj = state.stack.find((s) => s.id === targetId);
        if (targetStackObj) {
          // Mark the spell as countered - it will be moved to graveyard when it resolves
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
            stackObj.card.instanceId,
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
        const lifeGain = effect.isXSpell ? stackObj.xValue || 0 : effect.amount || 0;
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
 * Check if both players have passed priority
 */
export function bothPlayersPassedPriority(state: GameState): boolean {
  return state.players.player.hasPassedPriority && state.players.opponent.hasPassedPriority;
}

/**
 * Check if stack can resolve
 */
export function canResolveStack(state: GameState): boolean {
  return state.stack.length > 0 && bothPlayersPassedPriority(state);
}
