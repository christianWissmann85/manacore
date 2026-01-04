/**
 * Triggered Abilities System
 *
 * Handles "When...", "Whenever...", "At..." abilities
 *
 * Phase 1 triggers:
 * - "When ~ enters the battlefield" (ETB)
 * - "When ~ dies"
 * - "Whenever ~ deals damage"
 *
 * Phase 1.5 additions:
 * - Death triggers for creatures in graveyard
 * - "When ~ leaves the battlefield"
 */

import type { GameState } from '../state/GameState';
import type { CardInstance } from '../state/CardInstance';
import type { PlayerId } from '../state/Zone';
import { CardLoader } from '../cards/CardLoader';
import { isCreature } from '../cards/CardTemplate';

/**
 * Trigger event types
 */
export type TriggerEvent =
  | { type: 'ENTERS_BATTLEFIELD'; cardId: string; controller: PlayerId }
  | { type: 'DIES'; cardId: string; controller: PlayerId; wasController: PlayerId }
  | { type: 'DEALS_DAMAGE'; sourceId: string; targetId: string; amount: number }
  | { type: 'BECOMES_TAPPED'; cardId: string; controller: PlayerId };

/**
 * Triggered ability definition
 */
export interface TriggeredAbility {
  id: string;
  source: string; // Card instance ID
  controller: PlayerId;
  event: TriggerEvent;
  effect: (state: GameState) => void;
}

/**
 * Queue of triggered abilities waiting to go on stack
 */
let triggerQueue: TriggeredAbility[] = [];

/**
 * Register a trigger event
 */
export function registerTrigger(state: GameState, event: TriggerEvent): void {
  // Check all permanents on battlefield for matching triggers
  for (const playerId of ['player', 'opponent'] as const) {
    const player = state.players[playerId];

    for (const permanent of player.battlefield) {
      const triggers = getTriggersForCard(permanent, event, state);

      for (const trigger of triggers) {
        triggerQueue.push({
          id: `trigger_${Date.now()}_${Math.random()}`,
          source: permanent.instanceId,
          controller: permanent.controller,
          event,
          effect: trigger,
        });
      }
    }
  }

  // For DIES events, also check if the dying creature itself has a death trigger
  // (the creature is now in the graveyard, not on battlefield)
  if (event.type === 'DIES') {
    for (const playerId of ['player', 'opponent'] as const) {
      const player = state.players[playerId];

      // Find the dying creature in the graveyard
      const dyingCreature = player.graveyard.find((c) => c.instanceId === event.cardId);
      if (dyingCreature) {
        const triggers = getDeathTriggersForDyingCard(dyingCreature, event, state);

        for (const trigger of triggers) {
          triggerQueue.push({
            id: `trigger_${Date.now()}_${Math.random()}`,
            source: dyingCreature.instanceId,
            controller: event.wasController,
            event,
            effect: trigger,
          });
        }
      }
    }
  }
}

/**
 * Get triggered abilities for a card on the battlefield that match an event
 */
function getTriggersForCard(
  card: CardInstance,
  event: TriggerEvent,
  _state: GameState,
): Array<(state: GameState) => void> {
  const template = CardLoader.getById(card.scryfallId);
  if (!template) return [];

  const triggers: Array<(state: GameState) => void> = [];

  // Check card-specific triggers
  switch (template.name) {
    case 'Nekrataal':
      // "When Nekrataal enters the battlefield, destroy target nonblack creature"
      if (event.type === 'ENTERS_BATTLEFIELD' && event.cardId === card.instanceId) {
        triggers.push((triggerState: GameState) => {
          // Find first nonblack, nonartifact creature controlled by opponent
          const opponent = card.controller === 'player' ? 'opponent' : 'player';
          const opponentCreatures = triggerState.players[opponent].battlefield.filter((c) => {
            const t = CardLoader.getById(c.scryfallId);
            if (!t || !isCreature(t)) return false;
            // Check if nonblack and nonartifact
            const isBlack = t.colors?.includes('B') ?? false;
            const isArtifact = t.type_line?.toLowerCase().includes('artifact') ?? false;
            return !isBlack && !isArtifact;
          });

          if (opponentCreatures.length > 0) {
            // Destroy the first valid target (in real game, player would choose)
            const target = opponentCreatures[0]!;
            const index = triggerState.players[opponent].battlefield.indexOf(target);
            if (index !== -1) {
              triggerState.players[opponent].battlefield.splice(index, 1);
              target.zone = 'graveyard';
              target.damage = 0;
              target.tapped = false;
              triggerState.players[opponent].graveyard.push(target);
            }
          }
        });
      }
      break;

    case 'Gravedigger':
      // "When Gravedigger enters the battlefield, you may return target creature card from your graveyard to your hand."
      if (event.type === 'ENTERS_BATTLEFIELD' && event.cardId === card.instanceId) {
        triggers.push((triggerState: GameState) => {
          const player = triggerState.players[card.controller];

          // Find creature cards in graveyard (excluding the Gravedigger itself if somehow there)
          const creatureCards = player.graveyard.filter((c) => {
            if (c.instanceId === card.instanceId) return false;
            const t = CardLoader.getById(c.scryfallId);
            return t && isCreature(t);
          });

          if (creatureCards.length > 0) {
            // Return the first creature (in real game, player would choose target)
            const creatureToReturn = creatureCards[0]!;
            const index = player.graveyard.indexOf(creatureToReturn);
            player.graveyard.splice(index, 1);

            creatureToReturn.zone = 'hand';
            creatureToReturn.damage = 0;
            creatureToReturn.tapped = false;
            creatureToReturn.summoningSick = false;
            player.hand.push(creatureToReturn);
          }
        });
      }
      break;

    case 'Abyssal Specter':
      // "Whenever Abyssal Specter deals damage to a player, that player discards a card at random."
      if (event.type === 'DEALS_DAMAGE' && event.sourceId === card.instanceId) {
        triggers.push((triggerState: GameState) => {
          const targetPlayerId = event.targetId as 'player' | 'opponent';
          const targetPlayer = triggerState.players[targetPlayerId];

          // Discard a random card
          if (targetPlayer.hand.length > 0) {
            const randomIndex = Math.floor(Math.random() * targetPlayer.hand.length);
            const discardedCard = targetPlayer.hand.splice(randomIndex, 1)[0]!;
            discardedCard.zone = 'graveyard';
            targetPlayer.graveyard.push(discardedCard);
          }
        });
      }
      break;

    case 'Sibilant Spirit':
      // "Whenever Sibilant Spirit attacks, defending player may draw a card."
      // Note: This would need an ATTACKS event type, not implemented yet
      break;

    case 'Soul Net':
      // "Whenever a creature dies, you may pay {1}. If you do, you gain 1 life."
      // This is an artifact that triggers when ANY creature dies
      if (event.type === 'DIES') {
        triggers.push((triggerState: GameState) => {
          // For now, auto-gain the life (would need mana payment system for full implementation)
          // In real implementation, this would be optional and require {1} payment
          const controller = triggerState.players[card.controller];
          controller.life += 1;
        });
      }
      break;

    case 'Dingus Egg':
      // "Whenever a land is put into a graveyard from the battlefield, Dingus Egg deals 2 damage to that land's controller."
      // Would need LAND_DIES event type
      break;

    // ========================================
    // CITY OF BRASS (Phase 1.5.1)
    // ========================================

    case 'City of Brass':
      // "Whenever this land becomes tapped, it deals 1 damage to you."
      if (event.type === 'BECOMES_TAPPED' && event.cardId === card.instanceId) {
        triggers.push((triggerState: GameState) => {
          // Deal 1 damage to the controller
          triggerState.players[card.controller].life -= 1;
        });
      }
      break;

    // ========================================
    // ETB LIFE GAIN CREATURES (Phase 1.5.3)
    // ========================================

    case 'Venerable Monk':
      // "When Venerable Monk enters the battlefield, you gain 2 life."
      if (event.type === 'ENTERS_BATTLEFIELD' && event.cardId === card.instanceId) {
        triggers.push((triggerState: GameState) => {
          triggerState.players[card.controller].life += 2;
        });
      }
      break;

    case 'Staunch Defenders':
      // "When Staunch Defenders enters the battlefield, you gain 4 life."
      if (event.type === 'ENTERS_BATTLEFIELD' && event.cardId === card.instanceId) {
        triggers.push((triggerState: GameState) => {
          triggerState.players[card.controller].life += 4;
        });
      }
      break;

    // ========================================
    // ETB DESTROY ARTIFACT (Phase 1.5.3)
    // ========================================

    case 'Uktabi Orangutan':
      // "When Uktabi Orangutan enters the battlefield, destroy target artifact."
      if (event.type === 'ENTERS_BATTLEFIELD' && event.cardId === card.instanceId) {
        triggers.push((triggerState: GameState) => {
          // Find an artifact to destroy (opponent's first, then own)
          for (const playerId of ['opponent', 'player'] as const) {
            const targetPlayerId =
              card.controller === 'player'
                ? playerId
                : playerId === 'player'
                  ? 'opponent'
                  : 'player';
            const targetPlayer = triggerState.players[targetPlayerId];

            const artifact = targetPlayer.battlefield.find((c) => {
              const t = CardLoader.getById(c.scryfallId);
              return t && t.type_line?.toLowerCase().includes('artifact');
            });

            if (artifact) {
              const index = targetPlayer.battlefield.indexOf(artifact);
              if (index !== -1) {
                targetPlayer.battlefield.splice(index, 1);
                artifact.zone = 'graveyard';
                artifact.damage = 0;
                artifact.tapped = false;
                targetPlayer.graveyard.push(artifact);
              }
              break;
            }
          }
        });
      }
      break;

    // ========================================
    // ETB SCRY / LIBRARY MANIPULATION (Phase 1.5.3)
    // ========================================

    case 'Sage Owl':
      // "When Sage Owl enters the battlefield, look at the top four cards of your library, then put them back in any order."
      if (event.type === 'ENTERS_BATTLEFIELD' && event.cardId === card.instanceId) {
        triggers.push((triggerState: GameState) => {
          const player = triggerState.players[card.controller];

          // Get top 4 cards (or fewer if library is small)
          const topCards = player.library.slice(0, 4);

          // In a real implementation with player interaction, they would choose the order
          // For now, we'll just shuffle these top 4 cards randomly (simulating a non-optimal reorder)
          // This is a simplification - a smart AI would want to order these optimally
          for (let i = topCards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [topCards[i], topCards[j]] = [topCards[j]!, topCards[i]!];
          }

          // Put them back on top
          for (let i = 0; i < topCards.length; i++) {
            player.library[i] = topCards[i]!;
          }
        });
      }
      break;

    // ========================================
    // ETB DISCARD (Phase 1.5.3)
    // ========================================

    case 'Hidden Horror':
      // "When Hidden Horror enters the battlefield, sacrifice it unless you discard a creature card."
      if (event.type === 'ENTERS_BATTLEFIELD' && event.cardId === card.instanceId) {
        triggers.push((triggerState: GameState) => {
          const player = triggerState.players[card.controller];

          // Find a creature card in hand to discard
          const creatureCardIndex = player.hand.findIndex((c) => {
            const t = CardLoader.getById(c.scryfallId);
            return t && isCreature(t);
          });

          if (creatureCardIndex !== -1) {
            // Discard the creature card
            const discardedCard = player.hand.splice(creatureCardIndex, 1)[0]!;
            discardedCard.zone = 'graveyard';
            player.graveyard.push(discardedCard);
          } else {
            // No creature card to discard - sacrifice Hidden Horror
            const horrorIndex = player.battlefield.findIndex(
              (c) => c.instanceId === card.instanceId,
            );
            if (horrorIndex !== -1) {
              const horror = player.battlefield.splice(horrorIndex, 1)[0]!;
              horror.zone = 'graveyard';
              horror.damage = 0;
              horror.tapped = false;
              player.graveyard.push(horror);
            }
          }
        });
      }
      break;

    // ========================================
    // PRIMAL CLAY - ETB CHOICE (Phase 1.5.4)
    // ========================================

    case 'Primal Clay':
      // "As Primal Clay enters, it becomes your choice of a 3/3 artifact creature,
      //  a 2/2 artifact creature with flying, or a 1/6 Wall artifact creature with defender."
      // Note: This is technically a replacement effect, not a trigger, but we handle it here for simplicity.
      // For AI simulation, we default to the most versatile choice (3/3) unless the card already has a choice set.
      if (event.type === 'ENTERS_BATTLEFIELD' && event.cardId === card.instanceId) {
        triggers.push((triggerState: GameState) => {
          const player = triggerState.players[card.controller];
          const primalClay = player.battlefield.find((c) => c.instanceId === card.instanceId);

          if (primalClay && !primalClay.primalClayChoice) {
            // Default to 3/3 for AI - in a real game, player would choose
            // AI heuristic: choose based on game state
            // - If we need defense, choose 1/6 wall
            // - If opponent has flyers, choose 2/2 flying
            // - Otherwise, 3/3 is the most versatile
            const opponentPlayerId = card.controller === 'player' ? 'opponent' : 'player';
            const opponent = triggerState.players[opponentPlayerId];

            // Check for opponent flyers
            const opponentHasFlyers = opponent.battlefield.some((c) => {
              const t = CardLoader.getById(c.scryfallId);
              return t && t.keywords?.includes('Flying');
            });

            // Simple AI: if opponent has flyers and we need blockers, choose 2/2 flying
            // Otherwise default to 3/3
            if (opponentHasFlyers && player.life < 10) {
              primalClay.primalClayChoice = '2/2 flying';
            } else {
              primalClay.primalClayChoice = '3/3';
            }
          }
        });
      }
      break;

    // ========================================
    // GOBLIN MATRON - ETB TUTOR (Phase 1.5.4)
    // ========================================

    case 'Goblin Matron':
      // "When Goblin Matron enters the battlefield, you may search your library for a Goblin card,
      //  reveal that card, put it into your hand, then shuffle."
      if (event.type === 'ENTERS_BATTLEFIELD' && event.cardId === card.instanceId) {
        triggers.push((triggerState: GameState) => {
          const player = triggerState.players[card.controller];

          // Find a Goblin card in library
          const goblinIndex = player.library.findIndex((c) => {
            const t = CardLoader.getById(c.scryfallId);
            return t && t.type_line?.includes('Goblin');
          });

          if (goblinIndex !== -1) {
            // Move goblin to hand
            const goblin = player.library.splice(goblinIndex, 1)[0]!;
            goblin.zone = 'hand';
            player.hand.push(goblin);

            // Shuffle library
            for (let i = player.library.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [player.library[i], player.library[j]] = [player.library[j]!, player.library[i]!];
            }
          }
        });
      }
      break;

    // ========================================
    // BALDUVIAN HORDE - ETB DISCARD (Phase 1.5.4)
    // ========================================

    case 'Balduvian Horde':
      // "When Balduvian Horde enters the battlefield, sacrifice it unless you discard a card at random."
      if (event.type === 'ENTERS_BATTLEFIELD' && event.cardId === card.instanceId) {
        triggers.push((triggerState: GameState) => {
          const player = triggerState.players[card.controller];

          if (player.hand.length > 0) {
            // Discard a random card
            const randomIndex = Math.floor(Math.random() * player.hand.length);
            const discardedCard = player.hand.splice(randomIndex, 1)[0]!;
            discardedCard.zone = 'graveyard';
            player.graveyard.push(discardedCard);
          } else {
            // No cards to discard - sacrifice Balduvian Horde
            const hordeIndex = player.battlefield.findIndex(
              (c) => c.instanceId === card.instanceId,
            );
            if (hordeIndex !== -1) {
              const horde = player.battlefield.splice(hordeIndex, 1)[0]!;
              horde.zone = 'graveyard';
              horde.damage = 0;
              horde.tapped = false;
              player.graveyard.push(horde);
            }
          }
        });
      }
      break;

    // ========================================
    // KJELDORAN DEAD - ETB SACRIFICE (Phase 1.5.4)
    // ========================================

    case 'Kjeldoran Dead':
      // "When Kjeldoran Dead enters the battlefield, sacrifice a creature."
      if (event.type === 'ENTERS_BATTLEFIELD' && event.cardId === card.instanceId) {
        triggers.push((triggerState: GameState) => {
          const player = triggerState.players[card.controller];

          // Find a creature to sacrifice (not the Kjeldoran Dead itself)
          const creatureIndex = player.battlefield.findIndex((c) => {
            if (c.instanceId === card.instanceId) return false;
            const t = CardLoader.getById(c.scryfallId);
            return t && isCreature(t);
          });

          if (creatureIndex !== -1) {
            // Sacrifice the creature
            const creature = player.battlefield.splice(creatureIndex, 1)[0]!;
            creature.zone = 'graveyard';
            creature.damage = 0;
            creature.tapped = false;
            player.graveyard.push(creature);
          } else {
            // No other creature to sacrifice - must sacrifice Kjeldoran Dead
            const deadIndex = player.battlefield.findIndex((c) => c.instanceId === card.instanceId);
            if (deadIndex !== -1) {
              const dead = player.battlefield.splice(deadIndex, 1)[0]!;
              dead.zone = 'graveyard';
              dead.damage = 0;
              dead.tapped = false;
              player.graveyard.push(dead);
            }
          }
        });
      }
      break;

    // Add more cards with triggers here
  }

  return triggers;
}

/**
 * Get death triggers for a creature that just died (now in graveyard)
 * These are "When THIS creature dies" triggers
 */
function getDeathTriggersForDyingCard(
  card: CardInstance,
  event: TriggerEvent,
  _state: GameState,
): Array<(state: GameState) => void> {
  if (event.type !== 'DIES') return [];

  const template = CardLoader.getById(card.scryfallId);
  if (!template) return [];

  const triggers: Array<(state: GameState) => void> = [];

  switch (template.name) {
    case 'Gravebane Zombie':
      // "If Gravebane Zombie would die, put Gravebane Zombie on top of its owner's library instead."
      // Note: This is actually a replacement effect, not a trigger. For simplicity, we implement as trigger.
      triggers.push((triggerState: GameState) => {
        const owner = triggerState.players[card.owner];

        // Find the zombie in graveyard
        const index = owner.graveyard.findIndex((c) => c.instanceId === card.instanceId);
        if (index !== -1) {
          const zombie = owner.graveyard.splice(index, 1)[0]!;
          zombie.zone = 'library';
          zombie.damage = 0;
          zombie.tapped = false;
          zombie.summoningSick = false;
          // Put on top of library
          owner.library.unshift(zombie);
        }
      });
      break;

    case 'Kjeldoran Dead':
      // "When Kjeldoran Dead enters the battlefield, sacrifice a creature."
      // Note: This is an ETB, not death trigger - but adding for completeness
      break;

    case 'Daraja Griffin':
      // "Sacrifice Daraja Griffin: Destroy target black creature."
      // This is an activated ability, not a death trigger
      break;

    case 'Sengir Autocrat':
      // "When Sengir Autocrat leaves the battlefield, exile all Serf tokens."
      // This triggers on leaving battlefield (including death)
      // Will be fully implemented when tokens are added
      triggers.push((triggerState: GameState) => {
        // Remove all Serf tokens from battlefield
        for (const playerId of ['player', 'opponent'] as const) {
          const player = triggerState.players[playerId];
          player.battlefield = player.battlefield.filter((c) => {
            const t = CardLoader.getById(c.scryfallId);
            // Check if it's a Serf token (will use isToken flag when implemented)
            return !(t?.name === 'Serf');
          });
        }
      });
      break;

    // Add more death triggers here
  }

  return triggers;
}

/**
 * Put all waiting triggers onto the stack
 */
export function resolveTriggers(state: GameState): void {
  while (triggerQueue.length > 0) {
    const trigger = triggerQueue.shift()!;

    // Execute the trigger effect
    trigger.effect(state);
  }
}

/**
 * Clear the trigger queue (for testing)
 */
export function clearTriggers(): void {
  triggerQueue = [];
}

/**
 * Check if there are pending triggers
 */
export function hasPendingTriggers(): boolean {
  return triggerQueue.length > 0;
}
