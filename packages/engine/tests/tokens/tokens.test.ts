/**
 * Token System Tests
 *
 * Week 1.5.1: Token generation framework
 */

import { test, expect, describe, beforeAll } from 'bun:test';
import {
  CardLoader,
  createToken,
  createTokens,
  isTokenCard,
  isTokenType,
  getTokenDefinition,
  TOKEN_REGISTRY,
  putTokensOntoBattlefield,
  removeAllTokensOfType,
  createGameState,
  createCardInstance,
  type GameState,
} from '../../src/index';

beforeAll(() => {
  CardLoader.initialize();
});

// ============================================================
// Token Registry Tests
// ============================================================

describe('Token Registry', () => {
  test('contains all 7 expected token types', () => {
    const expectedTokens = ['serf', 'cat', 'snake', 'wasp', 'citizen', 'djinn', 'goblin'];
    for (const tokenType of expectedTokens) {
      expect(TOKEN_REGISTRY[tokenType]).toBeDefined();
    }
  });

  test('Serf token has correct stats', () => {
    const serf = TOKEN_REGISTRY.serf;
    expect(serf.name).toBe('Serf');
    expect(serf.power).toBe('0');
    expect(serf.toughness).toBe('1');
    expect(serf.colors).toContain('B');
  });

  test('Cat token has correct stats', () => {
    const cat = TOKEN_REGISTRY.cat;
    expect(cat.name).toBe('Cat');
    expect(cat.power).toBe('1');
    expect(cat.toughness).toBe('1');
    expect(cat.colors).toContain('G');
  });

  test('Wasp token has flying', () => {
    const wasp = TOKEN_REGISTRY.wasp;
    expect(wasp.name).toBe('Wasp');
    expect(wasp.keywords).toContain('Flying');
    expect(wasp.colors).toEqual([]);  // Colorless
  });

  test('Djinn token is 5/5 with flying', () => {
    const djinn = TOKEN_REGISTRY.djinn;
    expect(djinn.power).toBe('5');
    expect(djinn.toughness).toBe('5');
    expect(djinn.keywords).toContain('Flying');
  });

  test('getTokenDefinition works', () => {
    const serf = getTokenDefinition('serf');
    expect(serf?.name).toBe('Serf');

    const SERF = getTokenDefinition('SERF');  // Case insensitive
    expect(SERF?.name).toBe('Serf');

    const unknown = getTokenDefinition('unknown');
    expect(unknown).toBeUndefined();
  });
});

// ============================================================
// Token Creation Tests
// ============================================================

describe('Token Creation', () => {
  test('createToken creates a valid token', () => {
    const token = createToken('serf', 'player');

    expect(token.isToken).toBe(true);
    expect(token.tokenType).toBe('Serf');
    expect(token.controller).toBe('player');
    expect(token.owner).toBe('player');
    expect(token.zone).toBe('battlefield');
    expect(token.summoningSick).toBe(true);
    expect(token.tapped).toBe(false);
    expect(token.damage).toBe(0);
  });

  test('createToken sets createdBy', () => {
    const token = createToken('goblin', 'opponent', 'opponent', 'source_123');
    expect(token.createdBy).toBe('source_123');
  });

  test('createToken throws for unknown token type', () => {
    expect(() => createToken('unknown', 'player')).toThrow('Unknown token type: unknown');
  });

  test('createTokens creates multiple tokens', () => {
    const tokens = createTokens('citizen', 4, 'player');

    expect(tokens.length).toBe(4);
    for (const token of tokens) {
      expect(token.isToken).toBe(true);
      expect(token.tokenType).toBe('Citizen');
    }
  });

  test('each token has unique instanceId', () => {
    const tokens = createTokens('snake', 3, 'player');
    const ids = new Set(tokens.map(t => t.instanceId));
    expect(ids.size).toBe(3);
  });
});

// ============================================================
// Token Type Checking Tests
// ============================================================

describe('Token Type Checking', () => {
  test('isTokenCard correctly identifies tokens', () => {
    const token = createToken('serf', 'player');
    expect(isTokenCard(token)).toBe(true);

    // Non-token card
    const plains = CardLoader.getByName('Plains')!;
    const card = createCardInstance(plains.id, 'player', 'battlefield');
    expect(isTokenCard(card)).toBe(false);
  });

  test('isTokenType correctly identifies token types', () => {
    const serf = createToken('serf', 'player');
    expect(isTokenType(serf, 'serf')).toBe(true);
    expect(isTokenType(serf, 'Serf')).toBe(true);  // Case insensitive
    expect(isTokenType(serf, 'goblin')).toBe(false);
  });
});

// ============================================================
// Token Battlefield Integration Tests
// ============================================================

describe('Token Battlefield Integration', () => {
  function createTestState(): GameState {
    const plains = CardLoader.getByName('Plains')!;
    const library = [createCardInstance(plains.id, 'player', 'library')];
    const oppLibrary = [createCardInstance(plains.id, 'opponent', 'library')];
    return createGameState(library, oppLibrary);
  }

  test('putTokensOntoBattlefield adds tokens to battlefield', () => {
    const state = createTestState();
    const tokens = createTokens('goblin', 3, 'player');

    const beforeCount = state.players.player.battlefield.length;
    putTokensOntoBattlefield(state, tokens, 'player');

    expect(state.players.player.battlefield.length).toBe(beforeCount + 3);
  });

  test('removeAllTokensOfType removes matching tokens', () => {
    const state = createTestState();

    // Add some Serf tokens to player
    const serfTokens = createTokens('serf', 3, 'player');
    putTokensOntoBattlefield(state, serfTokens, 'player');

    // Add some Goblin tokens to opponent
    const goblinTokens = createTokens('goblin', 2, 'opponent');
    putTokensOntoBattlefield(state, goblinTokens, 'opponent');

    // Also add a non-Serf token to player
    const catToken = createToken('cat', 'player');
    putTokensOntoBattlefield(state, [catToken], 'player');

    // Remove all Serfs
    const removed = removeAllTokensOfType(state, 'serf');

    expect(removed.length).toBe(3);
    expect(state.players.player.battlefield.filter(c => c.tokenType === 'Serf').length).toBe(0);
    // Cat should still be there
    expect(state.players.player.battlefield.filter(c => c.tokenType === 'Cat').length).toBe(1);
    // Goblins should still be there
    expect(state.players.opponent.battlefield.filter(c => c.tokenType === 'Goblin').length).toBe(2);
  });
});

// ============================================================
// CardLoader Token Integration Tests
// ============================================================

describe('CardLoader Token Integration', () => {
  test('CardLoader can look up token by ID', () => {
    const serf = CardLoader.getById('token_serf');
    expect(serf).toBeDefined();
    expect(serf?.name).toBe('Serf');
    expect(serf?.power).toBe('0');
    expect(serf?.toughness).toBe('1');
  });

  test('CardLoader can look up token by name', () => {
    const wasp = CardLoader.getByName('Wasp');
    expect(wasp).toBeDefined();
    expect(wasp?.keywords).toContain('Flying');
  });

  test('Token from battlefield can be looked up', () => {
    const token = createToken('djinn', 'player');
    const template = CardLoader.getById(token.scryfallId);

    expect(template).toBeDefined();
    expect(template?.name).toBe('Djinn');
    expect(template?.power).toBe('5');
    expect(template?.toughness).toBe('5');
  });
});
