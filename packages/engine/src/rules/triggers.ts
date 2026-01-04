/**
 * Triggered Abilities System
 *
 * Handles "When...", "Whenever...", "At..." abilities
 *
 * Phase 1 triggers:
 * - "When ~ enters the battlefield" (ETB)
 * - "When ~ dies"
 */

import type { GameState } from '../state/GameState';
import type { CardInstance } from '../state/CardInstance';
import type { PlayerId } from '../state/Zone';
import { CardLoader } from '../cards/CardLoader';

/**
 * Trigger event types
 */
export type TriggerEvent =
  | { type: 'ENTERS_BATTLEFIELD'; cardId: string; controller: PlayerId }
  | { type: 'DIES'; cardId: string; controller: PlayerId; wasController: PlayerId }
  | { type: 'DEALS_DAMAGE'; sourceId: string; targetId: string; amount: number };

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
  // Check all permanents for matching triggers
  for (const playerId of ['player', 'opponent'] as const) {
    const player = state.players[playerId];

    for (const permanent of player.battlefield) {
      const triggers = getTriggersForCard(permanent, event);

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
}

/**
 * Get triggered abilities for a card that match an event
 */
function getTriggersForCard(
  card: CardInstance,
  event: TriggerEvent
): Array<(state: GameState) => void> {
  const template = CardLoader.getById(card.scryfallId);
  if (!template) return [];

  const triggers: Array<(state: GameState) => void> = [];

  // Check card-specific triggers
  switch (template.name) {
    case 'Nekrataal':
      // "When Nekrataal enters the battlefield, destroy target nonblack creature"
      if (event.type === 'ENTERS_BATTLEFIELD' && event.cardId === card.instanceId) {
        triggers.push((_state: GameState) => {
          // TODO: Implement targeting and destruction
          // For now, just log
          console.log('Nekrataal ETB trigger would fire here');
        });
      }
      break;

    // Add more cards with triggers here
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
