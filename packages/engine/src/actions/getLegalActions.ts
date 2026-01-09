/**
 * Generate all legal actions for the current game state
 *
 * This is used by both the CLI (to show options) and AI (to choose moves)
 *
 * Auto-pass optimizations are applied to reduce the action space for AI training:
 * - P1: Auto-pass when no instant-speed options available
 * - P2: Auto-skip blocking when no valid blockers exist
 * - P3: Auto-pass on stack when no responses possible
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
} from './Action';
import { getPlayer, findCard } from '../state/GameState';
import { CardLoader } from '../cards/CardLoader';
import {
  type CardTemplate,
  isLand,
  isCreature,
  isInstant,
  hasKeyword,
  hasFlying,
  hasReach,
  hasDefender,
  hasMenace,
  hasFear,
  getLandwalkTypes,
  isArtifact,
} from '../cards/CardTemplate';
import { parseManaCost, hasXInCost, calculateMaxAffordableX } from '../utils/manaCosts';
import { calculateAvailableMana } from './validators';
import { validateAction } from './validators';
import { getActivatedAbilities, getGraveyardAbilities } from '../rules/activatedAbilities';
import { parseTargetRequirements, getAllLegalTargetCombinations } from '../rules/targeting';
import {
  shouldAutoPass,
  hasValidBlockers,
  hasManaSink,
  getAutoPassAction,
  getNoBlockAction,
} from './autoPass';

/**
 * Helper: Check if a creature can't attack alone
 */
function cantAttackAlone(template: { name?: string; oracle_text?: string }): boolean {
  const creatures = ['Goblin Elite Infantry'];
  if (template.name && creatures.includes(template.name)) {
    return true;
  }
  const text = template.oracle_text?.toLowerCase() || '';
  return text.includes("can't attack alone");
}

/**
 * Check if a creature has Lure attached
 * (Lure: "All creatures able to block enchanted creature do so.")
 */
function hasLure(
  state: GameState,
  creature: import('../state/CardInstance').CardInstance,
): boolean {
  if (!creature.attachments || creature.attachments.length === 0) {
    return false;
  }

  for (const attachmentId of creature.attachments) {
    for (const playerId of ['player', 'opponent'] as const) {
      const aura = state.players[playerId].battlefield.find((c) => c.instanceId === attachmentId);
      if (aura) {
        const auraTemplate = CardLoader.getById(aura.scryfallId);
        if (auraTemplate?.name === 'Lure') {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Check if a creature is prevented from combat by an aura (e.g., Pacifism)
 */
function isPreventedFromCombat(
  state: GameState,
  creature: import('../state/CardInstance').CardInstance,
): boolean {
  if (!creature.attachments || creature.attachments.length === 0) {
    return false;
  }

  // Check each attachment
  for (const attachmentId of creature.attachments) {
    // Find the aura on any player's battlefield
    for (const playerId of ['player', 'opponent'] as const) {
      const aura = state.players[playerId].battlefield.find((c) => c.instanceId === attachmentId);
      if (aura) {
        const auraTemplate = CardLoader.getById(aura.scryfallId);
        if (auraTemplate?.oracle_text) {
          const text = auraTemplate.oracle_text.toLowerCase();
          // Check for "can't attack" or "can't attack or block"
          if (text.includes("can't attack") || text.includes('cannot attack')) {
            return true;
          }
        }
      }
    }
  }

  return false;
}

/**
 * Check if a creature is prevented from attacking or blocking by a global enchantment
 * (e.g., Light of Day: "Black creatures can't attack or block")
 */
function isPreventedByGlobalEnchantment(
  state: GameState,
  creature: import('../state/CardInstance').CardInstance,
): boolean {
  const creatureTemplate = CardLoader.getById(creature.scryfallId);
  if (!creatureTemplate) return false;

  const creatureColors = creatureTemplate.colors || [];

  // Check all enchantments on battlefield
  for (const playerId of ['player', 'opponent'] as const) {
    for (const permanent of state.players[playerId].battlefield) {
      const template = CardLoader.getById(permanent.scryfallId);
      if (!template) continue;

      const typeLine = template.type_line?.toLowerCase() || '';
      if (!typeLine.includes('enchantment') || typeLine.includes('aura')) continue;

      switch (template.name) {
        case 'Light of Day':
          // "Black creatures can't attack or block."
          if (creatureColors.includes('B')) {
            return true;
          }
          break;

        // Add more global enchantment combat restrictions here
      }
    }
  }

  return false;
}

/**
 * Check if a blocker can block a specific attacker (considering evasion abilities)
 * This is used for Lure to determine which blockers are "able" to block.
 */
function canBlockAttacker(
  state: GameState,
  blocker: import('../state/CardInstance').CardInstance,
  blockerTemplate: CardTemplate,
  attackerTemplate: CardTemplate,
  defendingPlayer: 'player' | 'opponent',
): boolean {
  // Check if prevented from blocking by aura (e.g., Pacifism)
  if (isPreventedFromCombat(state, blocker)) {
    return false;
  }

  // Check if prevented from blocking by global enchantment (e.g., Light of Day)
  if (isPreventedByGlobalEnchantment(state, blocker)) {
    return false;
  }

  // Flying check
  if (hasFlying(attackerTemplate)) {
    if (!hasFlying(blockerTemplate) && !hasReach(blockerTemplate)) {
      return false; // Can't block flying
    }
  }

  // Landwalk check
  const landwalkTypes = getLandwalkTypes(attackerTemplate);
  if (landwalkTypes.length > 0) {
    const defendingPlayerState = getPlayer(state, defendingPlayer);
    for (const landType of landwalkTypes) {
      const hasMatchingLand = defendingPlayerState.battlefield.some((permanent) => {
        const permTemplate = CardLoader.getById(permanent.scryfallId);
        if (!permTemplate) return false;
        return permTemplate.type_line.includes(landType);
      });
      if (hasMatchingLand) {
        return false; // Can't block due to landwalk
      }
    }
  }

  // Fear check
  if (hasFear(attackerTemplate)) {
    const isBlackCreature = blockerTemplate.colors?.includes('B') ?? false;
    const isArtifactCreature = isArtifact(blockerTemplate) && isCreature(blockerTemplate);
    if (!isBlackCreature && !isArtifactCreature) {
      return false; // Can't block due to Fear
    }
  }

  return true;
}

/**
 * Filter out redundant mana abilities in situations where they're not useful.
 *
 * Mana abilities are filtered in two scenarios:
 *
 * 1. When CAST_SPELL is available:
 *    The CAST_SPELL action automatically handles mana payment by tapping lands.
 *    Showing manual "Tap Forest for {G}" alongside "Cast Grizzly Bears" is redundant.
 *
 * 2. During non-sorcery-speed timing with no instant-speed options:
 *    If it's not our main phase (or stack has items or it's opponent's turn),
 *    and we have no instant-speed spells or abilities, tapping for mana is pointless.
 *    Example: During opponent's combat with only Grizzly Bears in hand.
 *
 * This optimization reduces the action space for AI training and simplifies UX.
 */
function filterRedundantManaAbilities(
  actions: Action[],
  state: GameState,
  playerId: 'player' | 'opponent',
): Action[] {
  // Check if there's at least one CAST_SPELL action
  const hasCastSpell = actions.some((a) => a.type === 'CAST_SPELL');

  // Check if we're at sorcery speed
  const canPlaySorcerySpeed =
    state.activePlayer === playerId &&
    (state.phase === 'main1' || state.phase === 'main2') &&
    state.stack.length === 0;

  // Determine if we should filter mana abilities
  let shouldFilterMana = false;

  if (hasCastSpell) {
    // Case 1: CAST_SPELL available - mana abilities are redundant
    shouldFilterMana = true;
  } else if (!canPlaySorcerySpeed) {
    // Case 2: Not at sorcery speed - check if there are instant-speed options
    // If no instant-speed options, mana abilities are pointless
    const hasNonManaAbility = actions.some((a) => {
      if (a.type !== 'ACTIVATE_ABILITY') return false;

      const player = getPlayer(state, playerId);
      const permanent = player.battlefield.find((c) => c.instanceId === a.payload.sourceId);
      if (!permanent) return false;

      const abilities = getActivatedAbilities(permanent, state);
      const ability = abilities.find((ab) => ab.id === a.payload.abilityId);
      return ability && !ability.isManaAbility;
    });

    // If there are no non-mana abilities and no spells to cast, filter mana abilities
    if (!hasNonManaAbility) {
      shouldFilterMana = true;
    }
  }

  if (!shouldFilterMana) {
    return actions;
  }

  // Filter out pure mana abilities
  return actions.filter((action) => {
    if (action.type !== 'ACTIVATE_ABILITY') {
      return true; // Keep non-ability actions
    }

    // Find the source permanent and ability
    const player = getPlayer(state, playerId);
    const permanent = player.battlefield.find((c) => c.instanceId === action.payload.sourceId);
    if (!permanent) {
      return true; // Keep if we can't find the source
    }

    const abilities = getActivatedAbilities(permanent, state);
    const ability = abilities.find((a) => a.id === action.payload.abilityId);
    if (!ability) {
      return true; // Keep if we can't find the ability
    }

    // Filter out pure mana abilities
    if (ability.isManaAbility) {
      return false; // Remove this action
    }

    return true; // Keep non-mana abilities
  });
}

/**
 * Get all legal actions for a player
 */
export function getLegalActions(state: GameState, playerId: 'player' | 'opponent'): Action[] {
  const actions: Action[] = [];

  // During beginning phase, only active player can take actions
  // Phase 0: Automatically advance through beginning phase by passing priority
  if (state.phase === 'beginning' && state.activePlayer === playerId) {
    actions.push({
      type: 'PASS_PRIORITY',
      playerId,
      payload: {},
    } as PassPriorityAction);
    return actions;
  }

  // P1 + P3: Auto-pass optimization for AI training efficiency
  // When player has no meaningful options, return only PASS_PRIORITY
  if (shouldAutoPass(state, playerId)) {
    return [getAutoPassAction(playerId)];
  }

  // Phase 1+: Can always pass priority when it's your priority
  if (state.priorityPlayer === playerId) {
    actions.push({
      type: 'PASS_PRIORITY',
      playerId,
      payload: {},
    } as PassPriorityAction);
  }

  // Can end turn when it's your turn (only during your priority)
  // Restricted to Main Phases with empty stack to prevent skipping phases like combat
  if (state.activePlayer === playerId && state.priorityPlayer === playerId) {
    if ((state.phase === 'main1' || state.phase === 'main2') && state.stack.length === 0) {
      actions.push({
        type: 'END_TURN',
        playerId,
        payload: {},
      } as EndTurnAction);
    }
  }

  // Generate actions from hand (Lands + Spells) - Single Pass with Deduplication
  if (state.priorityPlayer === playerId) {
    actions.push(...getLegalHandActions(state, playerId));
  }

  // Abilities from battlefield and graveyard
  if (state.priorityPlayer === playerId) {
    actions.push(...getLegalAbilityActivations(state, playerId));
    actions.push(...getLegalGraveyardAbilityActivations(state, playerId));
  }

  // Phase 0: Simplified combat - can attack from main1
  if (state.phase === 'main1' && state.activePlayer === playerId) {
    actions.push(...getLegalAttackerDeclarations(state, playerId));
  }

  // Combat phase actions
  if (state.phase === 'combat') {
    if (state.step === 'declare_attackers' && state.activePlayer === playerId) {
      actions.push(...getLegalAttackerDeclarations(state, playerId));
    }
    if (state.step === 'declare_blockers') {
      // Defending player declares blockers (regardless of priority)
      const defendingPlayer = state.activePlayer === 'player' ? 'opponent' : 'player';
      if (playerId === defendingPlayer) {
        actions.push(...getLegalBlockerDeclarations(state, playerId));
      }
    }
  }

  // Post-processing: Hide redundant mana abilities when CAST_SPELL is available
  // If we can cast a spell, the mana tapping is automatic - no need to show manual tap options
  return filterRedundantManaAbilities(actions, state, playerId);
}

/**
 * Get all legal actions from hand (Lands and Spells)
 * Optimized to iterate hand once and deduplicate identical cards
 */
function getLegalHandActions(state: GameState, playerId: 'player' | 'opponent'): Action[] {
  const actions: Action[] = [];
  const player = getPlayer(state, playerId);

  // Check conditions for Sorcery-speed actions (Lands, Sorceries, Creatures, etc.)
  const canPlaySorcerySpeed =
    state.activePlayer === playerId &&
    (state.phase === 'main1' || state.phase === 'main2') &&
    state.stack.length === 0;

  const seenLandNames = new Set<string>();
  const seenSpellNames = new Set<string>();

  for (const card of player.hand) {
    const template = CardLoader.getById(card.scryfallId);
    if (!template) continue;

    // 1. LANDS
    if (isLand(template)) {
      if (
        canPlaySorcerySpeed &&
        player.landsPlayedThisTurn < 1 &&
        !seenLandNames.has(template.name)
      ) {
        const action: PlayLandAction = {
          type: 'PLAY_LAND',
          playerId,
          payload: { cardInstanceId: card.instanceId },
        };

        if (validateAction(state, action).length === 0) {
          actions.push(action);
          seenLandNames.add(template.name); // Dedupe identical lands
        }
      }
      continue;
    }

    // 2. SPELLS
    // Check timing restriction
    const isInstantSpeed = isInstant(template) || hasKeyword(template, 'Flash');
    if (!canPlaySorcerySpeed && !isInstantSpeed) continue;

    // Deduplication: If we've already generated actions for this card name, skip
    // (Assumes identical cards in hand have identical valid actions)
    if (seenSpellNames.has(template.name)) continue;

    const spellActions: CastSpellAction[] = [];
    const targetRequirements = parseTargetRequirements(template.oracle_text || '');

    // Check if this is an X spell - if so, enumerate X values
    const isXSpell = hasXInCost(template.mana_cost);
    let xValues: number[] = [0]; // Default: single action with no X

    if (isXSpell) {
      // Calculate max affordable X and enumerate all values
      const availableMana = calculateAvailableMana(state, playerId);
      const manaCost = parseManaCost(template.mana_cost);
      const maxX = calculateMaxAffordableX(availableMana, manaCost);

      if (maxX < 0) {
        // Can't afford even X=0 (missing colored mana)
        continue;
      }

      // Generate X values from 0 to maxX
      xValues = [];
      for (let x = 0; x <= maxX; x++) {
        xValues.push(x);
      }
    }

    if (targetRequirements.length > 0) {
      // Generate actions for each valid target combination
      const targetCombinations = getAllLegalTargetCombinations(
        state,
        targetRequirements,
        playerId,
        card,
      );

      for (const targets of targetCombinations) {
        // For X spells, generate one action per X value per target
        for (const xValue of xValues) {
          const action: CastSpellAction = {
            type: 'CAST_SPELL',
            playerId,
            payload: {
              cardInstanceId: card.instanceId,
              targets,
              ...(isXSpell ? { xValue } : {}),
            },
          };

          if (validateAction(state, action).length === 0) {
            spellActions.push(action);
          }
        }
      }
    } else {
      // No targets required
      // For X spells, generate one action per X value
      for (const xValue of xValues) {
        const action: CastSpellAction = {
          type: 'CAST_SPELL',
          playerId,
          payload: {
            cardInstanceId: card.instanceId,
            targets: [],
            ...(isXSpell ? { xValue } : {}),
          },
        };

        if (validateAction(state, action).length === 0) {
          spellActions.push(action);
        }
      }
    }

    if (spellActions.length > 0) {
      actions.push(...spellActions);
      seenSpellNames.add(template.name); // Dedupe!
    }
  }

  return actions;
}

// REMOVED: getLegalLandPlays, getLegalSorcerySpeedCasts, getLegalInstantCasts

/**
 * Get legal ability activations
 * Phase 1+: Can activate abilities any time you have priority
 *
 * Mana ability filtering: If the player has no "mana sinks" (spells to cast,
 * abilities to activate), we filter out pure mana abilities to reduce the
 * action space for AI training.
 */
function getLegalAbilityActivations(
  state: GameState,
  playerId: 'player' | 'opponent',
): ActivateAbilityAction[] {
  const actions: ActivateAbilityAction[] = [];
  const player = getPlayer(state, playerId);

  // Check if we should filter out mana abilities (no mana sinks available)
  const filterManaAbilities = !hasManaSink(state, playerId);

  // Check each permanent on the battlefield
  for (const permanent of player.battlefield) {
    const abilities = getActivatedAbilities(permanent, state);

    for (const ability of abilities) {
      // Filter out mana abilities if nothing to spend mana on
      if (filterManaAbilities && ability.isManaAbility) {
        continue;
      }

      // Check if this ability can be activated
      if (!ability.canActivate(state, permanent.instanceId, playerId)) {
        continue;
      }

      // Check if this ability requires targets
      if (ability.targetRequirements && ability.targetRequirements.length > 0) {
        // Generate actions for each valid target combination
        const targetCombinations = getAllLegalTargetCombinations(
          state,
          ability.targetRequirements,
          playerId,
          permanent,
        );

        for (const targets of targetCombinations) {
          const action: ActivateAbilityAction = {
            type: 'ACTIVATE_ABILITY',
            playerId,
            payload: {
              sourceId: permanent.instanceId,
              abilityId: ability.id,
              targets,
            },
          };

          // Validate before adding
          if (validateAction(state, action).length === 0) {
            actions.push(action);
          }
        }
      } else {
        // No targeting required
        const action: ActivateAbilityAction = {
          type: 'ACTIVATE_ABILITY',
          playerId,
          payload: {
            sourceId: permanent.instanceId,
            abilityId: ability.id,
          },
        };

        // Validate before adding
        if (validateAction(state, action).length === 0) {
          actions.push(action);
        }
      }
    }
  }

  return actions;
}

/**
 * Get legal graveyard ability activations
 * For abilities like Necrosavant that activate from the graveyard
 */
function getLegalGraveyardAbilityActivations(
  state: GameState,
  playerId: 'player' | 'opponent',
): ActivateAbilityAction[] {
  const actions: ActivateAbilityAction[] = [];
  const player = getPlayer(state, playerId);

  // Check each card in the graveyard
  for (const card of player.graveyard) {
    const abilities = getGraveyardAbilities(card, state);

    for (const ability of abilities) {
      // Check if this ability can be activated
      if (!ability.canActivate(state, card.instanceId, playerId)) {
        continue;
      }

      // Check if this ability requires targets
      if (ability.targetRequirements && ability.targetRequirements.length > 0) {
        const targetCombinations = getAllLegalTargetCombinations(
          state,
          ability.targetRequirements,
          playerId,
          card,
        );

        for (const targets of targetCombinations) {
          const action: ActivateAbilityAction = {
            type: 'ACTIVATE_ABILITY',
            playerId,
            payload: {
              sourceId: card.instanceId,
              abilityId: ability.id,
              targets,
            },
          };

          if (validateAction(state, action).length === 0) {
            actions.push(action);
          }
        }
      } else {
        const action: ActivateAbilityAction = {
          type: 'ACTIVATE_ABILITY',
          playerId,
          payload: {
            sourceId: card.instanceId,
            abilityId: ability.id,
          },
        };

        if (validateAction(state, action).length === 0) {
          actions.push(action);
        }
      }
    }
  }

  return actions;
}

/**
 * Get legal attacker declarations
 */
function getLegalAttackerDeclarations(
  state: GameState,
  playerId: 'player' | 'opponent',
): DeclareAttackersAction[] {
  const actions: DeclareAttackersAction[] = [];
  const player = getPlayer(state, playerId);

  // Find creatures that can attack
  const potentialAttackers = player.battlefield.filter((card) => {
    const template = CardLoader.getById(card.scryfallId);
    if (!template || !isCreature(template)) return false;
    if (card.tapped) return false;
    if (card.summoningSick) return false;

    // Filter out creatures with Defender
    // (Animate Wall check is handled in validator)
    if (hasDefender(template)) return false;

    return true;
  });

  if (potentialAttackers.length === 0) {
    // No attackers - can pass
    return actions;
  }

  // Generate all possible combinations of attackers
  // For simplicity, we'll just generate: attack with each individually

  // Attack with each creature individually (unless it can't attack alone)
  for (const attacker of potentialAttackers) {
    const template = CardLoader.getById(attacker.scryfallId);
    // Skip creatures that can't attack alone if they would be the only attacker
    if (template && cantAttackAlone(template) && potentialAttackers.length === 1) {
      continue;
    }
    if (template && cantAttackAlone(template)) {
      // This creature needs another attacker, skip single-attack
      continue;
    }

    const action: DeclareAttackersAction = {
      type: 'DECLARE_ATTACKERS',
      playerId,
      payload: { attackers: [attacker.instanceId] },
    };

    // Validate before adding to ensure all constraints are met
    if (validateAction(state, action).length === 0) {
      actions.push(action);
    }
  }

  // Attack with all
  if (potentialAttackers.length > 1) {
    const action: DeclareAttackersAction = {
      type: 'DECLARE_ATTACKERS',
      playerId,
      payload: {
        attackers: potentialAttackers.map((c) => c.instanceId),
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
 * Check if a blocker can legally block an attacker (flying/reach check)
 */
function canBlock(blockerTemplate: CardTemplate, attackerTemplate: CardTemplate): boolean {
  // Flying restriction: only flying/reach creatures can block flyers
  if (hasFlying(attackerTemplate)) {
    if (!hasFlying(blockerTemplate) && !hasReach(blockerTemplate)) {
      return false;
    }
  }
  return true;
}

/**
 * Generate multi-block actions for attackers that benefit from gang-blocking
 *
 * Generates 2-3 blocker combinations for:
 * - Menace creatures (MUST be blocked by 2+ creatures)
 * - Large creatures (power >= 4) for strategic gang-blocking
 *
 * @param state - Current game state
 * @param playerId - Defending player
 * @param attackers - List of attacking creatures
 * @param potentialBlockers - List of available blockers
 * @returns Array of multi-block DeclareBlockersAction
 */
function generateMultiBlockActions(
  state: GameState,
  playerId: 'player' | 'opponent',
  attackers: Array<{ instanceId: string; scryfallId: string }>,
  potentialBlockers: Array<{ instanceId: string; scryfallId: string }>,
): DeclareBlockersAction[] {
  const actions: DeclareBlockersAction[] = [];
  const LARGE_CREATURE_POWER_THRESHOLD = 4;

  for (const attacker of attackers) {
    const attackerTemplate = CardLoader.getById(attacker.scryfallId);
    if (!attackerTemplate) continue;

    // Check if this attacker qualifies for multi-blocking:
    // - Has Menace (must be blocked by 2+)
    // - Is a large creature (power >= 4, strategic gang-blocking)
    const attackerPower = parseInt(attackerTemplate.power || '0', 10);
    const needsMultiBlock =
      hasMenace(attackerTemplate) || attackerPower >= LARGE_CREATURE_POWER_THRESHOLD;

    if (!needsMultiBlock) continue;

    // Find all blockers that can legally block this attacker
    const validBlockers = potentialBlockers.filter((blocker) => {
      const blockerTemplate = CardLoader.getById(blocker.scryfallId);
      if (!blockerTemplate) return false;
      return canBlock(blockerTemplate, attackerTemplate);
    });

    // Need at least 2 blockers for multi-blocking
    if (validBlockers.length < 2) continue;

    // Generate 2-blocker combinations
    for (let i = 0; i < validBlockers.length - 1; i++) {
      for (let j = i + 1; j < validBlockers.length; j++) {
        const blocker1 = validBlockers[i]!;
        const blocker2 = validBlockers[j]!;

        const action: DeclareBlockersAction = {
          type: 'DECLARE_BLOCKERS',
          playerId,
          payload: {
            blocks: [
              { blockerId: blocker1.instanceId, attackerId: attacker.instanceId },
              { blockerId: blocker2.instanceId, attackerId: attacker.instanceId },
            ],
          },
        };

        // Validate before adding (handles Menace validation, etc.)
        if (validateAction(state, action).length === 0) {
          actions.push(action);
        }
      }
    }

    // Generate 3-blocker combinations (if enough blockers available)
    if (validBlockers.length >= 3) {
      for (let i = 0; i < validBlockers.length - 2; i++) {
        for (let j = i + 1; j < validBlockers.length - 1; j++) {
          for (let k = j + 1; k < validBlockers.length; k++) {
            const blocker1 = validBlockers[i]!;
            const blocker2 = validBlockers[j]!;
            const blocker3 = validBlockers[k]!;

            const action: DeclareBlockersAction = {
              type: 'DECLARE_BLOCKERS',
              playerId,
              payload: {
                blocks: [
                  { blockerId: blocker1.instanceId, attackerId: attacker.instanceId },
                  { blockerId: blocker2.instanceId, attackerId: attacker.instanceId },
                  { blockerId: blocker3.instanceId, attackerId: attacker.instanceId },
                ],
              },
            };

            if (validateAction(state, action).length === 0) {
              actions.push(action);
            }
          }
        }
      }
    }
  }

  return actions;
}

/**
 * Get legal blocker declarations
 * Phase 1+: Defender can assign blockers to attackers
 *
 * P2 Optimization: If no valid blocking assignments exist, return only
 * the "don't block" action to reduce AI decision overhead.
 */
function getLegalBlockerDeclarations(
  state: GameState,
  playerId: 'player' | 'opponent',
): DeclareBlockersAction[] {
  const actions: DeclareBlockersAction[] = [];
  const player = getPlayer(state, playerId);
  const activePlayerId = state.activePlayer;
  const activePlayer = getPlayer(state, activePlayerId);

  // P2: Auto-skip blocking optimization
  // If no valid blockers exist, return only "don't block" action
  if (!hasValidBlockers(state, playerId)) {
    return [getNoBlockAction(playerId)];
  }

  // Find potential blockers
  const potentialBlockers = player.battlefield.filter((card) => {
    const template = CardLoader.getById(card.scryfallId);
    if (!template || !isCreature(template)) return false;
    if (card.tapped) return false;
    return true;
  });

  // Find attackers
  const attackers = activePlayer.battlefield.filter((c) => c.attacking);

  // Check if any attacker has Lure
  const luredAttackers = attackers.filter((attacker) => hasLure(state, attacker));

  if (luredAttackers.length > 0) {
    // LURE CASE: All able blockers must block the Lured creature(s)
    // Generate only the forced blocking actions

    for (const luredAttacker of luredAttackers) {
      const attackerTemplate = CardLoader.getById(luredAttacker.scryfallId);
      if (!attackerTemplate) continue;

      // Find all blockers that CAN block this Lured attacker
      const ableBlockers = potentialBlockers.filter((blocker) => {
        const blockerTemplate = CardLoader.getById(blocker.scryfallId);
        if (!blockerTemplate) return false;
        return canBlockAttacker(state, blocker, blockerTemplate, attackerTemplate, playerId);
      });

      // Create blocks array where ALL able blockers block the Lured attacker
      const forcedBlocks = ableBlockers.map((blocker) => ({
        blockerId: blocker.instanceId,
        attackerId: luredAttacker.instanceId,
      }));

      // Create the forced blocking action
      const forcedAction: DeclareBlockersAction = {
        type: 'DECLARE_BLOCKERS',
        playerId,
        payload: { blocks: forcedBlocks },
      };

      // Validate before adding
      if (validateAction(state, forcedAction).length === 0) {
        actions.push(forcedAction);
      }
    }

    // When Lure is present, we only return the forced blocking actions
    // Do NOT include "don't block" or other options
    return actions;
  }

  // NORMAL CASE (no Lure): Generate all blocking options
  // Option 1: Don't block at all
  actions.push({
    type: 'DECLARE_BLOCKERS',
    playerId,
    payload: { blocks: [] },
  });

  // Option 2: Block each attacker individually with each possible blocker
  for (const attacker of attackers) {
    const attackerTemplate = CardLoader.getById(attacker.scryfallId);
    if (!attackerTemplate) continue;

    for (const blocker of potentialBlockers) {
      const blockerTemplate = CardLoader.getById(blocker.scryfallId);
      if (!blockerTemplate) continue;

      // Check Flying restriction
      if (hasFlying(attackerTemplate)) {
        if (!hasFlying(blockerTemplate) && !hasReach(blockerTemplate)) {
          continue; // Can't block flying
        }
      }

      const action: DeclareBlockersAction = {
        type: 'DECLARE_BLOCKERS',
        playerId,
        payload: {
          blocks: [
            {
              blockerId: blocker.instanceId,
              attackerId: attacker.instanceId,
            },
          ],
        },
      };

      // Validate before adding
      if (validateAction(state, action).length === 0) {
        actions.push(action);
      }
    }
  }

  // Option 3: Multi-block combinations for Menace and large creatures
  const multiBlockActions = generateMultiBlockActions(
    state,
    playerId,
    attackers,
    potentialBlockers,
  );
  actions.push(...multiBlockActions);

  return actions;
}

/**
 * Get a card name with instance ID suffix for disambiguation
 * Format: "Giant Spider [0a1b]" when ID is needed, or just "Giant Spider" otherwise
 */
function getCardDisplayName(card: { instanceId: string; scryfallId: string }): string {
  const template = CardLoader.getById(card.scryfallId);
  const name = template?.name || 'creature';
  // Always include instance ID for clarity - helps distinguish multiple copies
  return `${name} [${card.instanceId}]`;
}

/**
 * Get a human-readable name for a target (with instance ID for cards)
 */
function getTargetName(state: GameState, targetId: string): string {
  // Player targets
  if (targetId === 'player') return 'Player';
  if (targetId === 'opponent') return 'Opponent';

  // Stack targets (for counterspells)
  const stackObj = state.stack.find((s) => s.id === targetId);
  if (stackObj) {
    const template = CardLoader.getById(stackObj.card.scryfallId);
    return template?.name || 'spell';
  }

  // Card targets - include instance ID for disambiguation
  const card = findCard(state, targetId);
  if (card) {
    return getCardDisplayName(card);
  }

  return targetId;
}

/**
 * Describe an action in human-readable form
 */
export function describeAction(action: Action, state: GameState): string {
  switch (action.type) {
    case 'PLAY_LAND': {
      const card = state.players[action.playerId].hand.find(
        (c) => c.instanceId === action.payload.cardInstanceId,
      );
      if (card) {
        const template = CardLoader.getById(card.scryfallId);
        return `Play ${template?.name || 'land'}`;
      }
      return 'Play land';
    }

    case 'CAST_SPELL': {
      const card = state.players[action.playerId].hand.find(
        (c) => c.instanceId === action.payload.cardInstanceId,
      );
      if (card) {
        const template = CardLoader.getById(card.scryfallId);
        const spellName = template?.name || 'spell';

        // Include X value for X spells
        const xValue = action.payload.xValue;
        const xSuffix = xValue !== undefined ? ` (X=${xValue})` : '';

        // Include targets in description
        const targets = action.payload.targets || [];
        if (targets.length > 0) {
          const targetNames = targets.map((t) => getTargetName(state, t)).join(', ');
          return `Cast ${spellName}${xSuffix} targeting ${targetNames}`;
        }
        return `Cast ${spellName}${xSuffix}`;
      }
      return 'Cast spell';
    }

    case 'DECLARE_ATTACKERS': {
      const count = action.payload.attackers.length;
      if (count === 1) {
        const attacker = findCard(state, action.payload.attackers[0]!);
        const name = attacker ? getCardDisplayName(attacker) : 'creature';
        return `Attack with ${name}`;
      }
      return `Attack with ${count} creatures`;
    }

    case 'DECLARE_BLOCKERS': {
      const blocks = action.payload.blocks;
      if (blocks.length === 0) return "Don't block";

      // Group blockers by attacker for cleaner multi-block descriptions
      const blockersByAttacker = new Map<string, string[]>();
      const attackerNames = new Map<string, string>();

      for (const block of blocks) {
        const blocker = findCard(state, block.blockerId);
        const attacker = findCard(state, block.attackerId);

        const blockerName = blocker ? getCardDisplayName(blocker) : 'creature';
        const attackerName = attacker ? getCardDisplayName(attacker) : 'attacker';

        // Store attacker name for later
        if (!attackerNames.has(block.attackerId)) {
          attackerNames.set(block.attackerId, attackerName);
        }

        // Group blockers by attacker
        if (!blockersByAttacker.has(block.attackerId)) {
          blockersByAttacker.set(block.attackerId, []);
        }
        blockersByAttacker.get(block.attackerId)!.push(blockerName);
      }

      // Build descriptions grouped by attacker
      const blockDescriptions: string[] = [];
      for (const [attackerId, blockerNames] of blockersByAttacker) {
        const attackerName = attackerNames.get(attackerId) || 'attacker';
        if (blockerNames.length === 1) {
          blockDescriptions.push(`${blockerNames[0]} blocks ${attackerName}`);
        } else {
          // Multi-block: "A + B block X"
          blockDescriptions.push(`${blockerNames.join(' + ')} block ${attackerName}`);
        }
      }

      return blockDescriptions.join(', ');
    }

    case 'END_TURN':
      return 'End turn';

    case 'PASS_PRIORITY':
      return 'Pass priority';

    case 'ACTIVATE_ABILITY': {
      // Find the card with the ability
      for (const playerId of ['player', 'opponent'] as const) {
        const player = state.players[playerId];
        const card = player.battlefield.find((c) => c.instanceId === action.payload.sourceId);
        if (card) {
          const template = CardLoader.getById(card.scryfallId);
          const abilities = getActivatedAbilities(card, state);
          const ability = abilities.find((a) => a.id === action.payload.abilityId);
          if (ability && template) {
            const targets = action.payload.targets || [];
            if (targets.length > 0) {
              const targetNames = targets.map((t) => getTargetName(state, t)).join(', ');
              return `${template.name}: ${ability.name} targeting ${targetNames}`;
            }
            return `${template.name}: ${ability.name}`;
          }
        }
      }
      return 'Activate ability';
    }

    default:
      return action.type;
  }
}

/**
 * Check if an ability is a regenerate ability
 */
function isRegenerateAbility(
  state: GameState,
  playerId: 'player' | 'opponent',
  action: ActivateAbilityAction,
): boolean {
  const player = getPlayer(state, playerId);
  const permanent = player.battlefield.find((c) => c.instanceId === action.payload.sourceId);
  if (!permanent) return false;

  const abilities = getActivatedAbilities(permanent, state);
  const ability = abilities.find((a) => a.id === action.payload.abilityId);
  return ability?.effect?.type === 'REGENERATE';
}

/**
 * Check if an ability is a mana ability
 */
function isManaAbilityAction(
  state: GameState,
  playerId: 'player' | 'opponent',
  action: ActivateAbilityAction,
): boolean {
  const player = getPlayer(state, playerId);
  const permanent = player.battlefield.find((c) => c.instanceId === action.payload.sourceId);
  if (!permanent) return false;

  const abilities = getActivatedAbilities(permanent, state);
  const ability = abilities.find((a) => a.id === action.payload.abilityId);
  return ability?.isManaAbility === true;
}

/**
 * Get only meaningful actions for AI training and LLM agents
 *
 * This function applies several optimizations:
 * 1. Consolidates PASS_PRIORITY and END_TURN into one skip option
 * 2. Filters regenerate abilities outside of combat (contextually irrelevant)
 * 3. Filters mana abilities when on opponent's turn with no instants to cast
 * 4. Filters mana abilities when responding to stack with no instants
 *
 * This reduces the action space by ~30-50% for AI training and reduces token usage
 * for LLM agents while still allowing explicit passing.
 *
 * Use cases:
 * - MCTS: Smaller game trees, faster simulations
 * - GreedyBot: Fewer actions to evaluate
 * - Neural Networks: Higher signal-to-noise ratio in training data
 * - LLM Agents: Fewer tool calls, lower token costs
 *
 * @param state - Current game state
 * @param playerId - Player to get actions for
 * @returns Array of meaningful actions (context-filtered)
 */
export function getMeaningfulActions(state: GameState, playerId: 'player' | 'opponent'): Action[] {
  const allActions = getLegalActions(state, playerId);

  // If 0-1 actions, return as-is (even if it's just pass)
  if (allActions.length <= 1) {
    return allActions;
  }

  // Check context for filtering decisions
  const isOurTurn = state.activePlayer === playerId;
  const inCombat = state.phase === 'combat';
  const hasStackItems = state.stack.length > 0;
  const hasCastableSpell = allActions.some((a) => a.type === 'CAST_SPELL');

  // Apply context-aware filtering to abilities
  const filteredActions = allActions.filter((action) => {
    if (action.type !== 'ACTIVATE_ABILITY') {
      return true; // Keep non-ability actions
    }

    const abilityAction = action;

    // Filter 1: Regenerate abilities outside combat
    // Regenerate is only useful when the creature might die
    if (!inCombat && isRegenerateAbility(state, playerId, abilityAction)) {
      return false;
    }

    // Filter 2: Mana abilities during opponent's turn with no castable spells
    // If we can't cast anything, tapping for mana is pointless
    if (!isOurTurn && !hasCastableSpell && isManaAbilityAction(state, playerId, abilityAction)) {
      return false;
    }

    // Filter 3: Mana abilities when responding to stack with no castable spells
    // If there's something on stack but we have no instant-speed response, mana is useless
    if (hasStackItems && !hasCastableSpell && isManaAbilityAction(state, playerId, abilityAction)) {
      return false;
    }

    return true;
  });

  // Separate remaining actions by type
  const passAction = filteredActions.find((a) => a.type === 'PASS_PRIORITY');
  const endTurnAction = filteredActions.find((a) => a.type === 'END_TURN');
  const otherActions = filteredActions.filter(
    (a) => a.type !== 'PASS_PRIORITY' && a.type !== 'END_TURN',
  );

  // Build result: other actions + one skip option (prefer END_TURN over PASS_PRIORITY)
  const result: Action[] = [...otherActions];

  // Add one skip option - END_TURN is preferred as it skips phases
  if (endTurnAction) {
    result.push(endTurnAction);
  } else if (passAction) {
    result.push(passAction);
  }

  // If we only have skip options (no other actions), just return the best one
  if (otherActions.length === 0) {
    if (endTurnAction) {
      return [endTurnAction];
    }
    if (passAction) {
      return [passAction];
    }
  }

  return result;
}
