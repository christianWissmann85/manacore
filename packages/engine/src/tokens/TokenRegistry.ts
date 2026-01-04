/**
 * Token Registry - Definitions and creation for token creatures
 *
 * Tokens are created by various cards in Magic. Unlike normal cards,
 * tokens don't have Scryfall data - their stats are defined here.
 *
 * Phase 1.5.1: Basic token infrastructure for 6th Edition cards
 */

import type { CardInstance } from '../state/CardInstance';
import type { PlayerId } from '../state/Zone';

/**
 * Token definition - describes a type of token that can be created
 */
export interface TokenDefinition {
  id: string; // Unique token ID (e.g., "token_serf")
  name: string; // Display name (e.g., "Serf")
  type_line: string; // Type line (e.g., "Creature — Serf")
  power: string; // Base power
  toughness: string; // Base toughness
  colors: string[]; // Colors (e.g., ["B"] for black, [] for colorless)
  keywords?: string[]; // Keywords (e.g., ["Flying"])
}

/**
 * Registry of all token types in 6th Edition
 */
export const TOKEN_REGISTRY: Record<string, TokenDefinition> = {
  // Sengir Autocrat creates 0/1 black Serf tokens
  serf: {
    id: 'token_serf',
    name: 'Serf',
    type_line: 'Creature — Serf',
    power: '0',
    toughness: '1',
    colors: ['B'],
  },

  // Waiting in the Weeds creates 1/1 green Cat tokens
  cat: {
    id: 'token_cat',
    name: 'Cat',
    type_line: 'Creature — Cat',
    power: '1',
    toughness: '1',
    colors: ['G'],
  },

  // Snake Basket creates 1/1 green Snake tokens
  snake: {
    id: 'token_snake',
    name: 'Snake',
    type_line: 'Creature — Snake',
    power: '1',
    toughness: '1',
    colors: ['G'],
  },

  // The Hive creates 1/1 colorless Insect tokens with flying
  wasp: {
    id: 'token_wasp',
    name: 'Wasp',
    type_line: 'Creature — Insect',
    power: '1',
    toughness: '1',
    colors: [],
    keywords: ['Flying'],
  },

  // Icatian Town creates 1/1 white Citizen tokens
  citizen: {
    id: 'token_citizen',
    name: 'Citizen',
    type_line: 'Creature — Citizen',
    power: '1',
    toughness: '1',
    colors: ['W'],
  },

  // Bottle of Suleiman creates a 5/5 colorless Djinn token with flying
  djinn: {
    id: 'token_djinn',
    name: 'Djinn',
    type_line: 'Creature — Djinn',
    power: '5',
    toughness: '5',
    colors: [],
    keywords: ['Flying'],
  },

  // Goblin Warrens creates 1/1 red Goblin tokens
  goblin: {
    id: 'token_goblin',
    name: 'Goblin',
    type_line: 'Creature — Goblin',
    power: '1',
    toughness: '1',
    colors: ['R'],
  },
};

/**
 * Get a token definition by type name
 */
export function getTokenDefinition(tokenType: string): TokenDefinition | undefined {
  return TOKEN_REGISTRY[tokenType.toLowerCase()];
}

/**
 * Check if a card is a token
 */
export function isTokenCard(card: CardInstance): boolean {
  return card.isToken === true;
}

/**
 * Check if a card is a specific token type
 */
export function isTokenType(card: CardInstance, tokenType: string): boolean {
  return card.isToken === true && card.tokenType?.toLowerCase() === tokenType.toLowerCase();
}

/**
 * Instance counter for unique token IDs
 */
let tokenInstanceCounter = 0;

/**
 * Create a token instance
 *
 * @param tokenType - Type of token to create (e.g., "serf", "cat", "goblin")
 * @param owner - Player who owns the token
 * @param controller - Player who controls the token (usually same as owner)
 * @param createdBy - Instance ID of the card that created this token
 * @returns A new CardInstance representing the token on the battlefield
 */
export function createToken(
  tokenType: string,
  owner: PlayerId,
  controller: PlayerId = owner,
  createdBy?: string,
): CardInstance {
  const definition = getTokenDefinition(tokenType);

  if (!definition) {
    throw new Error(`Unknown token type: ${tokenType}`);
  }

  const token: CardInstance = {
    instanceId: `token_${Date.now()}_${tokenInstanceCounter++}`,
    scryfallId: definition.id, // Synthetic ID for token lookup
    controller,
    owner,
    zone: 'battlefield',
    tapped: false,
    summoningSick: true, // Tokens have summoning sickness
    damage: 0,
    counters: {},
    temporaryModifications: [],
    attachments: [],
    // Token-specific fields
    isToken: true,
    tokenType: definition.name,
    createdBy,
  };

  return token;
}

/**
 * Create multiple tokens of the same type
 *
 * @param tokenType - Type of token to create
 * @param count - Number of tokens to create
 * @param owner - Player who owns the tokens
 * @param controller - Player who controls the tokens
 * @param createdBy - Instance ID of the source card
 * @returns Array of new token CardInstances
 */
export function createTokens(
  tokenType: string,
  count: number,
  owner: PlayerId,
  controller: PlayerId = owner,
  createdBy?: string,
): CardInstance[] {
  const tokens: CardInstance[] = [];

  for (let i = 0; i < count; i++) {
    tokens.push(createToken(tokenType, owner, controller, createdBy));
  }

  return tokens;
}

/**
 * Put tokens onto the battlefield for a player
 */
export function putTokensOntoBattlefield(
  state: { players: Record<PlayerId, { battlefield: CardInstance[] }> },
  tokens: CardInstance[],
  controller: PlayerId,
): void {
  for (const token of tokens) {
    state.players[controller].battlefield.push(token);
  }
}

/**
 * Remove all tokens of a specific type from the battlefield
 * (Used for "exile all X tokens" effects like Sengir Autocrat)
 */
export function removeAllTokensOfType(
  state: { players: Record<PlayerId, { battlefield: CardInstance[]; graveyard: CardInstance[] }> },
  tokenType: string,
  destination: 'exile' | 'graveyard' = 'exile',
): CardInstance[] {
  const removedTokens: CardInstance[] = [];

  for (const playerId of ['player', 'opponent'] as const) {
    const player = state.players[playerId];
    const tokensToRemove: CardInstance[] = [];

    // Find tokens to remove
    for (const card of player.battlefield) {
      if (isTokenType(card, tokenType)) {
        tokensToRemove.push(card);
      }
    }

    // Remove them from battlefield
    for (const token of tokensToRemove) {
      const index = player.battlefield.indexOf(token);
      if (index !== -1) {
        player.battlefield.splice(index, 1);
        token.zone = destination === 'exile' ? 'exile' : 'graveyard';
        // Tokens that go to graveyard cease to exist (but we track for triggers)
        removedTokens.push(token);
      }
    }
  }

  return removedTokens;
}

/**
 * Remove all tokens created by a specific source card
 * (Used for cleanup when source leaves battlefield)
 */
export function removeTokensCreatedBy(
  state: { players: Record<PlayerId, { battlefield: CardInstance[] }> },
  sourceId: string,
): CardInstance[] {
  const removedTokens: CardInstance[] = [];

  for (const playerId of ['player', 'opponent'] as const) {
    const player = state.players[playerId];
    const tokensToRemove: CardInstance[] = [];

    // Find tokens created by the source
    for (const card of player.battlefield) {
      if (card.isToken && card.createdBy === sourceId) {
        tokensToRemove.push(card);
      }
    }

    // Remove them
    for (const token of tokensToRemove) {
      const index = player.battlefield.indexOf(token);
      if (index !== -1) {
        player.battlefield.splice(index, 1);
        token.zone = 'exile';
        removedTokens.push(token);
      }
    }
  }

  return removedTokens;
}
