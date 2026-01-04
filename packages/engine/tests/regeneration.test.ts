/**
 * Regeneration System Tests
 *
 * Tests for the regeneration mechanic which protects creatures from lethal damage.
 * When a creature would be destroyed, a regeneration shield instead:
 * - Taps the creature
 * - Removes it from combat
 * - Removes all damage
 */

import { describe, test, expect } from 'bun:test';
import {
  CardLoader,
  createCardInstance,
  createGameState,
  getActivatedAbilities,
  applyAction,
  getPlayer,
} from '../src/index';

// Helper to create a basic game state with mana
function createTestState() {
  const plains = CardLoader.getByName('Plains')!;
  const state = createGameState(
    [createCardInstance(plains.id, 'player', 'library')],
    [createCardInstance(plains.id, 'opponent', 'library')]
  );
  return state;
}

// ==========================================
// REGENERATION ABILITY DETECTION
// ==========================================

describe('Regeneration Ability Detection', () => {
  test('Drudge Skeletons has regeneration ability', () => {
    const state = createTestState();
    const card = CardLoader.getByName('Drudge Skeletons')!;
    const instance = createCardInstance(card.id, 'player', 'battlefield');
    state.players.player.battlefield.push(instance);

    const abilities = getActivatedAbilities(instance, state);
    const regenAbility = abilities.find(a => a.effect.type === 'REGENERATE');

    expect(regenAbility).toBeDefined();
    expect(regenAbility?.cost.mana).toBe('{B}');
  });

  test('Gorilla Chieftain has regeneration ability', () => {
    const state = createTestState();
    const card = CardLoader.getByName('Gorilla Chieftain')!;
    const instance = createCardInstance(card.id, 'player', 'battlefield');
    state.players.player.battlefield.push(instance);

    const abilities = getActivatedAbilities(instance, state);
    const regenAbility = abilities.find(a => a.effect.type === 'REGENERATE');

    expect(regenAbility).toBeDefined();
    expect(regenAbility?.cost.mana).toBe('{1}{G}');
  });

  test('River Boa has regeneration ability', () => {
    const state = createTestState();
    const card = CardLoader.getByName('River Boa')!;
    const instance = createCardInstance(card.id, 'player', 'battlefield');
    state.players.player.battlefield.push(instance);

    const abilities = getActivatedAbilities(instance, state);
    const regenAbility = abilities.find(a => a.effect.type === 'REGENERATE');

    expect(regenAbility).toBeDefined();
    expect(regenAbility?.cost.mana).toBe('{G}');
  });

  test('Mischievous Poltergeist has life-cost regeneration', () => {
    const state = createTestState();
    const card = CardLoader.getByName('Mischievous Poltergeist')!;
    const instance = createCardInstance(card.id, 'player', 'battlefield');
    state.players.player.battlefield.push(instance);

    const abilities = getActivatedAbilities(instance, state);
    const regenAbility = abilities.find(a => a.effect.type === 'REGENERATE');

    expect(regenAbility).toBeDefined();
    expect(regenAbility?.cost.life).toBe(1);
    expect(regenAbility?.cost.mana).toBeUndefined();
  });
});

// ==========================================
// REGENERATION SHIELD MECHANICS
// ==========================================

describe('Regeneration Shield Mechanics', () => {
  test('Activating regeneration adds a shield', () => {
    const state = createTestState();

    // Add Drudge Skeletons (remove summoning sickness for testing)
    const card = CardLoader.getByName('Drudge Skeletons')!;
    const skeletons = createCardInstance(card.id, 'player', 'battlefield');
    skeletons.summoningSick = false; // Not needed for regeneration, but good practice
    state.players.player.battlefield.push(skeletons);

    // Add a Swamp and tap it for mana
    const swamp = CardLoader.getByName('Swamp')!;
    const swampCard = createCardInstance(swamp.id, 'player', 'battlefield');
    swampCard.summoningSick = false;
    state.players.player.battlefield.push(swampCard);

    // Add black mana to pool (simulating tapped Swamp)
    state.players.player.manaPool.black = 1;

    const abilities = getActivatedAbilities(skeletons, state);
    const regenAbility = abilities.find(a => a.effect.type === 'REGENERATE')!;

    // Activate regeneration
    const newState = applyAction(state, {
      type: 'ACTIVATE_ABILITY',
      playerId: 'player',
      payload: {
        sourceId: skeletons.instanceId,
        abilityId: regenAbility.id,
      },
    });

    // Check shield was added
    const updatedSkeletons = newState.players.player.battlefield.find(
      c => c.instanceId === skeletons.instanceId
    );
    expect(updatedSkeletons?.regenerationShields).toBe(1);
  });

  test('Multiple regeneration activations stack shields', () => {
    const state = createTestState();

    // Add Drudge Skeletons
    const card = CardLoader.getByName('Drudge Skeletons')!;
    const skeletons = createCardInstance(card.id, 'player', 'battlefield');
    skeletons.summoningSick = false;
    state.players.player.battlefield.push(skeletons);

    // Add two Swamps for mana
    const swamp = CardLoader.getByName('Swamp')!;
    const swampCard1 = createCardInstance(swamp.id, 'player', 'battlefield');
    swampCard1.summoningSick = false;
    const swampCard2 = createCardInstance(swamp.id, 'player', 'battlefield');
    swampCard2.summoningSick = false;
    state.players.player.battlefield.push(swampCard1, swampCard2);

    // Add black mana to pool
    state.players.player.manaPool.black = 2;

    const abilities = getActivatedAbilities(skeletons, state);
    const regenAbility = abilities.find(a => a.effect.type === 'REGENERATE')!;

    // Activate regeneration twice
    let newState = applyAction(state, {
      type: 'ACTIVATE_ABILITY',
      playerId: 'player',
      payload: {
        sourceId: skeletons.instanceId,
        abilityId: regenAbility.id,
      },
    });

    // Mana was spent, add more (simulating tapping another swamp)
    newState.players.player.manaPool.black = 1;

    newState = applyAction(newState, {
      type: 'ACTIVATE_ABILITY',
      playerId: 'player',
      payload: {
        sourceId: skeletons.instanceId,
        abilityId: regenAbility.id,
      },
    });

    // Check shields stacked
    const updatedSkeletons = newState.players.player.battlefield.find(
      c => c.instanceId === skeletons.instanceId
    );
    expect(updatedSkeletons?.regenerationShields).toBe(2);
  });
});

// ==========================================
// REGENERATION PREVENTING DEATH
// ==========================================

describe('Regeneration Prevents Death', () => {
  test('Creature with regeneration shield survives lethal damage', () => {
    const state = createTestState();

    // Add Drudge Skeletons (1/1)
    const card = CardLoader.getByName('Drudge Skeletons')!;
    const skeletons = createCardInstance(card.id, 'player', 'battlefield');
    state.players.player.battlefield.push(skeletons);

    // Give it a regeneration shield
    skeletons.regenerationShields = 1;

    // Deal lethal damage (1 damage to a 1/1)
    skeletons.damage = 1;

    // Apply an action to trigger state-based actions
    const newState = applyAction(state, {
      type: 'PASS_PRIORITY',
      playerId: 'player',
    });

    // Check creature survived (regeneration used)
    const updatedSkeletons = newState.players.player.battlefield.find(
      c => c.instanceId === skeletons.instanceId
    );
    expect(updatedSkeletons).toBeDefined();
    expect(updatedSkeletons?.regenerationShields).toBe(0);
    expect(updatedSkeletons?.tapped).toBe(true);
    expect(updatedSkeletons?.damage).toBe(0);
  });

  test('Creature without regeneration shield dies to lethal damage', () => {
    const state = createTestState();

    // Add Drudge Skeletons (1/1) without shield
    const card = CardLoader.getByName('Drudge Skeletons')!;
    const skeletons = createCardInstance(card.id, 'player', 'battlefield');
    state.players.player.battlefield.push(skeletons);

    // Deal lethal damage (1 damage to a 1/1)
    skeletons.damage = 1;

    // Apply an action to trigger state-based actions
    const newState = applyAction(state, {
      type: 'PASS_PRIORITY',
      playerId: 'player',
    });

    // Check creature died
    const onBattlefield = newState.players.player.battlefield.find(
      c => c.instanceId === skeletons.instanceId
    );
    expect(onBattlefield).toBeUndefined();

    // Check it went to graveyard
    const inGraveyard = newState.players.player.graveyard.find(
      c => c.instanceId === skeletons.instanceId
    );
    expect(inGraveyard).toBeDefined();
  });

  test('Regeneration removes creature from combat', () => {
    const state = createTestState();

    // Add Drudge Skeletons and mark as attacking
    const card = CardLoader.getByName('Drudge Skeletons')!;
    const skeletons = createCardInstance(card.id, 'player', 'battlefield');
    skeletons.attacking = true;
    skeletons.regenerationShields = 1;
    state.players.player.battlefield.push(skeletons);

    // Deal lethal damage
    skeletons.damage = 1;

    // Apply an action to trigger state-based actions
    const newState = applyAction(state, {
      type: 'PASS_PRIORITY',
      playerId: 'player',
    });

    // Check creature is no longer attacking
    const updatedSkeletons = newState.players.player.battlefield.find(
      c => c.instanceId === skeletons.instanceId
    );
    expect(updatedSkeletons?.attacking).toBe(false);
  });
});

// ==========================================
// REGENERATION SHIELD EXPIRATION
// ==========================================

describe('Regeneration Shield Expiration', () => {
  test('Regeneration shields expire at end of turn', () => {
    const state = createTestState();

    // Add Drudge Skeletons with shield
    const card = CardLoader.getByName('Drudge Skeletons')!;
    const skeletons = createCardInstance(card.id, 'player', 'battlefield');
    skeletons.regenerationShields = 2;
    state.players.player.battlefield.push(skeletons);

    // End the turn
    const newState = applyAction(state, {
      type: 'END_TURN',
      playerId: 'player',
    });

    // Check shields were cleared
    const updatedSkeletons = newState.players.player.battlefield.find(
      c => c.instanceId === skeletons.instanceId
    );
    expect(updatedSkeletons?.regenerationShields).toBeUndefined();
  });
});

// ==========================================
// TOUGHNESS ZERO CANNOT BE REGENERATED
// ==========================================

describe('Toughness Zero Cannot Be Regenerated', () => {
  test('Creature with 0 toughness dies even with regeneration shield', () => {
    const state = createTestState();

    // Add a creature and give it a regeneration shield
    const card = CardLoader.getByName('Drudge Skeletons')!;
    const skeletons = createCardInstance(card.id, 'player', 'battlefield');
    skeletons.regenerationShields = 1;
    state.players.player.battlefield.push(skeletons);

    // Give it -1/-1 (making it 0/0)
    skeletons.counters['-1/-1'] = 1;

    // Apply an action to trigger state-based actions
    const newState = applyAction(state, {
      type: 'PASS_PRIORITY',
      playerId: 'player',
    });

    // Check creature died (toughness 0 cannot be regenerated)
    const onBattlefield = newState.players.player.battlefield.find(
      c => c.instanceId === skeletons.instanceId
    );
    expect(onBattlefield).toBeUndefined();

    const inGraveyard = newState.players.player.graveyard.find(
      c => c.instanceId === skeletons.instanceId
    );
    expect(inGraveyard).toBeDefined();
  });
});

// ==========================================
// BATCH VERIFICATION
// ==========================================

describe('Regeneration Creatures Batch Verification', () => {
  test('Drudge Skeletons exists in database', () => {
    const card = CardLoader.getByName('Drudge Skeletons');
    expect(card).toBeDefined();
    expect(card?.power).toBe('1');
    expect(card?.toughness).toBe('1');
  });

  test('Gorilla Chieftain exists in database', () => {
    const card = CardLoader.getByName('Gorilla Chieftain');
    expect(card).toBeDefined();
    expect(card?.power).toBe('3');
    expect(card?.toughness).toBe('3');
  });

  test('River Boa exists in database', () => {
    const card = CardLoader.getByName('River Boa');
    expect(card).toBeDefined();
    expect(card?.power).toBe('2');
    expect(card?.toughness).toBe('1');
  });

  test('Kjeldoran Dead exists in database', () => {
    const card = CardLoader.getByName('Kjeldoran Dead');
    expect(card).toBeDefined();
    expect(card?.power).toBe('3');
    expect(card?.toughness).toBe('1');
  });

  test('Mischievous Poltergeist exists in database', () => {
    const card = CardLoader.getByName('Mischievous Poltergeist');
    expect(card).toBeDefined();
    expect(card?.power).toBe('1');
    expect(card?.toughness).toBe('1');
  });

  test('Uktabi Wildcats exists in database', () => {
    const card = CardLoader.getByName('Uktabi Wildcats');
    expect(card).toBeDefined();
    // Variable P/T = */*
    expect(card?.power).toBe('*');
    expect(card?.toughness).toBe('*');
  });
});
