/**
 * Auto-Pass Optimization Tests
 *
 * Tests for the AI training efficiency optimizations:
 * - P1: Auto-pass when no instant-speed options available
 * - P2: Auto-skip blocking when no valid blockers exist
 * - P3: Auto-pass on stack when no responses possible
 *
 * These optimizations reduce the action space for AI bots by eliminating
 * forced non-decisions that add no strategic value.
 */

import { test, expect, describe, beforeEach, beforeAll } from 'bun:test';
import {
  hasInstantSpeedOptions,
  hasValidBlockers,
  shouldAutoPass,
  shouldAutoPassOnStack,
  getAutoPassAction,
  getNoBlockAction,
} from '../src/actions/autoPass';
import { getLegalActions } from '../src/actions/getLegalActions';
import { applyAction } from '../src/actions/reducer';
import { CardLoader } from '../src/cards/CardLoader';
import { createGameState, getPlayer } from '../src/state/GameState';
import { createCardInstance, _resetInstanceCounter } from '../src/state/CardInstance';
import { _resetStackCounter } from '../src/rules/stack';
import type { GameState } from '../src/state/GameState';
import type { PlayerId } from '../src/state/Zone';

// Ensure cards are loaded
beforeAll(() => {
  CardLoader.initialize();
});

/**
 * Helper to create a test game state with specific cards
 */
function createTestState(): GameState {
  _resetInstanceCounter();
  _resetStackCounter();

  const forest = CardLoader.getByName('Forest')!;
  const mountain = CardLoader.getByName('Mountain')!;

  const playerLibrary = Array.from({ length: 30 }, () =>
    createCardInstance(forest.id, 'player', 'library'),
  );
  const opponentLibrary = Array.from({ length: 30 }, () =>
    createCardInstance(mountain.id, 'opponent', 'library'),
  );

  const state = createGameState(playerLibrary, opponentLibrary, 12345);

  // Set up main phase with empty stack
  state.phase = 'main1';
  state.step = 'main';
  state.priorityPlayer = 'player';
  state.activePlayer = 'player';

  return state;
}

/**
 * Helper to add a card to a player's hand
 */
function addToHand(state: GameState, playerId: PlayerId, cardName: string): void {
  const template = CardLoader.getByName(cardName);
  if (!template) throw new Error(`Card not found: ${cardName}`);
  const card = createCardInstance(template.id, playerId, 'hand');
  state.players[playerId].hand.push(card);
}

/**
 * Helper to add a card to a player's battlefield (as a non-summoning-sick creature)
 */
function addToBattlefield(
  state: GameState,
  playerId: PlayerId,
  cardName: string,
  options: { tapped?: boolean; attacking?: boolean; summoningSick?: boolean } = {},
): string {
  const template = CardLoader.getByName(cardName);
  if (!template) throw new Error(`Card not found: ${cardName}`);
  const card = createCardInstance(template.id, playerId, 'battlefield');
  card.tapped = options.tapped ?? false;
  card.attacking = options.attacking ?? false;
  card.summoningSick = options.summoningSick ?? false;
  state.players[playerId].battlefield.push(card);
  return card.instanceId;
}

describe('P1: hasInstantSpeedOptions', () => {
  test('returns false when hand is empty and no abilities', () => {
    const state = createTestState();
    state.players.player.hand = [];

    expect(hasInstantSpeedOptions(state, 'player')).toBe(false);
  });

  test('returns false when hand has only sorcery-speed cards', () => {
    const state = createTestState();
    state.players.player.hand = [];
    addToHand(state, 'player', 'Grizzly Bears'); // Creature - sorcery speed
    addToHand(state, 'player', 'Forest'); // Land - sorcery speed

    expect(hasInstantSpeedOptions(state, 'player')).toBe(false);
  });

  test('returns true when hand has instant spell with enough mana', () => {
    const state = createTestState();
    state.players.player.hand = [];
    addToHand(state, 'player', 'Giant Growth'); // {G} instant

    // Add a Forest for mana
    addToBattlefield(state, 'player', 'Forest');

    // Giant Growth targets a creature, so we need one
    addToBattlefield(state, 'player', 'Grizzly Bears');

    expect(hasInstantSpeedOptions(state, 'player')).toBe(true);
  });

  test('returns false when instant spell cannot be afforded', () => {
    const state = createTestState();
    state.players.player.hand = [];
    addToHand(state, 'player', 'Giant Growth'); // {G} instant

    // No mana sources
    state.players.player.battlefield = [];

    expect(hasInstantSpeedOptions(state, 'player')).toBe(false);
  });

  test('returns true when creature has activatable ability', () => {
    const state = createTestState();
    state.players.player.hand = [];

    // Prodigal Sorcerer has "{T}: Prodigal Sorcerer deals 1 damage to any target."
    addToBattlefield(state, 'player', 'Prodigal Sorcerer');

    expect(hasInstantSpeedOptions(state, 'player')).toBe(true);
  });

  test('returns false when mana ability is the only option (no use for mana)', () => {
    const state = createTestState();
    state.players.player.hand = [];

    // Only land with mana ability
    addToBattlefield(state, 'player', 'Forest');

    // Mana abilities alone should not count as instant-speed options
    expect(hasInstantSpeedOptions(state, 'player')).toBe(false);
  });

  test('returns false when instant has no valid targets', () => {
    const state = createTestState();
    state.players.player.hand = [];
    addToHand(state, 'player', 'Terror'); // Destroy target nonartifact, nonblack creature

    // Add mana
    addToBattlefield(state, 'player', 'Swamp');
    addToBattlefield(state, 'player', 'Swamp');

    // No creatures on battlefield to target
    expect(hasInstantSpeedOptions(state, 'player')).toBe(false);
  });

  test('returns true when instant has valid target', () => {
    const state = createTestState();
    state.players.player.hand = [];
    addToHand(state, 'player', 'Terror'); // Destroy target nonartifact, nonblack creature

    // Add mana
    addToBattlefield(state, 'player', 'Swamp');
    addToBattlefield(state, 'player', 'Swamp');

    // Add a targetable creature
    addToBattlefield(state, 'opponent', 'Grizzly Bears');

    expect(hasInstantSpeedOptions(state, 'player')).toBe(true);
  });
});

describe('P2: hasValidBlockers', () => {
  test('returns false when no creatures on battlefield', () => {
    const state = createTestState();
    state.phase = 'combat';
    state.step = 'declare_blockers';

    // Add attacker
    addToBattlefield(state, 'player', 'Grizzly Bears', { attacking: true });

    expect(hasValidBlockers(state, 'opponent')).toBe(false);
  });

  test('returns false when all blockers are tapped', () => {
    const state = createTestState();
    state.phase = 'combat';
    state.step = 'declare_blockers';

    // Add attacker
    addToBattlefield(state, 'player', 'Grizzly Bears', { attacking: true });

    // Add tapped blocker (Cat Warriors is 2/2)
    addToBattlefield(state, 'opponent', 'Cat Warriors', { tapped: true });

    expect(hasValidBlockers(state, 'opponent')).toBe(false);
  });

  test('returns true when valid blocker exists', () => {
    const state = createTestState();
    state.phase = 'combat';
    state.step = 'declare_blockers';

    // Add attacker
    addToBattlefield(state, 'player', 'Grizzly Bears', { attacking: true });

    // Add untapped blocker
    addToBattlefield(state, 'opponent', 'Cat Warriors');

    expect(hasValidBlockers(state, 'opponent')).toBe(true);
  });

  test('returns false when attacker has flying and no flyers/reach to block', () => {
    const state = createTestState();
    state.phase = 'combat';
    state.step = 'declare_blockers';

    // Add flying attacker (Air Elemental has flying)
    addToBattlefield(state, 'player', 'Air Elemental', { attacking: true });

    // Add ground blocker
    addToBattlefield(state, 'opponent', 'Grizzly Bears');

    expect(hasValidBlockers(state, 'opponent')).toBe(false);
  });

  test('returns true when flying attacker can be blocked by flyer', () => {
    const state = createTestState();
    state.phase = 'combat';
    state.step = 'declare_blockers';

    // Add flying attacker
    addToBattlefield(state, 'player', 'Air Elemental', { attacking: true });

    // Add flying blocker (Fog Elemental has flying)
    addToBattlefield(state, 'opponent', 'Fog Elemental');

    expect(hasValidBlockers(state, 'opponent')).toBe(true);
  });

  test('returns true when flying attacker can be blocked by reach creature', () => {
    const state = createTestState();
    state.phase = 'combat';
    state.step = 'declare_blockers';

    // Add flying attacker
    addToBattlefield(state, 'player', 'Air Elemental', { attacking: true });

    // Add reach blocker (Giant Spider has reach)
    addToBattlefield(state, 'opponent', 'Giant Spider');

    expect(hasValidBlockers(state, 'opponent')).toBe(true);
  });

  test('returns false when attacker is unblockable', () => {
    const state = createTestState();
    state.phase = 'combat';
    state.step = 'declare_blockers';

    // Add unblockable attacker (Phantom Warrior)
    addToBattlefield(state, 'player', 'Phantom Warrior', { attacking: true });

    // Add potential blocker
    addToBattlefield(state, 'opponent', 'Grizzly Bears');

    expect(hasValidBlockers(state, 'opponent')).toBe(false);
  });

  test('returns false when no attackers exist', () => {
    const state = createTestState();
    state.phase = 'combat';
    state.step = 'declare_blockers';

    // No attackers
    addToBattlefield(state, 'opponent', 'Grizzly Bears');

    expect(hasValidBlockers(state, 'opponent')).toBe(false);
  });
});

describe('P3: shouldAutoPassOnStack', () => {
  test('returns false when stack is empty', () => {
    const state = createTestState();
    state.stack = [];

    expect(shouldAutoPassOnStack(state, 'player')).toBe(false);
  });

  test('returns true when stack has spell and no instant options', () => {
    const state = createTestState();
    state.players.player.hand = [];
    state.players.player.battlefield = [];

    // Simulate spell on stack
    const template = CardLoader.getByName('Grizzly Bears')!;
    const card = createCardInstance(template.id, 'opponent', 'stack');
    state.stack.push({
      id: 'stack_0',
      controller: 'opponent',
      card,
      targets: [],
      resolved: false,
      countered: false,
    });

    expect(shouldAutoPassOnStack(state, 'player')).toBe(true);
  });

  test('returns false when stack has spell but player has counterspell', () => {
    const state = createTestState();
    state.players.player.hand = [];

    // Add Counterspell to hand
    addToHand(state, 'player', 'Counterspell');

    // Add mana for counterspell
    addToBattlefield(state, 'player', 'Island');
    addToBattlefield(state, 'player', 'Island');

    // Simulate spell on stack
    const template = CardLoader.getByName('Grizzly Bears')!;
    const card = createCardInstance(template.id, 'opponent', 'stack');
    state.stack.push({
      id: 'stack_0',
      controller: 'opponent',
      card,
      targets: [],
      resolved: false,
      countered: false,
    });

    expect(shouldAutoPassOnStack(state, 'player')).toBe(false);
  });
});

describe('shouldAutoPass (master function)', () => {
  test('returns false when player does not have priority', () => {
    const state = createTestState();
    state.priorityPlayer = 'opponent';

    expect(shouldAutoPass(state, 'player')).toBe(false);
  });

  test('returns false during beginning phase', () => {
    const state = createTestState();
    state.phase = 'beginning';

    expect(shouldAutoPass(state, 'player')).toBe(false);
  });

  test('returns false in main phase with sorcery-speed options', () => {
    const state = createTestState();
    state.phase = 'main1';
    state.priorityPlayer = 'player';
    state.activePlayer = 'player';

    // Add playable card
    addToHand(state, 'player', 'Grizzly Bears');
    addToBattlefield(state, 'player', 'Forest');
    addToBattlefield(state, 'player', 'Forest');

    // Should not auto-pass since can play sorcery-speed cards
    expect(shouldAutoPass(state, 'player')).toBe(false);
  });

  test('returns true when opponent has priority and no instant options', () => {
    const state = createTestState();
    state.phase = 'main1';
    state.priorityPlayer = 'opponent';
    state.activePlayer = 'player';
    state.players.opponent.hand = [];
    state.players.opponent.battlefield = [];

    expect(shouldAutoPass(state, 'opponent')).toBe(true);
  });

  test('returns true during combat with no options', () => {
    const state = createTestState();
    state.phase = 'combat';
    state.step = 'declare_attackers';
    state.priorityPlayer = 'opponent';
    state.activePlayer = 'player';
    state.players.opponent.hand = [];
    state.players.opponent.battlefield = [];

    expect(shouldAutoPass(state, 'opponent')).toBe(true);
  });
});

describe('Integration: getLegalActions with auto-pass', () => {
  test('returns only PASS_PRIORITY when shouldAutoPass is true', () => {
    const state = createTestState();
    state.phase = 'main1';
    state.priorityPlayer = 'opponent';
    state.activePlayer = 'player';
    state.players.opponent.hand = [];
    state.players.opponent.battlefield = [];

    const actions = getLegalActions(state, 'opponent');

    expect(actions.length).toBe(1);
    expect(actions[0]!.type).toBe('PASS_PRIORITY');
  });

  test('returns only "dont block" when no valid blockers exist', () => {
    const state = createTestState();
    state.phase = 'combat';
    state.step = 'declare_blockers';
    state.activePlayer = 'player';
    state.priorityPlayer = 'opponent';

    // Add flying attacker
    addToBattlefield(state, 'player', 'Air Elemental', { attacking: true });

    // Add ground creature (can't block flying)
    addToBattlefield(state, 'opponent', 'Grizzly Bears');

    const actions = getLegalActions(state, 'opponent');

    // Should only have one action: don't block
    const blockActions = actions.filter((a) => a.type === 'DECLARE_BLOCKERS');
    expect(blockActions.length).toBe(1);
    expect(blockActions[0]!.payload.blocks).toEqual([]);
  });

  test('returns multiple blocking options when valid blockers exist', () => {
    const state = createTestState();
    state.phase = 'combat';
    state.step = 'declare_blockers';
    state.activePlayer = 'player';
    state.priorityPlayer = 'opponent';

    // Add ground attacker
    addToBattlefield(state, 'player', 'Grizzly Bears', { attacking: true });

    // Add ground blocker
    addToBattlefield(state, 'opponent', 'Cat Warriors');

    const actions = getLegalActions(state, 'opponent');

    // Should have multiple options: don't block + block with Cat Warriors
    const blockActions = actions.filter((a) => a.type === 'DECLARE_BLOCKERS');
    expect(blockActions.length).toBeGreaterThan(1);
  });

  test('auto-pass does not prevent sorcery-speed plays in main phase', () => {
    const state = createTestState();
    state.phase = 'main1';
    state.priorityPlayer = 'player';
    state.activePlayer = 'player';

    // Clear hand and add playable sorcery-speed card
    state.players.player.hand = [];
    addToHand(state, 'player', 'Grizzly Bears');

    // Add mana
    addToBattlefield(state, 'player', 'Forest');
    addToBattlefield(state, 'player', 'Forest');

    const actions = getLegalActions(state, 'player');

    // Should have CAST_SPELL option for Grizzly Bears
    const castActions = actions.filter((a) => a.type === 'CAST_SPELL');
    expect(castActions.length).toBeGreaterThan(0);
  });
});

describe('Action helpers', () => {
  test('getAutoPassAction returns correct action structure', () => {
    const action = getAutoPassAction('player');

    expect(action.type).toBe('PASS_PRIORITY');
    expect(action.playerId).toBe('player');
    expect(action.payload).toEqual({});
  });

  test('getNoBlockAction returns correct action structure', () => {
    const action = getNoBlockAction('opponent');

    expect(action.type).toBe('DECLARE_BLOCKERS');
    expect(action.playerId).toBe('opponent');
    expect(action.payload.blocks).toEqual([]);
  });
});

describe('Action count reduction', () => {
  test('demonstrates reduction in forced non-decisions', () => {
    const state = createTestState();

    // Simulate opponent's turn, player has no options
    state.phase = 'main1';
    state.activePlayer = 'opponent';
    state.priorityPlayer = 'player';
    state.players.player.hand = [];
    state.players.player.battlefield = [];

    const actions = getLegalActions(state, 'player');

    // Before optimization: would have PASS_PRIORITY + potentially END_TURN
    // After optimization: only PASS_PRIORITY
    expect(actions.length).toBe(1);
    expect(actions[0]!.type).toBe('PASS_PRIORITY');
  });

  test('blocking with no blockers is single action', () => {
    const state = createTestState();
    state.phase = 'combat';
    state.step = 'declare_blockers';
    state.activePlayer = 'player';
    state.priorityPlayer = 'opponent';

    // Add attacker
    addToBattlefield(state, 'player', 'Grizzly Bears', { attacking: true });

    // No blockers
    state.players.opponent.battlefield = [];

    const actions = getLegalActions(state, 'opponent');

    // Should be exactly 1 action: pass priority (if shouldAutoPass triggers)
    // or just the "don't block" if in blockers step
    const blockActions = actions.filter((a) => a.type === 'DECLARE_BLOCKERS');
    expect(blockActions.length).toBeLessThanOrEqual(1);
  });
});

describe('Mana Sink Detection', () => {
  test('hasManaSink returns true when player has spells in hand', async () => {
    const { hasManaSink } = await import('../src/actions/autoPass');
    const state = createTestState();

    // Add a spell to hand
    addToHand(state, 'player', 'Giant Growth');

    expect(hasManaSink(state, 'player')).toBe(true);
  });

  test('hasManaSink returns false when hand is empty', async () => {
    const { hasManaSink } = await import('../src/actions/autoPass');
    const state = createTestState();

    state.players.player.hand = [];

    expect(hasManaSink(state, 'player')).toBe(false);
  });

  test('hasManaSink returns false when hand only contains lands', async () => {
    const { hasManaSink } = await import('../src/actions/autoPass');
    const state = createTestState();

    state.players.player.hand = [];
    addToHand(state, 'player', 'Forest');
    addToHand(state, 'player', 'Mountain');

    expect(hasManaSink(state, 'player')).toBe(false);
  });

  test('mana abilities are filtered when no mana sinks exist', () => {
    const state = createTestState();

    // Clear hand - no spells to cast
    state.players.player.hand = [];

    // Add some lands that could tap for mana
    addToBattlefield(state, 'player', 'Forest');
    addToBattlefield(state, 'player', 'Mountain');

    const actions = getLegalActions(state, 'player');

    // Should NOT have ACTIVATE_ABILITY actions for tapping lands
    const manaAbilities = actions.filter((a) => a.type === 'ACTIVATE_ABILITY');
    expect(manaAbilities.length).toBe(0);
  });

  test('mana abilities are hidden when CAST_SPELL is available (redundant)', () => {
    const state = createTestState();

    // Add a creature spell to hand - this is a mana sink
    addToHand(state, 'player', 'Grizzly Bears'); // {1}{G}

    // Add TWO lands - enough to cast Grizzly Bears
    addToBattlefield(state, 'player', 'Forest');
    addToBattlefield(state, 'player', 'Forest');

    const actions = getLegalActions(state, 'player');

    // CAST_SPELL should be available
    const castSpells = actions.filter((a) => a.type === 'CAST_SPELL');
    expect(castSpells.length).toBeGreaterThan(0);

    // Mana abilities should be HIDDEN since CAST_SPELL auto-pays mana
    // This reduces the action space for AI training
    const manaAbilities = actions.filter((a) => a.type === 'ACTIVATE_ABILITY');
    expect(manaAbilities.length).toBe(0);
  });

  test('mana abilities are filtered when tapping cannot enable any cast', () => {
    const state = createTestState();

    // Add a creature spell that costs {1}{G}
    addToHand(state, 'player', 'Grizzly Bears');

    // Add only ONE land - not enough to cast anything
    addToBattlefield(state, 'player', 'Forest');

    const actions = getLegalActions(state, 'player');

    // Should NOT have mana ability actions since tapping 1 Forest
    // can't enable casting Grizzly Bears ({1}{G})
    const manaAbilities = actions.filter((a) => a.type === 'ACTIVATE_ABILITY');
    expect(manaAbilities.length).toBe(0);

    // Should only have PASS_PRIORITY
    expect(actions.length).toBe(1);
    expect(actions[0]?.type).toBe('PASS_PRIORITY');
  });

  test('X spells can be cast with X=0 when colored requirement is met', () => {
    const state = createTestState();

    // Add Blaze ({X}{R}) - can cast with just {R} for X=0
    addToHand(state, 'player', 'Blaze');

    // Add one Mountain - enough for X=0
    addToBattlefield(state, 'player', 'Mountain');

    const actions = getLegalActions(state, 'player');

    // Should have CAST_SPELL for Blaze (can cast with X=0)
    const castSpells = actions.filter((a) => a.type === 'CAST_SPELL');
    expect(castSpells.length).toBeGreaterThan(0);

    // Mana abilities should be HIDDEN since CAST_SPELL is available
    const manaAbilities = actions.filter((a) => a.type === 'ACTIVATE_ABILITY');
    expect(manaAbilities.length).toBe(0);
  });
});

describe('F6 Mode (opt-in engine-level auto-pass)', () => {
  test('F6 mode is disabled by default', () => {
    const state = createTestState();
    expect(state.enableF6AutoPass).toBeUndefined();
  });

  test('enableF6Mode enables F6 auto-pass', async () => {
    const { enableF6Mode } = await import('../src/state/GameState');
    const state = createTestState();

    enableF6Mode(state, true);
    expect(state.enableF6AutoPass).toBe(true);

    enableF6Mode(state, false);
    expect(state.enableF6AutoPass).toBe(false);
  });

  test('F6 mode auto-resolves stack when neither player has responses', async () => {
    const { enableF6Mode } = await import('../src/state/GameState');
    const state = createTestState();
    enableF6Mode(state, true);

    // Give player mana to cast Lightning Blast
    addToBattlefield(state, 'player', 'Mountain');
    addToBattlefield(state, 'player', 'Mountain');
    addToBattlefield(state, 'player', 'Mountain');
    addToBattlefield(state, 'player', 'Mountain');
    addToHand(state, 'player', 'Lightning Blast');

    // Give opponent a creature to target (no instant-speed options)
    const bearsId = addToBattlefield(state, 'opponent', 'Grizzly Bears');

    // Clear opponent's hand so they have no responses
    state.players.opponent.hand = [];

    // Cast Lightning Blast targeting the creature (not the player)
    const actions = getLegalActions(state, 'player');
    const castAction = actions.find(
      (a) =>
        a.type === 'CAST_SPELL' &&
        a.payload.cardInstanceId === state.players.player.hand[0]?.instanceId &&
        a.payload.targets?.includes(bearsId),
    );
    expect(castAction).toBeDefined();

    // Cast the spell - after casting, priority goes to opponent
    let newState = applyAction(state, castAction!);

    // Priority should be with opponent (they get chance to respond)
    expect(newState.priorityPlayer).toBe('opponent');

    // Opponent has no responses (empty hand, no abilities), so they pass
    const oppPassAction = getLegalActions(newState, 'opponent').find(
      (a) => a.type === 'PASS_PRIORITY',
    );
    expect(oppPassAction).toBeDefined();
    newState = applyAction(newState, oppPassAction!);

    // After opponent passes, priority goes back to player
    // Player also has no responses at instant speed, so F6 auto-passes for player
    // Then both have passed, so spell resolves

    // With F6 mode, player auto-passes (no instant responses), spell resolves
    // Stack should be empty after resolution
    expect(newState.stack.length).toBe(0);

    // Grizzly Bears should have taken 4 damage and died
    expect(newState.players.opponent.battlefield.length).toBe(0);
    expect(newState.players.opponent.graveyard.length).toBe(1);
  });

  test('F6 mode skips empty combat phases', async () => {
    const { enableF6Mode } = await import('../src/state/GameState');
    const state = createTestState();
    enableF6Mode(state, true);

    // Set to main1, empty hands and battlefields
    state.phase = 'main1';
    state.step = 'main';
    state.players.player.hand = [];
    state.players.opponent.hand = [];
    state.players.player.battlefield = [];
    state.players.opponent.battlefield = [];
    state.players.player.landsPlayedThisTurn = 1; // Already played land

    // Player should auto-pass (no options)
    expect(shouldAutoPass(state, 'player')).toBe(true);

    // Pass priority - with F6 mode, should skip through phases
    let newState = applyAction(state, { type: 'PASS_PRIORITY', playerId: 'player', payload: {} });

    // Should have advanced past main1 → combat (auto-skip) → main2
    // Both players have no options, so F6 keeps passing
    expect(newState.phase).not.toBe('main1');
  });

  test('F6 mode does NOT skip phases when player has options', async () => {
    const { enableF6Mode } = await import('../src/state/GameState');
    const state = createTestState();
    enableF6Mode(state, true);

    // Give player a creature that can attack
    addToBattlefield(state, 'player', 'Grizzly Bears');

    // Set to combat, declare_attackers
    state.phase = 'combat';
    state.step = 'declare_attackers';

    // Player should NOT auto-pass because they have attackers
    expect(shouldAutoPass(state, 'player')).toBe(false);
  });

  test('disabled F6 mode requires explicit passes', async () => {
    const { enableF6Mode } = await import('../src/state/GameState');
    const state = createTestState();
    enableF6Mode(state, false); // Explicitly disabled

    // Give player mana to cast Lightning Blast
    addToBattlefield(state, 'player', 'Mountain');
    addToBattlefield(state, 'player', 'Mountain');
    addToBattlefield(state, 'player', 'Mountain');
    addToBattlefield(state, 'player', 'Mountain');
    addToHand(state, 'player', 'Lightning Blast');

    // Give opponent a creature to target
    addToBattlefield(state, 'opponent', 'Grizzly Bears');
    state.players.opponent.hand = []; // No responses

    // Cast Lightning Blast
    const castAction = getLegalActions(state, 'player').find((a) => a.type === 'CAST_SPELL');
    expect(castAction).toBeDefined();
    let newState = applyAction(state, castAction!);

    // After casting, priority goes to opponent (to respond)
    expect(newState.priorityPlayer).toBe('opponent');

    // Opponent passes priority (has no responses, but F6 is disabled so must explicitly pass)
    const oppPassAction = getLegalActions(newState, 'opponent').find(
      (a) => a.type === 'PASS_PRIORITY',
    );
    expect(oppPassAction).toBeDefined();
    newState = applyAction(newState, oppPassAction!);

    // After opponent passes, priority goes back to player
    // Without F6 mode, player must explicitly pass too
    expect(newState.stack.length).toBe(1);
    expect(newState.priorityPlayer).toBe('player');

    // Player passes priority
    const playerPassAction = getLegalActions(newState, 'player').find(
      (a) => a.type === 'PASS_PRIORITY',
    );
    expect(playerPassAction).toBeDefined();
    newState = applyAction(newState, playerPassAction!);

    // Now both have passed, spell resolves
    expect(newState.stack.length).toBe(0);
  });
});
