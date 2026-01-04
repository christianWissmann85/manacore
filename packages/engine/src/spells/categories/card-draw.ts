/**
 * Card Draw/Manipulation Spells Category
 *
 * Contains implementations for spells that draw cards, manipulate hands,
 * or otherwise affect card resources.
 *
 * Cards in this category:
 * - Inspiration: Target player draws 2 cards
 * - Agonizing Memories: Look at target player's hand, put 2 cards on top of library
 * - Ancestral Memories: Look at top 7, keep 2, put rest in graveyard
 * - Dream Cache: Draw 3 cards, put 2 back on top of library
 * - Forget: Target player discards 2 cards, then draws that many
 * - Painful Memories: Target player puts card from hand on top of library
 * - Stupor: Target opponent discards 1 at random, then discards 1
 * - Infernal Contract: Draw 4 cards, lose half your life rounded up
 * - Library of Lat-Nam: Opponent chooses: you draw 3, or search graveyard (simplified: draw 3)
 */

import type { SpellImplementation } from '../SpellImplementation';
import type { GameState } from '../../state/GameState';
import type { CardInstance } from '../../state/CardInstance';
import type { PlayerId } from '../../state/Zone';
import { CardLoader } from '../../cards/CardLoader';
import { isCreature } from '../../cards/CardTemplate';
import { registerSpells } from '../registry';
import {
  drawCards,
  discardCards,
  putCardsOnTopOfLibrary,
  discardThenDraw,
  drawThenPutBack,
} from '../../rules/effects';

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Apply Ancestral Memories: Look at top 7, keep 2, rest to graveyard
 * Uses deterministic selection (first 2 cards kept) for AI training
 */
function applyAncestralMemories(state: GameState, controller: PlayerId): void {
  const player = state.players[controller];

  // Take top 7 cards (or fewer if library is smaller)
  const cardsToLook = Math.min(7, player.library.length);
  const lookedCards: CardInstance[] = [];

  for (let i = 0; i < cardsToLook; i++) {
    const card = player.library.pop()!;
    lookedCards.push(card);
  }

  // Keep first 2 (deterministic selection)
  for (let i = 0; i < Math.min(2, lookedCards.length); i++) {
    const card = lookedCards[i]!;
    card.zone = 'hand';
    player.hand.push(card);
  }

  // Rest go to graveyard
  for (let i = 2; i < lookedCards.length; i++) {
    const card = lookedCards[i]!;
    card.zone = 'graveyard';
    player.graveyard.push(card);
  }
}

/**
 * Draw cards and lose half your life (rounded up)
 * Used for: Infernal Contract
 */
function drawCardsLoseHalfLife(state: GameState, playerId: PlayerId, drawCount: number): void {
  const player = state.players[playerId];

  // Draw cards
  drawCards(state, playerId, drawCount);

  // Lose half life rounded up
  const lifeToLose = Math.ceil(player.life / 2);
  player.life -= lifeToLose;

  // Check for game over
  if (player.life <= 0) {
    state.gameOver = true;
    state.winner = playerId === 'player' ? 'opponent' : 'player';
  }
}

/**
 * Count creature cards in a player's graveyard
 * Used for: Nature's Resurgence
 */
function countCreaturesInGraveyard(state: GameState, playerId: PlayerId): number {
  const player = state.players[playerId];
  let count = 0;

  for (const card of player.graveyard) {
    const template = CardLoader.getById(card.scryfallId);
    if (template && isCreature(template)) {
      count++;
    }
  }

  return count;
}

// =============================================================================
// SPELL IMPLEMENTATIONS
// =============================================================================

export const cardDrawSpells: SpellImplementation[] = [
  {
    cardName: 'Inspiration',
    resolve: (state, stackObj) => {
      // Target player draws 2 cards
      const target = stackObj.targets[0];
      if (target === 'player' || target === 'opponent') {
        drawCards(state, target, 2);
      }
    },
  },

  {
    cardName: 'Agonizing Memories',
    resolve: (state, stackObj) => {
      // Look at target player's hand and choose 2 cards from it.
      // Put them on top of library in any order.
      // Simplified: put top 2 cards from hand on top of library (deterministic)
      const target = stackObj.targets[0];
      if (target === 'player' || target === 'opponent') {
        putCardsOnTopOfLibrary(state, target, 2);
      }
    },
  },

  {
    cardName: 'Ancestral Memories',
    resolve: (state, stackObj) => {
      // Look at the top 7 cards of your library.
      // Put 2 into hand, rest in graveyard.
      applyAncestralMemories(state, stackObj.controller);
    },
  },

  {
    cardName: 'Dream Cache',
    resolve: (state, stackObj) => {
      // Draw 3 cards, then put 2 cards from your hand on top of library in any order
      drawThenPutBack(state, stackObj.controller, 3, 2);
    },
  },

  {
    cardName: 'Forget',
    resolve: (state, stackObj) => {
      // Target player discards 2 cards, then draws as many cards
      const target = stackObj.targets[0];
      if (target === 'player' || target === 'opponent') {
        discardThenDraw(state, target, 2, 2);
      }
    },
  },

  {
    cardName: 'Painful Memories',
    resolve: (state, stackObj) => {
      // Look at target player's hand and choose a card from it.
      // That player puts it on top of library.
      // Simplified: put first card from hand on top of library
      const target = stackObj.targets[0];
      if (target === 'player' || target === 'opponent') {
        putCardsOnTopOfLibrary(state, target, 1);
      }
    },
  },

  {
    cardName: 'Stupor',
    resolve: (state, stackObj) => {
      // Target opponent discards a card at random, then discards a card.
      // Simplified: target opponent discards 2 cards at random
      const target = stackObj.targets[0];
      if (target === 'player' || target === 'opponent') {
        discardCards(state, target, 2);
      }
    },
  },

  {
    cardName: 'Infernal Contract',
    resolve: (state, stackObj) => {
      // Draw 4 cards. You lose half your life, rounded up.
      drawCardsLoseHalfLife(state, stackObj.controller, 4);
    },
  },

  {
    cardName: 'Library of Lat-Nam',
    resolve: (state, stackObj) => {
      // An opponent chooses one: You draw 3 cards; or search library for a card, put in hand
      // Simplified: just draw 3 cards (assume opponent always chooses this)
      drawCards(state, stackObj.controller, 3);
    },
  },

  {
    cardName: "Nature's Resurgence",
    resolve: (state) => {
      // Each player draws cards equal to the number of creature cards in their graveyard
      const playerCreatureCount = countCreaturesInGraveyard(state, 'player');
      const opponentCreatureCount = countCreaturesInGraveyard(state, 'opponent');

      drawCards(state, 'player', playerCreatureCount);
      drawCards(state, 'opponent', opponentCreatureCount);
    },
  },
];

// =============================================================================
// REGISTRATION
// =============================================================================

registerSpells(cardDrawSpells);
