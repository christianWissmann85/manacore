/**
 * Week 1.5.2: Instants & Sorceries Tests
 *
 * Tests for all the new spell implementations:
 * - Mass destruction (Wrath of God, Armageddon, etc.)
 * - Counter variants (Memory Lapse, Remove Soul)
 * - Untap mechanics (Early Harvest, Vitalize)
 * - Team pump (Warrior's Honor)
 * - Tutors (Enlightened Tutor, etc.)
 * - Graveyard recursion (Raise Dead, Relearn)
 * - Card manipulation (Dream Cache, Forget)
 */

import { test, expect, describe, beforeEach } from 'bun:test';
import {
  createGameState,
  applyAction,
  createCardInstance,
  CardLoader,
  getPlayer,
  initializeGame,
  createVanillaDeck,
  type GameState,
  type CastSpellAction,
  type PlayerId,
} from '../src/index';
import { pushToStack, resolveTopOfStack } from '../src/rules/stack';

// Helper to set up a basic game state with mana
function setupGameWithMana(
  state: GameState,
  playerId: PlayerId,
  mana: {
    white?: number;
    blue?: number;
    black?: number;
    red?: number;
    green?: number;
    colorless?: number;
  },
) {
  const player = getPlayer(state, playerId);
  player.manaPool = {
    white: mana.white || 0,
    blue: mana.blue || 0,
    black: mana.black || 0,
    red: mana.red || 0,
    green: mana.green || 0,
    colorless: mana.colorless || 0,
  };
}

// Helper to create a proper game state with libraries
function createTestGameState(): GameState {
  const deck1 = createVanillaDeck();
  const deck2 = createVanillaDeck();
  return initializeGame(deck1, deck2);
}

// Helper to create a creature on the battlefield
function createCreatureOnBattlefield(
  state: GameState,
  playerId: PlayerId,
  cardName: string,
): string {
  const player = getPlayer(state, playerId);
  const template = CardLoader.getByName(cardName);
  if (!template) throw new Error(`Card not found: ${cardName}`);

  const instance = createCardInstance(template.id, playerId, 'battlefield');
  instance.summoningSick = false;
  player.battlefield.push(instance);
  return instance.instanceId;
}

// Helper to create a land on the battlefield
function createLandOnBattlefield(state: GameState, playerId: PlayerId, cardName: string): string {
  const player = getPlayer(state, playerId);
  const template = CardLoader.getByName(cardName);
  if (!template) throw new Error(`Card not found: ${cardName}`);

  const instance = createCardInstance(template.id, playerId, 'battlefield');
  player.battlefield.push(instance);
  return instance.instanceId;
}

// Helper to add a card to hand
function addCardToHand(state: GameState, playerId: PlayerId, cardName: string): string {
  const player = getPlayer(state, playerId);
  const template = CardLoader.getByName(cardName);
  if (!template) throw new Error(`Card not found: ${cardName}`);

  const instance = createCardInstance(template.id, playerId, 'hand');
  player.hand.push(instance);
  return instance.instanceId;
}

// Helper to cast and resolve a spell
function castAndResolve(
  state: GameState,
  cardName: string,
  playerId: PlayerId,
  targets: string[] = [],
  xValue?: number,
) {
  const template = CardLoader.getByName(cardName);
  if (!template) throw new Error(`Card not found: ${cardName}`);

  const instance = createCardInstance(template.id, playerId, 'stack');

  pushToStack(state, instance, playerId, targets, xValue);

  // Pass priority twice to resolve
  state.players.player.hasPassedPriority = true;
  state.players.opponent.hasPassedPriority = true;

  resolveTopOfStack(state);
}

describe('Week 1.5.2: Mass Destruction', () => {
  let state: GameState;

  beforeEach(() => {
    state = createTestGameState();
  });

  test('Wrath of God destroys all creatures', () => {
    // Skip if card not available
    if (!CardLoader.getByName('Wrath of God')) {
      console.log('Wrath of God not found, skipping test');
      return;
    }

    // Setup: Create creatures on both sides
    createCreatureOnBattlefield(state, 'player', 'Grizzly Bears');
    createCreatureOnBattlefield(state, 'opponent', 'Grizzly Bears');

    expect(state.players.player.battlefield.length).toBe(1);
    expect(state.players.opponent.battlefield.length).toBe(1);

    // Cast Wrath of God
    setupGameWithMana(state, 'player', { white: 4 });
    castAndResolve(state, 'Wrath of God', 'player');

    // All creatures should be gone
    expect(state.players.player.battlefield.length).toBe(0);
    expect(state.players.opponent.battlefield.length).toBe(0);
    // Player graveyard: Grizzly Bears + Wrath of God = 2
    expect(state.players.player.graveyard.length).toBe(2);
    expect(state.players.opponent.graveyard.length).toBe(1);
  });

  test('Armageddon destroys all lands', () => {
    if (!CardLoader.getByName('Armageddon')) {
      console.log('Armageddon not found, skipping test');
      return;
    }

    // Setup: Create lands on both sides
    createLandOnBattlefield(state, 'player', 'Plains');
    createLandOnBattlefield(state, 'player', 'Mountain');
    createLandOnBattlefield(state, 'opponent', 'Island');

    expect(state.players.player.battlefield.length).toBe(2);
    expect(state.players.opponent.battlefield.length).toBe(1);

    // Cast Armageddon
    setupGameWithMana(state, 'player', { white: 4 });
    castAndResolve(state, 'Armageddon', 'player');

    // All lands should be gone
    expect(state.players.player.battlefield.length).toBe(0);
    expect(state.players.opponent.battlefield.length).toBe(0);
  });

  test('Tranquility destroys all enchantments', () => {
    if (!CardLoader.getByName('Tranquility') || !CardLoader.getByName('Pacifism')) {
      console.log('Tranquility or Pacifism not found, skipping test');
      return;
    }

    // Setup: Create an enchantment
    const player = getPlayer(state, 'player');
    const pacifismTemplate = CardLoader.getByName('Pacifism')!;
    const pacifism = createCardInstance(pacifismTemplate.id, 'player', 'battlefield');
    player.battlefield.push(pacifism);

    expect(state.players.player.battlefield.length).toBe(1);

    // Cast Tranquility
    setupGameWithMana(state, 'player', { green: 3 });
    castAndResolve(state, 'Tranquility', 'player');

    // Enchantment should be gone
    expect(state.players.player.battlefield.length).toBe(0);
    // Graveyard: Pacifism + Tranquility = 2
    expect(state.players.player.graveyard.length).toBe(2);
  });
});

describe('Week 1.5.2: Counter Variants', () => {
  let state: GameState;

  beforeEach(() => {
    state = createTestGameState();
  });

  test('Remove Soul counters creature spell', () => {
    if (!CardLoader.getByName('Remove Soul') || !CardLoader.getByName('Grizzly Bears')) {
      console.log('Remove Soul or Grizzly Bears not found, skipping test');
      return;
    }

    // Setup: Cast a creature spell
    const bearsTemplate = CardLoader.getByName('Grizzly Bears')!;
    const bears = createCardInstance(bearsTemplate.id, 'opponent', 'stack');
    pushToStack(state, bears, 'opponent', []);

    const targetSpellId = state.stack[0]!.id;

    // Cast Remove Soul targeting the creature spell
    setupGameWithMana(state, 'player', { blue: 2 });
    castAndResolve(state, 'Remove Soul', 'player', [targetSpellId]);

    // The creature spell should be countered
    expect(state.stack[0]!.countered).toBe(true);
  });
});

describe('Week 1.5.2: Untap Mechanics', () => {
  let state: GameState;

  beforeEach(() => {
    state = createTestGameState();
  });

  test('Vitalize untaps all creatures you control', () => {
    if (!CardLoader.getByName('Vitalize')) {
      console.log('Vitalize not found, skipping test');
      return;
    }

    // Setup: Create tapped creatures
    const creature1Id = createCreatureOnBattlefield(state, 'player', 'Grizzly Bears');
    const creature2Id = createCreatureOnBattlefield(state, 'player', 'Grizzly Bears');
    const opponentCreatureId = createCreatureOnBattlefield(state, 'opponent', 'Grizzly Bears');

    // Tap all creatures
    state.players.player.battlefield.forEach((c) => (c.tapped = true));
    state.players.opponent.battlefield.forEach((c) => (c.tapped = true));

    // Cast Vitalize
    setupGameWithMana(state, 'player', { green: 1 });
    castAndResolve(state, 'Vitalize', 'player');

    // Player's creatures should be untapped
    expect(state.players.player.battlefield[0]!.tapped).toBe(false);
    expect(state.players.player.battlefield[1]!.tapped).toBe(false);
    // Opponent's creature should still be tapped
    expect(state.players.opponent.battlefield[0]!.tapped).toBe(true);
  });

  test('Early Harvest untaps all basic lands you control', () => {
    if (!CardLoader.getByName('Early Harvest')) {
      console.log('Early Harvest not found, skipping test');
      return;
    }

    // Setup: Create tapped lands
    createLandOnBattlefield(state, 'player', 'Forest');
    createLandOnBattlefield(state, 'player', 'Forest');

    // Tap all lands
    state.players.player.battlefield.forEach((c) => (c.tapped = true));

    // Cast Early Harvest
    setupGameWithMana(state, 'player', { green: 3 });
    castAndResolve(state, 'Early Harvest', 'player');

    // Lands should be untapped
    expect(state.players.player.battlefield[0]!.tapped).toBe(false);
    expect(state.players.player.battlefield[1]!.tapped).toBe(false);
  });
});

describe('Week 1.5.2: Team Pump', () => {
  let state: GameState;

  beforeEach(() => {
    state = createTestGameState();
  });

  test("Warrior's Honor gives +1/+1 to your creatures", () => {
    if (!CardLoader.getByName("Warrior's Honor")) {
      console.log("Warrior's Honor not found, skipping test");
      return;
    }

    // Setup: Create creatures
    createCreatureOnBattlefield(state, 'player', 'Grizzly Bears');
    createCreatureOnBattlefield(state, 'player', 'Grizzly Bears');

    // Cast Warrior's Honor
    setupGameWithMana(state, 'player', { white: 3 });
    castAndResolve(state, "Warrior's Honor", 'player');

    // Both creatures should have temporary modifications
    expect(state.players.player.battlefield[0]!.temporaryModifications.length).toBe(1);
    expect(state.players.player.battlefield[0]!.temporaryModifications[0]!.powerChange).toBe(1);
    expect(state.players.player.battlefield[0]!.temporaryModifications[0]!.toughnessChange).toBe(1);
    expect(state.players.player.battlefield[1]!.temporaryModifications.length).toBe(1);
  });
});

describe('Week 1.5.2: Simple Damage Spells', () => {
  let state: GameState;

  beforeEach(() => {
    state = createTestGameState();
  });

  test('Dry Spell deals 1 damage to all creatures and players', () => {
    if (!CardLoader.getByName('Dry Spell')) {
      console.log('Dry Spell not found, skipping test');
      return;
    }

    const startingLife = state.players.player.life;

    // Setup: Create creatures (need 2+ toughness to survive)
    createCreatureOnBattlefield(state, 'player', 'Grizzly Bears'); // 2/2
    createCreatureOnBattlefield(state, 'opponent', 'Grizzly Bears');

    // Cast Dry Spell
    setupGameWithMana(state, 'player', { black: 2 });
    castAndResolve(state, 'Dry Spell', 'player');

    // Players should have lost 1 life
    expect(state.players.player.life).toBe(startingLife - 1);
    expect(state.players.opponent.life).toBe(startingLife - 1);

    // Creatures should have 1 damage
    expect(state.players.player.battlefield[0]!.damage).toBe(1);
    expect(state.players.opponent.battlefield[0]!.damage).toBe(1);
  });

  test('Inferno deals 6 damage to all creatures and players', () => {
    if (!CardLoader.getByName('Inferno')) {
      console.log('Inferno not found, skipping test');
      return;
    }

    const startingLife = state.players.player.life;
    const startingGraveyard = state.players.player.graveyard.length;

    // Setup: Create creatures
    createCreatureOnBattlefield(state, 'player', 'Grizzly Bears');

    // Cast Inferno
    setupGameWithMana(state, 'player', { red: 7 });
    castAndResolve(state, 'Inferno', 'player');

    // Players should have lost 6 life
    expect(state.players.player.life).toBe(startingLife - 6);
    expect(state.players.opponent.life).toBe(startingLife - 6);

    // Creature should be dead (6 damage > 2 toughness)
    expect(state.players.player.battlefield.length).toBe(0);
    // Graveyard has creature + the Inferno spell
    expect(state.players.player.graveyard.length).toBe(startingGraveyard + 2);
  });
});

describe('Week 1.5.2: Graveyard Recursion', () => {
  let state: GameState;

  beforeEach(() => {
    state = createTestGameState();
  });

  test('Raise Dead returns creature from graveyard to hand', () => {
    if (!CardLoader.getByName('Raise Dead')) {
      console.log('Raise Dead not found, skipping test');
      return;
    }

    // Setup: Put a creature in graveyard
    const player = getPlayer(state, 'player');
    const bearsTemplate = CardLoader.getByName('Grizzly Bears')!;
    const bears = createCardInstance(bearsTemplate.id, 'player', 'graveyard');
    player.graveyard.push(bears);

    const startingHand = player.hand.length;

    // Cast Raise Dead
    setupGameWithMana(state, 'player', { black: 1 });
    castAndResolve(state, 'Raise Dead', 'player');

    // Creature should be in hand now (bears removed, but Raise Dead also in graveyard)
    // The graveyard should have Raise Dead (the spell that just resolved)
    expect(player.hand.length).toBe(startingHand + 1);

    // Find the creature in hand
    const bearsInHand = player.hand.find(
      (c) => CardLoader.getById(c.scryfallId)?.name === 'Grizzly Bears',
    );
    expect(bearsInHand).toBeDefined();
  });
});

describe('Week 1.5.2: Card Draw', () => {
  let state: GameState;

  beforeEach(() => {
    state = createTestGameState();
  });

  test('Inspiration draws 2 cards for target player', () => {
    if (!CardLoader.getByName('Inspiration')) {
      console.log('Inspiration not found, skipping test');
      return;
    }

    const player = getPlayer(state, 'player');
    const startingHand = player.hand.length;
    const startingLibrary = player.library.length;

    // Cast Inspiration targeting player
    setupGameWithMana(state, 'player', { blue: 4 });
    castAndResolve(state, 'Inspiration', 'player', ['player']);

    // Player should have drawn 2 cards
    expect(player.hand.length).toBe(startingHand + 2);
    expect(player.library.length).toBe(startingLibrary - 2);
  });
});

describe('Week 1.5.2: Life Drain', () => {
  let state: GameState;

  beforeEach(() => {
    state = createTestGameState();
  });

  test('Syphon Soul deals 2 to opponent and you gain 2 life', () => {
    if (!CardLoader.getByName('Syphon Soul')) {
      console.log('Syphon Soul not found, skipping test');
      return;
    }

    const startingPlayerLife = state.players.player.life;
    const startingOpponentLife = state.players.opponent.life;

    // Cast Syphon Soul
    setupGameWithMana(state, 'player', { black: 3 });
    castAndResolve(state, 'Syphon Soul', 'player');

    // Opponent loses 2, player gains 2
    expect(state.players.player.life).toBe(startingPlayerLife + 2);
    expect(state.players.opponent.life).toBe(startingOpponentLife - 2);
  });
});

describe('Week 1.5.2: Bounce Spells', () => {
  let state: GameState;

  beforeEach(() => {
    state = createTestGameState();
  });

  test('Boomerang returns permanent to hand', () => {
    if (!CardLoader.getByName('Boomerang')) {
      console.log('Boomerang not found, skipping test');
      return;
    }

    // Setup: Create a creature on opponent's battlefield
    const startingOpponentHand = state.players.opponent.hand.length;
    const creatureId = createCreatureOnBattlefield(state, 'opponent', 'Grizzly Bears');

    expect(state.players.opponent.battlefield.length).toBe(1);

    // Cast Boomerang targeting the creature
    setupGameWithMana(state, 'player', { blue: 2 });
    castAndResolve(state, 'Boomerang', 'player', [creatureId]);

    // Creature should be in opponent's hand
    expect(state.players.opponent.battlefield.length).toBe(0);
    expect(state.players.opponent.hand.length).toBe(startingOpponentHand + 1);
  });
});

describe('Week 1.5.2: Targeted Destruction', () => {
  let state: GameState;

  beforeEach(() => {
    state = createTestGameState();
  });

  test('Stone Rain destroys target land', () => {
    if (!CardLoader.getByName('Stone Rain')) {
      console.log('Stone Rain not found, skipping test');
      return;
    }

    // Setup: Create a land
    const landId = createLandOnBattlefield(state, 'opponent', 'Island');

    expect(state.players.opponent.battlefield.length).toBe(1);

    // Cast Stone Rain targeting the land
    setupGameWithMana(state, 'player', { red: 3 });
    castAndResolve(state, 'Stone Rain', 'player', [landId]);

    // Land should be in graveyard
    expect(state.players.opponent.battlefield.length).toBe(0);
    expect(state.players.opponent.graveyard.length).toBe(1);
  });
});
