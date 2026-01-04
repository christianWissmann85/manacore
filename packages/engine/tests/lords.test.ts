/**
 * Lords System Tests
 *
 * Tests for Lord creatures and anthem enchantments that grant
 * power/toughness bonuses and keywords to other creatures.
 */

import { describe, test, expect } from 'bun:test';
import {
  CardLoader,
  createCardInstance,
  createGameState,
  getLordBonuses,
  getEffectivePowerWithLords,
  getEffectiveToughnessWithLords,
  hasKeywordWithLords,
  getAllKeywords,
  getCreatureSubtypes,
  hasCreatureSubtype,
} from '../src/index';

// Helper to create a basic game state
function createTestState() {
  const plains = CardLoader.getByName('Plains')!;
  return createGameState(
    [createCardInstance(plains.id, 'player', 'library')],
    [createCardInstance(plains.id, 'opponent', 'library')],
  );
}

// ==========================================
// CREATURE SUBTYPE TESTS
// ==========================================

describe('Creature Subtypes', () => {
  test('getCreatureSubtypes parses single subtype', () => {
    const subtypes = getCreatureSubtypes('Creature — Goblin');
    expect(subtypes).toEqual(['Goblin']);
  });

  test('getCreatureSubtypes parses multiple subtypes', () => {
    const subtypes = getCreatureSubtypes('Creature — Human Wizard');
    expect(subtypes).toEqual(['Human', 'Wizard']);
  });

  test('getCreatureSubtypes handles no subtypes', () => {
    const subtypes = getCreatureSubtypes('Creature');
    expect(subtypes).toEqual([]);
  });

  test('getCreatureSubtypes handles non-creatures', () => {
    const subtypes = getCreatureSubtypes('Enchantment');
    expect(subtypes).toEqual([]);
  });

  test('hasCreatureSubtype returns true for matching subtype', () => {
    expect(hasCreatureSubtype('Creature — Goblin', 'Goblin')).toBe(true);
  });

  test('hasCreatureSubtype is case insensitive', () => {
    expect(hasCreatureSubtype('Creature — Goblin', 'goblin')).toBe(true);
  });

  test('hasCreatureSubtype returns false for non-matching subtype', () => {
    expect(hasCreatureSubtype('Creature — Goblin', 'Merfolk')).toBe(false);
  });
});

// ==========================================
// GOBLIN KING TESTS
// ==========================================

describe('Goblin King', () => {
  test('Goblin King exists with correct stats', () => {
    const card = CardLoader.getByName('Goblin King');
    expect(card).toBeDefined();
    expect(card?.power).toBe('2');
    expect(card?.toughness).toBe('2');
    expect(card?.type_line).toContain('Goblin');
  });

  test('Goblin King grants +1/+1 to other Goblins you control', () => {
    const state = createTestState();

    // Add Goblin King
    const goblinKing = CardLoader.getByName('Goblin King')!;
    const kingCard = createCardInstance(goblinKing.id, 'player', 'battlefield');
    state.players.player.battlefield.push(kingCard);

    // Add a Goblin (Raging Goblin is a 1/1 Goblin with Haste)
    const ragingGoblin = CardLoader.getByName('Raging Goblin')!;
    const goblinCard = createCardInstance(ragingGoblin.id, 'player', 'battlefield');
    state.players.player.battlefield.push(goblinCard);

    // Check the Goblin's effective power/toughness
    const basePower = parseInt(ragingGoblin.power || '0', 10);
    const baseToughness = parseInt(ragingGoblin.toughness || '0', 10);

    const effectivePower = getEffectivePowerWithLords(state, goblinCard, basePower);
    const effectiveToughness = getEffectiveToughnessWithLords(state, goblinCard, baseToughness);

    // Raging Goblin is 1/1, with Goblin King should be 2/2
    expect(effectivePower).toBe(2);
    expect(effectiveToughness).toBe(2);
  });

  test('Goblin King grants mountainwalk to other Goblins', () => {
    const state = createTestState();

    // Add Goblin King
    const goblinKing = CardLoader.getByName('Goblin King')!;
    const kingCard = createCardInstance(goblinKing.id, 'player', 'battlefield');
    state.players.player.battlefield.push(kingCard);

    // Add a Goblin
    const ragingGoblin = CardLoader.getByName('Raging Goblin')!;
    const goblinCard = createCardInstance(ragingGoblin.id, 'player', 'battlefield');
    state.players.player.battlefield.push(goblinCard);

    // Check the Goblin has mountainwalk
    expect(hasKeywordWithLords(state, goblinCard, 'Mountainwalk')).toBe(true);
  });

  test('Goblin King does not buff itself', () => {
    const state = createTestState();

    // Add Goblin King (which is itself a Goblin)
    const goblinKing = CardLoader.getByName('Goblin King')!;
    const kingCard = createCardInstance(goblinKing.id, 'player', 'battlefield');
    state.players.player.battlefield.push(kingCard);

    // Check the King's effective power/toughness (should be base: 2/2)
    const basePower = parseInt(goblinKing.power || '0', 10);
    const baseToughness = parseInt(goblinKing.toughness || '0', 10);

    const effectivePower = getEffectivePowerWithLords(state, kingCard, basePower);
    const effectiveToughness = getEffectiveToughnessWithLords(state, kingCard, baseToughness);

    expect(effectivePower).toBe(2); // Base power, no self-buff
    expect(effectiveToughness).toBe(2);
  });

  test('Goblin King does not buff opponent Goblins', () => {
    const state = createTestState();

    // Add Goblin King to player
    const goblinKing = CardLoader.getByName('Goblin King')!;
    const kingCard = createCardInstance(goblinKing.id, 'player', 'battlefield');
    state.players.player.battlefield.push(kingCard);

    // Add a Goblin to opponent
    const ragingGoblin = CardLoader.getByName('Raging Goblin')!;
    const opponentGoblin = createCardInstance(ragingGoblin.id, 'opponent', 'battlefield');
    state.players.opponent.battlefield.push(opponentGoblin);

    // Check the opponent's Goblin's effective power/toughness
    const basePower = parseInt(ragingGoblin.power || '0', 10);
    const baseToughness = parseInt(ragingGoblin.toughness || '0', 10);

    const effectivePower = getEffectivePowerWithLords(state, opponentGoblin, basePower);
    const effectiveToughness = getEffectiveToughnessWithLords(state, opponentGoblin, baseToughness);

    // Should be 1/1 (no buff from player's Goblin King)
    expect(effectivePower).toBe(1);
    expect(effectiveToughness).toBe(1);
  });

  test('Multiple Goblin Kings stack', () => {
    const state = createTestState();

    // Add two Goblin Kings
    const goblinKing = CardLoader.getByName('Goblin King')!;
    const king1 = createCardInstance(goblinKing.id, 'player', 'battlefield');
    const king2 = createCardInstance(goblinKing.id, 'player', 'battlefield');
    state.players.player.battlefield.push(king1, king2);

    // Add a Goblin
    const ragingGoblin = CardLoader.getByName('Raging Goblin')!;
    const goblinCard = createCardInstance(ragingGoblin.id, 'player', 'battlefield');
    state.players.player.battlefield.push(goblinCard);

    // Check the Goblin gets +2/+2 from both Kings
    const basePower = parseInt(ragingGoblin.power || '0', 10);
    const baseToughness = parseInt(ragingGoblin.toughness || '0', 10);

    const effectivePower = getEffectivePowerWithLords(state, goblinCard, basePower);
    const effectiveToughness = getEffectiveToughnessWithLords(state, goblinCard, baseToughness);

    expect(effectivePower).toBe(3); // 1 + 1 + 1
    expect(effectiveToughness).toBe(3);

    // Each King buffs the other King too
    const king1Power = getEffectivePowerWithLords(state, king1, 2);
    expect(king1Power).toBe(3); // 2 + 1 from other King
  });
});

// ==========================================
// LORD OF ATLANTIS TESTS
// ==========================================

describe('Lord of Atlantis', () => {
  test('Lord of Atlantis exists with correct stats', () => {
    const card = CardLoader.getByName('Lord of Atlantis');
    expect(card).toBeDefined();
    expect(card?.power).toBe('2');
    expect(card?.toughness).toBe('2');
    expect(card?.type_line).toContain('Merfolk');
  });

  test('Lord of Atlantis grants +1/+1 to other Merfolk', () => {
    const state = createTestState();

    // Add Lord of Atlantis
    const lord = CardLoader.getByName('Lord of Atlantis')!;
    const lordCard = createCardInstance(lord.id, 'player', 'battlefield');
    state.players.player.battlefield.push(lordCard);

    // Add another Merfolk
    const merfolk = CardLoader.getByName('Merfolk of the Pearl Trident')!;
    const merfolkCard = createCardInstance(merfolk.id, 'player', 'battlefield');
    state.players.player.battlefield.push(merfolkCard);

    // Check the Merfolk's effective power/toughness
    const basePower = parseInt(merfolk.power || '0', 10);
    const baseToughness = parseInt(merfolk.toughness || '0', 10);

    const effectivePower = getEffectivePowerWithLords(state, merfolkCard, basePower);
    const effectiveToughness = getEffectiveToughnessWithLords(state, merfolkCard, baseToughness);

    // Merfolk of the Pearl Trident is 1/1, with Lord should be 2/2
    expect(effectivePower).toBe(2);
    expect(effectiveToughness).toBe(2);
  });

  test('Lord of Atlantis grants islandwalk to other Merfolk', () => {
    const state = createTestState();

    // Add Lord of Atlantis
    const lord = CardLoader.getByName('Lord of Atlantis')!;
    const lordCard = createCardInstance(lord.id, 'player', 'battlefield');
    state.players.player.battlefield.push(lordCard);

    // Add another Merfolk
    const merfolk = CardLoader.getByName('Merfolk of the Pearl Trident')!;
    const merfolkCard = createCardInstance(merfolk.id, 'player', 'battlefield');
    state.players.player.battlefield.push(merfolkCard);

    // Check the Merfolk has islandwalk
    expect(hasKeywordWithLords(state, merfolkCard, 'Islandwalk')).toBe(true);
  });

  test('Lord of Atlantis affects ALL Merfolk (including opponent)', () => {
    const state = createTestState();

    // Add Lord of Atlantis to player
    const lord = CardLoader.getByName('Lord of Atlantis')!;
    const lordCard = createCardInstance(lord.id, 'player', 'battlefield');
    state.players.player.battlefield.push(lordCard);

    // Add Merfolk to opponent
    const merfolk = CardLoader.getByName('Merfolk of the Pearl Trident')!;
    const opponentMerfolk = createCardInstance(merfolk.id, 'opponent', 'battlefield');
    state.players.opponent.battlefield.push(opponentMerfolk);

    // Check the opponent's Merfolk gets the buff too
    const basePower = parseInt(merfolk.power || '0', 10);
    const effectivePower = getEffectivePowerWithLords(state, opponentMerfolk, basePower);

    // Lord of Atlantis says "Other Merfolk" - affects all, not just yours
    expect(effectivePower).toBe(2);
  });
});

// ==========================================
// ALL KEYWORDS TEST
// ==========================================

describe('getAllKeywords', () => {
  test('getAllKeywords includes native keywords', () => {
    const state = createTestState();

    const ragingGoblin = CardLoader.getByName('Raging Goblin')!;
    const goblinCard = createCardInstance(ragingGoblin.id, 'player', 'battlefield');
    state.players.player.battlefield.push(goblinCard);

    const keywords = getAllKeywords(state, goblinCard);
    expect(keywords).toContain('Haste');
  });

  test('getAllKeywords includes granted keywords from Lords', () => {
    const state = createTestState();

    // Add Goblin King
    const goblinKing = CardLoader.getByName('Goblin King')!;
    const kingCard = createCardInstance(goblinKing.id, 'player', 'battlefield');
    state.players.player.battlefield.push(kingCard);

    // Add a Goblin
    const ragingGoblin = CardLoader.getByName('Raging Goblin')!;
    const goblinCard = createCardInstance(ragingGoblin.id, 'player', 'battlefield');
    state.players.player.battlefield.push(goblinCard);

    const keywords = getAllKeywords(state, goblinCard);
    expect(keywords).toContain('Haste'); // Native
    expect(keywords).toContain('Mountainwalk'); // From Goblin King
  });
});

// ==========================================
// NO LORD EFFECTS TESTS
// ==========================================

describe('Non-Lord Creatures', () => {
  test('Non-Goblin creatures do not get Goblin King bonus', () => {
    const state = createTestState();

    // Add Goblin King
    const goblinKing = CardLoader.getByName('Goblin King')!;
    const kingCard = createCardInstance(goblinKing.id, 'player', 'battlefield');
    state.players.player.battlefield.push(kingCard);

    // Add a non-Goblin creature
    const grizzly = CardLoader.getByName('Grizzly Bears')!;
    const bearsCard = createCardInstance(grizzly.id, 'player', 'battlefield');
    state.players.player.battlefield.push(bearsCard);

    // Check the Bears don't get buffed
    const basePower = parseInt(grizzly.power || '0', 10);
    const baseToughness = parseInt(grizzly.toughness || '0', 10);

    const effectivePower = getEffectivePowerWithLords(state, bearsCard, basePower);
    const effectiveToughness = getEffectiveToughnessWithLords(state, bearsCard, baseToughness);

    expect(effectivePower).toBe(2); // Base power
    expect(effectiveToughness).toBe(2);
    expect(hasKeywordWithLords(state, bearsCard, 'Mountainwalk')).toBe(false);
  });
});

// ==========================================
// CRUSADE TESTS
// ==========================================

describe('Crusade', () => {
  test('Crusade grants +1/+1 to white creatures', () => {
    const state = createTestState();

    // Add Crusade enchantment
    const crusade = CardLoader.getByName('Crusade')!;
    const crusadeCard = createCardInstance(crusade.id, 'player', 'battlefield');
    state.players.player.battlefield.push(crusadeCard);

    // Add a white creature (Infantry Veteran 1/1)
    const veteran = CardLoader.getByName('Infantry Veteran')!;
    const veteranCard = createCardInstance(veteran.id, 'player', 'battlefield');
    state.players.player.battlefield.push(veteranCard);

    // Check the white creature gets +1/+1
    const basePower = parseInt(veteran.power || '0', 10);
    const baseToughness = parseInt(veteran.toughness || '0', 10);

    const effectivePower = getEffectivePowerWithLords(state, veteranCard, basePower);
    const effectiveToughness = getEffectiveToughnessWithLords(state, veteranCard, baseToughness);

    // Infantry Veteran is 1/1, with Crusade should be 2/2
    expect(effectivePower).toBe(2);
    expect(effectiveToughness).toBe(2);
  });

  test('Crusade does not affect non-white creatures', () => {
    const state = createTestState();

    // Add Crusade enchantment
    const crusade = CardLoader.getByName('Crusade')!;
    const crusadeCard = createCardInstance(crusade.id, 'player', 'battlefield');
    state.players.player.battlefield.push(crusadeCard);

    // Add a green creature
    const bears = CardLoader.getByName('Grizzly Bears')!;
    const bearsCard = createCardInstance(bears.id, 'player', 'battlefield');
    state.players.player.battlefield.push(bearsCard);

    // Check the green creature doesn't get the buff
    const effectivePower = getEffectivePowerWithLords(state, bearsCard, 2);
    expect(effectivePower).toBe(2); // Still 2/2
  });

  test('Crusade affects opponent white creatures too', () => {
    const state = createTestState();

    // Add Crusade to player
    const crusade = CardLoader.getByName('Crusade')!;
    const crusadeCard = createCardInstance(crusade.id, 'player', 'battlefield');
    state.players.player.battlefield.push(crusadeCard);

    // Add white creature to opponent
    const veteran = CardLoader.getByName('Infantry Veteran')!;
    const opponentVeteran = createCardInstance(veteran.id, 'opponent', 'battlefield');
    state.players.opponent.battlefield.push(opponentVeteran);

    // Check opponent's white creature gets +1/+1
    const effectivePower = getEffectivePowerWithLords(state, opponentVeteran, 1);
    expect(effectivePower).toBe(2);
  });
});

// ==========================================
// DREAD OF NIGHT TESTS
// ==========================================

describe('Dread of Night', () => {
  test('Dread of Night gives white creatures -1/-1', () => {
    const state = createTestState();

    // Add Dread of Night enchantment
    const dread = CardLoader.getByName('Dread of Night')!;
    const dreadCard = createCardInstance(dread.id, 'player', 'battlefield');
    state.players.player.battlefield.push(dreadCard);

    // Add a white creature (Infantry Veteran 1/1)
    const veteran = CardLoader.getByName('Infantry Veteran')!;
    const veteranCard = createCardInstance(veteran.id, 'player', 'battlefield');
    state.players.player.battlefield.push(veteranCard);

    // Check the white creature gets -1/-1
    const effectivePower = getEffectivePowerWithLords(state, veteranCard, 1);
    const effectiveToughness = getEffectiveToughnessWithLords(state, veteranCard, 1);

    expect(effectivePower).toBe(0);
    expect(effectiveToughness).toBe(0);
  });

  test('Dread of Night does not affect non-white creatures', () => {
    const state = createTestState();

    // Add Dread of Night enchantment
    const dread = CardLoader.getByName('Dread of Night')!;
    const dreadCard = createCardInstance(dread.id, 'player', 'battlefield');
    state.players.player.battlefield.push(dreadCard);

    // Add a green creature
    const bears = CardLoader.getByName('Grizzly Bears')!;
    const bearsCard = createCardInstance(bears.id, 'player', 'battlefield');
    state.players.player.battlefield.push(bearsCard);

    // Check the green creature is unaffected
    const effectivePower = getEffectivePowerWithLords(state, bearsCard, 2);
    expect(effectivePower).toBe(2);
  });
});

// ==========================================
// CASTLE TESTS
// ==========================================

describe('Castle', () => {
  test('Castle gives +0/+2 to untapped creatures you control', () => {
    const state = createTestState();

    // Add Castle enchantment
    const castle = CardLoader.getByName('Castle')!;
    const castleCard = createCardInstance(castle.id, 'player', 'battlefield');
    state.players.player.battlefield.push(castleCard);

    // Add an untapped creature
    const bears = CardLoader.getByName('Grizzly Bears')!;
    const bearsCard = createCardInstance(bears.id, 'player', 'battlefield');
    bearsCard.tapped = false;
    state.players.player.battlefield.push(bearsCard);

    // Check the untapped creature gets +0/+2
    const effectivePower = getEffectivePowerWithLords(state, bearsCard, 2);
    const effectiveToughness = getEffectiveToughnessWithLords(state, bearsCard, 2);

    expect(effectivePower).toBe(2); // No power bonus
    expect(effectiveToughness).toBe(4); // +2 toughness
  });

  test('Castle does not affect tapped creatures', () => {
    const state = createTestState();

    // Add Castle enchantment
    const castle = CardLoader.getByName('Castle')!;
    const castleCard = createCardInstance(castle.id, 'player', 'battlefield');
    state.players.player.battlefield.push(castleCard);

    // Add a tapped creature
    const bears = CardLoader.getByName('Grizzly Bears')!;
    const bearsCard = createCardInstance(bears.id, 'player', 'battlefield');
    bearsCard.tapped = true;
    state.players.player.battlefield.push(bearsCard);

    // Check the tapped creature doesn't get the buff
    const effectiveToughness = getEffectiveToughnessWithLords(state, bearsCard, 2);
    expect(effectiveToughness).toBe(2);
  });

  test('Castle does not affect opponent creatures', () => {
    const state = createTestState();

    // Add Castle to player
    const castle = CardLoader.getByName('Castle')!;
    const castleCard = createCardInstance(castle.id, 'player', 'battlefield');
    state.players.player.battlefield.push(castleCard);

    // Add untapped creature to opponent
    const bears = CardLoader.getByName('Grizzly Bears')!;
    const opponentBears = createCardInstance(bears.id, 'opponent', 'battlefield');
    opponentBears.tapped = false;
    state.players.opponent.battlefield.push(opponentBears);

    // Check opponent's creature doesn't get the buff
    const effectiveToughness = getEffectiveToughnessWithLords(state, opponentBears, 2);
    expect(effectiveToughness).toBe(2);
  });
});

// ==========================================
// FERVOR TESTS
// ==========================================

describe('Fervor', () => {
  test('Fervor grants haste to creatures you control', () => {
    const state = createTestState();

    // Add Fervor enchantment
    const fervor = CardLoader.getByName('Fervor')!;
    const fervorCard = createCardInstance(fervor.id, 'player', 'battlefield');
    state.players.player.battlefield.push(fervorCard);

    // Add a creature without haste
    const bears = CardLoader.getByName('Grizzly Bears')!;
    const bearsCard = createCardInstance(bears.id, 'player', 'battlefield');
    state.players.player.battlefield.push(bearsCard);

    // Check the creature has haste
    expect(hasKeywordWithLords(state, bearsCard, 'Haste')).toBe(true);
    expect(getAllKeywords(state, bearsCard)).toContain('Haste');
  });

  test('Fervor does not affect opponent creatures', () => {
    const state = createTestState();

    // Add Fervor to player
    const fervor = CardLoader.getByName('Fervor')!;
    const fervorCard = createCardInstance(fervor.id, 'player', 'battlefield');
    state.players.player.battlefield.push(fervorCard);

    // Add creature to opponent
    const bears = CardLoader.getByName('Grizzly Bears')!;
    const opponentBears = createCardInstance(bears.id, 'opponent', 'battlefield');
    state.players.opponent.battlefield.push(opponentBears);

    // Check opponent's creature doesn't have haste
    expect(hasKeywordWithLords(state, opponentBears, 'Haste')).toBe(false);
  });
});

// ==========================================
// SERRA'S BLESSING TESTS
// ==========================================

describe("Serra's Blessing", () => {
  test("Serra's Blessing grants vigilance to creatures you control", () => {
    const state = createTestState();

    // Add Serra's Blessing enchantment
    const blessing = CardLoader.getByName("Serra's Blessing")!;
    const blessingCard = createCardInstance(blessing.id, 'player', 'battlefield');
    state.players.player.battlefield.push(blessingCard);

    // Add a creature without vigilance
    const bears = CardLoader.getByName('Grizzly Bears')!;
    const bearsCard = createCardInstance(bears.id, 'player', 'battlefield');
    state.players.player.battlefield.push(bearsCard);

    // Check the creature has vigilance
    expect(hasKeywordWithLords(state, bearsCard, 'Vigilance')).toBe(true);
    expect(getAllKeywords(state, bearsCard)).toContain('Vigilance');
  });

  test("Serra's Blessing does not affect opponent creatures", () => {
    const state = createTestState();

    // Add Serra's Blessing to player
    const blessing = CardLoader.getByName("Serra's Blessing")!;
    const blessingCard = createCardInstance(blessing.id, 'player', 'battlefield');
    state.players.player.battlefield.push(blessingCard);

    // Add creature to opponent
    const bears = CardLoader.getByName('Grizzly Bears')!;
    const opponentBears = createCardInstance(bears.id, 'opponent', 'battlefield');
    state.players.opponent.battlefield.push(opponentBears);

    // Check opponent's creature doesn't have vigilance
    expect(hasKeywordWithLords(state, opponentBears, 'Vigilance')).toBe(false);
  });
});

// ==========================================
// ORCISH ORIFLAMME TESTS
// ==========================================

describe('Orcish Oriflamme', () => {
  test('Orcish Oriflamme gives +1/+0 to attacking creatures you control', () => {
    const state = createTestState();

    // Add Orcish Oriflamme enchantment
    const oriflamme = CardLoader.getByName('Orcish Oriflamme')!;
    const oriflammeCard = createCardInstance(oriflamme.id, 'player', 'battlefield');
    state.players.player.battlefield.push(oriflammeCard);

    // Add an attacking creature
    const bears = CardLoader.getByName('Grizzly Bears')!;
    const bearsCard = createCardInstance(bears.id, 'player', 'battlefield');
    bearsCard.attacking = true;
    state.players.player.battlefield.push(bearsCard);

    // Check the attacking creature gets +1/+0
    const effectivePower = getEffectivePowerWithLords(state, bearsCard, 2);
    const effectiveToughness = getEffectiveToughnessWithLords(state, bearsCard, 2);

    expect(effectivePower).toBe(3); // +1 power
    expect(effectiveToughness).toBe(2); // No toughness bonus
  });

  test('Orcish Oriflamme does not affect non-attacking creatures', () => {
    const state = createTestState();

    // Add Orcish Oriflamme enchantment
    const oriflamme = CardLoader.getByName('Orcish Oriflamme')!;
    const oriflammeCard = createCardInstance(oriflamme.id, 'player', 'battlefield');
    state.players.player.battlefield.push(oriflammeCard);

    // Add a non-attacking creature
    const bears = CardLoader.getByName('Grizzly Bears')!;
    const bearsCard = createCardInstance(bears.id, 'player', 'battlefield');
    bearsCard.attacking = false;
    state.players.player.battlefield.push(bearsCard);

    // Check the non-attacking creature doesn't get the buff
    const effectivePower = getEffectivePowerWithLords(state, bearsCard, 2);
    expect(effectivePower).toBe(2);
  });

  test('Orcish Oriflamme does not affect opponent attacking creatures', () => {
    const state = createTestState();

    // Add Orcish Oriflamme to player
    const oriflamme = CardLoader.getByName('Orcish Oriflamme')!;
    const oriflammeCard = createCardInstance(oriflamme.id, 'player', 'battlefield');
    state.players.player.battlefield.push(oriflammeCard);

    // Add attacking creature to opponent
    const bears = CardLoader.getByName('Grizzly Bears')!;
    const opponentBears = createCardInstance(bears.id, 'opponent', 'battlefield');
    opponentBears.attacking = true;
    state.players.opponent.battlefield.push(opponentBears);

    // Check opponent's creature doesn't get the buff
    const effectivePower = getEffectivePowerWithLords(state, opponentBears, 2);
    expect(effectivePower).toBe(2);
  });
});

// ==========================================
// COMBINED EFFECTS TESTS
// ==========================================

describe('Combined Lord and Anthem Effects', () => {
  test('Multiple effects stack correctly', () => {
    const state = createTestState();

    // Add Crusade (+1/+1 to white)
    const crusade = CardLoader.getByName('Crusade')!;
    const crusadeCard = createCardInstance(crusade.id, 'player', 'battlefield');
    state.players.player.battlefield.push(crusadeCard);

    // Add a second Crusade
    const crusade2 = createCardInstance(crusade.id, 'player', 'battlefield');
    state.players.player.battlefield.push(crusade2);

    // Add a white creature
    const veteran = CardLoader.getByName('Infantry Veteran')!;
    const veteranCard = createCardInstance(veteran.id, 'player', 'battlefield');
    state.players.player.battlefield.push(veteranCard);

    // Check the creature gets +2/+2 from both Crusades
    const effectivePower = getEffectivePowerWithLords(state, veteranCard, 1);
    const effectiveToughness = getEffectiveToughnessWithLords(state, veteranCard, 1);

    expect(effectivePower).toBe(3); // 1 + 1 + 1
    expect(effectiveToughness).toBe(3);
  });

  test('Crusade and Dread of Night cancel each other', () => {
    const state = createTestState();

    // Add Crusade (+1/+1 to white)
    const crusade = CardLoader.getByName('Crusade')!;
    const crusadeCard = createCardInstance(crusade.id, 'player', 'battlefield');
    state.players.player.battlefield.push(crusadeCard);

    // Add Dread of Night (-1/-1 to white)
    const dread = CardLoader.getByName('Dread of Night')!;
    const dreadCard = createCardInstance(dread.id, 'player', 'battlefield');
    state.players.player.battlefield.push(dreadCard);

    // Add a white creature
    const veteran = CardLoader.getByName('Infantry Veteran')!;
    const veteranCard = createCardInstance(veteran.id, 'player', 'battlefield');
    state.players.player.battlefield.push(veteranCard);

    // Check the creature gets net +0/+0
    const effectivePower = getEffectivePowerWithLords(state, veteranCard, 1);
    const effectiveToughness = getEffectiveToughnessWithLords(state, veteranCard, 1);

    expect(effectivePower).toBe(1);
    expect(effectiveToughness).toBe(1);
  });

  test('Goblin King + Oriflamme + Castle on attacking untapped Goblin', () => {
    const state = createTestState();

    // Add Goblin King (+1/+1 to Goblins)
    const goblinKing = CardLoader.getByName('Goblin King')!;
    const kingCard = createCardInstance(goblinKing.id, 'player', 'battlefield');
    state.players.player.battlefield.push(kingCard);

    // Add Orcish Oriflamme (+1/+0 when attacking)
    const oriflamme = CardLoader.getByName('Orcish Oriflamme')!;
    const oriflammeCard = createCardInstance(oriflamme.id, 'player', 'battlefield');
    state.players.player.battlefield.push(oriflammeCard);

    // Add Castle (+0/+2 when untapped)
    const castle = CardLoader.getByName('Castle')!;
    const castleCard = createCardInstance(castle.id, 'player', 'battlefield');
    state.players.player.battlefield.push(castleCard);

    // Add an attacking but untapped Goblin (e.g., has vigilance or Fervor scenario)
    const ragingGoblin = CardLoader.getByName('Raging Goblin')!;
    const goblinCard = createCardInstance(ragingGoblin.id, 'player', 'battlefield');
    goblinCard.attacking = true;
    goblinCard.tapped = false; // Untapped (vigilance scenario)
    state.players.player.battlefield.push(goblinCard);

    // Raging Goblin base: 1/1
    // +1/+1 from Goblin King
    // +1/+0 from Oriflamme (attacking)
    // +0/+2 from Castle (untapped)
    // Total: 3/4
    const effectivePower = getEffectivePowerWithLords(state, goblinCard, 1);
    const effectiveToughness = getEffectiveToughnessWithLords(state, goblinCard, 1);

    expect(effectivePower).toBe(3);
    expect(effectiveToughness).toBe(4);
  });
});

// ==========================================
// BATCH VERIFICATION
// ==========================================

describe('Lords Batch Verification', () => {
  test('Goblin King card exists in database', () => {
    const card = CardLoader.getByName('Goblin King');
    expect(card).toBeDefined();
    expect(card?.type_line).toContain('Creature');
    expect(card?.type_line).toContain('Goblin');
  });

  test('Lord of Atlantis card exists in database', () => {
    const card = CardLoader.getByName('Lord of Atlantis');
    expect(card).toBeDefined();
    expect(card?.type_line).toContain('Creature');
    expect(card?.type_line).toContain('Merfolk');
  });

  test('Test Goblin creatures exist', () => {
    const ragingGoblin = CardLoader.getByName('Raging Goblin');
    expect(ragingGoblin).toBeDefined();
    expect(ragingGoblin?.type_line).toContain('Goblin');
  });

  test('Test Merfolk creatures exist', () => {
    const merfolk = CardLoader.getByName('Merfolk of the Pearl Trident');
    expect(merfolk).toBeDefined();
    expect(merfolk?.type_line).toContain('Merfolk');
  });
});
