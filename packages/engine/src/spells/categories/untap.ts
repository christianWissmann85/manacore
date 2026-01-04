/**
 * Untap/Tap Spells Category
 *
 * Contains implementations for spells that untap or tap permanents.
 *
 * Cards in this category:
 * - Early Harvest: Untap all basic lands you control
 * - Vitalize: Untap all creatures you control
 * - Mana Short: Tap all lands target player controls, empty their mana pool
 * - Warrior's Honor: Creatures you control get +1/+1 until end of turn
 * - Tidal Surge: Tap all creatures without flying
 */

import type { SpellImplementation } from '../SpellImplementation';
import type { GameState } from '../../state/GameState';
import type { PlayerId } from '../../state/Zone';
import { registerSpells } from '../registry';
import {
  untapAllLands,
  untapAllCreatures,
  tapAllNonFlyingCreatures,
  applyTeamPump,
} from '../../rules/effects';
import { CardLoader } from '../../cards/CardLoader';

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

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

// =============================================================================
// SPELL IMPLEMENTATIONS
// =============================================================================

export const untapSpells: SpellImplementation[] = [
  {
    cardName: 'Early Harvest',
    resolve: (state, stackObj) => {
      // Untap all basic lands you control
      untapAllLands(state, stackObj.controller, true); // true = basic lands only
    },
  },

  {
    cardName: 'Vitalize',
    resolve: (state, stackObj) => {
      // Untap all creatures you control
      untapAllCreatures(state, stackObj.controller);
    },
  },

  {
    cardName: 'Mana Short',
    resolve: (state, stackObj) => {
      // Tap all lands target player controls and empty their mana pool
      const target = stackObj.targets[0];
      if (target === 'player' || target === 'opponent') {
        applyManaShort(state, target);
      }
    },
  },

  {
    cardName: "Warrior's Honor",
    resolve: (state, stackObj) => {
      // Creatures you control get +1/+1 until end of turn
      applyTeamPump(state, stackObj.controller, 1, 1, stackObj.card.instanceId);
    },
  },

  {
    cardName: 'Tidal Surge',
    resolve: (state) => {
      // Tap all creatures without flying
      tapAllNonFlyingCreatures(state, 'player');
      tapAllNonFlyingCreatures(state, 'opponent');
    },
  },
];

// =============================================================================
// REGISTRATION
// =============================================================================

registerSpells(untapSpells);
