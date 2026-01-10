/**
 * Game Reducer - applies actions to game state
 *
 * Pure function: (state, action) => newState
 * Never mutates the original state.
 */

import type { GameState } from '../state/GameState';
import type {
  Action,
  PlayLandAction,
  CastSpellAction,
  DeclareAttackersAction,
  DeclareBlockersAction,
  EndTurnAction,
  PassPriorityAction,
  ActivateAbilityAction,
  SacrificePermanentAction,
} from './Action';
import { validateAction } from './validators';
import { getPlayer } from '../state/GameState';
import { CardLoader } from '../cards/CardLoader';
import { hasVigilance } from '../cards/CardTemplate';
import { clearTemporaryModifications } from '../state/CardInstance';
import {
  pushToStack,
  pushAbilityToStack,
  resolveTopOfStack,
  canResolveStack,
  bothPlayersPassedPriority,
} from '../rules/stack';
import { shouldAutoPass, hasAttackers } from './autoPass';
import { resolveCombatDamage, cleanupCombat } from '../rules/combat';
import { checkStateBasedActions } from '../rules/stateBasedActions';
import { registerTrigger, resolveTriggers } from '../rules/triggers';
import { getActivatedAbilities, payCosts, applyAbilityEffect } from '../rules/activatedAbilities';
import { discardCards } from '../rules/effects';
import { parseManaCost, addManaToPool, type ManaColor } from '../utils/manaCosts';
import { createEmptyManaPool, type ManaPool } from '../state/PlayerState';
import { incrementalClone } from '../state/incrementalClone';

/**
 * Apply an action to the game state
 */
export function applyAction(state: GameState, action: Action): GameState {
  // Validate action
  const errors = validateAction(state, action);
  if (errors.length > 0) {
    throw new Error(`Invalid action: ${errors.join(', ')}`);
  }

  // Clone state (immutable updates) - use incremental cloning for performance
  const newState = incrementalClone(state, action);

  // Record action in history
  newState.actionHistory.push(JSON.stringify(action));

  // Apply action based on type
  switch (action.type) {
    case 'PLAY_LAND':
      applyPlayLand(newState, action);
      break;
    case 'CAST_SPELL':
      applyCastSpell(newState, action);
      break;
    case 'DECLARE_ATTACKERS':
      applyDeclareAttackers(newState, action);
      break;
    case 'DECLARE_BLOCKERS':
      applyDeclareBlockers(newState, action);
      break;
    case 'END_TURN':
      applyEndTurn(newState, action);
      break;
    case 'PASS_PRIORITY':
      applyPassPriority(newState, action);
      break;
    case 'DRAW_CARD':
      applyDrawCard(newState, action);
      break;
    case 'UNTAP':
      applyUntap(newState, action);
      break;
    case 'ACTIVATE_ABILITY':
      applyActivateAbility(newState, action);
      break;
    case 'SACRIFICE_PERMANENT':
      applySacrificePermanent(newState, action);
      break;
    default:
      break;
  }

  // Phase 1+: Check state-based actions and resolve triggers
  // Loop until no more SBAs or triggers fire
  let actionsPerformed = true;
  while (actionsPerformed && !newState.gameOver) {
    actionsPerformed = false;

    // Check state-based actions
    if (checkStateBasedActions(newState)) {
      actionsPerformed = true;
    }

    // Resolve any triggered abilities
    resolveTriggers(newState);

    // Check SBAs again after triggers resolve
    if (checkStateBasedActions(newState)) {
      actionsPerformed = true;
    }
  }

  // F6 Auto-Pass: After any action that might change priority, check if the
  // new priority player should auto-pass. This aggressively chains through
  // forced non-decisions (e.g., opponent has no responses to our spell).
  // Note: We skip this for PASS_PRIORITY since it already calls applyF6AutoPass internally.
  if (newState.enableF6AutoPass && action.type !== 'PASS_PRIORITY' && !newState.gameOver) {
    applyF6AutoPass(newState);
  }

  return newState;
}

/**
 * Lands that enter the battlefield tapped (Phase 1.5.1)
 */
const LANDS_THAT_ENTER_TAPPED = new Set([
  'Dwarven Ruins',
  'Ebon Stronghold',
  'Havenwood Battleground',
  'Ruins of Trokair',
  'Svyelunite Temple',
]);

/**
 * Play a land from hand onto the battlefield
 */
function applyPlayLand(state: GameState, action: PlayLandAction): void {
  const player = getPlayer(state, action.playerId);
  const cardId = action.payload.cardInstanceId;

  // Find and remove from hand
  const cardIndex = player.hand.findIndex((c) => c.instanceId === cardId);
  if (cardIndex === -1) return;

  const card = player.hand[cardIndex]!;
  player.hand.splice(cardIndex, 1);

  // Check if land enters tapped
  const template = CardLoader.getById(card.scryfallId);
  const entersTapped = template && LANDS_THAT_ENTER_TAPPED.has(template.name);

  // Add to battlefield
  card.zone = 'battlefield';
  card.tapped = entersTapped || false;
  player.battlefield.push(card);

  // Increment lands played this turn
  player.landsPlayedThisTurn++;

  // Trigger ETB (lands don't typically have ETB triggers, but for completeness)
  registerTrigger(state, {
    type: 'ENTERS_BATTLEFIELD',
    cardId: card.instanceId,
    controller: action.playerId,
  });
}

/**
 * Cast a spell from hand
 * Phase 1: Pay mana costs, then put spell on the stack
 */
function applyCastSpell(state: GameState, action: CastSpellAction): void {
  const player = getPlayer(state, action.playerId);
  const cardId = action.payload.cardInstanceId;

  // Find and remove from hand
  const cardIndex = player.hand.findIndex((c) => c.instanceId === cardId);
  if (cardIndex === -1) return;

  const card = player.hand[cardIndex]!;

  // Get card template for mana cost
  const template = CardLoader.getById(card.scryfallId);
  if (!template) return;

  // Parse mana cost
  const manaCost = parseManaCost(template.mana_cost);
  const xValue = action.payload.xValue ?? 0;

  // Auto-tap lands and pay mana cost
  autoTapForMana(state, action.playerId, manaCost, xValue);

  // Remove from hand
  player.hand.splice(cardIndex, 1);

  // Card is now on the stack (not in any zone yet)
  card.zone = 'stack';

  // Push to stack (with xValue stored for resolution)
  pushToStack(state, card, action.playerId, action.payload.targets || [], xValue);

  // Register SPELL_CAST trigger for artifacts like Crystal Rod, enchantments like Insight
  const spellColor = template.colors?.[0] || null; // Primary color of the spell
  const spellType = template.type_line?.toLowerCase() || '';
  registerTrigger(state, {
    type: 'SPELL_CAST',
    cardId: card.instanceId,
    controller: action.playerId,
    spellColor,
    spellType,
  });
}

/**
 * Declare attackers
 * Phase 1+: Move to declare_blockers step
 */
function applyDeclareAttackers(state: GameState, action: DeclareAttackersAction): void {
  const player = getPlayer(state, action.playerId);

  // Mark creatures as attacking and tap them (unless they have Vigilance)
  for (const attackerId of action.payload.attackers) {
    const attacker = player.battlefield.find((c) => c.instanceId === attackerId);
    if (attacker) {
      attacker.attacking = true;
      attacker.attackedThisTurn = true; // Track for Lead Golem "doesn't untap"

      // Check for Vigilance keyword
      const template = CardLoader.getById(attacker.scryfallId);
      if (template && !hasVigilance(template)) {
        attacker.tapped = true; // Attacking taps the creature (unless Vigilance)
      }

      // Register ATTACKS trigger (for Fog Elemental, Sibilant Spirit, etc.)
      registerTrigger(state, {
        type: 'ATTACKS',
        cardId: attacker.instanceId,
        controller: action.playerId,
      });
    }
  }

  // Move to declare blockers step
  state.phase = 'combat';
  state.step = 'declare_blockers';

  // Priority goes to defending player for blockers
  state.priorityPlayer = state.activePlayer === 'player' ? 'opponent' : 'player';
}

/**
 * Declare blockers
 * Phase 1+: Assign blockers to attackers, then resolve combat damage
 */
function applyDeclareBlockers(state: GameState, action: DeclareBlockersAction): void {
  // Assign each blocker to its attacker
  for (const block of action.payload.blocks) {
    const blocker = state.players[action.playerId].battlefield.find(
      (c) => c.instanceId === block.blockerId,
    );
    const attacker = state.players[state.activePlayer].battlefield.find(
      (c) => c.instanceId === block.attackerId,
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
}

/**
 * End the turn
 */
function applyEndTurn(state: GameState, _action: EndTurnAction): void {
  const currentPlayer = getPlayer(state, state.activePlayer);
  const opponent = getPlayer(state, state.activePlayer === 'player' ? 'opponent' : 'player');

  // Cleanup phase
  // 1. Remove damage from creatures
  for (const creature of currentPlayer.battlefield) {
    creature.damage = 0;
  }
  for (const creature of opponent.battlefield) {
    creature.damage = 0;
  }

  // 2. Remove summoning sickness
  for (const permanent of currentPlayer.battlefield) {
    permanent.summoningSick = false;
  }

  // 3. Clear "until end of turn" effects for all permanents
  for (const permanent of currentPlayer.battlefield) {
    clearTemporaryModifications(permanent, 'end_of_turn');
  }
  for (const permanent of opponent.battlefield) {
    clearTemporaryModifications(permanent, 'end_of_turn');
  }

  // 3.5. Clear regeneration shields (expire at end of turn)
  for (const permanent of currentPlayer.battlefield) {
    permanent.regenerationShields = undefined;
  }
  for (const permanent of opponent.battlefield) {
    permanent.regenerationShields = undefined;
  }

  // 4. Empty mana pools for both players
  state.players.player.manaPool = createEmptyManaPool();
  state.players.opponent.manaPool = createEmptyManaPool();

  // 5. Reset prevention effects (Phase 1.5.1)
  state.preventAllCombatDamage = false;

  // 6. Check max hand size (Cleanup step)
  // Simplified: Auto-discard down to 7 (randomly)
  // In a full implementation, the player would choose which cards to discard
  if (currentPlayer.hand.length > 7) {
    discardCards(state, state.activePlayer, currentPlayer.hand.length - 7);
  }

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

  // Check if Meekstone is on the battlefield
  const meekstoneActive =
    state.players.player.battlefield.some((p) => {
      const t = CardLoader.getById(p.scryfallId);
      return t?.name === 'Meekstone';
    }) ||
    state.players.opponent.battlefield.some((p) => {
      const t = CardLoader.getById(p.scryfallId);
      return t?.name === 'Meekstone';
    });

  // Untap all permanents (except those with special untap restrictions)
  for (const permanent of newActivePlayer.battlefield) {
    const template = CardLoader.getById(permanent.scryfallId);

    // Lead Golem: Doesn't untap if it attacked during your last turn
    if (template?.name === 'Lead Golem' && permanent.attackedThisTurn) {
      // Skip untap - clear the flag for next turn
      permanent.attackedThisTurn = false;
      continue;
    }

    // Meekstone: Creatures with power 3+ don't untap
    if (meekstoneActive && template?.type_line?.toLowerCase().includes('creature')) {
      const power = parseInt(template.power || '0', 10);
      if (power >= 3) {
        permanent.attackedThisTurn = false; // Clear the flag
        continue; // Skip untap
      }
    }

    permanent.tapped = false;
    permanent.attackedThisTurn = false; // Clear the flag
  }
}

/**
 * Pass priority
 *
 * F6 Mode: After priority switches, if the new priority player has no meaningful
 * actions (shouldAutoPass returns true), we automatically pass for them. This
 * eliminates forced non-decisions and speeds up AI simulations.
 */
function applyPassPriority(state: GameState, action: PassPriorityAction): void {
  const player = getPlayer(state, action.playerId);
  player.hasPassedPriority = true;
  player.consecutivePasses++;

  // Phase 0: During beginning phase, auto-advance to main1
  if (state.phase === 'beginning' && state.activePlayer === action.playerId) {
    // Draw a card before moving to Main 1 (Skip for first player on Turn 1)
    if (state.turnCount > 1) {
      applyDrawCard(state, {
        type: 'DRAW_CARD',
        playerId: state.activePlayer,
        payload: { count: 1 },
      } as Action);
    }

    state.phase = 'main1';
    state.step = 'main';
    // Reset priority passes
    state.players.player.hasPassedPriority = false;
    state.players.opponent.hasPassedPriority = false;
    state.players.player.consecutivePasses = 0;
    state.players.opponent.consecutivePasses = 0;
    return;
  }

  // Switch priority to opponent
  const newPriorityPlayer = action.playerId === 'player' ? 'opponent' : 'player';
  state.priorityPlayer = newPriorityPlayer;

  // Check if both players passed
  if (bothPlayersPassedPriority(state)) {
    // Both passed - resolve stack if there's anything on it
    if (canResolveStack(state)) {
      resolveTopOfStack(state);
      // After resolution, priority returns to active player
      // Stack resets priority passes
    } else if (state.stack.length === 0) {
      // Stack is empty and both passed - advance to next phase/step
      advancePhase(state);
    }
    // After resolution or phase advance, check F6 auto-pass for new priority player
    if (state.enableF6AutoPass) {
      applyF6AutoPass(state);
    }
  } else {
    // Only one player passed - check F6 auto-pass for the new priority player
    if (state.enableF6AutoPass) {
      applyF6AutoPass(state);
    }
  }
}

/**
 * F6 Auto-Pass: Automatically pass priority for a player if they have no meaningful actions.
 *
 * This implements MTGO-style F6 behavior at the engine level, eliminating the need for
 * bots to explicitly choose PASS_PRIORITY when they have no options.
 *
 * Safety: Limited recursion depth to prevent infinite loops in edge cases.
 */
function applyF6AutoPass(state: GameState, depth: number = 0): void {
  // Safety limit to prevent infinite loops
  const MAX_DEPTH = 20;
  if (depth >= MAX_DEPTH) {
    return;
  }

  // Don't auto-pass if game is over
  if (state.gameOver) {
    return;
  }

  const currentPlayer = state.priorityPlayer;

  // Check if current priority player should auto-pass
  if (shouldAutoPass(state, currentPlayer)) {
    // Automatically pass for this player (with incremented depth)
    applyF6AutoPassInternal(state, currentPlayer, depth + 1);
  }
}

/**
 * Internal F6 auto-pass that tracks recursion depth
 */
function applyF6AutoPassInternal(
  state: GameState,
  playerId: 'player' | 'opponent',
  depth: number,
): void {
  const player = getPlayer(state, playerId);
  player.hasPassedPriority = true;
  player.consecutivePasses++;

  // Switch priority to opponent
  const newPriorityPlayer = playerId === 'player' ? 'opponent' : 'player';
  state.priorityPlayer = newPriorityPlayer;

  // Check if both players passed
  if (bothPlayersPassedPriority(state)) {
    if (canResolveStack(state)) {
      resolveTopOfStack(state);
    } else if (state.stack.length === 0) {
      advancePhase(state);
    }
  }

  // Continue F6 chain if needed
  applyF6AutoPass(state, depth);
}

/**
 * Advance to the next phase/step when both players pass priority with empty stack
 */
function advancePhase(state: GameState): void {
  // Reset priority passes
  state.players.player.hasPassedPriority = false;
  state.players.opponent.hasPassedPriority = false;
  state.players.player.consecutivePasses = 0;
  state.players.opponent.consecutivePasses = 0;

  // Handle phase/step transitions
  if (state.phase === 'combat') {
    if (state.step === 'declare_attackers') {
      // Check if any creatures are actually attacking
      const hasAttackingCreatures =
        state.players.player.battlefield.some((c) => c.attacking) ||
        state.players.opponent.battlefield.some((c) => c.attacking);

      if (!hasAttackingCreatures) {
        // No attackers declared - skip directly to main2 (no blocking needed)
        state.phase = 'main2';
        state.step = 'main';
        state.priorityPlayer = state.activePlayer;
      } else {
        // Move to declare blockers
        state.step = 'declare_blockers';
        // Priority goes to defending player
        state.priorityPlayer = state.activePlayer === 'player' ? 'opponent' : 'player';
      }
    } else if (state.step === 'declare_blockers') {
      // Resolve combat damage
      resolveCombatDamage(state);
      cleanupCombat(state);

      // Move to main2
      state.phase = 'main2';
      state.step = 'main';
      state.priorityPlayer = state.activePlayer;
    }
  } else if (state.phase === 'main1') {
    // Main 1 -> Combat (or skip to Main 2 if no attackers)
    // Optimization: If active player has no creatures that can attack, skip combat entirely
    if (!hasAttackers(state, state.activePlayer)) {
      // No potential attackers - skip directly to main2
      state.phase = 'main2';
      state.step = 'main';
      state.priorityPlayer = state.activePlayer;
    } else {
      // Has potential attackers - enter combat normally
      state.phase = 'combat';
      state.step = 'declare_attackers';
      state.priorityPlayer = state.activePlayer;
    }
  } else if (state.phase === 'main2') {
    // Main 2 -> End Turn
    // Automatically apply end turn logic
    applyEndTurn(state, {
      type: 'END_TURN',
      playerId: state.activePlayer,
      payload: {},
    });
  }
}

/**
 * Draw a card
 */
function applyDrawCard(state: GameState, action: Action): void {
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
}

/**
 * Untap all permanents
 */
function applyUntap(state: GameState, action: Action): void {
  const player = getPlayer(state, action.playerId);

  for (const permanent of player.battlefield) {
    permanent.tapped = false;
  }
}

/**
 * Activate an ability
 *
 * Mana abilities resolve immediately (don't use the stack)
 * Other abilities go on the stack (implemented at line 667)
 */
function applyActivateAbility(state: GameState, action: ActivateAbilityAction): void {
  const player = getPlayer(state, action.playerId);

  // Find the card with the ability
  const card = player.battlefield.find((c) => c.instanceId === action.payload.sourceId);
  if (!card) return;

  // Track whether card was untapped before paying costs
  const wasUntapped = !card.tapped;

  // Get all abilities for this card
  const abilities = getActivatedAbilities(card, state);
  const ability = abilities.find((a) => a.id === action.payload.abilityId);
  if (!ability) return;

  // Auto-tap lands if ability has mana cost (Phase 1.5.6 Fix)
  if (ability.cost.mana) {
    const manaCost = parseManaCost(ability.cost.mana);
    // Activated abilities generally don't have X costs unless specified (like Snake Basket)
    // For now, we assume X=0 for abilities unless we implement X selection in ActivateAbilityAction
    const xValue = 0;
    autoTapForMana(state, action.playerId, manaCost, xValue, false); // pay=false, payCosts will consume
  }

  // Pay costs (tap, mana, etc.)
  if (!payCosts(state, action.payload.sourceId, ability.cost)) {
    return; // Failed to pay costs
  }

  // Fire BECOMES_TAPPED trigger if card became tapped as part of the cost
  if (wasUntapped && card.tapped) {
    registerTrigger(state, {
      type: 'BECOMES_TAPPED',
      cardId: card.instanceId,
      controller: action.playerId,
    });
  }

  // Set target if provided
  if (action.payload.targets && action.payload.targets.length > 0) {
    ability.effect.target = action.payload.targets[0];
  }

  // Mana abilities resolve immediately (don't use the stack)
  if (ability.isManaAbility) {
    // Get the color choice for multi-color mana abilities
    const manaColorChoice = action.payload.manaColorChoice as ManaColor | undefined;
    applyAbilityEffect(
      state,
      ability.effect,
      action.playerId,
      manaColorChoice,
      action.payload.sourceId,
    );
  } else {
    // Non-mana abilities go on the stack
    pushAbilityToStack(
      state,
      action.payload.sourceId,
      ability,
      action.playerId,
      action.payload.targets,
      action.payload.xValue,
    );
  }
}

/**
 * Auto-tap lands and mana-producing permanents to pay a mana cost
 *
 * Algorithm:
 * 1. First use mana already in the pool
 * 2. Then tap permanents to produce the remaining mana needed
 * 3. For colored costs, prioritize tapping sources that produce that color
 * 4. For generic costs, use any remaining untapped sources
 *
 * This is a greedy algorithm that works well for simple cases.
 * A more sophisticated algorithm could optimize for leaving flexibility.
 */
function autoTapForMana(
  state: GameState,
  playerId: 'player' | 'opponent',
  cost: {
    white: number;
    blue: number;
    black: number;
    red: number;
    green: number;
    colorless: number;
    generic: number;
    x: number;
  },
  xValue: number,
  pay: boolean = true,
): void {
  const player = getPlayer(state, playerId);

  // Calculate what we need to pay
  const needed = {
    white: cost.white,
    blue: cost.blue,
    black: cost.black,
    red: cost.red,
    green: cost.green,
    colorless: cost.colorless,
    generic: cost.generic + cost.x * xValue,
  };

  // First, use mana already in the pool
  const useFromPool = (
    color: 'white' | 'blue' | 'black' | 'red' | 'green' | 'colorless',
    amount: number,
  ): number => {
    const available = player.manaPool[color];
    const toUse = Math.min(available, amount);
    if (pay) {
      player.manaPool[color] -= toUse;
    }
    return amount - toUse;
  };

  needed.white = useFromPool('white', needed.white);
  needed.blue = useFromPool('blue', needed.blue);
  needed.black = useFromPool('black', needed.black);
  needed.red = useFromPool('red', needed.red);
  needed.green = useFromPool('green', needed.green);
  needed.colorless = useFromPool('colorless', needed.colorless);

  // Use remaining pool for generic costs
  for (const color of ['colorless', 'white', 'blue', 'black', 'red', 'green'] as const) {
    if (needed.generic <= 0) break;
    const available = player.manaPool[color];
    const toUse = Math.min(available, needed.generic);
    player.manaPool[color] -= toUse;
    needed.generic -= toUse;
  }

  // Now tap permanents to produce remaining mana
  // Get list of untapped permanents with mana abilities
  const untappedSources: Array<{
    permanent: (typeof player.battlefield)[0];
    ability: ReturnType<typeof getActivatedAbilities>[0];
    colors: ManaColor[];
  }> = [];

  for (const permanent of player.battlefield) {
    if (permanent.tapped) continue;

    const abilities = getActivatedAbilities(permanent, state);
    const manaAbility = abilities.find((a) => a.isManaAbility && a.effect.type === 'ADD_MANA');

    if (manaAbility && manaAbility.canActivate(state, permanent.instanceId, playerId)) {
      untappedSources.push({
        permanent,
        ability: manaAbility,
        colors: manaAbility.effect.manaColors || [],
      });
    }
  }

  // Helper to tap a source for a specific color
  const tapSourceForColor = (color: ManaColor): boolean => {
    // Find a source that can produce this color
    const sourceIndex = untappedSources.findIndex((s) => s.colors.includes(color));
    if (sourceIndex === -1) return false;

    const source = untappedSources[sourceIndex]!;
    source.permanent.tapped = true;

    // Fire BECOMES_TAPPED trigger (e.g., for City of Brass)
    registerTrigger(state, {
      type: 'BECOMES_TAPPED',
      cardId: source.permanent.instanceId,
      controller: playerId,
    });

    // Add mana to pool
    player.manaPool = addManaToPool(player.manaPool, color, source.ability.effect.amount ?? 1);

    // Remove from available sources
    untappedSources.splice(sourceIndex, 1);
    return true;
  };

  // Helper to tap a source for any mana (for generic costs)
  const tapSourceForAny = (): ManaColor | null => {
    if (untappedSources.length === 0) return null;

    const source = untappedSources[0]!;
    source.permanent.tapped = true;

    // Fire BECOMES_TAPPED trigger (e.g., for City of Brass)
    registerTrigger(state, {
      type: 'BECOMES_TAPPED',
      cardId: source.permanent.instanceId,
      controller: playerId,
    });

    // Pick the first color this source can produce
    const color = source.colors[0] || 'C';

    // Add mana to pool
    player.manaPool = addManaToPool(player.manaPool, color, source.ability.effect.amount ?? 1);

    // Remove from available sources
    untappedSources.shift();
    return color;
  };

  // Tap sources for colored costs first
  const colorMap: Array<{ key: keyof typeof needed; manaColor: ManaColor }> = [
    { key: 'white', manaColor: 'W' },
    { key: 'blue', manaColor: 'U' },
    { key: 'black', manaColor: 'B' },
    { key: 'red', manaColor: 'R' },
    { key: 'green', manaColor: 'G' },
    { key: 'colorless', manaColor: 'C' },
  ];

  for (const { key, manaColor } of colorMap) {
    while (needed[key] > 0) {
      if (!tapSourceForColor(manaColor)) {
        // No source for this color - try to use mana we've already added
        const poolKey = key as keyof ManaPool;
        if (player.manaPool[poolKey] > 0) {
          if (pay) player.manaPool[poolKey]--;
          needed[key]--;
        } else {
          break; // Can't pay - should have been caught by validator
        }
      } else {
        // Used the mana we just added
        if (pay) {
          const poolKey = key as keyof ManaPool;
          player.manaPool[poolKey]--;
        }
        needed[key]--;
      }
    }
  }

  // Tap sources for generic costs
  while (needed.generic > 0) {
    const color = tapSourceForAny();
    if (!color) break;

    // Use the mana we just added
    if (pay) {
      const poolKey =
        color === 'W'
          ? 'white'
          : color === 'U'
            ? 'blue'
            : color === 'B'
              ? 'black'
              : color === 'R'
                ? 'red'
                : color === 'G'
                  ? 'green'
                  : 'colorless';
      player.manaPool[poolKey]--;
    }
    needed.generic--;
  }
}

/**
 * Sacrifice a permanent
 *
 * Moves the permanent from battlefield to graveyard.
 * This triggers death triggers (for creatures) and "when sacrificed" triggers.
 */
function applySacrificePermanent(state: GameState, action: SacrificePermanentAction): void {
  const player = getPlayer(state, action.playerId);
  const permanentId = action.payload.permanentId;

  // Find the permanent on the battlefield
  const permanentIndex = player.battlefield.findIndex((c) => c.instanceId === permanentId);
  if (permanentIndex === -1) return;

  const permanent = player.battlefield[permanentIndex]!;

  // Remove from battlefield
  player.battlefield.splice(permanentIndex, 1);

  // Move to graveyard
  permanent.zone = 'graveyard';
  permanent.damage = 0;
  permanent.tapped = false;
  permanent.attacking = false;
  permanent.blocking = undefined;
  permanent.blockedBy = undefined;
  player.graveyard.push(permanent);

  // Check if it's a creature for death triggers
  const template = CardLoader.getById(permanent.scryfallId);
  if (template) {
    const isCreatureType = template.type_line?.toLowerCase().includes('creature');

    if (isCreatureType) {
      // Fire death trigger (sacrifice counts as dying)
      registerTrigger(state, {
        type: 'DIES',
        cardId: permanent.instanceId,
        controller: action.playerId,
        wasController: action.playerId,
      });
    }
  }
}
