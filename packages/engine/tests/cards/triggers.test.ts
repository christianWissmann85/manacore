/**
 * Triggered Ability Tests
 *
 * Tests for cards with triggered abilities (ETB, damage triggers, etc.).
 */

import { describe, test, expect } from 'bun:test';
import { CardLoader, createCardInstance, applyAction } from '../../src/index';
import { setupGameWithMana, castAndResolve } from './helpers';

describe('Enter the Battlefield Triggers', () => {
  describe('Gravedigger', () => {
    test('card exists with ETB trigger text', () => {
      const card = CardLoader.getByName('Gravedigger');
      expect(card).toBeDefined();
      expect(card?.power).toBe('2');
      expect(card?.toughness).toBe('2');
      expect(card?.oracle_text?.toLowerCase()).toContain('when');
      expect(card?.oracle_text?.toLowerCase()).toContain('enters');
      expect(card?.oracle_text?.toLowerCase()).toContain('return');
      expect(card?.oracle_text?.toLowerCase()).toContain('graveyard');
    });

    test('ETB returns creature from graveyard to hand', () => {
      const gravedigger = CardLoader.getByName('Gravedigger')!;
      const bears = CardLoader.getByName('Grizzly Bears')!;
      const state = setupGameWithMana({ B: 4 });

      // Put a creature in graveyard
      const deadCreature = createCardInstance(bears.id, 'player', 'graveyard');
      state.players.player.graveyard.push(deadCreature);

      // Put Gravedigger in hand
      const gravediggerCard = createCardInstance(gravedigger.id, 'player', 'hand');
      state.players.player.hand.push(gravediggerCard);

      // Cast Gravedigger
      const newState = castAndResolve(state, 'player', gravediggerCard.instanceId);

      // Gravedigger should be on battlefield
      const onBattlefield = newState.players.player.battlefield.find(
        (c) => c.instanceId === gravediggerCard.instanceId,
      );
      expect(onBattlefield).toBeDefined();

      // Dead creature should be back in hand
      expect(newState.players.player.graveyard.length).toBe(0);
      const returnedCreature = newState.players.player.hand.find(
        (c) => c.instanceId === deadCreature.instanceId,
      );
      expect(returnedCreature).toBeDefined();
      expect(returnedCreature?.zone).toBe('hand');
    });
  });

  // ========================================
  // ETB LIFE GAIN CREATURES (Phase 1.5.3)
  // ========================================

  describe('Venerable Monk', () => {
    test('card exists with ETB trigger text', () => {
      const card = CardLoader.getByName('Venerable Monk');
      expect(card).toBeDefined();
      expect(card?.power).toBe('2');
      expect(card?.toughness).toBe('2');
      expect(card?.oracle_text?.toLowerCase()).toContain('when');
      expect(card?.oracle_text?.toLowerCase()).toContain('enters');
      expect(card?.oracle_text?.toLowerCase()).toContain('gain 2 life');
    });

    test('ETB gains 2 life', () => {
      const monk = CardLoader.getByName('Venerable Monk')!;
      const state = setupGameWithMana({ W: 3 });
      const initialLife = state.players.player.life;

      // Put Monk in hand
      const monkCard = createCardInstance(monk.id, 'player', 'hand');
      state.players.player.hand.push(monkCard);

      // Cast Monk
      const newState = castAndResolve(state, 'player', monkCard.instanceId);

      // Monk should be on battlefield
      const onBattlefield = newState.players.player.battlefield.find(
        (c) => c.instanceId === monkCard.instanceId,
      );
      expect(onBattlefield).toBeDefined();

      // Player should have gained 2 life
      expect(newState.players.player.life).toBe(initialLife + 2);
    });
  });

  describe('Staunch Defenders', () => {
    test('card exists with ETB trigger text', () => {
      const card = CardLoader.getByName('Staunch Defenders');
      expect(card).toBeDefined();
      expect(card?.power).toBe('3');
      expect(card?.toughness).toBe('4');
      expect(card?.oracle_text?.toLowerCase()).toContain('when');
      expect(card?.oracle_text?.toLowerCase()).toContain('enters');
      expect(card?.oracle_text?.toLowerCase()).toContain('gain 4 life');
    });

    test('ETB gains 4 life', () => {
      const defenders = CardLoader.getByName('Staunch Defenders')!;
      const state = setupGameWithMana({ W: 5 });
      const initialLife = state.players.player.life;

      // Put Defenders in hand
      const defendersCard = createCardInstance(defenders.id, 'player', 'hand');
      state.players.player.hand.push(defendersCard);

      // Cast Defenders
      const newState = castAndResolve(state, 'player', defendersCard.instanceId);

      // Defenders should be on battlefield
      const onBattlefield = newState.players.player.battlefield.find(
        (c) => c.instanceId === defendersCard.instanceId,
      );
      expect(onBattlefield).toBeDefined();

      // Player should have gained 4 life
      expect(newState.players.player.life).toBe(initialLife + 4);
    });
  });

  // ========================================
  // ETB DESTROY ARTIFACT (Phase 1.5.3)
  // ========================================

  describe('Uktabi Orangutan', () => {
    test('card exists with ETB trigger text', () => {
      const card = CardLoader.getByName('Uktabi Orangutan');
      expect(card).toBeDefined();
      expect(card?.power).toBe('2');
      expect(card?.toughness).toBe('2');
      expect(card?.oracle_text?.toLowerCase()).toContain('when');
      expect(card?.oracle_text?.toLowerCase()).toContain('enters');
      expect(card?.oracle_text?.toLowerCase()).toContain('destroy');
      expect(card?.oracle_text?.toLowerCase()).toContain('artifact');
    });

    test('ETB destroys target artifact', () => {
      const orangutan = CardLoader.getByName('Uktabi Orangutan')!;
      const artifact = CardLoader.getByName('Sol Ring');
      if (!artifact) {
        // Find any artifact in card pool
        const anyArtifact = CardLoader.getAllCards().find((c) => c.type_line?.includes('Artifact'));
        if (!anyArtifact) {
          console.log('No artifacts in card pool, skipping test');
          return;
        }
      }

      const state = setupGameWithMana({ G: 3 });

      // Put an artifact on opponent's battlefield
      const artifactCard = createCardInstance(
        (artifact || CardLoader.getAllCards().find((c) => c.type_line?.includes('Artifact'))!).id,
        'opponent',
        'battlefield',
      );
      state.players.opponent.battlefield.push(artifactCard);

      // Put Orangutan in hand
      const orangutanCard = createCardInstance(orangutan.id, 'player', 'hand');
      state.players.player.hand.push(orangutanCard);

      // Cast Orangutan
      const newState = castAndResolve(state, 'player', orangutanCard.instanceId);

      // Orangutan should be on battlefield
      const onBattlefield = newState.players.player.battlefield.find(
        (c) => c.instanceId === orangutanCard.instanceId,
      );
      expect(onBattlefield).toBeDefined();

      // Artifact should be in graveyard
      expect(
        newState.players.opponent.battlefield.find((c) => c.instanceId === artifactCard.instanceId),
      ).toBeUndefined();
      expect(
        newState.players.opponent.graveyard.find((c) => c.instanceId === artifactCard.instanceId),
      ).toBeDefined();
    });
  });

  // ========================================
  // ETB SCRY / LIBRARY MANIPULATION (Phase 1.5.3)
  // ========================================

  describe('Sage Owl', () => {
    test('card exists with ETB trigger text', () => {
      const card = CardLoader.getByName('Sage Owl');
      expect(card).toBeDefined();
      expect(card?.power).toBe('1');
      expect(card?.toughness).toBe('1');
      expect(card?.keywords).toContain('Flying');
      expect(card?.oracle_text?.toLowerCase()).toContain('when');
      expect(card?.oracle_text?.toLowerCase()).toContain('enters');
      expect(card?.oracle_text?.toLowerCase()).toContain('look at the top');
    });

    test('ETB looks at top 4 and reorders', () => {
      const owl = CardLoader.getByName('Sage Owl')!;
      const state = setupGameWithMana({ U: 2 });

      // Remember the top 4 cards
      const originalTop4 = state.players.player.library.slice(0, 4).map((c) => c.instanceId);

      // Put Owl in hand
      const owlCard = createCardInstance(owl.id, 'player', 'hand');
      state.players.player.hand.push(owlCard);

      // Cast Owl
      const newState = castAndResolve(state, 'player', owlCard.instanceId);

      // Owl should be on battlefield
      const onBattlefield = newState.players.player.battlefield.find(
        (c) => c.instanceId === owlCard.instanceId,
      );
      expect(onBattlefield).toBeDefined();

      // The top 4 cards should contain the same cards (possibly reordered)
      const newTop4 = newState.players.player.library.slice(0, 4).map((c) => c.instanceId);
      expect(newTop4.sort()).toEqual(originalTop4.sort());
    });
  });

  // ========================================
  // ETB DISCARD (Phase 1.5.3)
  // ========================================

  describe('Hidden Horror', () => {
    test('card exists with ETB trigger text', () => {
      const card = CardLoader.getByName('Hidden Horror');
      expect(card).toBeDefined();
      expect(card?.power).toBe('4');
      expect(card?.toughness).toBe('4');
      expect(card?.oracle_text?.toLowerCase()).toContain('when');
      expect(card?.oracle_text?.toLowerCase()).toContain('enters');
      expect(card?.oracle_text?.toLowerCase()).toContain('discard');
    });

    test('ETB forces discard of creature card to keep', () => {
      const horror = CardLoader.getByName('Hidden Horror')!;
      const bears = CardLoader.getByName('Grizzly Bears')!;
      const state = setupGameWithMana({ B: 3 });

      // Put a creature card in hand
      const bearsCard = createCardInstance(bears.id, 'player', 'hand');
      state.players.player.hand.push(bearsCard);

      // Put Horror in hand
      const horrorCard = createCardInstance(horror.id, 'player', 'hand');
      state.players.player.hand.push(horrorCard);

      // Cast Horror
      const newState = castAndResolve(state, 'player', horrorCard.instanceId);

      // Horror should be on battlefield (creature card was discarded)
      const onBattlefield = newState.players.player.battlefield.find(
        (c) => c.instanceId === horrorCard.instanceId,
      );
      expect(onBattlefield).toBeDefined();

      // Bears should be in graveyard (discarded)
      expect(
        newState.players.player.graveyard.find((c) => c.instanceId === bearsCard.instanceId),
      ).toBeDefined();
    });

    test('ETB sacrifices itself if no creature to discard', () => {
      const horror = CardLoader.getByName('Hidden Horror')!;
      const state = setupGameWithMana({ B: 3 });

      // No creature cards in hand
      state.players.player.hand = [];

      // Put Horror in hand
      const horrorCard = createCardInstance(horror.id, 'player', 'hand');
      state.players.player.hand.push(horrorCard);

      // Cast Horror
      const newState = castAndResolve(state, 'player', horrorCard.instanceId);

      // Horror should NOT be on battlefield (sacrificed)
      const onBattlefield = newState.players.player.battlefield.find(
        (c) => c.instanceId === horrorCard.instanceId,
      );
      expect(onBattlefield).toBeUndefined();

      // Horror should be in graveyard
      expect(
        newState.players.player.graveyard.find((c) => c.instanceId === horrorCard.instanceId),
      ).toBeDefined();
    });
  });
});

describe('Damage Triggers', () => {
  describe('Abyssal Specter', () => {
    test('card exists with damage trigger text', () => {
      const card = CardLoader.getByName('Abyssal Specter');
      expect(card).toBeDefined();
      expect(card?.power).toBe('2');
      expect(card?.toughness).toBe('3');
      expect(card?.keywords).toContain('Flying');
      expect(card?.oracle_text?.toLowerCase()).toContain('whenever');
      expect(card?.oracle_text?.toLowerCase()).toContain('damage');
      expect(card?.oracle_text?.toLowerCase()).toContain('discard');
    });

    test('triggers discard when dealing combat damage to player', () => {
      const specter = CardLoader.getByName('Abyssal Specter')!;
      const bears = CardLoader.getByName('Grizzly Bears')!;
      const state = setupGameWithMana({ B: 4 });

      // Put Specter on battlefield
      const specterCard = createCardInstance(specter.id, 'player', 'battlefield');
      specterCard.summoningSick = false;
      state.players.player.battlefield.push(specterCard);

      // Give opponent a card in hand
      const opponentHandCard = createCardInstance(bears.id, 'opponent', 'hand');
      state.players.opponent.hand = [opponentHandCard];
      const initialHandSize = state.players.opponent.hand.length;

      // Declare attackers
      let newState = applyAction(state, {
        type: 'DECLARE_ATTACKERS',
        playerId: 'player',
        payload: { attackers: [specterCard.instanceId] },
      });

      // Declare no blockers
      newState = applyAction(newState, {
        type: 'DECLARE_BLOCKERS',
        playerId: 'opponent',
        payload: { blocks: [] },
      });

      // Specter deals 2 damage, triggering discard
      expect(newState.players.opponent.life).toBe(18); // 20 - 2
      expect(newState.players.opponent.hand.length).toBe(initialHandSize - 1);
      expect(newState.players.opponent.graveyard.length).toBe(1);
    });
  });
});

describe('Counterspell (Stack Interaction)', () => {
  test('card exists', () => {
    const card = CardLoader.getByName('Counterspell');
    expect(card).toBeDefined();
    expect(card?.mana_cost).toBe('{U}{U}');
    expect(card?.type_line).toBe('Instant');
    expect(card?.oracle_text?.toLowerCase()).toContain('counter target spell');
  });

  test('counters a creature spell', () => {
    const counterspell = CardLoader.getByName('Counterspell')!;
    const bears = CardLoader.getByName('Grizzly Bears')!;
    const state = setupGameWithMana({ G: 2 }, { U: 2 });

    const bearsCard = createCardInstance(bears.id, 'player', 'hand');
    const counterCard = createCardInstance(counterspell.id, 'opponent', 'hand');
    state.players.player.hand.push(bearsCard);
    state.players.opponent.hand.push(counterCard);

    // Player casts Grizzly Bears
    let newState = applyAction(state, {
      type: 'CAST_SPELL',
      playerId: 'player',
      payload: { cardInstanceId: bearsCard.instanceId },
    });

    expect(newState.stack.length).toBe(1);
    const bearsStackId = newState.stack[0]!.id;

    // Opponent casts Counterspell targeting Bears
    newState = applyAction(newState, {
      type: 'CAST_SPELL',
      playerId: 'opponent',
      payload: { cardInstanceId: counterCard.instanceId, targets: [bearsStackId] },
    });

    expect(newState.stack.length).toBe(2);

    // Both pass - Counterspell resolves
    newState = applyAction(newState, {
      type: 'PASS_PRIORITY',
      playerId: 'player',
      payload: {},
    });

    newState = applyAction(newState, {
      type: 'PASS_PRIORITY',
      playerId: 'opponent',
      payload: {},
    });

    expect(newState.stack[0]?.countered).toBe(true);

    // Resolve countered Bears
    newState = applyAction(newState, {
      type: 'PASS_PRIORITY',
      playerId: 'player',
      payload: {},
    });

    newState = applyAction(newState, {
      type: 'PASS_PRIORITY',
      playerId: 'opponent',
      payload: {},
    });

    // Bears should be in graveyard (countered), not on battlefield
    expect(newState.players.player.graveyard.length).toBe(1);
    expect(
      newState.players.player.battlefield.filter((c) => c.instanceId === bearsCard.instanceId)
        .length,
    ).toBe(0);
  });
});
