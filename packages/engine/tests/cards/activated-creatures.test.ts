/**
 * Activated Ability Creatures Tests - Phase 1.5.4
 *
 * Tests for creatures with activated abilities.
 * Categories:
 * - Tap to deal damage
 * - Tap to buff
 * - Pump abilities (no tap)
 * - Tap/untap abilities
 * - Flying granting
 * - Damage prevention
 * - Sacrifice abilities
 * - Life payment abilities
 */

import { describe, test, expect } from 'bun:test';
import { CardLoader, createCardInstance } from '../../src/index';
import { setupGameWithMana } from './helpers';
import { getActivatedAbilities } from '../../src/rules/activatedAbilities';

// ==========================================
// TAP TO DEAL DAMAGE
// ==========================================

describe('Tap to Deal Damage Creatures', () => {
  describe('Orcish Artillery', () => {
    test('card exists with correct stats', () => {
      const card = CardLoader.getByName('Orcish Artillery');
      expect(card).toBeDefined();
      expect(card?.power).toBe('1');
      expect(card?.toughness).toBe('3');
      expect(card?.oracle_text).toContain('2 damage to any target');
    });

    test('has tap damage ability', () => {
      const artillery = CardLoader.getByName('Orcish Artillery')!;
      const state = setupGameWithMana({});

      const artilleryCard = createCardInstance(artillery.id, 'player', 'battlefield');
      artilleryCard.summoningSick = false;
      state.players.player.battlefield.push(artilleryCard);

      const abilities = getActivatedAbilities(artilleryCard, state);
      expect(abilities.length).toBeGreaterThanOrEqual(1);

      const damageAbility = abilities.find(a => a.id.includes('tap_damage'));
      expect(damageAbility).toBeDefined();
      expect(damageAbility!.cost.tap).toBe(true);
    });

    test('cannot activate when tapped', () => {
      const artillery = CardLoader.getByName('Orcish Artillery')!;
      const state = setupGameWithMana({});

      const artilleryCard = createCardInstance(artillery.id, 'player', 'battlefield');
      artilleryCard.summoningSick = false;
      artilleryCard.tapped = true;
      state.players.player.battlefield.push(artilleryCard);

      const abilities = getActivatedAbilities(artilleryCard, state);
      const damageAbility = abilities.find(a => a.id.includes('tap_damage'));

      expect(damageAbility!.canActivate(state, artilleryCard.instanceId, 'player')).toBe(false);
    });

    test('cannot activate when summoning sick', () => {
      const artillery = CardLoader.getByName('Orcish Artillery')!;
      const state = setupGameWithMana({});

      const artilleryCard = createCardInstance(artillery.id, 'player', 'battlefield');
      artilleryCard.summoningSick = true;
      state.players.player.battlefield.push(artilleryCard);

      const abilities = getActivatedAbilities(artilleryCard, state);
      const damageAbility = abilities.find(a => a.id.includes('tap_damage'));

      expect(damageAbility!.canActivate(state, artilleryCard.instanceId, 'player')).toBe(false);
    });
  });

  describe('Heavy Ballista', () => {
    test('card exists with correct stats', () => {
      const card = CardLoader.getByName('Heavy Ballista');
      expect(card).toBeDefined();
      expect(card?.power).toBe('2');
      expect(card?.toughness).toBe('3');
      expect(card?.oracle_text).toContain('attacking or blocking creature');
    });

    test('has tap damage ability targeting attackers/blockers', () => {
      const ballista = CardLoader.getByName('Heavy Ballista')!;
      const state = setupGameWithMana({});

      const ballistaCard = createCardInstance(ballista.id, 'player', 'battlefield');
      ballistaCard.summoningSick = false;
      state.players.player.battlefield.push(ballistaCard);

      const abilities = getActivatedAbilities(ballistaCard, state);
      const damageAbility = abilities.find(a => a.id.includes('tap_damage'));

      expect(damageAbility).toBeDefined();
      expect(damageAbility!.cost.tap).toBe(true);
      expect(damageAbility!.targetRequirements![0].restrictions).toContain('attacking_or_blocking');
    });
  });

  describe("D'Avenant Archer", () => {
    test('card exists with correct stats', () => {
      const card = CardLoader.getByName("D'Avenant Archer");
      expect(card).toBeDefined();
      expect(card?.power).toBe('1');
      expect(card?.toughness).toBe('2');
    });

    test('has tap for 1 damage ability', () => {
      const archer = CardLoader.getByName("D'Avenant Archer")!;
      const state = setupGameWithMana({});

      const archerCard = createCardInstance(archer.id, 'player', 'battlefield');
      archerCard.summoningSick = false;
      state.players.player.battlefield.push(archerCard);

      const abilities = getActivatedAbilities(archerCard, state);
      const damageAbility = abilities.find(a => a.id.includes('tap_damage'));

      expect(damageAbility).toBeDefined();
      expect(damageAbility!.effect.amount).toBe(1);
    });
  });

  describe('Femeref Archers', () => {
    test('card exists with correct stats', () => {
      const card = CardLoader.getByName('Femeref Archers');
      expect(card).toBeDefined();
      expect(card?.power).toBe('2');
      expect(card?.toughness).toBe('2');
    });

    test('has tap for 4 damage to attacking flyer', () => {
      const archers = CardLoader.getByName('Femeref Archers')!;
      const state = setupGameWithMana({});

      const archersCard = createCardInstance(archers.id, 'player', 'battlefield');
      archersCard.summoningSick = false;
      state.players.player.battlefield.push(archersCard);

      const abilities = getActivatedAbilities(archersCard, state);
      const damageAbility = abilities.find(a => a.id.includes('tap_damage'));

      expect(damageAbility).toBeDefined();
      expect(damageAbility!.effect.amount).toBe(4);
      expect(damageAbility!.targetRequirements![0].restrictions).toContain('attacking');
      expect(damageAbility!.targetRequirements![0].restrictions).toContain('flying');
    });
  });

  describe('Reckless Embermage', () => {
    test('card exists with correct stats', () => {
      const card = CardLoader.getByName('Reckless Embermage');
      expect(card).toBeDefined();
      expect(card?.power).toBe('2');
      expect(card?.toughness).toBe('2');
    });

    test('has mana-activated damage ability', () => {
      const mage = CardLoader.getByName('Reckless Embermage')!;
      const state = setupGameWithMana({ R: 2 });

      const mageCard = createCardInstance(mage.id, 'player', 'battlefield');
      state.players.player.battlefield.push(mageCard);

      const abilities = getActivatedAbilities(mageCard, state);
      const damageAbility = abilities.find(a => a.id.includes('damage'));

      expect(damageAbility).toBeDefined();
      expect(damageAbility!.cost.mana).toBe('{1}{R}');
      expect(damageAbility!.cost.tap).toBeUndefined();
    });
  });
});

// ==========================================
// TAP TO BUFF
// ==========================================

describe('Tap to Buff Creatures', () => {
  describe('Infantry Veteran', () => {
    test('card exists with correct stats', () => {
      const card = CardLoader.getByName('Infantry Veteran');
      expect(card).toBeDefined();
      expect(card?.power).toBe('1');
      expect(card?.toughness).toBe('1');
    });

    test('has tap buff ability for attacking creatures', () => {
      const veteran = CardLoader.getByName('Infantry Veteran')!;
      const state = setupGameWithMana({});

      const veteranCard = createCardInstance(veteran.id, 'player', 'battlefield');
      veteranCard.summoningSick = false;
      state.players.player.battlefield.push(veteranCard);

      const abilities = getActivatedAbilities(veteranCard, state);
      const buffAbility = abilities.find(a => a.id.includes('tap_buff'));

      expect(buffAbility).toBeDefined();
      expect(buffAbility!.cost.tap).toBe(true);
      expect(buffAbility!.targetRequirements![0].restrictions).toContain('attacking');
    });
  });

  describe('Wyluli Wolf', () => {
    test('card exists with correct stats', () => {
      const card = CardLoader.getByName('Wyluli Wolf');
      expect(card).toBeDefined();
      expect(card?.power).toBe('1');
      expect(card?.toughness).toBe('1');
    });

    test('has tap buff ability for any creature', () => {
      const wolf = CardLoader.getByName('Wyluli Wolf')!;
      const state = setupGameWithMana({});

      const wolfCard = createCardInstance(wolf.id, 'player', 'battlefield');
      wolfCard.summoningSick = false;
      state.players.player.battlefield.push(wolfCard);

      const abilities = getActivatedAbilities(wolfCard, state);
      const buffAbility = abilities.find(a => a.id.includes('tap_buff'));

      expect(buffAbility).toBeDefined();
      expect(buffAbility!.cost.tap).toBe(true);
      expect(buffAbility!.targetRequirements![0].restrictions).toEqual([]);
    });
  });

  describe('Pradesh Gypsies', () => {
    test('card exists with correct stats', () => {
      const card = CardLoader.getByName('Pradesh Gypsies');
      expect(card).toBeDefined();
      expect(card?.power).toBe('1');
      expect(card?.toughness).toBe('1');
    });

    test('has tap debuff ability with mana cost', () => {
      const gypsies = CardLoader.getByName('Pradesh Gypsies')!;
      const state = setupGameWithMana({ G: 2 });

      const gypsiesCard = createCardInstance(gypsies.id, 'player', 'battlefield');
      gypsiesCard.summoningSick = false;
      state.players.player.battlefield.push(gypsiesCard);

      const abilities = getActivatedAbilities(gypsiesCard, state);
      const debuffAbility = abilities.find(a => a.id.includes('tap_debuff'));

      expect(debuffAbility).toBeDefined();
      expect(debuffAbility!.cost.tap).toBe(true);
      expect(debuffAbility!.cost.mana).toBe('{1}{G}');
    });
  });
});

// ==========================================
// PUMP ABILITIES (NO TAP)
// ==========================================

describe('Pump Ability Creatures', () => {
  describe('Flame Spirit', () => {
    test('card exists with correct stats', () => {
      const card = CardLoader.getByName('Flame Spirit');
      expect(card).toBeDefined();
      expect(card?.power).toBe('2');
      expect(card?.toughness).toBe('3');
    });

    test('has pump ability for red mana', () => {
      const spirit = CardLoader.getByName('Flame Spirit')!;
      const state = setupGameWithMana({ R: 3 });

      const spiritCard = createCardInstance(spirit.id, 'player', 'battlefield');
      state.players.player.battlefield.push(spiritCard);

      const abilities = getActivatedAbilities(spiritCard, state);
      const pumpAbility = abilities.find(a => a.id.includes('pump'));

      expect(pumpAbility).toBeDefined();
      expect(pumpAbility!.cost.mana).toBe('{R}');
      expect(pumpAbility!.cost.tap).toBeUndefined();
    });

    test('pump ability applies modifier', () => {
      const spirit = CardLoader.getByName('Flame Spirit')!;
      const state = setupGameWithMana({ R: 3 });

      const spiritCard = createCardInstance(spirit.id, 'player', 'battlefield');
      state.players.player.battlefield.push(spiritCard);

      const abilities = getActivatedAbilities(spiritCard, state);
      const pumpAbility = abilities.find(a => a.id.includes('pump'));

      // Execute the custom effect
      pumpAbility!.effect.custom!(state);

      expect(spiritCard.temporaryModifications.length).toBe(1);
      expect(spiritCard.temporaryModifications[0].powerChange).toBe(1);
      expect(spiritCard.temporaryModifications[0].toughnessChange).toBe(0);
    });
  });

  describe('Dragon Engine', () => {
    test('card exists with correct stats', () => {
      const card = CardLoader.getByName('Dragon Engine');
      expect(card).toBeDefined();
      expect(card?.power).toBe('1');
      expect(card?.toughness).toBe('3');
    });

    test('has pump ability for generic mana', () => {
      const engine = CardLoader.getByName('Dragon Engine')!;
      const state = setupGameWithMana({ W: 4 }); // Generic mana from any source

      const engineCard = createCardInstance(engine.id, 'player', 'battlefield');
      state.players.player.battlefield.push(engineCard);

      const abilities = getActivatedAbilities(engineCard, state);
      const pumpAbility = abilities.find(a => a.id.includes('pump'));

      expect(pumpAbility).toBeDefined();
      expect(pumpAbility!.cost.mana).toBe('{2}');
    });
  });

  describe('Pearl Dragon', () => {
    test('card exists with correct stats', () => {
      const card = CardLoader.getByName('Pearl Dragon');
      expect(card).toBeDefined();
      expect(card?.power).toBe('4');
      expect(card?.toughness).toBe('4');
      expect(card?.keywords).toContain('Flying');
    });

    test('has toughness pump ability', () => {
      const dragon = CardLoader.getByName('Pearl Dragon')!;
      const state = setupGameWithMana({ W: 2 });

      const dragonCard = createCardInstance(dragon.id, 'player', 'battlefield');
      state.players.player.battlefield.push(dragonCard);

      const abilities = getActivatedAbilities(dragonCard, state);
      const pumpAbility = abilities.find(a => a.id.includes('pump'));

      expect(pumpAbility).toBeDefined();
      expect(pumpAbility!.cost.mana).toBe('{1}{W}');

      // Execute and verify +0/+1
      pumpAbility!.effect.custom!(state);
      expect(dragonCard.temporaryModifications[0].powerChange).toBe(0);
      expect(dragonCard.temporaryModifications[0].toughnessChange).toBe(1);
    });
  });

  describe('Wall of Fire', () => {
    test('card exists with defender', () => {
      const card = CardLoader.getByName('Wall of Fire');
      expect(card).toBeDefined();
      expect(card?.keywords).toContain('Defender');
    });

    test('has pump ability', () => {
      const wall = CardLoader.getByName('Wall of Fire')!;
      const state = setupGameWithMana({ R: 3 });

      const wallCard = createCardInstance(wall.id, 'player', 'battlefield');
      state.players.player.battlefield.push(wallCard);

      const abilities = getActivatedAbilities(wallCard, state);
      const pumpAbility = abilities.find(a => a.id.includes('pump'));

      expect(pumpAbility).toBeDefined();
      expect(pumpAbility!.cost.mana).toBe('{R}');
    });
  });

  describe('Spitting Drake', () => {
    test('card exists with flying', () => {
      const card = CardLoader.getByName('Spitting Drake');
      expect(card).toBeDefined();
      expect(card?.keywords).toContain('Flying');
    });

    test('has once-per-turn pump ability', () => {
      const drake = CardLoader.getByName('Spitting Drake')!;
      const state = setupGameWithMana({ R: 3 });

      const drakeCard = createCardInstance(drake.id, 'player', 'battlefield');
      state.players.player.battlefield.push(drakeCard);

      const abilities = getActivatedAbilities(drakeCard, state);
      const pumpAbility = abilities.find(a => a.id.includes('pump'));

      expect(pumpAbility).toBeDefined();
      expect(pumpAbility!.name).toContain('once per turn');

      // First activation should work
      expect(pumpAbility!.canActivate(state, drakeCard.instanceId, 'player')).toBe(true);

      // After activation, should not work again
      pumpAbility!.effect.custom!(state);
      expect(pumpAbility!.canActivate(state, drakeCard.instanceId, 'player')).toBe(false);
    });
  });
});

// ==========================================
// TAP/UNTAP ABILITIES
// ==========================================

describe('Tap/Untap Ability Creatures', () => {
  describe('Elder Druid', () => {
    test('card exists with correct stats', () => {
      const card = CardLoader.getByName('Elder Druid');
      expect(card).toBeDefined();
      expect(card?.power).toBe('2');
      expect(card?.toughness).toBe('2');
    });

    test('has tap/untap ability with mana cost', () => {
      const druid = CardLoader.getByName('Elder Druid')!;
      const state = setupGameWithMana({ G: 4 });

      const druidCard = createCardInstance(druid.id, 'player', 'battlefield');
      druidCard.summoningSick = false;
      state.players.player.battlefield.push(druidCard);

      const abilities = getActivatedAbilities(druidCard, state);
      const tapAbility = abilities.find(a => a.id.includes('tap_control'));

      expect(tapAbility).toBeDefined();
      expect(tapAbility!.cost.tap).toBe(true);
      expect(tapAbility!.cost.mana).toBe('{3}{G}');
    });
  });

  describe('Fyndhorn Brownie', () => {
    test('card exists with correct stats', () => {
      const card = CardLoader.getByName('Fyndhorn Brownie');
      expect(card).toBeDefined();
      expect(card?.power).toBe('1');
      expect(card?.toughness).toBe('1');
    });

    test('has untap creature ability', () => {
      const brownie = CardLoader.getByName('Fyndhorn Brownie')!;
      const state = setupGameWithMana({ G: 3 });

      const brownieCard = createCardInstance(brownie.id, 'player', 'battlefield');
      brownieCard.summoningSick = false;
      state.players.player.battlefield.push(brownieCard);

      const abilities = getActivatedAbilities(brownieCard, state);
      const untapAbility = abilities.find(a => a.id.includes('tap_untap'));

      expect(untapAbility).toBeDefined();
      expect(untapAbility!.cost.tap).toBe(true);
      expect(untapAbility!.cost.mana).toBe('{2}{G}');
      expect(untapAbility!.targetRequirements![0].targetType).toBe('creature');
    });
  });

  describe('Radjan Spirit', () => {
    test('card exists with correct stats', () => {
      const card = CardLoader.getByName('Radjan Spirit');
      expect(card).toBeDefined();
      expect(card?.power).toBe('3');
      expect(card?.toughness).toBe('2');
    });

    test('has remove flying ability', () => {
      const spirit = CardLoader.getByName('Radjan Spirit')!;
      const state = setupGameWithMana({});

      const spiritCard = createCardInstance(spirit.id, 'player', 'battlefield');
      spiritCard.summoningSick = false;
      state.players.player.battlefield.push(spiritCard);

      const abilities = getActivatedAbilities(spiritCard, state);
      const removeFlying = abilities.find(a => a.id.includes('remove_flying'));

      expect(removeFlying).toBeDefined();
      expect(removeFlying!.cost.tap).toBe(true);
      expect(removeFlying!.name).toContain('flying');
    });
  });
});

// ==========================================
// FLYING GRANTING
// ==========================================

describe('Flying Granting Creatures', () => {
  describe('Patagia Golem', () => {
    test('card exists with correct stats', () => {
      const card = CardLoader.getByName('Patagia Golem');
      expect(card).toBeDefined();
      expect(card?.power).toBe('2');
      expect(card?.toughness).toBe('3');
    });

    test('has gain flying ability', () => {
      const golem = CardLoader.getByName('Patagia Golem')!;
      const state = setupGameWithMana({ W: 4 }); // Generic mana from any source

      const golemCard = createCardInstance(golem.id, 'player', 'battlefield');
      state.players.player.battlefield.push(golemCard);

      const abilities = getActivatedAbilities(golemCard, state);
      const flyingAbility = abilities.find(a => a.id.includes('gain_flying'));

      expect(flyingAbility).toBeDefined();
      expect(flyingAbility!.cost.mana).toBe('{3}');
    });
  });

  describe('Harmattan Efreet', () => {
    test('card exists with flying', () => {
      const card = CardLoader.getByName('Harmattan Efreet');
      expect(card).toBeDefined();
      expect(card?.keywords).toContain('Flying');
    });

    test('has grant flying to target ability', () => {
      const efreet = CardLoader.getByName('Harmattan Efreet')!;
      const state = setupGameWithMana({ U: 3 });

      const efreetCard = createCardInstance(efreet.id, 'player', 'battlefield');
      state.players.player.battlefield.push(efreetCard);

      const abilities = getActivatedAbilities(efreetCard, state);
      const grantFlying = abilities.find(a => a.id.includes('grant_flying'));

      expect(grantFlying).toBeDefined();
      expect(grantFlying!.cost.mana).toBe('{1}{U}{U}');
      expect(grantFlying!.targetRequirements![0].targetType).toBe('creature');
    });
  });
});

// ==========================================
// DAMAGE PREVENTION
// ==========================================

describe('Damage Prevention Creatures', () => {
  describe('Samite Healer', () => {
    test('card exists with correct stats', () => {
      const card = CardLoader.getByName('Samite Healer');
      expect(card).toBeDefined();
      expect(card?.power).toBe('1');
      expect(card?.toughness).toBe('1');
    });

    test('has tap prevent damage ability', () => {
      const healer = CardLoader.getByName('Samite Healer')!;
      const state = setupGameWithMana({});

      const healerCard = createCardInstance(healer.id, 'player', 'battlefield');
      healerCard.summoningSick = false;
      state.players.player.battlefield.push(healerCard);

      const abilities = getActivatedAbilities(healerCard, state);
      const preventAbility = abilities.find(a => a.id.includes('tap_prevent'));

      expect(preventAbility).toBeDefined();
      expect(preventAbility!.cost.tap).toBe(true);
      expect(preventAbility!.targetRequirements![0].targetType).toBe('any');
    });
  });
});

// ==========================================
// SACRIFICE ABILITIES
// ==========================================

describe('Sacrifice Ability Creatures', () => {
  describe('Daraja Griffin', () => {
    test('card exists with flying', () => {
      const card = CardLoader.getByName('Daraja Griffin');
      expect(card).toBeDefined();
      expect(card?.keywords).toContain('Flying');
    });

    test('has sacrifice to destroy black creature', () => {
      const griffin = CardLoader.getByName('Daraja Griffin')!;
      const state = setupGameWithMana({});

      const griffinCard = createCardInstance(griffin.id, 'player', 'battlefield');
      state.players.player.battlefield.push(griffinCard);

      const abilities = getActivatedAbilities(griffinCard, state);
      const sacAbility = abilities.find(a => a.id.includes('sac_destroy'));

      expect(sacAbility).toBeDefined();
      expect(sacAbility!.cost.sacrifice).toEqual({ type: 'self' });
      expect(sacAbility!.targetRequirements![0].restrictions).toContain('black');
    });
  });

  describe('Daring Apprentice', () => {
    test('card exists with correct stats', () => {
      const card = CardLoader.getByName('Daring Apprentice');
      expect(card).toBeDefined();
      expect(card?.power).toBe('1');
      expect(card?.toughness).toBe('1');
    });

    test('has tap + sacrifice to counter spell', () => {
      const apprentice = CardLoader.getByName('Daring Apprentice')!;
      const state = setupGameWithMana({});

      const apprenticeCard = createCardInstance(apprentice.id, 'player', 'battlefield');
      apprenticeCard.summoningSick = false;
      state.players.player.battlefield.push(apprenticeCard);

      const abilities = getActivatedAbilities(apprenticeCard, state);
      const counterAbility = abilities.find(a => a.id.includes('sac_counter'));

      expect(counterAbility).toBeDefined();
      expect(counterAbility!.cost.tap).toBe(true);
      expect(counterAbility!.cost.sacrifice).toEqual({ type: 'self' });
    });

    test('cannot activate without spell on stack', () => {
      const apprentice = CardLoader.getByName('Daring Apprentice')!;
      const state = setupGameWithMana({});
      state.stack = []; // Empty stack

      const apprenticeCard = createCardInstance(apprentice.id, 'player', 'battlefield');
      apprenticeCard.summoningSick = false;
      state.players.player.battlefield.push(apprenticeCard);

      const abilities = getActivatedAbilities(apprenticeCard, state);
      const counterAbility = abilities.find(a => a.id.includes('sac_counter'));

      expect(counterAbility!.canActivate(state, apprenticeCard.instanceId, 'player')).toBe(false);
    });
  });

  describe('Goblin Digging Team', () => {
    test('card exists with correct stats', () => {
      const card = CardLoader.getByName('Goblin Digging Team');
      expect(card).toBeDefined();
      expect(card?.power).toBe('1');
      expect(card?.toughness).toBe('1');
    });

    test('has tap + sacrifice to destroy wall', () => {
      const goblin = CardLoader.getByName('Goblin Digging Team')!;
      const state = setupGameWithMana({});

      const goblinCard = createCardInstance(goblin.id, 'player', 'battlefield');
      goblinCard.summoningSick = false;
      state.players.player.battlefield.push(goblinCard);

      const abilities = getActivatedAbilities(goblinCard, state);
      const sacAbility = abilities.find(a => a.id.includes('sac_destroy_wall'));

      expect(sacAbility).toBeDefined();
      expect(sacAbility!.cost.tap).toBe(true);
      expect(sacAbility!.cost.sacrifice).toEqual({ type: 'self' });
      expect(sacAbility!.targetRequirements![0].restrictions).toContain('wall');
    });
  });

  describe('Resistance Fighter', () => {
    test('card exists with correct stats', () => {
      const card = CardLoader.getByName('Resistance Fighter');
      expect(card).toBeDefined();
      expect(card?.power).toBe('1');
      expect(card?.toughness).toBe('1');
    });

    test('has sacrifice to prevent combat damage', () => {
      const fighter = CardLoader.getByName('Resistance Fighter')!;
      const state = setupGameWithMana({});

      const fighterCard = createCardInstance(fighter.id, 'player', 'battlefield');
      state.players.player.battlefield.push(fighterCard);

      const abilities = getActivatedAbilities(fighterCard, state);
      const sacAbility = abilities.find(a => a.id.includes('sac_prevent'));

      expect(sacAbility).toBeDefined();
      expect(sacAbility!.cost.sacrifice).toEqual({ type: 'self' });
      expect(sacAbility!.targetRequirements![0].targetType).toBe('creature');
    });
  });
});

// ==========================================
// LIFE PAYMENT ABILITIES
// ==========================================

describe('Life Payment Ability Creatures', () => {
  describe('Mischievous Poltergeist', () => {
    test('card exists with flying', () => {
      const card = CardLoader.getByName('Mischievous Poltergeist');
      expect(card).toBeDefined();
      expect(card?.keywords).toContain('Flying');
    });

    test('has pay life to regenerate ability', () => {
      const poltergeist = CardLoader.getByName('Mischievous Poltergeist')!;
      const state = setupGameWithMana({});

      const poltergeistCard = createCardInstance(poltergeist.id, 'player', 'battlefield');
      state.players.player.battlefield.push(poltergeistCard);

      const abilities = getActivatedAbilities(poltergeistCard, state);
      const regenAbility = abilities.find(a => a.id.includes('regenerate'));

      expect(regenAbility).toBeDefined();
      expect(regenAbility!.cost.life).toBe(1);
    });

    test('can activate with 1 life (goes to 0)', () => {
      // In MTG, you can pay life costs even if it puts you to 0
      const poltergeist = CardLoader.getByName('Mischievous Poltergeist')!;
      const state = setupGameWithMana({});
      state.players.player.life = 1;

      const poltergeistCard = createCardInstance(poltergeist.id, 'player', 'battlefield');
      state.players.player.battlefield.push(poltergeistCard);

      const abilities = getActivatedAbilities(poltergeistCard, state);
      const regenAbility = abilities.find(a => a.id.includes('regenerate'));

      expect(regenAbility!.canActivate(state, poltergeistCard.instanceId, 'player')).toBe(true);
    });
  });

  describe('Ethereal Champion', () => {
    test('card exists with correct stats', () => {
      const card = CardLoader.getByName('Ethereal Champion');
      expect(card).toBeDefined();
      expect(card?.power).toBe('3');
      expect(card?.toughness).toBe('4');
    });

    test('has pay life to prevent damage ability', () => {
      const champion = CardLoader.getByName('Ethereal Champion')!;
      const state = setupGameWithMana({});

      const championCard = createCardInstance(champion.id, 'player', 'battlefield');
      state.players.player.battlefield.push(championCard);

      const abilities = getActivatedAbilities(championCard, state);
      const preventAbility = abilities.find(a => a.id.includes('prevent'));

      expect(preventAbility).toBeDefined();
      expect(preventAbility!.cost.life).toBe(1);
    });

    test('can activate with sufficient life', () => {
      const champion = CardLoader.getByName('Ethereal Champion')!;
      const state = setupGameWithMana({});
      state.players.player.life = 10;

      const championCard = createCardInstance(champion.id, 'player', 'battlefield');
      state.players.player.battlefield.push(championCard);

      const abilities = getActivatedAbilities(championCard, state);
      const preventAbility = abilities.find(a => a.id.includes('prevent'));

      expect(preventAbility!.canActivate(state, championCard.instanceId, 'player')).toBe(true);
    });
  });
});

// ==========================================
// BATCH VERIFICATION
// ==========================================

// ==========================================
// MORE ACTIVATED ABILITY CREATURES
// ==========================================

describe('More Activated Ability Creatures', () => {
  describe('Abyssal Hunter', () => {
    test('card exists with correct stats', () => {
      const card = CardLoader.getByName('Abyssal Hunter');
      expect(card).toBeDefined();
      expect(card?.power).toBe('1');
      expect(card?.toughness).toBe('1');
    });

    test('has tap + mana cost damage ability', () => {
      const hunter = CardLoader.getByName('Abyssal Hunter')!;
      const state = setupGameWithMana({ B: 3 });

      const hunterCard = createCardInstance(hunter.id, 'player', 'battlefield');
      hunterCard.summoningSick = false;
      state.players.player.battlefield.push(hunterCard);

      const abilities = getActivatedAbilities(hunterCard, state);
      const damageAbility = abilities.find(a => a.id.includes('tap_damage'));

      expect(damageAbility).toBeDefined();
      expect(damageAbility!.cost.tap).toBe(true);
      expect(damageAbility!.cost.mana).toBe('{B}');
    });
  });

  describe('Anaba Shaman', () => {
    test('card exists with correct stats', () => {
      const card = CardLoader.getByName('Anaba Shaman');
      expect(card).toBeDefined();
      expect(card?.power).toBe('2');
      expect(card?.toughness).toBe('2');
    });

    test('has tap + mana damage ability', () => {
      const shaman = CardLoader.getByName('Anaba Shaman')!;
      const state = setupGameWithMana({ R: 3 });

      const shamanCard = createCardInstance(shaman.id, 'player', 'battlefield');
      shamanCard.summoningSick = false;
      state.players.player.battlefield.push(shamanCard);

      const abilities = getActivatedAbilities(shamanCard, state);
      const damageAbility = abilities.find(a => a.id.includes('tap_damage'));

      expect(damageAbility).toBeDefined();
      expect(damageAbility!.cost.tap).toBe(true);
      expect(damageAbility!.cost.mana).toBe('{R}');
      expect(damageAbility!.effect.amount).toBe(1);
    });
  });

  describe('Blood Pet', () => {
    test('card exists with correct stats', () => {
      const card = CardLoader.getByName('Blood Pet');
      expect(card).toBeDefined();
      expect(card?.power).toBe('1');
      expect(card?.toughness).toBe('1');
    });

    test('has sacrifice for mana ability', () => {
      const pet = CardLoader.getByName('Blood Pet')!;
      const state = setupGameWithMana({});

      const petCard = createCardInstance(pet.id, 'player', 'battlefield');
      state.players.player.battlefield.push(petCard);

      const abilities = getActivatedAbilities(petCard, state);
      const manaAbility = abilities.find(a => a.id.includes('sac_mana'));

      expect(manaAbility).toBeDefined();
      expect(manaAbility!.cost.sacrifice).toEqual({ type: 'self' });
      expect(manaAbility!.isManaAbility).toBe(true);
      expect(manaAbility!.effect.manaColors).toContain('B');
    });
  });

  describe('Fyndhorn Elder', () => {
    test('card exists with correct stats', () => {
      const card = CardLoader.getByName('Fyndhorn Elder');
      expect(card).toBeDefined();
      expect(card?.power).toBe('1');
      expect(card?.toughness).toBe('1');
    });

    test('has tap for two green mana ability', () => {
      const elder = CardLoader.getByName('Fyndhorn Elder')!;
      const state = setupGameWithMana({});

      const elderCard = createCardInstance(elder.id, 'player', 'battlefield');
      elderCard.summoningSick = false;
      state.players.player.battlefield.push(elderCard);

      const abilities = getActivatedAbilities(elderCard, state);
      const manaAbility = abilities.find(a => a.isManaAbility);

      expect(manaAbility).toBeDefined();
      expect(manaAbility!.cost.tap).toBe(true);
      expect(manaAbility!.isManaAbility).toBe(true);
      expect(manaAbility!.effect.amount).toBe(2);
      expect(manaAbility!.effect.manaColors).toContain('G');
    });
  });

  describe('Crimson Hellkite', () => {
    test('card exists with flying', () => {
      const card = CardLoader.getByName('Crimson Hellkite');
      expect(card).toBeDefined();
      expect(card?.keywords).toContain('Flying');
    });

    test('has X damage ability', () => {
      const hellkite = CardLoader.getByName('Crimson Hellkite')!;
      const state = setupGameWithMana({ R: 5 });

      const hellkiteCard = createCardInstance(hellkite.id, 'player', 'battlefield');
      hellkiteCard.summoningSick = false;
      state.players.player.battlefield.push(hellkiteCard);

      const abilities = getActivatedAbilities(hellkiteCard, state);
      const xAbility = abilities.find(a => a.id.includes('x_damage'));

      expect(xAbility).toBeDefined();
      expect(xAbility!.cost.tap).toBe(true);
      expect(xAbility!.targetRequirements![0].targetType).toBe('creature');
    });
  });

  describe('Fallen Angel', () => {
    test('card exists with flying', () => {
      const card = CardLoader.getByName('Fallen Angel');
      expect(card).toBeDefined();
      expect(card?.keywords).toContain('Flying');
    });

    test('has sacrifice creature for pump ability', () => {
      const angel = CardLoader.getByName('Fallen Angel')!;
      const llanowar = CardLoader.getByName('Llanowar Elves')!;
      const state = setupGameWithMana({});

      const angelCard = createCardInstance(angel.id, 'player', 'battlefield');
      const sacTarget = createCardInstance(llanowar.id, 'player', 'battlefield');
      state.players.player.battlefield.push(angelCard, sacTarget);

      const abilities = getActivatedAbilities(angelCard, state);
      const sacAbility = abilities.find(a => a.id.includes('sac_pump'));

      expect(sacAbility).toBeDefined();
      expect(sacAbility!.cost.sacrifice?.type).toBe('creature');
    });

    test('cannot activate without creature to sacrifice', () => {
      const angel = CardLoader.getByName('Fallen Angel')!;
      const state = setupGameWithMana({});

      const angelCard = createCardInstance(angel.id, 'player', 'battlefield');
      state.players.player.battlefield.push(angelCard);

      const abilities = getActivatedAbilities(angelCard, state);
      const sacAbility = abilities.find(a => a.id.includes('sac_pump'));

      expect(sacAbility!.canActivate(state, angelCard.instanceId, 'player')).toBe(false);
    });
  });

  describe('Order of the Sacred Torch', () => {
    test('card exists with correct stats', () => {
      const card = CardLoader.getByName('Order of the Sacred Torch');
      expect(card).toBeDefined();
      expect(card?.power).toBe('2');
      expect(card?.toughness).toBe('2');
    });

    test('has counter black spell ability', () => {
      const order = CardLoader.getByName('Order of the Sacred Torch')!;
      const state = setupGameWithMana({});

      const orderCard = createCardInstance(order.id, 'player', 'battlefield');
      orderCard.summoningSick = false;
      state.players.player.battlefield.push(orderCard);

      const abilities = getActivatedAbilities(orderCard, state);
      const counterAbility = abilities.find(a => a.id.includes('counter_black'));

      expect(counterAbility).toBeDefined();
      expect(counterAbility!.cost.tap).toBe(true);
      expect(counterAbility!.cost.life).toBe(1);
    });
  });

  describe('Stromgald Cabal', () => {
    test('card exists with correct stats', () => {
      const card = CardLoader.getByName('Stromgald Cabal');
      expect(card).toBeDefined();
      expect(card?.power).toBe('2');
      expect(card?.toughness).toBe('2');
    });

    test('has counter white spell ability', () => {
      const cabal = CardLoader.getByName('Stromgald Cabal')!;
      const state = setupGameWithMana({});

      const cabalCard = createCardInstance(cabal.id, 'player', 'battlefield');
      cabalCard.summoningSick = false;
      state.players.player.battlefield.push(cabalCard);

      const abilities = getActivatedAbilities(cabalCard, state);
      const counterAbility = abilities.find(a => a.id.includes('counter_white'));

      expect(counterAbility).toBeDefined();
      expect(counterAbility!.cost.tap).toBe(true);
      expect(counterAbility!.cost.life).toBe(1);
    });
  });

  describe('Rag Man', () => {
    test('card exists with correct stats', () => {
      const card = CardLoader.getByName('Rag Man');
      expect(card).toBeDefined();
      expect(card?.power).toBe('2');
      expect(card?.toughness).toBe('1');
    });

    test('has discard ability', () => {
      const ragMan = CardLoader.getByName('Rag Man')!;
      const state = setupGameWithMana({ B: 5 });
      state.activePlayer = 'player';

      const ragManCard = createCardInstance(ragMan.id, 'player', 'battlefield');
      ragManCard.summoningSick = false;
      state.players.player.battlefield.push(ragManCard);

      const abilities = getActivatedAbilities(ragManCard, state);
      const discardAbility = abilities.find(a => a.id.includes('discard'));

      expect(discardAbility).toBeDefined();
      expect(discardAbility!.cost.tap).toBe(true);
      expect(discardAbility!.cost.mana).toBe('{B}{B}{B}');
    });

    test('cannot activate on opponent turn', () => {
      const ragMan = CardLoader.getByName('Rag Man')!;
      const state = setupGameWithMana({ B: 5 });
      state.activePlayer = 'opponent';

      const ragManCard = createCardInstance(ragMan.id, 'player', 'battlefield');
      ragManCard.summoningSick = false;
      state.players.player.battlefield.push(ragManCard);

      const abilities = getActivatedAbilities(ragManCard, state);
      const discardAbility = abilities.find(a => a.id.includes('discard'));

      expect(discardAbility!.canActivate(state, ragManCard.instanceId, 'player')).toBe(false);
    });
  });
});

describe('Activated Ability Creatures Batch Verification', () => {
  const activatedCreatures = [
    // Original list
    'Orcish Artillery',
    'Heavy Ballista',
    "D'Avenant Archer",
    'Femeref Archers',
    'Reckless Embermage',
    'Infantry Veteran',
    'Wyluli Wolf',
    'Pradesh Gypsies',
    'Flame Spirit',
    'Dragon Engine',
    'Pearl Dragon',
    'Mesa Falcon',
    'Wall of Fire',
    'Spitting Drake',
    'Elder Druid',
    'Fyndhorn Brownie',
    'Radjan Spirit',
    'Patagia Golem',
    'Harmattan Efreet',
    'Samite Healer',
    'Daraja Griffin',
    'Daring Apprentice',
    'Unyaro Griffin',
    'Resistance Fighter',
    'Goblin Digging Team',
    'Mischievous Poltergeist',
    'Ethereal Champion',
    // New additions
    'Abyssal Hunter',
    'Anaba Shaman',
    'Blood Pet',
    'Fyndhorn Elder',
    'Kjeldoran Royal Guard',
    'Order of the Sacred Torch',
    'Stromgald Cabal',
    'Rag Man',
    'Soldevi Sage',
    'Crimson Hellkite',
    'Fallen Angel',
  ];

  test('all activated ability creatures exist in card database', () => {
    for (const name of activatedCreatures) {
      const card = CardLoader.getByName(name);
      expect(card).toBeDefined();
      expect(card?.type_line).toContain('Creature');
    }
  });

  test('all activated ability creatures have at least one ability', () => {
    const state = setupGameWithMana({ W: 5, U: 5, B: 5, R: 5, G: 5 });

    for (const name of activatedCreatures) {
      const template = CardLoader.getByName(name)!;
      const card = createCardInstance(template.id, 'player', 'battlefield');
      card.summoningSick = false;
      state.players.player.battlefield = [card];

      const abilities = getActivatedAbilities(card, state);
      expect(abilities.length).toBeGreaterThanOrEqual(1);
    }
  });
});
