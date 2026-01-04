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
        c => c.instanceId === gravediggerCard.instanceId
      );
      expect(onBattlefield).toBeDefined();

      // Dead creature should be back in hand
      expect(newState.players.player.graveyard.length).toBe(0);
      const returnedCreature = newState.players.player.hand.find(
        c => c.instanceId === deadCreature.instanceId
      );
      expect(returnedCreature).toBeDefined();
      expect(returnedCreature?.zone).toBe('hand');
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
    expect(newState.players.player.battlefield.filter(
      c => c.instanceId === bearsCard.instanceId
    ).length).toBe(0);
  });
});
