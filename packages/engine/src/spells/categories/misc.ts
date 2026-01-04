/**
 * Miscellaneous Spells Category
 *
 * Contains implementations for spells that don't fit neatly into
 * other categories.
 *
 * Cards in this category:
 * - Boomerang: Return target permanent to owner's hand
 * - Fallow Earth: Put target land on top of owner's library
 * - Fit of Rage: Target creature gets +3/+3 and trample until end of turn
 * - Syphon Soul: Each opponent loses 2 life, you gain that much
 * - Tariff: Each player sacrifices creature with highest CMC they control
 * - Summer Bloom: Play up to 3 additional lands this turn
 * - Relentless Assault: Untap all creatures, additional combat phase
 * - Icatian Town: Create 4 1/1 white Citizen tokens
 * - Waiting in the Weeds: Create Cat tokens for untapped Forests
 *
 * Note: Dark Ritual is in xcost.ts, Inspiration and Library of Lat-Nam are in card-draw.ts
 */

import type { SpellImplementation } from '../SpellImplementation';
import type { GameState } from '../../state/GameState';
import type { CardInstance } from '../../state/CardInstance';
import type { PlayerId } from '../../state/Zone';
import { addTemporaryModification } from '../../state/CardInstance';
import { registerSpells } from '../registry';
import {
  returnToHand,
  drainLife,
  untapAllCreatures,
  findPermanentByInstanceId,
} from '../../rules/effects';
import { createTokens } from '../../rules/tokens';
import { CardLoader } from '../../cards/CardLoader';
import { isCreature } from '../../cards/CardTemplate';
import { registerTrigger } from '../../rules/triggers';

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Return a permanent to the top of its owner's library
 */
function returnToLibraryTop(state: GameState, targetId: string): void {
  for (const playerId of ['player', 'opponent'] as const) {
    const player = state.players[playerId];
    const index = player.battlefield.findIndex((c) => c.instanceId === targetId);

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
        if (
          template.name === 'Forest' ||
          (template.type_line && template.type_line.includes('Forest'))
        ) {
          forestCount++;
        }
      }
    }

    // Create Cat tokens
    if (forestCount > 0) {
      createTokens(state, playerId, 'cat', forestCount);
    }
  }
}

// =============================================================================
// SPELL IMPLEMENTATIONS
// =============================================================================

export const miscSpells: SpellImplementation[] = [
  {
    cardName: 'Boomerang',
    resolve: (state, stackObj) => {
      // Return target permanent to its owner's hand
      const target = stackObj.targets[0];
      if (target) {
        returnToHand(state, target);
      }
    },
  },

  {
    cardName: 'Fallow Earth',
    resolve: (state, stackObj) => {
      // Put target land on top of its owner's library
      const target = stackObj.targets[0];
      if (target) {
        returnToLibraryTop(state, target);
      }
    },
  },

  {
    cardName: 'Fit of Rage',
    resolve: (state, stackObj) => {
      // Target creature gets +3/+3 and gains first strike until end of turn
      // Note: First strike grant is tracked via temporaryModifications
      const target = stackObj.targets[0];
      if (target) {
        const creature = findPermanentByInstanceId(state, target);
        if (creature) {
          // +3/+3 and first strike tracked together
          addTemporaryModification(
            creature,
            3,
            3,
            'end_of_turn',
            `${stackObj.card.instanceId}_fitofrageFirstStrike`,
          );
        }
      }
    },
  },

  {
    cardName: 'Syphon Soul',
    resolve: (state, stackObj) => {
      // Syphon Soul deals 2 damage to each other player. You gain life equal to damage dealt.
      drainLife(state, stackObj.controller, 2);
    },
  },

  {
    cardName: 'Tariff',
    resolve: (state) => {
      // Each player sacrifices the creature they control with highest CMC
      applyTariff(state);
    },
  },

  {
    cardName: 'Summer Bloom',
    resolve: (state, stackObj) => {
      // You may play up to three additional lands this turn
      // Simplified: Reset landsPlayedThisTurn to allow 3 more plays
      state.players[stackObj.controller].landsPlayedThisTurn = Math.max(
        0,
        state.players[stackObj.controller].landsPlayedThisTurn - 3,
      );
    },
  },

  {
    cardName: 'Relentless Assault',
    resolve: (state, stackObj) => {
      // Untap all creatures that attacked this turn. After this main phase,
      // there is an additional combat phase.
      // Simplified: just untap all creatures (extra combat is complex)
      untapAllCreatures(state, stackObj.controller);
    },
  },

  {
    cardName: 'Icatian Town',
    resolve: (state, stackObj) => {
      // Create four 1/1 white Citizen creature tokens
      createTokens(state, stackObj.controller, 'citizen', 4, {
        createdBy: stackObj.card.instanceId,
      });
    },
  },

  {
    cardName: 'Waiting in the Weeds',
    resolve: (state) => {
      // Each player creates a 1/1 green Cat creature token for each untapped Forest they control
      applyWaitingInTheWeeds(state);
    },
  },
];

// =============================================================================
// REGISTRATION
// =============================================================================

registerSpells(miscSpells);
