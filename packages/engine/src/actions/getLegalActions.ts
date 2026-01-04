/**
 * Generate all legal actions for the current game state
 *
 * This is used by both the CLI (to show options) and AI (to choose moves)
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
import { isLand, isCreature, isInstant, hasFlying, hasReach } from '../cards/CardTemplate';
import { validateAction } from './validators';
import { getActivatedAbilities } from '../rules/activatedAbilities';
import { parseTargetRequirements, getAllLegalTargetCombinations } from '../rules/targeting';

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

  // Phase 1+: Can always pass priority when it's your priority
  if (state.priorityPlayer === playerId) {
    actions.push({
      type: 'PASS_PRIORITY',
      playerId,
      payload: {},
    } as PassPriorityAction);
  }

  // Can end turn when it's your turn (only during your priority)
  if (state.activePlayer === playerId && state.priorityPlayer === playerId) {
    actions.push({
      type: 'END_TURN',
      playerId,
      payload: {},
    } as EndTurnAction);
  }

  // Phase 1+: Can cast instant-speed spells whenever you have priority
  if (state.priorityPlayer === playerId) {
    actions.push(...getLegalInstantCasts(state, playerId));
    actions.push(...getLegalAbilityActivations(state, playerId));
  }

  // Sorcery-speed actions require it to be your turn
  if (state.activePlayer !== playerId) {
    return actions;
  }

  // Main phase actions
  if (state.phase === 'main1' || state.phase === 'main2') {
    // Play lands
    actions.push(...getLegalLandPlays(state, playerId));

    // Cast sorcery-speed spells
    actions.push(...getLegalSorcerySpeedCasts(state, playerId));
  }

  // Phase 0: Simplified combat - can attack from main1
  if (state.phase === 'main1') {
    actions.push(...getLegalAttackerDeclarations(state, playerId));
  }

  // Combat phase actions
  if (state.phase === 'combat') {
    if (state.step === 'declare_attackers') {
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
 * Get legal land plays
 */
function getLegalLandPlays(state: GameState, playerId: 'player' | 'opponent'): PlayLandAction[] {
  const actions: PlayLandAction[] = [];
  const player = getPlayer(state, playerId);

  // Can only play one land per turn
  if (player.landsPlayedThisTurn >= 1) {
    return actions;
  }

  // Find lands in hand
  for (const card of player.hand) {
    const template = CardLoader.getById(card.scryfallId);
    if (template && isLand(template)) {
      const action: PlayLandAction = {
        type: 'PLAY_LAND',
        playerId,
        payload: {
          cardInstanceId: card.instanceId,
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
 * Get legal sorcery-speed spell casts
 * Phase 1+: Only when it's your turn, main phase, stack empty
 */
function getLegalSorcerySpeedCasts(
  state: GameState,
  playerId: 'player' | 'opponent',
): CastSpellAction[] {
  const actions: CastSpellAction[] = [];
  const player = getPlayer(state, playerId);

  // Stack must be empty for sorcery-speed spells
  if (state.stack.length > 0) {
    return actions;
  }

  // Find sorcery-speed castable cards in hand
  for (const card of player.hand) {
    const template = CardLoader.getById(card.scryfallId);
    if (!template || isLand(template)) continue;

    // Skip instants - they're handled separately
    if (isInstant(template)) continue;

    // Check if this spell requires targets
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

        // Validate before adding
        if (validateAction(state, action).length === 0) {
          actions.push(action);
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

      // Validate before adding
      if (validateAction(state, action).length === 0) {
        actions.push(action);
      }
    }
  }

  return actions;
}

/**
 * Get legal instant-speed spell casts
 * Phase 1+: Can cast instants any time you have priority
 */
function getLegalInstantCasts(
  state: GameState,
  playerId: 'player' | 'opponent',
): CastSpellAction[] {
  const actions: CastSpellAction[] = [];
  const player = getPlayer(state, playerId);

  // Find instant-speed castable cards in hand
  for (const card of player.hand) {
    const template = CardLoader.getById(card.scryfallId);
    if (!template || isLand(template)) continue;

    // Only instants
    if (!isInstant(template)) continue;

    // Check if this spell requires targets
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

        // Validate before adding
        if (validateAction(state, action).length === 0) {
          actions.push(action);
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

      // Validate before adding
      if (validateAction(state, action).length === 0) {
        actions.push(action);
      }
    }
  }

  return actions;
}

/**
 * Get legal ability activations
 * Phase 1+: Can activate abilities any time you have priority
 */
function getLegalAbilityActivations(
  state: GameState,
  playerId: 'player' | 'opponent',
): ActivateAbilityAction[] {
  const actions: ActivateAbilityAction[] = [];
  const player = getPlayer(state, playerId);

  // Check each permanent on the battlefield
  for (const permanent of player.battlefield) {
    const abilities = getActivatedAbilities(permanent, state);

    for (const ability of abilities) {
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
    return true;
  });

  if (potentialAttackers.length === 0) {
    // No attackers - can pass
    actions.push({
      type: 'DECLARE_ATTACKERS',
      playerId,
      payload: { attackers: [] },
    });
    return actions;
  }

  // Generate all possible combinations of attackers
  // For simplicity, we'll just generate: attack with all, attack with none, attack with each individually

  // Attack with none
  actions.push({
    type: 'DECLARE_ATTACKERS',
    playerId,
    payload: { attackers: [] },
  });

  // Attack with each creature individually
  for (const attacker of potentialAttackers) {
    actions.push({
      type: 'DECLARE_ATTACKERS',
      playerId,
      payload: { attackers: [attacker.instanceId] },
    });
  }

  // Attack with all
  if (potentialAttackers.length > 1) {
    actions.push({
      type: 'DECLARE_ATTACKERS',
      playerId,
      payload: {
        attackers: potentialAttackers.map((c) => c.instanceId),
      },
    });
  }

  return actions;
}

/**
 * Get legal blocker declarations
 * Phase 1+: Defender can assign blockers to attackers
 */
function getLegalBlockerDeclarations(
  state: GameState,
  playerId: 'player' | 'opponent',
): DeclareBlockersAction[] {
  const actions: DeclareBlockersAction[] = [];
  const player = getPlayer(state, playerId);
  const activePlayerId = state.activePlayer;
  const activePlayer = getPlayer(state, activePlayerId);

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
      if (count === 0) return 'Attack with no creatures';
      if (count === 1) return 'Attack with 1 creature';
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
