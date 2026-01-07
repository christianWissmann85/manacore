/**
 * Parameterized Card Tests
 *
 * Data-driven tests for ManaCore card mechanics.
 * This file consolidates common card test patterns into parameterized tests
 * for better maintainability and reduced code duplication.
 *
 * Run with: cd packages/engine && bun test parameterized
 */

import { describe, test, expect } from 'bun:test';
import { CardLoader, isCreature, applyAction, validateAction } from '../../src/index';
import {
  // Test data
  VANILLA_CREATURES,
  FLYING_CREATURES,
  FIRST_STRIKE_CREATURES,
  VIGILANCE_CREATURES,
  HASTE_CREATURES,
  REACH_CREATURES,
  DEFENDER_CREATURES,
  LANDWALK_CREATURES,
  FEAR_CREATURES,
  MENACE_CREATURES,
  MULTI_KEYWORD_CREATURES,
  ETB_LIFE_GAIN_CREATURES,
  ETB_GRAVEYARD_CREATURES,
  ETB_DISCARD_CREATURES,
  ETB_LIBRARY_CREATURES,
  ETB_DESTROY_CREATURES,
  STAT_BUFF_AURAS,
  STAT_DEBUFF_AURAS,
  BASIC_LANDS,
  MANA_DORKS,
  VARIABLE_PT_CREATURES,
  LORD_CREATURES,
} from './card-test-data';
import {
  // Test helpers
  setupGameWithMana,
  setupBlockingState,
  createCreatureOnBattlefield,
  createCardInHand,
  createCardInGraveyard,
  addLandToBattlefield,
  castAndResolve,
  declareAttackers,
  declareBlockers,
  performUnblockedAttack,
  validateBlocking,
  checkKeyword,
  isOnBattlefield,
  isInGraveyard,
  isInHand,
  getCard,
  cardExists,
} from './test-helpers';

// ============================================
// VANILLA CREATURES - STATS TESTS
// ============================================

describe('Vanilla Creatures - Parameterized Stats', () => {
  describe.each(VANILLA_CREATURES)('$name', ({ name, power, toughness, manaCost, cmc }) => {
    test('card exists in database', () => {
      expect(cardExists(name)).toBe(true);
    });

    test('has correct power/toughness', () => {
      const card = getCard(name);
      expect(card.power).toBe(power);
      expect(card.toughness).toBe(toughness);
    });

    test('is a creature', () => {
      const card = getCard(name);
      expect(isCreature(card)).toBe(true);
    });

    if (manaCost) {
      test(`has mana cost ${manaCost}`, () => {
        const card = getCard(name);
        expect(card.mana_cost).toBe(manaCost);
      });
    }

    if (cmc !== undefined) {
      test(`has CMC ${cmc}`, () => {
        const card = getCard(name);
        expect(card.cmc).toBe(cmc);
      });
    }

    test('has no keyword abilities', () => {
      const card = getCard(name);
      expect(card.keywords?.length ?? 0).toBe(0);
    });
  });
});

// ============================================
// FLYING CREATURES - KEYWORD TESTS
// ============================================

describe('Flying Creatures - Parameterized', () => {
  describe.each(FLYING_CREATURES)('$name', ({ name, power, toughness }) => {
    test('card exists with Flying keyword', () => {
      const card = getCard(name);
      expect(card.keywords).toContain('Flying');
    });

    test('hasFlying helper returns true', () => {
      expect(checkKeyword(name, 'Flying')).toBe(true);
    });

    if (power && toughness) {
      test(`has correct stats (${power}/${toughness})`, () => {
        const card = getCard(name);
        expect(card.power).toBe(power);
        expect(card.toughness).toBe(toughness);
      });
    }
  });

  test('flying creature cannot be blocked by non-flyer', () => {
    // Pick the first flying creature for the test
    const flyerData = FLYING_CREATURES[0];
    const state = setupBlockingState({ U: 5 }, { G: 2 });

    // Add flying attacker
    const flyer = createCreatureOnBattlefield(state, flyerData.name, 'player', {
      attacking: true,
    });

    // Add non-flying blocker
    const blocker = createCreatureOnBattlefield(state, 'Grizzly Bears', 'opponent');

    // Blocking should fail
    const errors = validateBlocking(state, [
      { blockerId: blocker.instanceId, attackerId: flyer.instanceId },
    ]);
    expect(errors.some((e) => e.toLowerCase().includes('flying'))).toBe(true);
  });
});

// ============================================
// FIRST STRIKE CREATURES - KEYWORD TESTS
// ============================================

describe('First Strike Creatures - Parameterized', () => {
  describe.each(FIRST_STRIKE_CREATURES)('$name', ({ name, keywords, power, toughness }) => {
    test('card exists with First Strike keyword', () => {
      const card = getCard(name);
      expect(card.keywords).toContain('First strike');
    });

    test('hasFirstStrike helper returns true', () => {
      expect(checkKeyword(name, 'First strike')).toBe(true);
    });

    if (power && toughness) {
      test(`has correct stats (${power}/${toughness})`, () => {
        const card = getCard(name);
        expect(card.power).toBe(power);
        expect(card.toughness).toBe(toughness);
      });
    }
  });
});

// ============================================
// VIGILANCE CREATURES - KEYWORD TESTS
// ============================================

describe('Vigilance Creatures - Parameterized', () => {
  describe.each(VIGILANCE_CREATURES)('$name', ({ name, keywords }) => {
    test('card exists with Vigilance keyword', () => {
      const card = getCard(name);
      expect(card.keywords).toContain('Vigilance');
    });

    test('hasVigilance helper returns true', () => {
      expect(checkKeyword(name, 'Vigilance')).toBe(true);
    });
  });

  test('vigilance creature does not tap when attacking', () => {
    const vigilantData = VIGILANCE_CREATURES[0];
    const state = setupGameWithMana({ W: 7 });

    const vigilant = createCreatureOnBattlefield(state, vigilantData.name, 'player');

    const newState = declareAttackers(state, [vigilant.instanceId]);

    const attacker = newState.players.player.battlefield.find(
      (c) => c.instanceId === vigilant.instanceId,
    );
    expect(attacker?.attacking).toBe(true);
    expect(attacker?.tapped).toBe(false); // Vigilance!
  });
});

// ============================================
// HASTE CREATURES - KEYWORD TESTS
// ============================================

describe('Haste Creatures - Parameterized', () => {
  describe.each(HASTE_CREATURES)('$name', ({ name, keywords }) => {
    test('card exists with Haste keyword', () => {
      const card = getCard(name);
      expect(card.keywords).toContain('Haste');
    });

    test('hasHaste helper returns true', () => {
      expect(checkKeyword(name, 'Haste')).toBe(true);
    });
  });
});

// ============================================
// REACH CREATURES - KEYWORD TESTS
// ============================================

describe('Reach Creatures - Parameterized', () => {
  describe.each(REACH_CREATURES)('$name', ({ name }) => {
    test('card exists with Reach keyword', () => {
      const card = getCard(name);
      expect(card.keywords).toContain('Reach');
    });

    test('hasReach helper returns true', () => {
      expect(checkKeyword(name, 'Reach')).toBe(true);
    });
  });

  test('reach creature CAN block flying creature', () => {
    const reachData = REACH_CREATURES[0]; // Giant Spider
    const flyerData = FLYING_CREATURES[0];

    const state = setupBlockingState({ U: 5 }, { G: 4 });

    // Add flying attacker
    const flyer = createCreatureOnBattlefield(state, flyerData.name, 'player', {
      attacking: true,
    });

    // Add reach blocker
    const spider = createCreatureOnBattlefield(state, reachData.name, 'opponent');

    // Blocking should succeed (no errors or no Flying error)
    const errors = validateBlocking(state, [
      { blockerId: spider.instanceId, attackerId: flyer.instanceId },
    ]);
    expect(errors.some((e) => e.toLowerCase().includes('flying'))).toBe(false);
  });
});

// ============================================
// DEFENDER CREATURES - KEYWORD TESTS
// ============================================

describe('Defender Creatures - Parameterized', () => {
  describe.each(DEFENDER_CREATURES)('$name', ({ name, power, toughness }) => {
    test('card exists and has Defender ability', () => {
      expect(checkKeyword(name, 'Defender')).toBe(true);
    });

    if (power && toughness) {
      test(`has correct stats (${power}/${toughness})`, () => {
        const card = getCard(name);
        expect(card.power).toBe(power);
        expect(card.toughness).toBe(toughness);
      });
    }

    test('cannot attack', () => {
      const state = setupGameWithMana({ U: 5 });
      const wall = createCreatureOnBattlefield(state, name, 'player');

      expect(() =>
        applyAction(state, {
          type: 'DECLARE_ATTACKERS',
          playerId: 'player',
          payload: { attackers: [wall.instanceId] },
        }),
      ).toThrow(/Defender/i);
    });
  });
});

// ============================================
// LANDWALK CREATURES - KEYWORD TESTS
// ============================================

describe('Landwalk Creatures - Parameterized', () => {
  describe.each(LANDWALK_CREATURES)(
    '$name with $landwalkType',
    ({ name, landwalkType, correspondingLand }) => {
      test(`card exists with ${landwalkType} keyword`, () => {
        const card = getCard(name);
        expect(card.keywords).toContain(landwalkType);
      });

      test(`cannot be blocked when opponent controls ${correspondingLand}`, () => {
        const state = setupBlockingState({ B: 4 }, { G: 2 });

        // Add the attacker with landwalk
        const landwalker = createCreatureOnBattlefield(state, name, 'player', {
          attacking: true,
        });

        // Add the relevant land to opponent's battlefield
        addLandToBattlefield(state, correspondingLand, 'opponent');

        // Add a potential blocker
        const blocker = createCreatureOnBattlefield(state, 'Grizzly Bears', 'opponent');

        // Blocking should fail due to landwalk
        const errors = validateBlocking(state, [
          { blockerId: blocker.instanceId, attackerId: landwalker.instanceId },
        ]);
        expect(errors.some((e) => e.includes(landwalkType))).toBe(true);
      });
    },
  );
});

// ============================================
// FEAR CREATURES - KEYWORD TESTS
// ============================================

describe('Fear Creatures - Parameterized', () => {
  describe.each(FEAR_CREATURES)('$name', ({ name }) => {
    test('card exists with Fear keyword', () => {
      const card = getCard(name);
      expect(card.keywords).toContain('Fear');
    });

    test('hasFear helper returns true', () => {
      expect(checkKeyword(name, 'Fear')).toBe(true);
    });

    test('cannot be blocked by non-black non-artifact creature', () => {
      const state = setupBlockingState({ B: 3 }, { G: 2 });

      // Add fear creature as attacker
      const fearCreature = createCreatureOnBattlefield(state, name, 'player', {
        attacking: true,
      });

      // Add green creature as blocker
      const blocker = createCreatureOnBattlefield(state, 'Grizzly Bears', 'opponent');

      // Blocking should fail due to Fear
      const errors = validateBlocking(state, [
        { blockerId: blocker.instanceId, attackerId: fearCreature.instanceId },
      ]);
      expect(errors.some((e) => e.includes('Fear'))).toBe(true);
    });

    test('CAN be blocked by black creature', () => {
      const state = setupBlockingState({ B: 3 }, { B: 3 });

      // Add fear creature as attacker
      const fearCreature = createCreatureOnBattlefield(state, name, 'player', {
        attacking: true,
      });

      // Add black creature as blocker (Scathe Zombies)
      const blocker = createCreatureOnBattlefield(state, 'Scathe Zombies', 'opponent');

      // Blocking should succeed
      const errors = validateBlocking(state, [
        { blockerId: blocker.instanceId, attackerId: fearCreature.instanceId },
      ]);
      expect(errors.some((e) => e.includes('Fear'))).toBe(false);
    });
  });
});

// ============================================
// MENACE CREATURES - KEYWORD TESTS
// ============================================

describe('Menace Creatures - Parameterized', () => {
  describe.each(MENACE_CREATURES)('$name', ({ name, keywords }) => {
    test('card exists with Menace keyword', () => {
      const card = getCard(name);
      expect(card.keywords).toContain('Menace');
    });

    test('hasMenace helper returns true', () => {
      expect(checkKeyword(name, 'Menace')).toBe(true);
    });

    test('cannot be blocked by single creature', () => {
      const state = setupBlockingState({ U: 5 }, { U: 3 });

      // Wind Spirit has both Flying and Menace, so we need flying blockers
      const menaceCreature = createCreatureOnBattlefield(state, name, 'player', {
        attacking: true,
      });

      // Add a single flying blocker
      const blocker = createCreatureOnBattlefield(state, 'Storm Crow', 'opponent');

      // Blocking should fail due to Menace
      const errors = validateBlocking(state, [
        { blockerId: blocker.instanceId, attackerId: menaceCreature.instanceId },
      ]);
      expect(errors.some((e) => e.includes('Menace'))).toBe(true);
    });

    test('CAN be blocked by two creatures', () => {
      const state = setupBlockingState({ U: 5 }, { U: 6 });

      // Wind Spirit has Flying, so blockers need Flying too
      const menaceCreature = createCreatureOnBattlefield(state, name, 'player', {
        attacking: true,
      });

      // Add two flying blockers
      const blocker1 = createCreatureOnBattlefield(state, 'Storm Crow', 'opponent');
      const blocker2 = createCreatureOnBattlefield(state, 'Storm Crow', 'opponent');

      // Blocking with two should succeed
      const errors = validateBlocking(state, [
        { blockerId: blocker1.instanceId, attackerId: menaceCreature.instanceId },
        { blockerId: blocker2.instanceId, attackerId: menaceCreature.instanceId },
      ]);
      expect(errors.some((e) => e.includes('Menace'))).toBe(false);
    });
  });
});

// ============================================
// MULTI-KEYWORD CREATURES - COMBINED TESTS
// ============================================

describe('Multi-Keyword Creatures - Parameterized', () => {
  describe.each(MULTI_KEYWORD_CREATURES)('$name', ({ name, keywords }) => {
    test(`card exists with all keywords: ${keywords.join(', ')}`, () => {
      const card = getCard(name);
      keywords.forEach((keyword) => {
        expect(card.keywords).toContain(keyword);
      });
    });

    keywords.forEach((keyword) => {
      test(`has${keyword.replace(' ', '')} helper returns true`, () => {
        expect(checkKeyword(name, keyword)).toBe(true);
      });
    });
  });
});

// ============================================
// ETB CREATURES - TRIGGER TESTS
// ============================================

describe('ETB Life Gain Creatures - Parameterized', () => {
  describe.each(ETB_LIFE_GAIN_CREATURES)(
    '$name - $effect',
    ({ name, power, toughness, oracleTextContains }) => {
      test('card exists with correct stats', () => {
        const card = getCard(name);
        expect(card.power).toBe(power);
        expect(card.toughness).toBe(toughness);
      });

      test('oracle text contains ETB trigger', () => {
        const card = getCard(name);
        const oracleText = card.oracle_text?.toLowerCase() ?? '';
        oracleTextContains.forEach((text) => {
          expect(oracleText).toContain(text);
        });
      });
    },
  );
});

describe('ETB Graveyard Creatures - Parameterized', () => {
  describe.each(ETB_GRAVEYARD_CREATURES)(
    '$name - $effect',
    ({ name, power, toughness, oracleTextContains }) => {
      test('card exists with correct stats', () => {
        const card = getCard(name);
        expect(card.power).toBe(power);
        expect(card.toughness).toBe(toughness);
      });

      test('oracle text contains ETB trigger', () => {
        const card = getCard(name);
        const oracleText = card.oracle_text?.toLowerCase() ?? '';
        oracleTextContains.forEach((text) => {
          expect(oracleText).toContain(text);
        });
      });
    },
  );
});

describe('ETB Discard Creatures - Parameterized', () => {
  describe.each(ETB_DISCARD_CREATURES)(
    '$name - $effect',
    ({ name, power, toughness, oracleTextContains }) => {
      test('card exists with correct stats', () => {
        const card = getCard(name);
        expect(card.power).toBe(power);
        expect(card.toughness).toBe(toughness);
      });

      test('oracle text contains ETB trigger', () => {
        const card = getCard(name);
        const oracleText = card.oracle_text?.toLowerCase() ?? '';
        oracleTextContains.forEach((text) => {
          expect(oracleText).toContain(text);
        });
      });
    },
  );
});

describe('ETB Library Manipulation Creatures - Parameterized', () => {
  describe.each(ETB_LIBRARY_CREATURES)(
    '$name - $effect',
    ({ name, power, toughness, oracleTextContains }) => {
      test('card exists with correct stats', () => {
        const card = getCard(name);
        expect(card.power).toBe(power);
        expect(card.toughness).toBe(toughness);
      });

      test('oracle text contains ETB trigger', () => {
        const card = getCard(name);
        const oracleText = card.oracle_text?.toLowerCase() ?? '';
        oracleTextContains.forEach((text) => {
          expect(oracleText).toContain(text);
        });
      });
    },
  );
});

describe('ETB Destroy Creatures - Parameterized', () => {
  describe.each(ETB_DESTROY_CREATURES)(
    '$name - $effect',
    ({ name, power, toughness, oracleTextContains }) => {
      test('card exists with correct stats', () => {
        const card = getCard(name);
        expect(card.power).toBe(power);
        expect(card.toughness).toBe(toughness);
      });

      test('oracle text contains ETB trigger', () => {
        const card = getCard(name);
        const oracleText = card.oracle_text?.toLowerCase() ?? '';
        oracleTextContains.forEach((text) => {
          expect(oracleText).toContain(text);
        });
      });
    },
  );
});

// ============================================
// BASIC LANDS - PARAMETERIZED TESTS
// ============================================

describe('Basic Lands - Parameterized', () => {
  describe.each(BASIC_LANDS)('$name', ({ name, color }) => {
    test('card exists', () => {
      expect(cardExists(name)).toBe(true);
    });

    test('is a land', () => {
      const card = getCard(name);
      expect(card.type_line).toContain('Land');
    });

    test('is a basic land', () => {
      const card = getCard(name);
      expect(card.type_line).toContain('Basic');
    });

    test('has no mana cost', () => {
      const card = getCard(name);
      expect(card.mana_cost).toBe('');
    });

    test(`produces ${color} mana`, () => {
      const card = getCard(name);
      expect(card.oracle_text).toContain(`{${color}}`);
    });
  });
});

// ============================================
// MANA DORKS - PARAMETERIZED TESTS
// ============================================

describe('Mana Dorks - Parameterized', () => {
  describe.each(MANA_DORKS)('$name', ({ name, manaProduced }) => {
    test('card exists', () => {
      expect(cardExists(name)).toBe(true);
    });

    test('is a creature', () => {
      const card = getCard(name);
      expect(isCreature(card)).toBe(true);
    });

    test('has tap ability in oracle text', () => {
      const card = getCard(name);
      expect(card.oracle_text).toContain('{T}');
    });

    if (manaProduced !== 'any') {
      test(`produces ${manaProduced} mana`, () => {
        const card = getCard(name);
        const manaColors = manaProduced.split('');
        manaColors.forEach((color) => {
          expect(card.oracle_text).toContain(`{${color}}`);
        });
      });
    }
  });
});

// ============================================
// VARIABLE P/T CREATURES - PARAMETERIZED TESTS
// ============================================

describe('Variable P/T Creatures - Parameterized', () => {
  describe.each(VARIABLE_PT_CREATURES)('$name', ({ name, basePT, variable }) => {
    test('card exists', () => {
      expect(cardExists(name)).toBe(true);
    });

    test('has variable (*) power and toughness', () => {
      const card = getCard(name);
      expect(card.power).toBe('*');
      expect(card.toughness).toBe('*');
    });

    test(`P/T based on ${variable}`, () => {
      const card = getCard(name);
      // Variable P/T cards have specific oracle text patterns
      expect(card.oracle_text).toBeDefined();
    });
  });
});

// ============================================
// LORD CREATURES - PARAMETERIZED TESTS
// ============================================

describe('Lord Creatures - Parameterized', () => {
  describe.each(LORD_CREATURES)('$name', ({ name, buffedType, bonus, grantsKeyword }) => {
    test('card exists', () => {
      expect(cardExists(name)).toBe(true);
    });

    test('is a creature', () => {
      const card = getCard(name);
      expect(isCreature(card)).toBe(true);
    });

    test(`buffs other ${buffedType}s`, () => {
      const card = getCard(name);
      expect(card.oracle_text?.toLowerCase()).toContain(buffedType.toLowerCase());
    });

    if (grantsKeyword) {
      test(`grants ${grantsKeyword}`, () => {
        const card = getCard(name);
        expect(card.oracle_text?.toLowerCase()).toContain(grantsKeyword.toLowerCase());
      });
    }
  });
});

// ============================================
// STAT MODIFIER AURAS - PARAMETERIZED TESTS
// ============================================

describe('Stat Buff Auras - Parameterized', () => {
  describe.each(STAT_BUFF_AURAS)('$name', ({ name, modifier }) => {
    test('card exists', () => {
      expect(cardExists(name)).toBe(true);
    });

    test('is an aura', () => {
      const card = getCard(name);
      expect(card.type_line).toContain('Aura');
    });

    test(`grants +${modifier.power}/+${modifier.toughness}`, () => {
      const card = getCard(name);
      // Check oracle text for the modifier
      const expectedModifier = `+${modifier.power}/+${modifier.toughness}`;
      expect(card.oracle_text).toContain(expectedModifier);
    });
  });
});

describe('Stat Debuff Auras - Parameterized', () => {
  describe.each(STAT_DEBUFF_AURAS)('$name', ({ name, modifier }) => {
    test('card exists', () => {
      expect(cardExists(name)).toBe(true);
    });

    test('is an aura', () => {
      const card = getCard(name);
      expect(card.type_line).toContain('Aura');
    });

    test(`grants ${modifier.power}/${modifier.toughness}`, () => {
      const card = getCard(name);
      // Check oracle text for the modifier
      const expectedModifier = `${modifier.power}/${modifier.toughness}`;
      expect(card.oracle_text).toContain(expectedModifier);
    });
  });
});
