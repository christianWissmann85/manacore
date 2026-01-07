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
  isLand,
  isCreature,
  isInstant,
  hasKeyword,
  hasFlying,
  hasReach,
  hasDefender,
} from '../cards/CardTemplate';
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

  return actions;
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

    if (targetRequirements.length > 0) {
      // Generate actions for each valid target combination
      const targetCombinations = getAllLegalTargetCombinations(
        state,
        targetRequirements,
        playerId,
        card,
      );

      for (const targets of targetCombinations) {
        const action: CastSpellAction = {
          type: 'CAST_SPELL',
          playerId,
          payload: {
            cardInstanceId: card.instanceId,
            targets,
          },
        };

        if (validateAction(state, action).length === 0) {
          spellActions.push(action);
        }
      }
    } else {
      // No targets required
      const action: CastSpellAction = {
        type: 'CAST_SPELL',
        playerId,
        payload: {
          cardInstanceId: card.instanceId,
          targets: [],
        },
      };

      if (validateAction(state, action).length === 0) {
        spellActions.push(action);
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

  return actions;
}

/**
 * Get a human-readable name for a target
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

  // Card targets
  const card = findCard(state, targetId);
  if (card) {
    const template = CardLoader.getById(card.scryfallId);
    return template?.name || 'permanent';
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

        // Include targets in description
        const targets = action.payload.targets || [];
        if (targets.length > 0) {
          const targetNames = targets.map((t) => getTargetName(state, t)).join(', ');
          return `Cast ${spellName} targeting ${targetNames}`;
        }
        return `Cast ${spellName}`;
      }
      return 'Cast spell';
    }

    case 'DECLARE_ATTACKERS': {
      const count = action.payload.attackers.length;
      if (count === 1) {
        const attacker = findCard(state, action.payload.attackers[0]!);
        const name = attacker ? CardLoader.getById(attacker.scryfallId)?.name : 'creature';
        return `Attack with ${name}`;
      }
      return `Attack with ${count} creatures`;
    }

    case 'DECLARE_BLOCKERS': {
      const count = action.payload.blocks.length;
      if (count === 0) return "Don't block";
      if (count === 1) return 'Block with 1 creature';
      return `Block with ${count} creatures`;
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
