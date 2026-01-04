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
import { isInstant, isSorcery, isCreature, isEnchantment, isAura, isArtifact, hasFlying } from '../cards/CardTemplate';
import {
  parseTargetRequirements,
  shouldSpellFizzle,
} from './targeting';
import { registerTrigger } from './triggers';
import {
  // Mass destruction
  destroyAllCreatures,
  destroyAllLands,
  destroyAllArtifacts,
  destroyAllEnchantments,
  destroyAllCreaturesOfColor,
  destroyAllLandsOfType,
  destroyAllNonEnchantments,
  // Untap/tap effects
  untapAllLands,
  untapAllCreatures,
  tapAllNonFlyingCreatures,
  // Library search (tutors)
  searchLibrary,
  shuffleLibrary,
  // Graveyard recursion
  returnCreatureFromGraveyard,
  returnSpellFromGraveyard,
  // Team pump
  applyTeamPump,
  // Mass damage
  dealDamageToAll,
  // Card manipulation
  putCardsOnTopOfLibrary,
  discardThenDraw,
  drawThenPutBack,
  // Life manipulation
  drainLife,
  drawCardsPayLife,
  // Conditional destruction
  destroyIfDamaged,
  destroyIfPowerFourOrGreater,
} from './effects';

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
  if (!text.includes('each creature') && !text.includes('each player') && !text.includes('each other player')) {
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

    // ========================================
    // PHASE A: QUICK WINS (Week 1.5.2)
    // ========================================

    // Simple destruction spells
    case 'Wrath of God':
      // Destroy all creatures. They can't be regenerated.
      destroyAllCreatures(state);
      break;

    case 'Armageddon':
      // Destroy all lands
      destroyAllLands(state);
      break;

    case 'Shatterstorm':
      // Destroy all artifacts. They can't be regenerated.
      destroyAllArtifacts(state);
      break;

    case 'Tranquility':
      // Destroy all enchantments
      destroyAllEnchantments(state);
      break;

    case 'Perish':
      // Destroy all green creatures. They can't be regenerated.
      destroyAllCreaturesOfColor(state, 'green');
      break;

    case 'Flashfires':
      // Destroy all Plains
      destroyAllLandsOfType(state, 'Plains');
      break;

    case 'Boil':
      // Destroy all Islands
      destroyAllLandsOfType(state, 'Island');
      break;

    case 'Jokulhaups':
      // Destroy all artifacts, creatures, and lands
      destroyAllNonEnchantments(state);
      break;

    case 'Shatter':
      // Destroy target artifact
      if (stackObj.targets[0]) {
        destroyArtifact(state, stackObj.targets[0]);
      }
      break;

    case 'Stone Rain':
      // Destroy target land
      if (stackObj.targets[0]) {
        destroyPermanent(state, stackObj.targets[0]);
      }
      break;

    case 'Pillage':
      // Destroy target artifact or land. It can't be regenerated.
      if (stackObj.targets[0]) {
        destroyPermanent(state, stackObj.targets[0]);
      }
      break;

    case 'Creeping Mold':
      // Destroy target artifact, enchantment, or land
      if (stackObj.targets[0]) {
        destroyPermanent(state, stackObj.targets[0]);
      }
      break;

    // Conditional destruction
    case 'Fatal Blow':
      // Destroy target creature that was dealt damage this turn
      if (stackObj.targets[0]) {
        destroyIfDamaged(state, stackObj.targets[0]);
      }
      break;

    case 'Reprisal':
      // Destroy target creature with power 4 or greater. It can't be regenerated.
      if (stackObj.targets[0]) {
        destroyIfPowerFourOrGreater(state, stackObj.targets[0]);
      }
      break;

    // Simple damage spells
    case 'Dry Spell':
      // Dry Spell deals 1 damage to each creature and each player
      dealDamageToAll(state, 1, { creatures: true, players: true });
      break;

    case 'Tremor':
      // Tremor deals 1 damage to each creature without flying
      dealDamageToAll(state, 1, { creatures: true, flyersOnly: false, players: false, excludeFlyers: true });
      break;

    case 'Inferno':
      // Inferno deals 6 damage to each creature and each player
      dealDamageToAll(state, 6, { creatures: true, players: true });
      break;

    case 'Vertigo':
      // Vertigo deals 2 damage to target creature with flying
      if (stackObj.targets[0]) {
        applyDamage(state, stackObj.targets[0], 2);
      }
      break;

    case 'Spitting Earth':
      // Spitting Earth deals damage equal to the number of Mountains you control
      if (stackObj.targets[0]) {
        const mountainCount = countMountains(state, stackObj.controller);
        applyDamage(state, stackObj.targets[0], mountainCount);
      }
      break;

    case 'Pyrotechnics':
      // Pyrotechnics deals 4 damage divided as you choose among any number of targets
      // Simplified: divide evenly among targets, or all to single target
      applyPyrotechnics(state, stackObj);
      break;

    // Bounce spell
    case 'Boomerang':
      // Return target permanent to its owner's hand
      if (stackObj.targets[0]) {
        returnToHand(state, stackObj.targets[0]);
      }
      break;

    case 'Fallow Earth':
      // Put target land on top of its owner's library
      if (stackObj.targets[0]) {
        returnToLibraryTop(state, stackObj.targets[0]);
      }
      break;

    // Simple card draw
    case 'Inspiration':
      // Target player draws 2 cards
      if (stackObj.targets[0] === 'player' || stackObj.targets[0] === 'opponent') {
        drawCards(state, stackObj.targets[0], 2);
      }
      break;

    // Pump spells
    case 'Fit of Rage':
      // Target creature gets +3/+3 and gains first strike until end of turn
      // Note: First strike grant is tracked via temporaryModifications (combat system checks sourceId)
      if (stackObj.targets[0]) {
        const target = findPermanentByInstanceId(state, stackObj.targets[0]);
        if (target) {
          // +3/+3 and first strike tracked together
          addTemporaryModification(target, 3, 3, 'end_of_turn', `${stackObj.card.instanceId}_fitofrageFirstStrike`);
        }
      }
      break;

    // Graveyard recursion (simple)
    case 'Raise Dead':
      // Return target creature card from your graveyard to your hand
      returnCreatureFromGraveyard(state, stackObj.controller);
      break;

    // ========================================
    // PHASE B: COUNTER VARIANTS (Week 1.5.2)
    // ========================================

    case 'Memory Lapse':
      // Counter target spell. Put it on top of its owner's library instead of into that player's graveyard.
      applyMemoryLapse(state, stackObj);
      break;

    case 'Remove Soul':
      // Counter target creature spell
      applyRemoveSoul(state, stackObj);
      break;

    // ========================================
    // PHASE C: UNTAP MECHANICS (Week 1.5.2)
    // ========================================

    case 'Early Harvest':
      // Untap all basic lands you control
      untapAllLands(state, stackObj.controller, true); // true = basic lands only
      break;

    case 'Vitalize':
      // Untap all creatures you control
      untapAllCreatures(state, stackObj.controller);
      break;

    case 'Mana Short':
      // Tap all lands target player controls and empty their mana pool
      if (stackObj.targets[0] === 'player' || stackObj.targets[0] === 'opponent') {
        applyManaShort(state, stackObj.targets[0]);
      }
      break;

    // ========================================
    // PHASE D: TEAM/MASS EFFECTS (Week 1.5.2)
    // ========================================

    case "Warrior's Honor":
      // Creatures you control get +1/+1 until end of turn
      applyTeamPump(state, stackObj.controller, 1, 1, stackObj.card.instanceId);
      break;

    case 'Tidal Surge':
      // Tap all creatures without flying
      tapAllNonFlyingCreatures(state, 'player');
      tapAllNonFlyingCreatures(state, 'opponent');
      break;

    // ========================================
    // PHASE E: TUTOR/SEARCH MECHANICS (Week 1.5.2)
    // ========================================

    case 'Enlightened Tutor':
      // Search your library for an artifact or enchantment card, reveal it, put on top of library, shuffle
      searchLibrary(state, stackObj.controller, stackObj.controller,
        (card) => {
          const template = CardLoader.getById(card.scryfallId);
          return template ? (isArtifact(template) || isEnchantment(template)) : false;
        },
        'library_top');
      break;

    case 'Mystical Tutor':
      // Search your library for an instant or sorcery card, reveal it, put on top of library, shuffle
      searchLibrary(state, stackObj.controller, stackObj.controller,
        (card) => {
          const template = CardLoader.getById(card.scryfallId);
          return template ? (isInstant(template) || isSorcery(template)) : false;
        },
        'library_top');
      break;

    case 'Vampiric Tutor':
      // Search your library for a card, put on top of library, lose 2 life, shuffle
      searchLibrary(state, stackObj.controller, stackObj.controller,
        () => true, // Any card
        'library_top');
      state.players[stackObj.controller].life -= 2;
      break;

    case 'Worldly Tutor':
      // Search your library for a creature card, reveal it, put on top of library, shuffle
      searchLibrary(state, stackObj.controller, stackObj.controller,
        (card) => {
          const template = CardLoader.getById(card.scryfallId);
          return template ? isCreature(template) : false;
        },
        'library_top');
      break;

    case 'Rampant Growth':
      // Search your library for a basic land card, put it onto the battlefield tapped, shuffle
      searchLibrary(state, stackObj.controller, stackObj.controller,
        (card) => {
          const template = CardLoader.getById(card.scryfallId);
          return template ? isBasicLand(template) : false;
        },
        'battlefield_tapped');
      break;

    case 'Untamed Wilds':
      // Search your library for a basic land card, put it onto the battlefield, shuffle
      searchLibrary(state, stackObj.controller, stackObj.controller,
        (card) => {
          const template = CardLoader.getById(card.scryfallId);
          return template ? isBasicLand(template) : false;
        },
        'battlefield');
      break;

    // ========================================
    // PHASE F: GRAVEYARD RECURSION (Week 1.5.2)
    // ========================================

    case 'Elven Cache':
      // Return target card from your graveyard to your hand
      // Simplified: return first non-land card
      returnFromGraveyardToHand(state, stackObj.controller, 1);
      break;

    case 'Relearn':
      // Return target instant or sorcery card from your graveyard to your hand
      returnSpellFromGraveyard(state, stackObj.controller);
      break;

    case 'Nature\'s Resurgence':
      // Each player returns all creature cards from their graveyard to their hand
      returnAllCreaturesFromGraveyard(state, 'player');
      returnAllCreaturesFromGraveyard(state, 'opponent');
      break;

    case 'Hammer of Bogardan':
      // Hammer of Bogardan deals 3 damage to any target
      // (Recursion ability handled separately as activated ability)
      if (stackObj.targets[0]) {
        applyDamage(state, stackObj.targets[0], 3);
      }
      break;

    case 'Ashen Powder':
      // Return target creature card from an opponent's graveyard to the battlefield under your control
      applyAshenPowder(state, stackObj);
      break;

    // ========================================
    // PHASE G: CARD MANIPULATION (Week 1.5.2)
    // ========================================

    case 'Agonizing Memories':
      // Look at target player's hand and choose 2 cards from it. Put them on top of library in any order.
      // Simplified: put top 2 cards from hand on top of library (deterministic)
      if (stackObj.targets[0] === 'player' || stackObj.targets[0] === 'opponent') {
        putCardsOnTopOfLibrary(state, stackObj.targets[0], 2);
      }
      break;

    case 'Ancestral Memories':
      // Look at the top 7 cards of your library. Put 2 into hand, rest in graveyard.
      applyAncestralMemories(state, stackObj.controller);
      break;

    case 'Dream Cache':
      // Draw 3 cards, then put 2 cards from your hand on top of library in any order
      drawThenPutBack(state, stackObj.controller, 3, 2);
      break;

    case 'Forget':
      // Target player discards 2 cards, then draws as many cards
      if (stackObj.targets[0] === 'player' || stackObj.targets[0] === 'opponent') {
        discardThenDraw(state, stackObj.targets[0], 2, 2);
      }
      break;

    case 'Painful Memories':
      // Look at target player's hand and choose a card from it. That player puts it on top of library.
      // Simplified: put first card from hand on top of library
      if (stackObj.targets[0] === 'player' || stackObj.targets[0] === 'opponent') {
        putCardsOnTopOfLibrary(state, stackObj.targets[0], 1);
      }
      break;

    case 'Stupor':
      // Target opponent discards a card at random, then discards a card.
      // Simplified: target opponent discards 2 cards at random
      if (stackObj.targets[0] === 'player' || stackObj.targets[0] === 'opponent') {
        discardCards(state, stackObj.targets[0], 2);
      }
      break;

    // ========================================
    // PHASE H: LIFE/MISC EFFECTS (Week 1.5.2)
    // ========================================

    case 'Infernal Contract':
      // Draw 4 cards. You lose half your life, rounded up.
      drawCards(state, stackObj.controller, 4);
      drawCardsPayLife(state, stackObj.controller, 0, Math.ceil(state.players[stackObj.controller].life / 2));
      break;

    case 'Syphon Soul':
      // Syphon Soul deals 2 damage to each other player. You gain life equal to the damage dealt.
      drainLife(state, stackObj.controller, 2);
      break;

    case 'Tariff':
      // Each player sacrifices the creature they control with highest CMC
      applyTariff(state);
      break;

    case 'Library of Lat-Nam':
      // An opponent chooses one: You draw 3 cards; or search library for a card, put in hand
      // Simplified: just draw 3 cards (assume opponent always chooses this)
      drawCards(state, stackObj.controller, 3);
      break;

    // Extra land/combat
    case 'Summer Bloom':
      // You may play up to three additional lands this turn
      // Simplified: Reset landsPlayedThisTurn to allow 3 more plays
      // Note: Full implementation would track additionalLandPlays in PlayerState
      state.players[stackObj.controller].landsPlayedThisTurn = Math.max(0, state.players[stackObj.controller].landsPlayedThisTurn - 3);
      break;

    case 'Relentless Assault':
      // Untap all creatures that attacked this turn. After this main phase, there is an additional combat phase.
      // Simplified: just untap all creatures (extra combat is complex)
      untapAllCreatures(state, stackObj.controller);
      break;

    // Token generation
    case 'Icatian Town':
      // Create four 1/1 white Citizen creature tokens
      createTokensForSpell(state, stackObj.controller, 'citizen', 4);
      break;

    case 'Waiting in the Weeds':
      // Each player creates a 1/1 green Cat creature token for each untapped Forest they control
      applyWaitingInTheWeeds(state);
      break;

    // Damage prevention (additional)
    case 'Remedy':
      // Prevent the next 5 damage that would be dealt to target creature this turn
      // Simplified: Remove 5 damage from creature (if it has damage)
      if (stackObj.targets[0]) {
        const target = findPermanentByInstanceId(state, stackObj.targets[0]);
        if (target) {
          target.damage = Math.max(0, target.damage - 5);
        }
      }
      break;

    case 'Reverse Damage':
      // The next time a source would deal damage to you this turn, prevent that damage. You gain life equal to damage prevented.
      // Simplified: Gain 5 life (approximation of typical damage)
      state.players[stackObj.controller].life += 5;
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

// ========================================
// NEW HELPER FUNCTIONS (Week 1.5.2)
// ========================================

/**
 * Destroy target artifact
 */
function destroyArtifact(state: GameState, targetId: string): void {
  for (const playerId of ['player', 'opponent'] as const) {
    const player = state.players[playerId];
    const index = player.battlefield.findIndex(c => c.instanceId === targetId);

    if (index !== -1) {
      const permanent = player.battlefield[index]!;
      const template = CardLoader.getById(permanent.scryfallId);

      // Only destroy if it's an artifact
      if (template && isArtifact(template)) {
        player.battlefield.splice(index, 1);
        permanent.zone = 'graveyard';
        player.graveyard.push(permanent);
      }
      return;
    }
  }
}

/**
 * Count Mountains controller controls
 */
function countMountains(state: GameState, controller: PlayerId): number {
  const player = state.players[controller];
  let count = 0;

  for (const permanent of player.battlefield) {
    const template = CardLoader.getById(permanent.scryfallId);
    if (template) {
      // Check if it's a Mountain (either basic or has Mountain type)
      if (template.name === 'Mountain' ||
          (template.type_line && template.type_line.includes('Mountain'))) {
        count++;
      }
    }
  }

  return count;
}

/**
 * Apply Pyrotechnics: 4 damage divided among targets
 */
function applyPyrotechnics(state: GameState, stackObj: StackObject): void {
  const targets = stackObj.targets;
  if (targets.length === 0) return;

  // Divide 4 damage evenly among all targets, remainder goes to first target
  const damagePerTarget = Math.floor(4 / targets.length);
  const remainder = 4 % targets.length;

  for (let i = 0; i < targets.length; i++) {
    const damage = damagePerTarget + (i === 0 ? remainder : 0);
    applyDamage(state, targets[i]!, damage);
  }
}

/**
 * Return a permanent to the top of its owner's library
 */
function returnToLibraryTop(state: GameState, targetId: string): void {
  for (const playerId of ['player', 'opponent'] as const) {
    const player = state.players[playerId];
    const index = player.battlefield.findIndex(c => c.instanceId === targetId);

    if (index !== -1) {
      const permanent = player.battlefield[index]!;
      player.battlefield.splice(index, 1);
      permanent.zone = 'library';
      permanent.tapped = false;
      permanent.damage = 0;
      permanent.summoningSick = false;
      // Put on top of owner's library
      state.players[permanent.owner].library.push(permanent);
      return;
    }
  }
}

/**
 * Apply Memory Lapse: Counter spell and put on top of library
 */
function applyMemoryLapse(state: GameState, stackObj: StackObject): void {
  const targetId = stackObj.targets[0];
  if (!targetId) return;

  const targetStackObj = state.stack.find(s => s.id === targetId);
  if (!targetStackObj) return;

  // Mark as countered (it will be handled specially)
  targetStackObj.countered = true;

  // Instead of going to graveyard, put on top of library
  // This is handled by checking the countered flag during resolution
  // We'll set a special property to indicate library-top placement
  (targetStackObj as { putOnLibrary?: boolean }).putOnLibrary = true;
}

/**
 * Apply Remove Soul: Counter target creature spell
 */
function applyRemoveSoul(state: GameState, stackObj: StackObject): void {
  const targetId = stackObj.targets[0];
  if (!targetId) return;

  const targetStackObj = state.stack.find(s => s.id === targetId);
  if (!targetStackObj) return;

  // Check if target is a creature spell
  const template = CardLoader.getById(targetStackObj.card.scryfallId);
  if (template && isCreature(template)) {
    targetStackObj.countered = true;
  }
}

/**
 * Apply Mana Short: Tap all lands and empty mana pool
 */
function applyManaShort(state: GameState, targetPlayer: PlayerId): void {
  const player = state.players[targetPlayer];

  // Tap all lands
  for (const permanent of player.battlefield) {
    const template = CardLoader.getById(permanent.scryfallId);
    if (template && template.type_line?.toLowerCase().includes('land')) {
      permanent.tapped = true;
    }
  }

  // Empty mana pool
  player.manaPool = {
    white: 0,
    blue: 0,
    black: 0,
    red: 0,
    green: 0,
    colorless: 0,
  };
}

/**
 * Check if a card is a basic land
 */
function isBasicLand(template: { type_line?: string; name?: string }): boolean {
  const basicLandNames = ['Plains', 'Island', 'Swamp', 'Mountain', 'Forest'];
  if (template.name && basicLandNames.includes(template.name)) {
    return true;
  }
  return template.type_line?.toLowerCase().includes('basic land') || false;
}

/**
 * Return cards from graveyard to hand
 */
function returnFromGraveyardToHand(state: GameState, playerId: PlayerId, count: number): void {
  const player = state.players[playerId];

  for (let i = 0; i < count && player.graveyard.length > 0; i++) {
    // Take first card (deterministic)
    const card = player.graveyard.shift()!;
    card.zone = 'hand';
    player.hand.push(card);
  }
}

/**
 * Return all creature cards from graveyard to hand
 */
function returnAllCreaturesFromGraveyard(state: GameState, playerId: PlayerId): void {
  const player = state.players[playerId];
  const toReturn: CardInstance[] = [];

  // Find all creatures in graveyard
  for (const card of player.graveyard) {
    const template = CardLoader.getById(card.scryfallId);
    if (template && isCreature(template)) {
      toReturn.push(card);
    }
  }

  // Move them to hand
  for (const card of toReturn) {
    const index = player.graveyard.indexOf(card);
    if (index !== -1) {
      player.graveyard.splice(index, 1);
      card.zone = 'hand';
      player.hand.push(card);
    }
  }
}

/**
 * Apply Ashen Powder: Steal creature from opponent's graveyard
 */
function applyAshenPowder(state: GameState, stackObj: StackObject): void {
  const controller = stackObj.controller;
  const opponent = controller === 'player' ? 'opponent' : 'player';
  const opponentPlayer = state.players[opponent];
  const controllerPlayer = state.players[controller];

  // Find first creature in opponent's graveyard
  for (let i = 0; i < opponentPlayer.graveyard.length; i++) {
    const card = opponentPlayer.graveyard[i]!;
    const template = CardLoader.getById(card.scryfallId);

    if (template && isCreature(template)) {
      // Remove from opponent's graveyard
      opponentPlayer.graveyard.splice(i, 1);

      // Put onto battlefield under controller's control
      card.zone = 'battlefield';
      card.controller = controller;
      card.summoningSick = true;
      card.tapped = false;
      card.damage = 0;
      controllerPlayer.battlefield.push(card);

      // Register ETB trigger
      registerTrigger(state, {
        type: 'ENTERS_BATTLEFIELD',
        cardId: card.instanceId,
        controller: controller,
      });

      return;
    }
  }
}

/**
 * Apply Ancestral Memories: Look at top 7, keep 2, rest to graveyard
 */
function applyAncestralMemories(state: GameState, controller: PlayerId): void {
  const player = state.players[controller];

  // Take top 7 cards (or fewer if library is smaller)
  const cardsToLook = Math.min(7, player.library.length);
  const lookedCards: CardInstance[] = [];

  for (let i = 0; i < cardsToLook; i++) {
    const card = player.library.pop()!;
    lookedCards.push(card);
  }

  // Keep first 2 (deterministic selection)
  for (let i = 0; i < Math.min(2, lookedCards.length); i++) {
    const card = lookedCards[i]!;
    card.zone = 'hand';
    player.hand.push(card);
  }

  // Rest go to graveyard
  for (let i = 2; i < lookedCards.length; i++) {
    const card = lookedCards[i]!;
    card.zone = 'graveyard';
    player.graveyard.push(card);
  }
}

/**
 * Apply Tariff: Each player sacrifices their highest CMC creature
 */
function applyTariff(state: GameState): void {
  for (const playerId of ['player', 'opponent'] as const) {
    const player = state.players[playerId];
    let highestCMC = -1;
    let creatureToSacrifice: CardInstance | null = null;

    // Find creature with highest CMC
    for (const permanent of player.battlefield) {
      const template = CardLoader.getById(permanent.scryfallId);
      if (!template || !isCreature(template)) continue;

      // Calculate CMC
      const manaCost = template.mana_cost || '';
      let cmc = 0;
      const colorMatch = manaCost.match(/\{[WUBRGC]\}/gi);
      if (colorMatch) cmc += colorMatch.length;
      const genericMatch = manaCost.match(/\{(\d+)\}/);
      if (genericMatch) cmc += parseInt(genericMatch[1]!, 10);

      if (cmc > highestCMC) {
        highestCMC = cmc;
        creatureToSacrifice = permanent;
      }
    }

    // Sacrifice the creature
    if (creatureToSacrifice) {
      const index = player.battlefield.indexOf(creatureToSacrifice);
      if (index !== -1) {
        player.battlefield.splice(index, 1);
        creatureToSacrifice.zone = 'graveyard';
        player.graveyard.push(creatureToSacrifice);

        // Fire death trigger
        registerTrigger(state, {
          type: 'DIES',
          cardId: creatureToSacrifice.instanceId,
          controller: playerId,
          wasController: playerId,
        });
      }
    }
  }
}

/**
 * Create tokens for a spell
 */
function createTokensForSpell(state: GameState, controller: PlayerId, tokenType: string, count: number): void {
  // Import token creation from TokenRegistry dynamically would be complex,
  // so we'll create tokens manually here
  const player = state.players[controller];

  for (let i = 0; i < count; i++) {
    const token: CardInstance = {
      instanceId: `token_${tokenType}_${Date.now()}_${Math.random()}`,
      scryfallId: `token_${tokenType}`,
      owner: controller,
      controller: controller,
      zone: 'battlefield',
      tapped: false,
      damage: 0,
      counters: {},
      attachments: [],
      temporaryModifications: [],
      summoningSick: true,
      isToken: true,
      tokenType: tokenType === 'citizen' ? 'Citizen' : tokenType === 'cat' ? 'Cat' : tokenType,
    };

    player.battlefield.push(token);

    // Register ETB trigger
    registerTrigger(state, {
      type: 'ENTERS_BATTLEFIELD',
      cardId: token.instanceId,
      controller: controller,
    });
  }
}

/**
 * Apply Waiting in the Weeds: Create Cat tokens for untapped Forests
 */
function applyWaitingInTheWeeds(state: GameState): void {
  for (const playerId of ['player', 'opponent'] as const) {
    const player = state.players[playerId];
    let forestCount = 0;

    // Count untapped Forests
    for (const permanent of player.battlefield) {
      const template = CardLoader.getById(permanent.scryfallId);
      if (template && !permanent.tapped) {
        if (template.name === 'Forest' ||
            (template.type_line && template.type_line.includes('Forest'))) {
          forestCount++;
        }
      }
    }

    // Create Cat tokens
    if (forestCount > 0) {
      createTokensForSpell(state, playerId, 'cat', forestCount);
    }
  }
}
