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
  source: string;      // Card instance ID
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
      const dyingCreature = player.graveyard.find(c => c.instanceId === event.cardId);
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
  state: GameState
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
          const opponentCreatures = triggerState.players[opponent].battlefield.filter(c => {
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
          const creatureCards = player.graveyard.filter(c => {
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
  state: GameState
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
        const index = owner.graveyard.findIndex(c => c.instanceId === card.instanceId);
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
          player.battlefield = player.battlefield.filter(c => {
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
