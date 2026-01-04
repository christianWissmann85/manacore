/**
 * Spell Effect Helpers
 *
 * Reusable functions for implementing spell and ability effects.
 * These are used by stack.ts and activatedAbilities.ts.
 *
 * Week 1.5.2 additions:
 * - Mass destruction effects
 * - Untap effects
 * - Library search (tutors)
 * - Graveyard recursion
 * - Team pump effects
 */

import type { GameState } from '../state/GameState';
import type { CardInstance } from '../state/CardInstance';
import type { PlayerId } from '../state/Zone';
import { CardLoader } from '../cards/CardLoader';
import type { CardTemplate } from '../cards/CardTemplate';
import {
  isCreature,
  isLand,
  isArtifact,
  isEnchantment,
  isInstant,
  isSorcery,
} from '../cards/CardTemplate';
import { addTemporaryModification, getEffectiveToughness } from '../state/CardInstance';
import { registerTrigger } from './triggers';

// ============================================================================
// MASS DESTRUCTION EFFECTS
// ============================================================================

/**
 * Destroy all permanents matching a filter function
 * Used for: Wrath of God, Armageddon, Tranquility, Shatterstorm, etc.
 */
export function destroyAllMatching(
  state: GameState,
  filter: (card: CardInstance, template: CardTemplate) => boolean,
  options: { fireTriggers?: boolean } = {},
): CardInstance[] {
  const destroyed: CardInstance[] = [];
  const { fireTriggers = true } = options;

  for (const playerId of ['player', 'opponent'] as const) {
    const player = state.players[playerId];
    const toDestroy: CardInstance[] = [];

    for (const permanent of player.battlefield) {
      const template = CardLoader.getById(permanent.scryfallId);
      if (!template) continue;

      if (filter(permanent, template)) {
        toDestroy.push(permanent);
      }
    }

    // Remove and move to graveyard
    for (const permanent of toDestroy) {
      const index = player.battlefield.indexOf(permanent);
      if (index !== -1) {
        player.battlefield.splice(index, 1);
        permanent.zone = 'graveyard';
        permanent.damage = 0;
        permanent.tapped = false;
        player.graveyard.push(permanent);
        destroyed.push(permanent);

        // Fire death trigger for creatures
        if (fireTriggers) {
          const template = CardLoader.getById(permanent.scryfallId);
          if (template && isCreature(template)) {
            registerTrigger(state, {
              type: 'DIES',
              cardId: permanent.instanceId,
              controller: playerId,
              wasController: playerId,
            });
          }
        }
      }
    }
  }

  return destroyed;
}

/**
 * Destroy all creatures
 * Used for: Wrath of God
 */
export function destroyAllCreatures(state: GameState): CardInstance[] {
  return destroyAllMatching(state, (card, template) => isCreature(template));
}

/**
 * Destroy all lands
 * Used for: Armageddon
 */
export function destroyAllLands(state: GameState): CardInstance[] {
  return destroyAllMatching(state, (card, template) => isLand(template));
}

/**
 * Destroy all artifacts
 * Used for: Shatterstorm
 */
export function destroyAllArtifacts(state: GameState): CardInstance[] {
  return destroyAllMatching(state, (card, template) => isArtifact(template));
}

/**
 * Destroy all enchantments
 * Used for: Tranquility
 */
export function destroyAllEnchantments(state: GameState): CardInstance[] {
  return destroyAllMatching(state, (card, template) => isEnchantment(template));
}

/**
 * Destroy all creatures of a specific color
 * Used for: Perish (green), color hosers
 */
export function destroyAllCreaturesOfColor(state: GameState, color: string): CardInstance[] {
  return destroyAllMatching(state, (card, template) => {
    if (!isCreature(template)) return false;
    return template.colors?.includes(color) ?? false;
  });
}

/**
 * Destroy all lands of a specific type
 * Used for: Boil (Islands), Flashfires (Plains)
 */
export function destroyAllLandsOfType(state: GameState, landType: string): CardInstance[] {
  return destroyAllMatching(state, (card, template) => {
    if (!isLand(template)) return false;
    // Check type_line for land type (e.g., "Basic Land — Island")
    return template.type_line?.toLowerCase().includes(landType.toLowerCase()) ?? false;
  });
}

/**
 * Destroy all non-enchantment permanents
 * Used for: Jokulhaups
 */
export function destroyAllNonEnchantments(state: GameState): CardInstance[] {
  return destroyAllMatching(state, (card, template) => !isEnchantment(template));
}

// ============================================================================
// UNTAP EFFECTS
// ============================================================================

/**
 * Untap all permanents matching a filter
 * Used for: Early Harvest, Vitalize
 */
export function untapAllMatching(
  state: GameState,
  controller: PlayerId,
  filter: (card: CardInstance, template: CardTemplate) => boolean,
): CardInstance[] {
  const untapped: CardInstance[] = [];
  const player = state.players[controller];

  for (const permanent of player.battlefield) {
    const template = CardLoader.getById(permanent.scryfallId);
    if (!template) continue;

    if (permanent.tapped && filter(permanent, template)) {
      permanent.tapped = false;
      untapped.push(permanent);
    }
  }

  return untapped;
}

/**
 * Untap all lands you control
 * Used for: Early Harvest
 * @param basicOnly - If true, only untap basic lands
 */
export function untapAllLands(
  state: GameState,
  controller: PlayerId,
  basicOnly: boolean = false,
): CardInstance[] {
  return untapAllMatching(state, controller, (card, template) => {
    if (!isLand(template)) return false;
    if (basicOnly) {
      const basicLandNames = ['Plains', 'Island', 'Swamp', 'Mountain', 'Forest'];
      return (
        basicLandNames.includes(template.name || '') ||
        template.type_line?.toLowerCase().includes('basic land') ||
        false
      );
    }
    return true;
  });
}

/**
 * Untap all creatures you control
 * Used for: Vitalize
 */
export function untapAllCreatures(state: GameState, controller: PlayerId): CardInstance[] {
  return untapAllMatching(state, controller, (card, template) => isCreature(template));
}

/**
 * Tap all permanents matching a filter
 * Used for: Tidal Surge, Mana Short
 */
export function tapAllMatching(
  state: GameState,
  targetPlayer: PlayerId | 'all',
  filter: (card: CardInstance, template: CardTemplate) => boolean,
): CardInstance[] {
  const tapped: CardInstance[] = [];
  const players = targetPlayer === 'all' ? (['player', 'opponent'] as const) : [targetPlayer];

  for (const playerId of players) {
    const player = state.players[playerId];

    for (const permanent of player.battlefield) {
      const template = CardLoader.getById(permanent.scryfallId);
      if (!template) continue;

      if (!permanent.tapped && filter(permanent, template)) {
        permanent.tapped = true;
        tapped.push(permanent);

        // Fire BECOMES_TAPPED trigger
        registerTrigger(state, {
          type: 'BECOMES_TAPPED',
          cardId: permanent.instanceId,
          controller: playerId,
        });
      }
    }
  }

  return tapped;
}

/**
 * Tap all non-flying creatures
 * Used for: Tidal Surge
 */
export function tapAllNonFlyingCreatures(
  state: GameState,
  targetPlayer: PlayerId | 'all',
): CardInstance[] {
  return tapAllMatching(state, targetPlayer, (card, template) => {
    if (!isCreature(template)) return false;
    const hasFlying = template.keywords?.includes('Flying') ?? false;
    return !hasFlying;
  });
}

// ============================================================================
// LIBRARY SEARCH (TUTORS)
// ============================================================================

/**
 * Search library for a card matching filter and move to destination
 * Uses deterministic selection (first match) for AI training consistency
 *
 * Used for: Enlightened Tutor, Mystical Tutor, Vampiric Tutor, Worldly Tutor
 */
export function searchLibrary(
  state: GameState,
  searcher: PlayerId,
  libraryOwner: PlayerId,
  filter: (card: CardInstance) => boolean,
  destination: 'hand' | 'library_top' | 'top_of_library' | 'battlefield' | 'battlefield_tapped',
  options: { shuffle?: boolean } = {},
): CardInstance | null {
  const { shuffle = true } = options;
  const tapped = destination === 'battlefield_tapped';
  const owner = state.players[libraryOwner];

  // Find first matching card (deterministic for AI training)
  let foundIndex = -1;
  for (let i = 0; i < owner.library.length; i++) {
    const card = owner.library[i]!;
    if (filter(card)) {
      foundIndex = i;
      break;
    }
  }

  if (foundIndex === -1) {
    // No matching card found
    if (shuffle) {
      shuffleLibrary(state, libraryOwner);
    }
    return null;
  }

  // Remove from library
  const card = owner.library.splice(foundIndex, 1)[0]!;

  // Move to destination
  switch (destination) {
    case 'hand':
      card.zone = 'hand';
      state.players[searcher].hand.push(card);
      break;

    case 'library_top':
    case 'top_of_library':
      card.zone = 'library';
      owner.library.push(card); // Push to end (which is "top" of library since we pop from end)
      break;

    case 'battlefield':
    case 'battlefield_tapped': {
      card.zone = 'battlefield';
      card.controller = searcher;
      card.tapped = tapped;
      const template = CardLoader.getById(card.scryfallId);
      if (template && isCreature(template)) {
        card.summoningSick = true;
      }
      state.players[searcher].battlefield.push(card);

      // Fire ETB trigger
      registerTrigger(state, {
        type: 'ENTERS_BATTLEFIELD',
        cardId: card.instanceId,
        controller: searcher,
      });
      break;
    }
  }

  // Shuffle library after searching (unless putting on top)
  if (shuffle && destination !== 'top_of_library' && destination !== 'library_top') {
    shuffleLibrary(state, libraryOwner);
  }

  return card;
}

/**
 * Shuffle a player's library using seeded random for determinism
 */
export function shuffleLibrary(state: GameState, playerId: PlayerId): void {
  const player = state.players[playerId];
  const library = player.library;

  // Fisher-Yates shuffle with deterministic seed
  for (let i = library.length - 1; i > 0; i--) {
    // Use game state's turn count as part of seed for determinism
    const seed = state.turnCount * 1000 + i;
    const j = Math.floor(deterministicRandom(seed) * (i + 1));
    [library[i], library[j]] = [library[j]!, library[i]!];
  }
}

/**
 * Deterministic random number generator for consistent AI training
 */
function deterministicRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

// ============================================================================
// GRAVEYARD RECURSION
// ============================================================================

/**
 * Return a card from graveyard to hand
 * Uses deterministic selection (first match) for AI training
 *
 * Used for: Raise Dead, Elven Cache, Relearn
 */
export function returnFromGraveyard(
  state: GameState,
  playerId: PlayerId,
  filter: (template: CardTemplate) => boolean,
  destination: 'hand' | 'battlefield' | 'top_of_library',
  count: number = 1,
): CardInstance[] {
  const player = state.players[playerId];
  const returned: CardInstance[] = [];

  for (let i = 0; i < count; i++) {
    // Find first matching card in graveyard
    let foundIndex = -1;
    for (let j = 0; j < player.graveyard.length; j++) {
      const card = player.graveyard[j]!;
      const template = CardLoader.getById(card.scryfallId);
      if (template && filter(template)) {
        foundIndex = j;
        break;
      }
    }

    if (foundIndex === -1) break; // No more matching cards

    // Remove from graveyard
    const card = player.graveyard.splice(foundIndex, 1)[0]!;

    // Reset card state
    card.damage = 0;
    card.tapped = false;
    card.summoningSick = false;

    // Move to destination
    switch (destination) {
      case 'hand':
        card.zone = 'hand';
        player.hand.push(card);
        break;

      case 'battlefield': {
        card.zone = 'battlefield';
        card.controller = playerId;
        const template = CardLoader.getById(card.scryfallId);
        if (template && isCreature(template)) {
          card.summoningSick = true;
        }
        player.battlefield.push(card);

        // Fire ETB trigger
        registerTrigger(state, {
          type: 'ENTERS_BATTLEFIELD',
          cardId: card.instanceId,
          controller: playerId,
        });
        break;
      }

      case 'top_of_library':
        card.zone = 'library';
        player.library.unshift(card);
        break;
    }

    returned.push(card);
  }

  return returned;
}

/**
 * Return a creature card from graveyard to hand
 * Used for: Raise Dead
 */
export function returnCreatureFromGraveyard(
  state: GameState,
  playerId: PlayerId,
): CardInstance | null {
  const result = returnFromGraveyard(
    state,
    playerId,
    (template) => isCreature(template),
    'hand',
    1,
  );
  return result[0] ?? null;
}

/**
 * Return an instant or sorcery from graveyard to hand
 * Used for: Relearn
 */
export function returnSpellFromGraveyard(
  state: GameState,
  playerId: PlayerId,
): CardInstance | null {
  const result = returnFromGraveyard(
    state,
    playerId,
    (template) => isInstant(template) || isSorcery(template),
    'hand',
    1,
  );
  return result[0] ?? null;
}

// ============================================================================
// TEAM PUMP EFFECTS
// ============================================================================

/**
 * Apply a temporary power/toughness boost to all creatures you control
 * Used for: Warrior's Honor
 */
export function applyTeamPump(
  state: GameState,
  controller: PlayerId,
  powerBoost: number,
  toughnessBoost: number,
  sourceId: string,
): CardInstance[] {
  const player = state.players[controller];
  const pumped: CardInstance[] = [];

  for (const permanent of player.battlefield) {
    const template = CardLoader.getById(permanent.scryfallId);
    if (!template || !isCreature(template)) continue;

    addTemporaryModification(permanent, powerBoost, toughnessBoost, 'end_of_turn', sourceId);
    pumped.push(permanent);
  }

  return pumped;
}

// ============================================================================
// MASS DAMAGE EFFECTS
// ============================================================================

/**
 * Deal damage to all creatures and/or players
 * Used for: Inferno, Tremor, Dry Spell
 */
export function dealDamageToAll(
  state: GameState,
  damage: number,
  targets: {
    creatures?: boolean;
    players?: boolean;
    creatureFilter?: (card: CardInstance, template: CardTemplate) => boolean;
    flyersOnly?: boolean;
    excludeFlyers?: boolean;
  },
): void {
  const {
    creatures = true,
    players = false,
    creatureFilter,
    flyersOnly = false,
    excludeFlyers = false,
  } = targets;

  // Damage players
  if (players) {
    state.players.player.life -= damage;
    state.players.opponent.life -= damage;

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
  }

  // Damage creatures
  if (creatures) {
    for (const playerId of ['player', 'opponent'] as const) {
      const player = state.players[playerId];
      const toDie: CardInstance[] = [];

      for (const creature of player.battlefield) {
        const template = CardLoader.getById(creature.scryfallId);
        if (!template || !isCreature(template)) continue;

        // Check flying restrictions
        const hasFlying = template.keywords?.includes('Flying') ?? false;
        if (flyersOnly && !hasFlying) continue;
        if (excludeFlyers && hasFlying) continue;

        // Apply custom filter if provided
        if (creatureFilter && !creatureFilter(creature, template)) continue;

        creature.damage += damage;

        // Check lethal damage
        const baseToughness = parseInt(template.toughness || '0', 10);
        const effectiveToughness = getEffectiveToughness(creature, baseToughness);
        if (creature.damage >= effectiveToughness) {
          toDie.push(creature);
        }
      }

      // Remove dead creatures
      for (const creature of toDie) {
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
}

/**
 * Deal damage to all non-flying creatures and all players
 * Used for: Tremor
 */
export function dealDamageToNonFlyers(
  state: GameState,
  damage: number,
  includePlayers: boolean,
): void {
  dealDamageToAll(state, damage, {
    creatures: true,
    players: includePlayers,
    creatureFilter: (card, template) => {
      const hasFlying = template.keywords?.includes('Flying') ?? false;
      return !hasFlying;
    },
  });
}

// ============================================================================
// CARD MANIPULATION
// ============================================================================

/**
 * Put cards from hand on top of library
 * Used for: Agonizing Memories, Painful Memories
 */
export function putCardsOnTopOfLibrary(
  state: GameState,
  playerId: PlayerId,
  count: number,
): CardInstance[] {
  const player = state.players[playerId];
  const moved: CardInstance[] = [];

  // Move first 'count' cards from hand to top of library (deterministic)
  for (let i = 0; i < count && player.hand.length > 0; i++) {
    const card = player.hand.shift()!; // Take from front for determinism
    card.zone = 'library';
    player.library.unshift(card);
    moved.push(card);
  }

  return moved;
}

/**
 * Discard cards and draw cards
 * Used for: Forget
 */
export function discardThenDraw(
  state: GameState,
  playerId: PlayerId,
  discardCount: number,
  drawCount: number,
): void {
  const player = state.players[playerId];

  // Discard (from front of hand for determinism)
  for (let i = 0; i < discardCount && player.hand.length > 0; i++) {
    const card = player.hand.shift()!;
    card.zone = 'graveyard';
    player.graveyard.push(card);
  }

  // Draw
  for (let i = 0; i < drawCount && player.library.length > 0; i++) {
    const card = player.library.pop()!;
    card.zone = 'hand';
    player.hand.push(card);
  }
}

/**
 * Draw cards then put some back on top of library
 * Used for: Dream Cache
 */
export function drawThenPutBack(
  state: GameState,
  playerId: PlayerId,
  drawCount: number,
  putBackCount: number,
): void {
  const player = state.players[playerId];

  // Draw cards
  for (let i = 0; i < drawCount && player.library.length > 0; i++) {
    const card = player.library.pop()!;
    card.zone = 'hand';
    player.hand.push(card);
  }

  // Put cards back (from front of hand for determinism)
  for (let i = 0; i < putBackCount && player.hand.length > 0; i++) {
    const card = player.hand.shift()!;
    card.zone = 'library';
    player.library.unshift(card);
  }
}

// ============================================================================
// LIFE MANIPULATION
// ============================================================================

/**
 * Drain life from opponents
 * Used for: Syphon Soul
 */
export function drainLife(state: GameState, controller: PlayerId, damagePerOpponent: number): void {
  const opponent = controller === 'player' ? 'opponent' : 'player';

  // Deal damage to opponent
  state.players[opponent].life -= damagePerOpponent;

  // Gain that much life
  state.players[controller].life += damagePerOpponent;

  // Check for game over
  if (state.players[opponent].life <= 0) {
    state.gameOver = true;
    state.winner = controller;
  }
}

/**
 * Draw cards and pay life
 * Used for: Infernal Contract (draw 4, lose half life)
 */
export function drawCardsPayLife(
  state: GameState,
  playerId: PlayerId,
  drawCount: number,
  lifeToLose: number | 'half',
): void {
  const player = state.players[playerId];

  // Draw cards
  for (let i = 0; i < drawCount && player.library.length > 0; i++) {
    const card = player.library.pop()!;
    card.zone = 'hand';
    player.hand.push(card);
  }

  // Lose life
  if (lifeToLose === 'half') {
    player.life = Math.ceil(player.life / 2);
  } else {
    player.life -= lifeToLose;
  }

  // Check for game over
  if (player.life <= 0) {
    state.gameOver = true;
    state.winner = playerId === 'player' ? 'opponent' : 'player';
  }
}

// ============================================================================
// CONDITIONAL DESTRUCTION
// ============================================================================

/**
 * Destroy a creature if it meets a condition
 * Used for: Fatal Blow (damaged), Reprisal (power 4+)
 */
export function destroyCreatureIf(
  state: GameState,
  targetId: string,
  condition: (card: CardInstance, template: CardTemplate) => boolean,
): boolean {
  for (const playerId of ['player', 'opponent'] as const) {
    const player = state.players[playerId];
    const index = player.battlefield.findIndex((c) => c.instanceId === targetId);

    if (index !== -1) {
      const creature = player.battlefield[index]!;
      const template = CardLoader.getById(creature.scryfallId);

      if (!template || !isCreature(template)) return false;

      if (condition(creature, template)) {
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

        return true;
      }
      return false;
    }
  }
  return false;
}

/**
 * Destroy creature if it's damaged
 * Used for: Fatal Blow
 */
export function destroyIfDamaged(state: GameState, targetId: string): boolean {
  return destroyCreatureIf(state, targetId, (card) => card.damage > 0);
}

/**
 * Destroy creature if power is 4 or greater
 * Used for: Reprisal
 */
export function destroyIfPowerFourOrGreater(state: GameState, targetId: string): boolean {
  return destroyCreatureIf(state, targetId, (card, template) => {
    const power = parseInt(template.power || '0', 10);
    return power >= 4;
  });
}

// ============================================================================
// SINGLE TARGET EFFECTS
// ============================================================================

/**
 * Destroy a single permanent by instance ID
 * Used for: Shatter, Stone Rain, targeted removal
 */
export function destroyPermanent(state: GameState, targetId: string): boolean {
  for (const playerId of ['player', 'opponent'] as const) {
    const player = state.players[playerId];
    const index = player.battlefield.findIndex((c) => c.instanceId === targetId);

    if (index !== -1) {
      const permanent = player.battlefield[index]!;
      const template = CardLoader.getById(permanent.scryfallId);

      player.battlefield.splice(index, 1);
      permanent.zone = 'graveyard';
      permanent.damage = 0;
      permanent.tapped = false;
      player.graveyard.push(permanent);

      // Fire death trigger for creatures
      if (template && isCreature(template)) {
        registerTrigger(state, {
          type: 'DIES',
          cardId: permanent.instanceId,
          controller: playerId,
          wasController: playerId,
        });
      }

      return true;
    }
  }
  return false;
}

/**
 * Return a permanent to its owner's hand
 * Used for: Boomerang, Unsummon, bounce effects
 */
export function returnToHand(state: GameState, targetId: string): boolean {
  for (const playerId of ['player', 'opponent'] as const) {
    const player = state.players[playerId];
    const index = player.battlefield.findIndex((c) => c.instanceId === targetId);

    if (index !== -1) {
      const permanent = player.battlefield[index]!;
      player.battlefield.splice(index, 1);
      permanent.zone = 'hand';
      permanent.tapped = false;
      permanent.damage = 0;
      permanent.summoningSick = false;
      // Return to owner's hand (not controller's)
      state.players[permanent.owner].hand.push(permanent);
      return true;
    }
  }
  return false;
}

/**
 * Exile a creature and gain life equal to its toughness
 * Used for: Exile effects with lifegain (Swords to Plowshares style)
 */
export function exileWithLifegain(
  state: GameState,
  targetId: string,
  controller: PlayerId,
): boolean {
  for (const playerId of ['player', 'opponent'] as const) {
    const player = state.players[playerId];
    const index = player.battlefield.findIndex((c) => c.instanceId === targetId);

    if (index !== -1) {
      const creature = player.battlefield[index]!;
      const template = CardLoader.getById(creature.scryfallId);

      // Get toughness for life gain
      const toughness = template?.toughness ? parseInt(template.toughness, 10) : 0;

      // Exile the creature
      player.battlefield.splice(index, 1);
      creature.zone = 'exile' as 'graveyard'; // Note: exile zone not fully implemented

      // Gain life equal to toughness
      state.players[controller].life += toughness;

      return true;
    }
  }
  return false;
}

// ============================================================================
// CARD DRAW AND DISCARD
// ============================================================================

/**
 * Draw cards for a player
 * Used for: Inspiration, Ancestral Recall, draw effects
 */
export function drawCards(state: GameState, playerId: PlayerId, count: number): CardInstance[] {
  const player = state.players[playerId];
  const drawn: CardInstance[] = [];

  for (let i = 0; i < count; i++) {
    if (player.library.length === 0) {
      // Can't draw from empty library
      // Note: Drawing from empty library causes loss (handled by SBAs)
      break;
    }
    const card = player.library.pop()!;
    card.zone = 'hand';
    player.hand.push(card);
    drawn.push(card);
  }

  return drawn;
}

/**
 * Discard cards from a player's hand (random selection)
 * Used for: Mind Rot, discard effects
 */
export function discardCards(state: GameState, playerId: PlayerId, count: number): CardInstance[] {
  const player = state.players[playerId];
  const discarded: CardInstance[] = [];

  for (let i = 0; i < count && player.hand.length > 0; i++) {
    // Random discard for non-deterministic effects
    const index = Math.floor(Math.random() * player.hand.length);
    const card = player.hand.splice(index, 1)[0]!;
    card.zone = 'graveyard';
    player.graveyard.push(card);
    discarded.push(card);
  }

  return discarded;
}

/**
 * Discard specific cards from hand (deterministic - takes from front)
 * Used for deterministic AI training
 */
export function discardCardsDeterministic(
  state: GameState,
  playerId: PlayerId,
  count: number,
): CardInstance[] {
  const player = state.players[playerId];
  const discarded: CardInstance[] = [];

  for (let i = 0; i < count && player.hand.length > 0; i++) {
    const card = player.hand.shift()!;
    card.zone = 'graveyard';
    player.graveyard.push(card);
    discarded.push(card);
  }

  return discarded;
}

// ============================================================================
// DAMAGE EFFECTS
// ============================================================================

/**
 * Apply damage to a target (creature or player)
 * Used for: Lightning Bolt, Shock, direct damage spells
 */
export function applyDamage(state: GameState, targetId: string, damage: number): boolean {
  // Check if target is a player
  if (targetId === 'player' || targetId === 'opponent') {
    state.players[targetId].life -= damage;

    // Check for game over
    if (state.players[targetId].life <= 0) {
      state.gameOver = true;
      state.winner = targetId === 'player' ? 'opponent' : 'player';
    }
    return true;
  }

  // Otherwise, target is a creature
  for (const playerId of ['player', 'opponent'] as const) {
    const player = state.players[playerId];
    const creature = player.battlefield.find((c) => c.instanceId === targetId);

    if (creature) {
      creature.damage += damage;

      // Check if creature should die
      const template = CardLoader.getById(creature.scryfallId);
      if (template?.toughness) {
        const baseToughness = parseInt(template.toughness, 10);
        const effectiveToughness = getEffectiveToughness(creature, baseToughness);
        if (creature.damage >= effectiveToughness) {
          // Creature dies
          const index = player.battlefield.indexOf(creature);
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
      return true;
    }
  }
  return false;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Find a permanent on any player's battlefield by instance ID
 */
export function findPermanentByInstanceId(
  state: GameState,
  instanceId: string,
): CardInstance | null {
  for (const playerId of ['player', 'opponent'] as const) {
    const card = state.players[playerId].battlefield.find((c) => c.instanceId === instanceId);
    if (card) return card;
  }
  return null;
}

/**
 * Find the controller of a permanent by instance ID
 */
export function findPermanentController(state: GameState, instanceId: string): PlayerId | null {
  for (const playerId of ['player', 'opponent'] as const) {
    const card = state.players[playerId].battlefield.find((c) => c.instanceId === instanceId);
    if (card) return playerId;
  }
  return null;
}

/**
 * Gain life for a player
 * Used for: Healing Salve, life gain effects
 */
export function gainLife(state: GameState, playerId: PlayerId, amount: number): void {
  state.players[playerId].life += amount;
}

/**
 * Lose life for a player
 * Used for: Life loss effects (different from damage)
 */
export function loseLife(state: GameState, playerId: PlayerId, amount: number): void {
  state.players[playerId].life -= amount;

  if (state.players[playerId].life <= 0) {
    state.gameOver = true;
    state.winner = playerId === 'player' ? 'opponent' : 'player';
  }
}
