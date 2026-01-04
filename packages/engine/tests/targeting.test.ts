/**
 * Targeting System Tests
 *
 * Tests for:
 * - Oracle text parsing
 * - Target validation
 * - Legal target generation
 * - Hexproof/Shroud/Protection
 * - Spell fizzle
 */

import { test, expect, describe, beforeAll } from 'bun:test';
import {
  parseTargetRequirements,
  validateTargets,
  getLegalTargets,
  getAllLegalTargetCombinations,
  shouldSpellFizzle,
  hasHexproof,
  hasShroud,
  hasProtectionFrom,
  requiresTargets,
} from '../src/rules/targeting';
import { CardLoader } from '../src/cards/CardLoader';
import { createGameState, getPlayer, findCard } from '../src/state/GameState';
import { createCardInstance } from '../src/state/CardInstance';
import { applyAction } from '../src/actions/reducer';
import { getLegalActions, describeAction } from '../src/actions/getLegalActions';
import type { CastSpellAction, PassPriorityAction } from '../src/actions/Action';

// Ensure cards are loaded
beforeAll(() => {
  CardLoader.initialize();
});

describe('Oracle Text Parsing', () => {
  test('parses "any target" from Lightning Bolt', () => {
    const oracleText = 'Lightning Bolt deals 3 damage to any target.';
    const requirements = parseTargetRequirements(oracleText);

    expect(requirements.length).toBe(1);
    expect(requirements[0]!.targetType).toBe('any');
    expect(requirements[0]!.count).toBe(1);
  });

  test('parses "target creature" from Terror', () => {
    const oracleText = 'Destroy target nonartifact, nonblack creature.';
    const requirements = parseTargetRequirements(oracleText);

    expect(requirements.length).toBe(1);
    expect(requirements[0]!.targetType).toBe('creature');
    // Check for restrictions
    expect(requirements[0]!.restrictions.some(r => r.type === 'nonartifact')).toBe(true);
    expect(requirements[0]!.restrictions.some(r => r.type === 'color' && r.color === 'B' && r.negated)).toBe(true);
  });

  test('parses "target spell" from Counterspell', () => {
    const oracleText = 'Counter target spell.';
    const requirements = parseTargetRequirements(oracleText);

    expect(requirements.length).toBe(1);
    expect(requirements[0]!.targetType).toBe('spell');
    expect(requirements[0]!.zone).toBe('stack');
  });

  test('parses "target creature spell" from Remove Soul', () => {
    const oracleText = 'Counter target creature spell.';
    const requirements = parseTargetRequirements(oracleText);

    expect(requirements.length).toBe(1);
    expect(requirements[0]!.targetType).toBe('creature_spell');
    expect(requirements[0]!.zone).toBe('stack');
  });

  test('parses "target artifact or enchantment" from Disenchant', () => {
    const oracleText = 'Destroy target artifact or enchantment.';
    const requirements = parseTargetRequirements(oracleText);

    expect(requirements.length).toBe(1);
    expect(requirements[0]!.targetType).toBe('artifact_or_enchantment');
  });

  test('parses "target permanent" from Boomerang', () => {
    const oracleText = 'Return target permanent to its owner\'s hand.';
    const requirements = parseTargetRequirements(oracleText);

    expect(requirements.length).toBe(1);
    expect(requirements[0]!.targetType).toBe('permanent');
  });

  test('returns empty for spells without targets', () => {
    const oracleText = 'Draw three cards.';
    const requirements = parseTargetRequirements(oracleText);

    expect(requirements.length).toBe(0);
  });

  test('requiresTargets helper works correctly', () => {
    expect(requiresTargets('Lightning Bolt deals 3 damage to any target.')).toBe(true);
    expect(requiresTargets('Draw three cards.')).toBe(false);
    expect(requiresTargets(undefined)).toBe(false);
  });
});

describe('Target Validation', () => {
  test('validates player as legal target for "any target"', () => {
    const mountain = CardLoader.getByName('Mountain');
    const playerLibrary = [createCardInstance(mountain!.id, 'player', 'library')];
    const opponentLibrary = [createCardInstance(mountain!.id, 'opponent', 'library')];
    const state = createGameState(playerLibrary, opponentLibrary);

    const requirements = parseTargetRequirements('Lightning Bolt deals 3 damage to any target.');
    const errors = validateTargets(state, ['opponent'], requirements, 'player');

    expect(errors.length).toBe(0);
  });

  test('rejects creature target for player-only requirement', () => {
    const mountain = CardLoader.getByName('Mountain');
    const bear = CardLoader.getByName('Grizzly Bears');

    const playerLibrary = [createCardInstance(mountain!.id, 'player', 'library')];
    const opponentLibrary = [createCardInstance(mountain!.id, 'opponent', 'library')];
    const state = createGameState(playerLibrary, opponentLibrary);

    // Add a creature to target
    const bearCard = createCardInstance(bear!.id, 'opponent', 'battlefield');
    state.players.opponent.battlefield.push(bearCard);

    // Try to target the creature with a "target player" spell
    const requirements = parseTargetRequirements('Target player draws a card.');
    const errors = validateTargets(state, [bearCard.instanceId], requirements, 'player');

    expect(errors.length).toBeGreaterThan(0);
  });

  test('rejects black creature for "nonblack creature" requirement', () => {
    const mountain = CardLoader.getByName('Mountain');
    const specter = CardLoader.getByName('Abyssal Specter'); // Black creature in 6th Edition

    const playerLibrary = [createCardInstance(mountain!.id, 'player', 'library')];
    const opponentLibrary = [createCardInstance(mountain!.id, 'opponent', 'library')];
    const state = createGameState(playerLibrary, opponentLibrary);

    // Add black creature
    const specterCard = createCardInstance(specter!.id, 'opponent', 'battlefield');
    state.players.opponent.battlefield.push(specterCard);

    const requirements = parseTargetRequirements('Destroy target nonblack creature.');
    const errors = validateTargets(state, [specterCard.instanceId], requirements, 'player');

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('black');
  });

  test('rejects when wrong number of targets provided', () => {
    const mountain = CardLoader.getByName('Mountain');
    const playerLibrary = [createCardInstance(mountain!.id, 'player', 'library')];
    const opponentLibrary = [createCardInstance(mountain!.id, 'opponent', 'library')];
    const state = createGameState(playerLibrary, opponentLibrary);

    const requirements = parseTargetRequirements('Lightning Bolt deals 3 damage to any target.');

    // No targets when 1 is required
    const errors = validateTargets(state, [], requirements, 'player');
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('Legal Target Generation', () => {
  test('generates player targets for "any target"', () => {
    const mountain = CardLoader.getByName('Mountain');
    const playerLibrary = [createCardInstance(mountain!.id, 'player', 'library')];
    const opponentLibrary = [createCardInstance(mountain!.id, 'opponent', 'library')];
    const state = createGameState(playerLibrary, opponentLibrary);

    const requirements = parseTargetRequirements('Lightning Bolt deals 3 damage to any target.');
    const targets = getLegalTargets(state, requirements[0]!, 'player');

    expect(targets).toContain('player');
    expect(targets).toContain('opponent');
  });

  test('generates creature targets for "any target"', () => {
    const mountain = CardLoader.getByName('Mountain');
    const bear = CardLoader.getByName('Grizzly Bears');

    const playerLibrary = [createCardInstance(mountain!.id, 'player', 'library')];
    const opponentLibrary = [createCardInstance(mountain!.id, 'opponent', 'library')];
    const state = createGameState(playerLibrary, opponentLibrary);

    // Add a creature
    const bearCard = createCardInstance(bear!.id, 'opponent', 'battlefield');
    state.players.opponent.battlefield.push(bearCard);

    const requirements = parseTargetRequirements('Lightning Bolt deals 3 damage to any target.');
    const targets = getLegalTargets(state, requirements[0]!, 'player');

    expect(targets).toContain(bearCard.instanceId);
  });

  test('generates all valid combinations', () => {
    const mountain = CardLoader.getByName('Mountain');
    const playerLibrary = [createCardInstance(mountain!.id, 'player', 'library')];
    const opponentLibrary = [createCardInstance(mountain!.id, 'opponent', 'library')];
    const state = createGameState(playerLibrary, opponentLibrary);

    const requirements = parseTargetRequirements('Lightning Bolt deals 3 damage to any target.');
    const combinations = getAllLegalTargetCombinations(state, requirements, 'player');

    // Should have at least player and opponent
    expect(combinations.length).toBeGreaterThanOrEqual(2);
    expect(combinations.some(c => c[0] === 'player')).toBe(true);
    expect(combinations.some(c => c[0] === 'opponent')).toBe(true);
  });
});

describe('Protection/Hexproof/Shroud', () => {
  test('blocks targeting with hexproof (from opponent)', () => {
    // Note: 6th Edition doesn't have hexproof, so we test the function directly
    const cardWithHexproof = {
      id: 'test',
      name: 'Test Creature',
      type_line: 'Creature',
      keywords: ['Hexproof'],
      colors: [],
      color_identity: [],
      cmc: 0,
      rarity: 'common',
      set: 'test',
      collector_number: '1',
      image_filename: '',
      rulings_uri: '',
    };

    expect(hasHexproof(cardWithHexproof)).toBe(true);
  });

  test('blocks all targeting with shroud', () => {
    const cardWithShroud = {
      id: 'test',
      name: 'Test Creature',
      type_line: 'Creature',
      keywords: ['Shroud'],
      colors: [],
      color_identity: [],
      cmc: 0,
      rarity: 'common',
      set: 'test',
      collector_number: '1',
      image_filename: '',
      rulings_uri: '',
    };

    expect(hasShroud(cardWithShroud)).toBe(true);
  });

  test('checks protection from color', () => {
    const cardWithProtection = {
      id: 'test',
      name: 'Test Creature',
      type_line: 'Creature',
      oracle_text: 'Protection from black',
      keywords: [],
      colors: ['W'],
      color_identity: ['W'],
      cmc: 2,
      rarity: 'common',
      set: 'test',
      collector_number: '1',
      image_filename: '',
      rulings_uri: '',
    };

    expect(hasProtectionFrom(cardWithProtection, 'B')).toBe(true);
    expect(hasProtectionFrom(cardWithProtection, 'R')).toBe(false);
  });
});

describe('Spell Fizzle', () => {
  test('spell does not fizzle with valid target', () => {
    const mountain = CardLoader.getByName('Mountain');
    const bear = CardLoader.getByName('Grizzly Bears');

    const playerLibrary = [createCardInstance(mountain!.id, 'player', 'library')];
    const opponentLibrary = [createCardInstance(mountain!.id, 'opponent', 'library')];
    const state = createGameState(playerLibrary, opponentLibrary);

    // Add a creature
    const bearCard = createCardInstance(bear!.id, 'opponent', 'battlefield');
    state.players.opponent.battlefield.push(bearCard);

    const requirements = parseTargetRequirements('Lightning Bolt deals 3 damage to any target.');
    const fizzles = shouldSpellFizzle(state, [bearCard.instanceId], requirements, 'player');

    expect(fizzles).toBe(false);
  });

  test('spell fizzles when target leaves battlefield', () => {
    const mountain = CardLoader.getByName('Mountain');
    const bear = CardLoader.getByName('Grizzly Bears');

    const playerLibrary = [createCardInstance(mountain!.id, 'player', 'library')];
    const opponentLibrary = [createCardInstance(mountain!.id, 'opponent', 'library')];
    const state = createGameState(playerLibrary, opponentLibrary);

    // The creature WAS on battlefield but is now gone
    const bearCard = createCardInstance(bear!.id, 'opponent', 'graveyard');
    state.players.opponent.graveyard.push(bearCard);

    const requirements = parseTargetRequirements('Lightning Bolt deals 3 damage to any target.');
    const fizzles = shouldSpellFizzle(state, [bearCard.instanceId], requirements, 'player');

    expect(fizzles).toBe(true);
  });

  test('spell targeting player never fizzles', () => {
    const mountain = CardLoader.getByName('Mountain');
    const playerLibrary = [createCardInstance(mountain!.id, 'player', 'library')];
    const opponentLibrary = [createCardInstance(mountain!.id, 'opponent', 'library')];
    const state = createGameState(playerLibrary, opponentLibrary);

    const requirements = parseTargetRequirements('Lightning Bolt deals 3 damage to any target.');
    const fizzles = shouldSpellFizzle(state, ['opponent'], requirements, 'player');

    expect(fizzles).toBe(false);
  });
});

describe('Legal Actions with Targets', () => {
  test('generates targeted spell actions', () => {
    const shock = CardLoader.getByName('Shock'); // 6th Edition equivalent of Lightning Bolt
    const mountain = CardLoader.getByName('Mountain');

    const shockCard = createCardInstance(shock!.id, 'player', 'hand');
    const playerLibrary = [createCardInstance(mountain!.id, 'player', 'library')];
    const opponentLibrary = [createCardInstance(mountain!.id, 'opponent', 'library')];

    let state = createGameState(playerLibrary, opponentLibrary);
    state.players.player.hand.push(shockCard);

    // Add mana source
    const mountainCard = createCardInstance(mountain!.id, 'player', 'battlefield');
    state.players.player.battlefield.push(mountainCard);

    // Tap mountain for mana
    state.players.player.manaPool.red = 1;

    state.phase = 'main1';

    // Get legal actions - should include Shock targeting both players
    const actions = getLegalActions(state, 'player');

    // Find cast actions for Shock
    const shockActions = actions.filter(
      a => a.type === 'CAST_SPELL' && (a as CastSpellAction).payload.cardInstanceId === shockCard.instanceId
    ) as CastSpellAction[];

    expect(shockActions.length).toBeGreaterThan(0);

    // Should have one action for targeting player and one for opponent
    const targetsPlayer = shockActions.some(a => a.payload.targets?.includes('player'));
    const targetsOpponent = shockActions.some(a => a.payload.targets?.includes('opponent'));

    expect(targetsPlayer).toBe(true);
    expect(targetsOpponent).toBe(true);
  });

  test('describeAction shows target names', () => {
    const shock = CardLoader.getByName('Shock'); // 6th Edition equivalent of Lightning Bolt
    const mountain = CardLoader.getByName('Mountain');
    const bear = CardLoader.getByName('Grizzly Bears');

    const shockCard = createCardInstance(shock!.id, 'player', 'hand');
    const playerLibrary = [createCardInstance(mountain!.id, 'player', 'library')];
    const opponentLibrary = [createCardInstance(mountain!.id, 'opponent', 'library')];

    let state = createGameState(playerLibrary, opponentLibrary);
    state.players.player.hand.push(shockCard);

    // Add a creature target
    const bearCard = createCardInstance(bear!.id, 'opponent', 'battlefield');
    state.players.opponent.battlefield.push(bearCard);

    const action: CastSpellAction = {
      type: 'CAST_SPELL',
      playerId: 'player',
      payload: {
        cardInstanceId: shockCard.instanceId,
        targets: [bearCard.instanceId],
      },
    };

    const description = describeAction(action, state);
    expect(description).toContain('Shock');
    expect(description).toContain('targeting');
    expect(description).toContain('Grizzly Bears');
  });
});
