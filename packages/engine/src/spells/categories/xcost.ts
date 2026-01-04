/**
 * X-Cost Spells Category
 *
 * Contains implementations for spells with variable X costs.
 * These spells use stackObj.xValue to determine their effect magnitude.
 *
 * Cards in this category:
 * - Dark Ritual: Add {B}{B}{B} to mana pool
 * - Earthquake: X damage to each non-flying creature and each player
 * - Hurricane: X damage to each flying creature and each player
 * - Howl from Beyond: Target creature gets +X/+0 until end of turn
 * - Mind Warp: Target player discards X cards
 * - Prosperity: Each player draws X cards
 * - Power Sink: Counter target spell unless controller pays X
 * - Spell Blast: Counter target spell with CMC X
 * - Recall: Discard X cards, then return X cards from graveyard to hand
 */

import type { SpellImplementation } from '../SpellImplementation';
import type { GameState, StackObject } from '../../state/GameState';
import type { PlayerId } from '../../state/Zone';
import type { CardInstance } from '../../state/CardInstance';
import { addTemporaryModification, getEffectiveToughness } from '../../state/CardInstance';
import { CardLoader } from '../../cards/CardLoader';
import { isCreature, hasFlying } from '../../cards/CardTemplate';
import { registerSpells } from '../registry';
import { registerTrigger } from '../../rules/triggers';
import { drawCards, discardCards, findPermanentByInstanceId } from '../../rules/effects';

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Apply Earthquake: X damage to each creature without flying and each player
 */
function applyEarthquake(state: GameState, xDamage: number): void {
  if (xDamage <= 0) return;

  // Damage all players
  state.players.player.life -= xDamage;
  state.players.opponent.life -= xDamage;

  // Check for game over
  if (state.players.player.life <= 0 && state.players.opponent.life <= 0) {
    state.gameOver = true;
    state.winner = null; // Draw
  } else if (state.players.player.life <= 0) {
    state.gameOver = true;
    state.winner = 'opponent';
  } else if (state.players.opponent.life <= 0) {
    state.gameOver = true;
    state.winner = 'player';
  }

  // Damage all non-flying creatures
  for (const playerId of ['player', 'opponent'] as const) {
    const player = state.players[playerId];
    const toRemove: CardInstance[] = [];

    for (const creature of player.battlefield) {
      const template = CardLoader.getById(creature.scryfallId);
      if (!template || !isCreature(template)) continue;

      // Skip flyers
      if (hasFlying(template)) continue;

      creature.damage += xDamage;

      // Check lethal damage
      const baseToughness = parseInt(template.toughness || '0', 10);
      const effectiveToughness = getEffectiveToughness(creature, baseToughness);
      if (creature.damage >= effectiveToughness) {
        toRemove.push(creature);
      }
    }

    // Remove dead creatures
    for (const creature of toRemove) {
      const index = player.battlefield.indexOf(creature);
      if (index !== -1) {
        player.battlefield.splice(index, 1);
        creature.zone = 'graveyard';
        player.graveyard.push(creature);

        // Fire death trigger
        registerTrigger(state, {
          type: 'DIES',
          cardId: creature.instanceId,
          controller: playerId,
          wasController: playerId,
        });
      }
    }
  }
}

/**
 * Apply Hurricane: X damage to each creature with flying and each player
 */
function applyHurricane(state: GameState, xDamage: number): void {
  if (xDamage <= 0) return;

  // Damage all players
  state.players.player.life -= xDamage;
  state.players.opponent.life -= xDamage;

  // Check for game over
  if (state.players.player.life <= 0 && state.players.opponent.life <= 0) {
    state.gameOver = true;
    state.winner = null; // Draw
  } else if (state.players.player.life <= 0) {
    state.gameOver = true;
    state.winner = 'opponent';
  } else if (state.players.opponent.life <= 0) {
    state.gameOver = true;
    state.winner = 'player';
  }

  // Damage all flying creatures
  for (const playerId of ['player', 'opponent'] as const) {
    const player = state.players[playerId];
    const toRemove: CardInstance[] = [];

    for (const creature of player.battlefield) {
      const template = CardLoader.getById(creature.scryfallId);
      if (!template || !isCreature(template)) continue;

      // Only flyers
      if (!hasFlying(template)) continue;

      creature.damage += xDamage;

      // Check lethal damage
      const baseToughness = parseInt(template.toughness || '0', 10);
      const effectiveToughness = getEffectiveToughness(creature, baseToughness);
      if (creature.damage >= effectiveToughness) {
        toRemove.push(creature);
      }
    }

    // Remove dead creatures
    for (const creature of toRemove) {
      const index = player.battlefield.indexOf(creature);
      if (index !== -1) {
        player.battlefield.splice(index, 1);
        creature.zone = 'graveyard';
        player.graveyard.push(creature);

        // Fire death trigger
        registerTrigger(state, {
          type: 'DIES',
          cardId: creature.instanceId,
          controller: playerId,
          wasController: playerId,
        });
      }
    }
  }
}

/**
 * Apply Power Sink: Counter target spell unless controller pays X
 * Simplified: Counter if X >= spell's CMC (approximate the "can't pay" scenario)
 */
function applyPowerSink(state: GameState, stackObj: StackObject, xValue: number): void {
  const targetId = stackObj.targets[0];
  if (!targetId) return;

  const targetStackObj = state.stack.find((s) => s.id === targetId);
  if (!targetStackObj) return;

  // Get the target spell's CMC
  const targetTemplate = CardLoader.getById(targetStackObj.card.scryfallId);
  if (!targetTemplate) return;

  // Calculate CMC from mana cost
  const manaCost = targetTemplate.mana_cost || '';
  let cmc = 0;
  const colorMatch = manaCost.match(/\{[WUBRGC]\}/gi);
  if (colorMatch) cmc += colorMatch.length;
  const genericMatch = manaCost.match(/\{(\d+)\}/);
  if (genericMatch) cmc += parseInt(genericMatch[1]!, 10);

  // If X >= CMC, counter the spell (simplified: assumes opponent can't pay)
  if (xValue >= cmc) {
    targetStackObj.countered = true;
  }
}

/**
 * Apply Spell Blast: Counter target spell with CMC X
 */
function applySpellBlast(state: GameState, stackObj: StackObject, xValue: number): void {
  const targetId = stackObj.targets[0];
  if (!targetId) return;

  const targetStackObj = state.stack.find((s) => s.id === targetId);
  if (!targetStackObj) return;

  // Get the target spell's CMC
  const targetTemplate = CardLoader.getById(targetStackObj.card.scryfallId);
  if (!targetTemplate) return;

  // Calculate CMC from mana cost
  const manaCost = targetTemplate.mana_cost || '';
  let cmc = 0;
  const colorMatch = manaCost.match(/\{[WUBRGC]\}/gi);
  if (colorMatch) cmc += colorMatch.length;
  const genericMatch = manaCost.match(/\{(\d+)\}/);
  if (genericMatch) cmc += parseInt(genericMatch[1]!, 10);

  // Only counter if X matches the CMC exactly
  if (xValue === cmc) {
    targetStackObj.countered = true;
  }
}

/**
 * Apply Recall: Discard X cards, then return X cards from graveyard to hand
 * Simplified: Random selection for both
 */
function applyRecall(state: GameState, controller: PlayerId, xValue: number): void {
  if (xValue <= 0) return;

  const player = state.players[controller];

  // First discard X cards (random)
  for (let i = 0; i < xValue && player.hand.length > 0; i++) {
    const index = Math.floor(Math.random() * player.hand.length);
    const card = player.hand.splice(index, 1)[0]!;
    card.zone = 'graveyard';
    player.graveyard.push(card);
  }

  // Then return X cards from graveyard to hand (random)
  for (let i = 0; i < xValue && player.graveyard.length > 0; i++) {
    const index = Math.floor(Math.random() * player.graveyard.length);
    const card = player.graveyard.splice(index, 1)[0]!;
    card.zone = 'hand';
    player.hand.push(card);
  }
}

// =============================================================================
// SPELL IMPLEMENTATIONS
// =============================================================================

export const xcostSpells: SpellImplementation[] = [
  {
    cardName: 'Dark Ritual',
    resolve: (state, stackObj) => {
      // Add {B}{B}{B} to mana pool
      state.players[stackObj.controller].manaPool.black += 3;
    },
  },

  {
    cardName: 'Earthquake',
    resolve: (state, stackObj) => {
      // Deal X damage to each creature without flying and each player
      const xValue = stackObj.xValue || 0;
      applyEarthquake(state, xValue);
    },
  },

  {
    cardName: 'Hurricane',
    resolve: (state, stackObj) => {
      // Deal X damage to each creature with flying and each player
      const xValue = stackObj.xValue || 0;
      applyHurricane(state, xValue);
    },
  },

  {
    cardName: 'Howl from Beyond',
    resolve: (state, stackObj) => {
      // Target creature gets +X/+0 until end of turn
      const xValue = stackObj.xValue || 0;
      const targetId = stackObj.targets[0];
      if (targetId) {
        const target = findPermanentByInstanceId(state, targetId);
        if (target) {
          addTemporaryModification(target, xValue, 0, 'end_of_turn', stackObj.card.instanceId);
        }
      }
    },
  },

  {
    cardName: 'Mind Warp',
    resolve: (state, stackObj) => {
      // Look at target player's hand and make them discard X cards
      const xValue = stackObj.xValue || 0;
      const targetId = stackObj.targets[0];
      if (targetId === 'player' || targetId === 'opponent') {
        discardCards(state, targetId, xValue);
      }
    },
  },

  {
    cardName: 'Prosperity',
    resolve: (state, stackObj) => {
      // Each player draws X cards
      const xValue = stackObj.xValue || 0;
      drawCards(state, 'player', xValue);
      drawCards(state, 'opponent', xValue);
    },
  },

  {
    cardName: 'Power Sink',
    resolve: (state, stackObj) => {
      // Counter target spell unless controller pays X
      const xValue = stackObj.xValue || 0;
      applyPowerSink(state, stackObj, xValue);
    },
  },

  {
    cardName: 'Spell Blast',
    resolve: (state, stackObj) => {
      // Counter target spell with CMC X
      const xValue = stackObj.xValue || 0;
      applySpellBlast(state, stackObj, xValue);
    },
  },

  {
    cardName: 'Recall',
    resolve: (state, stackObj) => {
      // Discard X cards, then return X cards from graveyard to hand
      const xValue = stackObj.xValue || 0;
      applyRecall(state, stackObj.controller, xValue);
    },
  },
];

// =============================================================================
// REGISTRATION
// =============================================================================

registerSpells(xcostSpells);
