/**
 * Special Lands Tests (Phase 1.5.1)
 *
 * Tests for:
 * - Pain Lands (5): Tap for colorless OR tap for colored + 1 damage
 * - City of Brass: Triggered damage when tapped
 * - Sacrifice Lands (5): Enter tapped, tap/sac for double mana
 * - Crystal Vein: Already implemented, included for completeness
 */

import { test, expect, describe, beforeAll } from 'bun:test';
import {
  CardLoader,
  createCardInstance,
  createGameState,
  applyAction,
  getPlayer,
  getActivatedAbilities,
  type ActivateAbilityAction,
  type PlayLandAction,
  type GameState,
} from '../../src/index';

beforeAll(() => {
  CardLoader.initialize();
});

// Helper to create a test game state
function createTestState(): GameState {
  const plains = CardLoader.getByName('Plains')!;
  const library = [createCardInstance(plains.id, 'player', 'library')];
  const oppLibrary = [createCardInstance(plains.id, 'opponent', 'library')];
  return createGameState(library, oppLibrary);
}

// ============================================================
// Pain Lands Tests
// ============================================================

describe('Pain Lands', () => {
  const painLands = [
    { name: 'Adarkar Wastes', colors: ['W', 'U'] },
    { name: 'Brushland', colors: ['G', 'W'] },
    { name: 'Karplusan Forest', colors: ['R', 'G'] },
    { name: 'Sulfurous Springs', colors: ['B', 'R'] },
    { name: 'Underground River', colors: ['U', 'B'] },
  ];

  for (const { name, colors } of painLands) {
    describe(name, () => {
      test(`${name} exists in card pool`, () => {
        const land = CardLoader.getByName(name);
        expect(land).toBeDefined();
        expect(land?.type_line).toContain('Land');
      });

      test(`${name} has two mana abilities`, () => {
        const land = CardLoader.getByName(name)!;
        const card = createCardInstance(land.id, 'player', 'battlefield');
        const state = createTestState();

        const abilities = getActivatedAbilities(card, state);
        expect(abilities.length).toBe(2);

        // First ability: colorless (no pain)
        expect(abilities[0]!.name).toContain('{C}');
        expect(abilities[0]!.cost.life).toBeUndefined();

        // Second ability: colored with 1 life cost
        expect(abilities[1]!.cost.life).toBe(1);
        expect(abilities[1]!.effect.manaColors).toContain(colors[0]);
        expect(abilities[1]!.effect.manaColors).toContain(colors[1]);
      });

      test(`${name} tap for colorless doesn't deal damage`, () => {
        const land = CardLoader.getByName(name)!;
        const card = createCardInstance(land.id, 'player', 'battlefield');
        let state = createTestState();

        const player = getPlayer(state, 'player');
        player.battlefield.push(card);

        const abilities = getActivatedAbilities(card, state);
        const colorlessAbility = abilities.find((a) => a.name.includes('{C}'))!;

        const action: ActivateAbilityAction = {
          type: 'ACTIVATE_ABILITY',
          playerId: 'player',
          payload: {
            sourceId: card.instanceId,
            abilityId: colorlessAbility.id,
          },
        };

        state = applyAction(state, action);

        // Should add colorless mana and NOT deal damage
        const newPlayer = getPlayer(state, 'player');
        expect(newPlayer.manaPool.colorless).toBe(1);
        expect(newPlayer.life).toBe(20);
      });

      test(`${name} tap for colored deals 1 damage`, () => {
        const land = CardLoader.getByName(name)!;
        const card = createCardInstance(land.id, 'player', 'battlefield');
        let state = createTestState();

        const player = getPlayer(state, 'player');
        player.battlefield.push(card);

        const abilities = getActivatedAbilities(card, state);
        const coloredAbility = abilities.find((a) => a.cost.life === 1)!;

        const action: ActivateAbilityAction = {
          type: 'ACTIVATE_ABILITY',
          playerId: 'player',
          payload: {
            sourceId: card.instanceId,
            abilityId: coloredAbility.id,
            manaColorChoice: colors[0] as any,
          },
        };

        state = applyAction(state, action);

        // Should add colored mana AND deal 1 damage
        const newPlayer = getPlayer(state, 'player');
        expect(newPlayer.life).toBe(19); // 20 - 1 = 19
      });
    });
  }
});

// ============================================================
// City of Brass Tests
// ============================================================

describe('City of Brass', () => {
  test('City of Brass exists in card pool', () => {
    const city = CardLoader.getByName('City of Brass');
    expect(city).toBeDefined();
    expect(city?.type_line).toContain('Land');
  });

  test('City of Brass has mana ability for any color', () => {
    const city = CardLoader.getByName('City of Brass')!;
    const card = createCardInstance(city.id, 'player', 'battlefield');
    const state = createTestState();

    const abilities = getActivatedAbilities(card, state);
    expect(abilities.length).toBe(1);
    expect(abilities[0]!.effect.manaColors).toContain('W');
    expect(abilities[0]!.effect.manaColors).toContain('U');
    expect(abilities[0]!.effect.manaColors).toContain('B');
    expect(abilities[0]!.effect.manaColors).toContain('R');
    expect(abilities[0]!.effect.manaColors).toContain('G');
  });

  test('City of Brass deals damage when tapped for mana', () => {
    const city = CardLoader.getByName('City of Brass')!;
    const card = createCardInstance(city.id, 'player', 'battlefield');
    let state = createTestState();

    const player = getPlayer(state, 'player');
    player.battlefield.push(card);

    const abilities = getActivatedAbilities(card, state);
    const manaAbility = abilities[0]!;

    const action: ActivateAbilityAction = {
      type: 'ACTIVATE_ABILITY',
      playerId: 'player',
      payload: {
        sourceId: card.instanceId,
        abilityId: manaAbility.id,
        manaColorChoice: 'R',
      },
    };

    state = applyAction(state, action);

    // Should deal 1 damage from trigger
    const newPlayer = getPlayer(state, 'player');
    expect(newPlayer.life).toBe(19);
    expect(newPlayer.manaPool.red).toBe(1);
  });

  test('City of Brass triggers when auto-tapped for casting', () => {
    const city = CardLoader.getByName('City of Brass')!;
    const shock = CardLoader.getByName('Shock')!;

    let state = createTestState();
    const player = getPlayer(state, 'player');

    // Put City of Brass on battlefield
    const cityCard = createCardInstance(city.id, 'player', 'battlefield');
    player.battlefield.push(cityCard);

    // Put Shock in hand (costs {R})
    const shockCard = createCardInstance(shock.id, 'player', 'hand');
    player.hand.push(shockCard);

    state.phase = 'main1';
    state.step = 'main';

    // Cast Shock targeting opponent - this should auto-tap City of Brass
    state = applyAction(state, {
      type: 'CAST_SPELL',
      playerId: 'player',
      payload: {
        cardInstanceId: shockCard.instanceId,
        targets: ['opponent'],
      },
    });

    // City of Brass should have dealt 1 damage when it was tapped
    const newPlayer = getPlayer(state, 'player');
    expect(newPlayer.life).toBe(19);
  });
});

// ============================================================
// Sacrifice Lands Tests
// ============================================================

describe('Sacrifice Lands', () => {
  const sacrificeLands = [
    { name: 'Dwarven Ruins', color: 'R', poolKey: 'red' as const },
    { name: 'Ebon Stronghold', color: 'B', poolKey: 'black' as const },
    { name: 'Havenwood Battleground', color: 'G', poolKey: 'green' as const },
    { name: 'Ruins of Trokair', color: 'W', poolKey: 'white' as const },
    { name: 'Svyelunite Temple', color: 'U', poolKey: 'blue' as const },
  ];

  for (const { name, color, poolKey } of sacrificeLands) {
    describe(name, () => {
      test(`${name} exists in card pool`, () => {
        const land = CardLoader.getByName(name);
        expect(land).toBeDefined();
        expect(land?.type_line).toContain('Land');
      });

      test(`${name} enters tapped`, () => {
        const land = CardLoader.getByName(name)!;
        const card = createCardInstance(land.id, 'player', 'hand');
        let state = createTestState();

        const player = getPlayer(state, 'player');
        player.hand.push(card);

        state.phase = 'main1';
        state.step = 'main';

        const action: PlayLandAction = {
          type: 'PLAY_LAND',
          playerId: 'player',
          payload: { cardInstanceId: card.instanceId },
        };

        state = applyAction(state, action);

        // Land should be tapped on battlefield
        const newPlayer = getPlayer(state, 'player');
        const landOnField = newPlayer.battlefield.find((c) => c.instanceId === card.instanceId);
        expect(landOnField).toBeDefined();
        expect(landOnField!.tapped).toBe(true);
      });

      test(`${name} has two mana abilities`, () => {
        const land = CardLoader.getByName(name)!;
        const card = createCardInstance(land.id, 'player', 'battlefield');
        const state = createTestState();

        const abilities = getActivatedAbilities(card, state);
        expect(abilities.length).toBe(2);

        // First ability: tap for single mana
        const tapAbility = abilities.find((a) => !a.cost.sacrifice);
        expect(tapAbility).toBeDefined();
        expect(tapAbility!.effect.amount).toBe(1);
        expect(tapAbility!.effect.manaColors).toContain(color);

        // Second ability: tap + sacrifice for double mana
        const sacAbility = abilities.find((a) => a.cost.sacrifice?.type === 'self');
        expect(sacAbility).toBeDefined();
        expect(sacAbility!.effect.amount).toBe(2);
        expect(sacAbility!.effect.manaColors).toContain(color);
      });

      test(`${name} tap for single mana works`, () => {
        const land = CardLoader.getByName(name)!;
        const card = createCardInstance(land.id, 'player', 'battlefield');
        card.tapped = false; // Manually set untapped for testing
        let state = createTestState();

        const player = getPlayer(state, 'player');
        player.battlefield.push(card);

        const abilities = getActivatedAbilities(card, state);
        const tapAbility = abilities.find((a) => !a.cost.sacrifice)!;

        const action: ActivateAbilityAction = {
          type: 'ACTIVATE_ABILITY',
          playerId: 'player',
          payload: {
            sourceId: card.instanceId,
            abilityId: tapAbility.id,
          },
        };

        state = applyAction(state, action);

        const newPlayer = getPlayer(state, 'player');
        expect(newPlayer.manaPool[poolKey]).toBe(1);
        // Land should still be on battlefield (just tapped)
        expect(newPlayer.battlefield.find((c) => c.instanceId === card.instanceId)).toBeDefined();
      });

      test(`${name} tap + sacrifice for double mana works`, () => {
        const land = CardLoader.getByName(name)!;
        const card = createCardInstance(land.id, 'player', 'battlefield');
        card.tapped = false; // Manually set untapped for testing
        let state = createTestState();

        const player = getPlayer(state, 'player');
        player.battlefield.push(card);

        const abilities = getActivatedAbilities(card, state);
        const sacAbility = abilities.find((a) => a.cost.sacrifice?.type === 'self')!;

        const action: ActivateAbilityAction = {
          type: 'ACTIVATE_ABILITY',
          playerId: 'player',
          payload: {
            sourceId: card.instanceId,
            abilityId: sacAbility.id,
          },
        };

        state = applyAction(state, action);

        const newPlayer = getPlayer(state, 'player');
        expect(newPlayer.manaPool[poolKey]).toBe(2);
        // Land should be in graveyard (sacrificed)
        expect(newPlayer.battlefield.find((c) => c.instanceId === card.instanceId)).toBeUndefined();
        expect(newPlayer.graveyard.find((c) => c.instanceId === card.instanceId)).toBeDefined();
      });
    });
  }
});

// ============================================================
// Crystal Vein Tests (included for completeness)
// ============================================================

describe('Crystal Vein', () => {
  test('Crystal Vein exists in card pool', () => {
    const crystal = CardLoader.getByName('Crystal Vein');
    expect(crystal).toBeDefined();
    expect(crystal?.type_line).toContain('Land');
  });

  test('Crystal Vein has two mana abilities', () => {
    const crystal = CardLoader.getByName('Crystal Vein')!;
    const card = createCardInstance(crystal.id, 'player', 'battlefield');
    const state = createTestState();

    const abilities = getActivatedAbilities(card, state);
    expect(abilities.length).toBe(2);

    // First: tap for {C}
    expect(abilities[0]!.effect.amount).toBe(1);
    expect(abilities[0]!.effect.manaColors).toContain('C');

    // Second: tap + sac for {C}{C}
    expect(abilities[1]!.effect.amount).toBe(2);
    expect(abilities[1]!.cost.sacrifice?.type).toBe('self');
  });

  test('Crystal Vein does NOT enter tapped', () => {
    const crystal = CardLoader.getByName('Crystal Vein')!;
    const card = createCardInstance(crystal.id, 'player', 'hand');
    let state = createTestState();

    const player = getPlayer(state, 'player');
    player.hand.push(card);

    state.phase = 'main1';
    state.step = 'main';

    const action: PlayLandAction = {
      type: 'PLAY_LAND',
      playerId: 'player',
      payload: { cardInstanceId: card.instanceId },
    };

    state = applyAction(state, action);

    // Crystal Vein should NOT be tapped on entry
    const newPlayer = getPlayer(state, 'player');
    const landOnField = newPlayer.battlefield.find((c) => c.instanceId === card.instanceId);
    expect(landOnField).toBeDefined();
    expect(landOnField!.tapped).toBe(false);
  });
});
