/**
 * Graveyard Recursion Spells Category
 *
 * Contains implementations for spells that interact with graveyards,
 * primarily returning cards from graveyards to hand or battlefield.
 *
 * Cards in this category:
 * - Raise Dead: Return target creature card from your graveyard to your hand
 * - Elven Cache: Return target card from your graveyard to your hand
 * - Relearn: Return target instant or sorcery card from your graveyard to your hand
 * - Hammer of Bogardan: Deals 3 damage (recursion is activated ability, not spell part)
 * - Ashen Powder: Put target creature from opponent's graveyard onto battlefield under your control
 */

import type { SpellImplementation } from '../SpellImplementation';
import type { GameState, StackObject } from '../../state/GameState';
import type { PlayerId } from '../../state/Zone';
import { CardLoader } from '../../cards/CardLoader';
import { isCreature } from '../../cards/CardTemplate';
import { registerSpells } from '../registry';
import {
  returnCreatureFromGraveyard,
  returnSpellFromGraveyard,
  returnFromGraveyard,
  applyDamage,
} from '../../rules/effects';
import { registerTrigger } from '../../rules/triggers';

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Return any card from graveyard to hand
 * Uses deterministic selection (first card) for AI training
 * Used for: Elven Cache
 */
function returnAnyCardFromGraveyard(state: GameState, playerId: PlayerId): void {
  const player = state.players[playerId];

  if (player.graveyard.length === 0) return;

  // Take first card (deterministic)
  const card = player.graveyard.shift()!;
  card.zone = 'hand';
  player.hand.push(card);
}

/**
 * Apply Ashen Powder: Steal creature from opponent's graveyard
 * Put target creature card from an opponent's graveyard onto battlefield under your control
 */
function applyAshenPowder(state: GameState, stackObj: StackObject): void {
  const controller = stackObj.controller;
  const opponent: PlayerId = controller === 'player' ? 'opponent' : 'player';
  const opponentPlayer = state.players[opponent];
  const controllerPlayer = state.players[controller];

  // Find first creature in opponent's graveyard (deterministic)
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

// =============================================================================
// SPELL IMPLEMENTATIONS
// =============================================================================

export const graveyardSpells: SpellImplementation[] = [
  {
    cardName: 'Raise Dead',
    resolve: (state, stackObj) => {
      // Return target creature card from your graveyard to your hand
      returnCreatureFromGraveyard(state, stackObj.controller);
    },
  },

  {
    cardName: 'Elven Cache',
    resolve: (state, stackObj) => {
      // Return target card from your graveyard to your hand
      // Simplified: return first card (any type) from graveyard
      returnAnyCardFromGraveyard(state, stackObj.controller);
    },
  },

  {
    cardName: 'Relearn',
    resolve: (state, stackObj) => {
      // Return target instant or sorcery card from your graveyard to your hand
      returnSpellFromGraveyard(state, stackObj.controller);
    },
  },

  {
    cardName: 'Hammer of Bogardan',
    resolve: (state, stackObj) => {
      // Hammer of Bogardan deals 3 damage to any target
      // Note: The graveyard recursion is an activated ability, not part of the spell
      const target = stackObj.targets[0];
      if (target) {
        applyDamage(state, target, 3);
      }
    },
  },

  {
    cardName: 'Ashen Powder',
    resolve: (state, stackObj) => {
      // Put target creature card from an opponent's graveyard
      // onto the battlefield under your control
      applyAshenPowder(state, stackObj);
    },
  },
];

// =============================================================================
// REGISTRATION
// =============================================================================

registerSpells(graveyardSpells);
