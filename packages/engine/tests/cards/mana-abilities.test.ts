/**
 * Mana Ability Tests
 *
 * Tests for cards with mana abilities (lands and mana dorks).
 * Mana abilities don't use the stack and resolve immediately.
 */

import { describe, test, expect } from 'bun:test';
import { CardLoader, createCardInstance, applyAction, type ActivateAbilityAction } from '../../src/index';
import { setupGameWithMana } from './helpers';
import { getActivatedAbilities } from '../../src/rules/activatedAbilities';

describe('Basic Lands', () => {
  const basicLands = [
    { name: 'Plains', color: 'W' },
    { name: 'Island', color: 'U' },
    { name: 'Swamp', color: 'B' },
    { name: 'Mountain', color: 'R' },
    { name: 'Forest', color: 'G' },
  ];

  for (const { name, color } of basicLands) {
    describe(name, () => {
      test('card exists', () => {
        const card = CardLoader.getByName(name);
        expect(card).toBeDefined();
        expect(card?.type_line).toContain('Basic Land');
      });

      test(`has tap ability for ${color} mana`, () => {
        const land = CardLoader.getByName(name)!;
        const state = setupGameWithMana({});

        const landCard = createCardInstance(land.id, 'player', 'battlefield');
        state.players.player.battlefield.push(landCard);

        const abilities = getActivatedAbilities(landCard, state);
        const manaAbility = abilities.find(a => a.isManaAbility);

        expect(manaAbility).toBeDefined();
        expect(manaAbility!.effect.manaColors).toContain(color);
      });
    });
  }
});

describe('Mana Dorks', () => {
  describe('Llanowar Elves', () => {
    test('card exists with correct stats', () => {
      const card = CardLoader.getByName('Llanowar Elves');
      expect(card).toBeDefined();
      expect(card?.power).toBe('1');
      expect(card?.toughness).toBe('1');
      expect(card?.oracle_text).toContain('{T}: Add {G}');
    });

    test('can tap for green mana when not summoning sick', () => {
      const elves = CardLoader.getByName('Llanowar Elves')!;
      const state = setupGameWithMana({ G: 1 });

      const elvesCard = createCardInstance(elves.id, 'player', 'battlefield');
      elvesCard.summoningSick = false;
      state.players.player.battlefield.push(elvesCard);

      const abilities = getActivatedAbilities(elvesCard, state);
      const manaAbility = abilities.find(a => a.isManaAbility);

      expect(manaAbility).toBeDefined();
      expect(manaAbility!.effect.manaColors).toContain('G');
      expect(manaAbility!.cost.tap).toBe(true);
    });

    test('cannot tap when summoning sick', () => {
      const elves = CardLoader.getByName('Llanowar Elves')!;
      const state = setupGameWithMana({ G: 1 });

      const elvesCard = createCardInstance(elves.id, 'player', 'battlefield');
      elvesCard.summoningSick = true; // Just entered
      state.players.player.battlefield.push(elvesCard);

      const abilities = getActivatedAbilities(elvesCard, state);
      const manaAbility = abilities.find(a => a.isManaAbility);

      expect(manaAbility).toBeDefined();
      // canActivate should return false for summoning sick creature
      expect(manaAbility!.canActivate(state, elvesCard.instanceId, 'player')).toBe(false);
    });
  });

  describe('Birds of Paradise', () => {
    test('card exists with correct stats', () => {
      const card = CardLoader.getByName('Birds of Paradise');
      expect(card).toBeDefined();
      expect(card?.power).toBe('0');
      expect(card?.toughness).toBe('1');
      expect(card?.keywords).toContain('Flying');
    });

    test('can tap for any color mana', () => {
      const birds = CardLoader.getByName('Birds of Paradise')!;
      const state = setupGameWithMana({ G: 1 });

      const birdsCard = createCardInstance(birds.id, 'player', 'battlefield');
      birdsCard.summoningSick = false;
      state.players.player.battlefield.push(birdsCard);

      const abilities = getActivatedAbilities(birdsCard, state);
      const manaAbility = abilities.find(a => a.isManaAbility);

      expect(manaAbility).toBeDefined();
      expect(manaAbility!.effect.manaColors).toContain('W');
      expect(manaAbility!.effect.manaColors).toContain('U');
      expect(manaAbility!.effect.manaColors).toContain('B');
      expect(manaAbility!.effect.manaColors).toContain('R');
      expect(manaAbility!.effect.manaColors).toContain('G');
    });
  });
});

describe('Mana Ability Activation', () => {
  test('tapping a land marks it as tapped', () => {
    const state = setupGameWithMana({ R: 1 });

    const mountain = state.players.player.battlefield.find(c =>
      CardLoader.getById(c.scryfallId)?.name === 'Mountain'
    )!;

    const newState = applyAction(state, {
      type: 'ACTIVATE_ABILITY',
      playerId: 'player',
      payload: {
        sourceId: mountain.instanceId,
        abilityId: mountain.instanceId + '_tap_mana',
        manaColorChoice: 'R',
      },
    } as ActivateAbilityAction);

    const tappedMountain = newState.players.player.battlefield.find(
      c => c.instanceId === mountain.instanceId
    );
    expect(tappedMountain?.tapped).toBe(true);

    // Mana should be in pool (checking it exists)
    expect(newState.players.player.manaPool).toBeDefined();
  });
});
