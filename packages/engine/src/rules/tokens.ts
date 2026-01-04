/**
 * Token Creation Helpers
 *
 * Provides functions for creating creature tokens in the game.
 * Used by spell implementations that generate tokens (Icatian Town,
 * Waiting in the Weeds, etc.).
 */

import type { GameState } from '../state/GameState';
import type { CardInstance } from '../state/CardInstance';
import type { PlayerId } from '../state/Zone';
import { registerTrigger } from './triggers';

// =============================================================================
// TOKEN DEFINITIONS
// =============================================================================

/**
 * Token definition for creating standardized tokens
 */
export interface TokenDefinition {
  name: string;
  power: number;
  toughness: number;
  colors: ('W' | 'U' | 'B' | 'R' | 'G')[];
  types: string[];
  subtypes: string[];
  keywords?: string[];
}

/**
 * Pre-defined token types used in 6th Edition
 */
export const TOKEN_DEFINITIONS: Record<string, TokenDefinition> = {
  citizen: {
    name: 'Citizen',
    power: 1,
    toughness: 1,
    colors: ['W'],
    types: ['Creature'],
    subtypes: ['Citizen'],
  },
  cat: {
    name: 'Cat',
    power: 1,
    toughness: 1,
    colors: ['G'],
    types: ['Creature'],
    subtypes: ['Cat'],
  },
  goblin: {
    name: 'Goblin',
    power: 1,
    toughness: 1,
    colors: ['R'],
    types: ['Creature'],
    subtypes: ['Goblin'],
  },
  saproling: {
    name: 'Saproling',
    power: 1,
    toughness: 1,
    colors: ['G'],
    types: ['Creature'],
    subtypes: ['Saproling'],
  },
  soldier: {
    name: 'Soldier',
    power: 1,
    toughness: 1,
    colors: ['W'],
    types: ['Creature'],
    subtypes: ['Soldier'],
  },
  zombie: {
    name: 'Zombie',
    power: 2,
    toughness: 2,
    colors: ['B'],
    types: ['Creature'],
    subtypes: ['Zombie'],
  },
};

// =============================================================================
// TOKEN CREATION FUNCTIONS
// =============================================================================

/**
 * Create tokens for a controller
 *
 * @param state Game state to modify
 * @param controller Player who controls the tokens
 * @param tokenType Type of token to create (key in TOKEN_DEFINITIONS)
 * @param count Number of tokens to create
 * @param options Optional settings for token creation
 * @returns Array of created token instances
 *
 * @example
 * ```typescript
 * // Create 4 Citizen tokens (Icatian Town)
 * createTokens(state, controller, 'citizen', 4);
 *
 * // Create Cat tokens with custom source tracking
 * createTokens(state, controller, 'cat', forestCount, { createdBy: stackObj.card.instanceId });
 * ```
 */
export function createTokens(
  state: GameState,
  controller: PlayerId,
  tokenType: string,
  count: number,
  options: {
    createdBy?: string;
    fireTriggers?: boolean;
    summoningSick?: boolean;
  } = {},
): CardInstance[] {
  const { createdBy, fireTriggers = true, summoningSick = true } = options;
  const player = state.players[controller];
  const definition = TOKEN_DEFINITIONS[tokenType.toLowerCase()];
  const tokens: CardInstance[] = [];

  for (let i = 0; i < count; i++) {
    const token: CardInstance = {
      instanceId: `token_${tokenType}_${Date.now()}_${Math.random()}`,
      scryfallId: `token_${tokenType}`,
      owner: controller,
      controller: controller,
      zone: 'battlefield',
      tapped: false,
      damage: 0,
      counters: {},
      attachments: [],
      temporaryModifications: [],
      summoningSick: summoningSick,
      isToken: true,
      tokenType: definition?.name ?? tokenType,
      createdBy,
    };

    player.battlefield.push(token);
    tokens.push(token);

    // Register ETB trigger
    if (fireTriggers) {
      registerTrigger(state, {
        type: 'ENTERS_BATTLEFIELD',
        cardId: token.instanceId,
        controller: controller,
      });
    }
  }

  return tokens;
}

/**
 * Create a custom token with specified stats
 *
 * For tokens that don't fit pre-defined patterns.
 *
 * @param state Game state to modify
 * @param controller Player who controls the token
 * @param definition Custom token definition
 * @param count Number of tokens to create
 * @param options Optional settings
 * @returns Array of created token instances
 */
export function createCustomTokens(
  state: GameState,
  controller: PlayerId,
  definition: TokenDefinition,
  count: number,
  options: {
    createdBy?: string;
    fireTriggers?: boolean;
    summoningSick?: boolean;
  } = {},
): CardInstance[] {
  const { createdBy, fireTriggers = true, summoningSick = true } = options;
  const player = state.players[controller];
  const tokens: CardInstance[] = [];

  for (let i = 0; i < count; i++) {
    const token: CardInstance = {
      instanceId: `token_${definition.name.toLowerCase()}_${Date.now()}_${Math.random()}`,
      scryfallId: `token_custom_${definition.name.toLowerCase()}`,
      owner: controller,
      controller: controller,
      zone: 'battlefield',
      tapped: false,
      damage: 0,
      counters: {},
      attachments: [],
      temporaryModifications: [],
      summoningSick: summoningSick,
      isToken: true,
      tokenType: definition.name,
      createdBy,
    };

    player.battlefield.push(token);
    tokens.push(token);

    if (fireTriggers) {
      registerTrigger(state, {
        type: 'ENTERS_BATTLEFIELD',
        cardId: token.instanceId,
        controller: controller,
      });
    }
  }

  return tokens;
}

/**
 * Get the power/toughness for a token type
 *
 * Returns [power, toughness] tuple for use in CardLoader-like lookups.
 */
export function getTokenStats(tokenType: string): [number, number] | null {
  const definition = TOKEN_DEFINITIONS[tokenType.toLowerCase()];
  if (!definition) return null;
  return [definition.power, definition.toughness];
}

/**
 * Check if a card is a token
 */
export function isToken(card: CardInstance): boolean {
  return card.isToken === true;
}
