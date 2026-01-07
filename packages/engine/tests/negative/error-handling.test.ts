/**
 * Negative/Error Handling Tests
 *
 * These tests verify that the engine correctly handles invalid inputs and error conditions.
 * The engine should:
 * - Reject invalid actions with meaningful error messages
 * - Never crash on invalid input
 * - Maintain state consistency after rejected actions
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import {
  CardLoader,
  createCardInstance,
  createGameState,
  applyAction,
  getPlayer,
  getLegalActions,
  validateAction,
  getActivatedAbilities,
  type GameState,
  type PlayLandAction,
  type CastSpellAction,
  type DeclareAttackersAction,
  type DeclareBlockersAction,
  type PassPriorityAction,
  type EndTurnAction,
  type ActivateAbilityAction,
  type SacrificePermanentAction,
} from '../../src/index';

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Create a basic game state with some cards for testing
 */
function createTestGameState(): GameState {
  const mountain = CardLoader.getByName('Mountain')!;
  const forest = CardLoader.getByName('Forest')!;

  const playerLibrary = Array(10)
    .fill(null)
    .map(() => createCardInstance(mountain.id, 'player', 'library'));
  const opponentLibrary = Array(10)
    .fill(null)
    .map(() => createCardInstance(forest.id, 'opponent', 'library'));

  const state = createGameState(playerLibrary, opponentLibrary);
  state.phase = 'main1';
  state.step = 'main';
  state.activePlayer = 'player';
  state.priorityPlayer = 'player';

  return state;
}

/**
 * Clone state and verify it matches original (for state consistency checks)
 */
function cloneState(state: GameState): GameState {
  return JSON.parse(JSON.stringify(state));
}

// =============================================================================
// 1. INVALID ACTION HANDLING - Actions that should be rejected
// =============================================================================

describe('Invalid Action Handling', () => {
  test('playing a non-existent card fails validation', () => {
    const state = createTestGameState();

    const action: PlayLandAction = {
      type: 'PLAY_LAND',
      playerId: 'player',
      payload: { cardInstanceId: 'non-existent-card-id-12345' },
    };

    const errors = validateAction(state, action);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors).toContain('Card not found');
  });

  test('playing a non-existent card throws when applied', () => {
    const state = createTestGameState();

    const action: PlayLandAction = {
      type: 'PLAY_LAND',
      playerId: 'player',
      payload: { cardInstanceId: 'non-existent-card-id-12345' },
    };

    expect(() => applyAction(state, action)).toThrow('Invalid action');
  });

  test('casting a non-existent spell fails validation', () => {
    const state = createTestGameState();

    const action: CastSpellAction = {
      type: 'CAST_SPELL',
      playerId: 'player',
      payload: { cardInstanceId: 'non-existent-spell-id' },
    };

    const errors = validateAction(state, action);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors).toContain('Card not found');
  });

  test('activating ability on non-existent card fails', () => {
    const state = createTestGameState();

    const action: ActivateAbilityAction = {
      type: 'ACTIVATE_ABILITY',
      playerId: 'player',
      payload: {
        sourceId: 'fake-card-id',
        abilityId: 'fake-ability',
      },
    };

    const errors = validateAction(state, action);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors).toContain('Card not found');
  });

  test('sacrificing non-existent permanent fails', () => {
    const state = createTestGameState();

    const action: SacrificePermanentAction = {
      type: 'SACRIFICE_PERMANENT',
      playerId: 'player',
      payload: { permanentId: 'fake-permanent-id' },
    };

    const errors = validateAction(state, action);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors).toContain('Permanent not found');
  });

  test('playing a non-land card as a land fails', () => {
    const state = createTestGameState();
    const bears = CardLoader.getByName('Grizzly Bears')!;
    const bearsCard = createCardInstance(bears.id, 'player', 'hand');
    getPlayer(state, 'player').hand.push(bearsCard);

    const action: PlayLandAction = {
      type: 'PLAY_LAND',
      playerId: 'player',
      payload: { cardInstanceId: bearsCard.instanceId },
    };

    const errors = validateAction(state, action);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors).toContain('Card is not a land');
  });
});

// =============================================================================
// 2. WRONG PLAYER ACTIONS - Actions from the wrong player
// =============================================================================

describe('Wrong Player Actions', () => {
  test('opponent cannot play land on player turn', () => {
    const state = createTestGameState();
    const forest = CardLoader.getByName('Forest')!;
    const forestCard = createCardInstance(forest.id, 'opponent', 'hand');
    getPlayer(state, 'opponent').hand.push(forestCard);

    state.activePlayer = 'player';

    const action: PlayLandAction = {
      type: 'PLAY_LAND',
      playerId: 'opponent',
      payload: { cardInstanceId: forestCard.instanceId },
    };

    const errors = validateAction(state, action);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors).toContain('Not your turn');
  });

  test('player cannot cast sorcery-speed spell on opponent turn', () => {
    const state = createTestGameState();
    const bears = CardLoader.getByName('Grizzly Bears')!;
    const bearsCard = createCardInstance(bears.id, 'player', 'hand');
    getPlayer(state, 'player').hand.push(bearsCard);

    // Give mana
    const forest = CardLoader.getByName('Forest')!;
    getPlayer(state, 'player').battlefield.push(
      createCardInstance(forest.id, 'player', 'battlefield'),
      createCardInstance(forest.id, 'player', 'battlefield'),
    );

    state.activePlayer = 'opponent';
    state.priorityPlayer = 'player'; // Player has priority but it's not their turn

    const action: CastSpellAction = {
      type: 'CAST_SPELL',
      playerId: 'player',
      payload: { cardInstanceId: bearsCard.instanceId },
    };

    const errors = validateAction(state, action);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors).toContain('Can only cast sorcery-speed spells on your turn');
  });

  test('active player cannot declare blockers during declare blockers step', () => {
    const state = createTestGameState();
    const bears = CardLoader.getByName('Grizzly Bears')!;

    // Put creature on active player's battlefield (attacker)
    const attackerCreature = createCardInstance(bears.id, 'player', 'battlefield');
    attackerCreature.summoningSick = false;
    attackerCreature.attacking = true;
    getPlayer(state, 'player').battlefield.push(attackerCreature);

    // Put blocker on opponent battlefield
    const blockerCreature = createCardInstance(bears.id, 'opponent', 'battlefield');
    blockerCreature.summoningSick = false;
    getPlayer(state, 'opponent').battlefield.push(blockerCreature);

    state.phase = 'combat';
    state.step = 'declare_blockers';
    state.activePlayer = 'player';

    // Active player tries to declare blockers (should fail)
    const action: DeclareBlockersAction = {
      type: 'DECLARE_BLOCKERS',
      playerId: 'player',
      payload: { blocks: [] },
    };

    const errors = validateAction(state, action);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors).toContain('Only the defending player can declare blockers');
  });

  test('opponent cannot cast spell without priority', () => {
    const state = createTestGameState();
    const bolt = CardLoader.getByName('Lightning Bolt');
    if (!bolt) return; // Skip if card not available

    const boltCard = createCardInstance(bolt.id, 'opponent', 'hand');
    getPlayer(state, 'opponent').hand.push(boltCard);

    // Give mana
    const mountain = CardLoader.getByName('Mountain')!;
    getPlayer(state, 'opponent').battlefield.push(
      createCardInstance(mountain.id, 'opponent', 'battlefield'),
    );

    state.priorityPlayer = 'player'; // Player has priority

    const action: CastSpellAction = {
      type: 'CAST_SPELL',
      playerId: 'opponent',
      payload: {
        cardInstanceId: boltCard.instanceId,
        targets: ['player'],
      },
    };

    const errors = validateAction(state, action);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors).toContain('You do not have priority');
  });

  test('cannot control card owned by opponent', () => {
    const state = createTestGameState();
    const mountain = CardLoader.getByName('Mountain')!;

    // Create a land owned by opponent
    const opponentLand = createCardInstance(mountain.id, 'opponent', 'hand');
    getPlayer(state, 'opponent').hand.push(opponentLand);

    // Player tries to play opponent's land
    const action: PlayLandAction = {
      type: 'PLAY_LAND',
      playerId: 'player',
      payload: { cardInstanceId: opponentLand.instanceId },
    };

    const errors = validateAction(state, action);
    expect(errors.length).toBeGreaterThan(0);
    // Should fail because card is not in player's hand or not controlled by player
  });
});

// =============================================================================
// 3. INVALID TARGETS - Targeting invalid permanents/players
// =============================================================================

describe('Invalid Targets', () => {
  test('targeting non-existent permanent fails', () => {
    const state = createTestGameState();
    const blast = CardLoader.getByName('Lightning Blast')!;
    const blastCard = createCardInstance(blast.id, 'player', 'hand');
    getPlayer(state, 'player').hand.push(blastCard);

    // Add mana
    const mountain = CardLoader.getByName('Mountain')!;
    for (let i = 0; i < 4; i++) {
      getPlayer(state, 'player').battlefield.push(
        createCardInstance(mountain.id, 'player', 'battlefield'),
      );
    }

    const action: CastSpellAction = {
      type: 'CAST_SPELL',
      playerId: 'player',
      payload: {
        cardInstanceId: blastCard.instanceId,
        targets: ['non-existent-target-id'],
      },
    };

    const errors = validateAction(state, action);
    expect(errors.length).toBeGreaterThan(0);
  });

  test('targeting creature in wrong zone fails', () => {
    const state = createTestGameState();
    const terror = CardLoader.getByName('Terror');
    if (!terror) return; // Skip if not available

    const terrorCard = createCardInstance(terror.id, 'player', 'hand');
    getPlayer(state, 'player').hand.push(terrorCard);

    // Add mana
    const swamp = CardLoader.getByName('Swamp')!;
    for (let i = 0; i < 2; i++) {
      getPlayer(state, 'player').battlefield.push(
        createCardInstance(swamp.id, 'player', 'battlefield'),
      );
    }

    // Put target creature in graveyard (not battlefield)
    const bears = CardLoader.getByName('Grizzly Bears')!;
    const graveyardCreature = createCardInstance(bears.id, 'opponent', 'graveyard');
    getPlayer(state, 'opponent').graveyard.push(graveyardCreature);

    const action: CastSpellAction = {
      type: 'CAST_SPELL',
      playerId: 'player',
      payload: {
        cardInstanceId: terrorCard.instanceId,
        targets: [graveyardCreature.instanceId],
      },
    };

    const errors = validateAction(state, action);
    expect(errors.length).toBeGreaterThan(0);
  });

  test('declaring attack with non-existent creature fails', () => {
    const state = createTestGameState();

    const action: DeclareAttackersAction = {
      type: 'DECLARE_ATTACKERS',
      playerId: 'player',
      payload: { attackers: ['fake-creature-id'] },
    };

    const errors = validateAction(state, action);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.includes('not found'))).toBe(true);
  });

  test('blocking with non-existent creature fails', () => {
    const state = createTestGameState();
    const bears = CardLoader.getByName('Grizzly Bears')!;

    // Setup attacking creature
    const attacker = createCardInstance(bears.id, 'player', 'battlefield');
    attacker.summoningSick = false;
    attacker.attacking = true;
    getPlayer(state, 'player').battlefield.push(attacker);

    state.phase = 'combat';
    state.step = 'declare_blockers';
    state.activePlayer = 'player';

    const action: DeclareBlockersAction = {
      type: 'DECLARE_BLOCKERS',
      playerId: 'opponent',
      payload: {
        blocks: [{ blockerId: 'fake-blocker-id', attackerId: attacker.instanceId }],
      },
    };

    const errors = validateAction(state, action);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.includes('not found'))).toBe(true);
  });

  test('blocking a non-attacking creature fails', () => {
    const state = createTestGameState();
    const bears = CardLoader.getByName('Grizzly Bears')!;

    // Setup non-attacking creature
    const notAttacker = createCardInstance(bears.id, 'player', 'battlefield');
    notAttacker.summoningSick = false;
    notAttacker.attacking = false; // NOT attacking
    getPlayer(state, 'player').battlefield.push(notAttacker);

    // Setup blocker
    const blocker = createCardInstance(bears.id, 'opponent', 'battlefield');
    blocker.summoningSick = false;
    getPlayer(state, 'opponent').battlefield.push(blocker);

    state.phase = 'combat';
    state.step = 'declare_blockers';
    state.activePlayer = 'player';

    const action: DeclareBlockersAction = {
      type: 'DECLARE_BLOCKERS',
      playerId: 'opponent',
      payload: {
        blocks: [{ blockerId: blocker.instanceId, attackerId: notAttacker.instanceId }],
      },
    };

    const errors = validateAction(state, action);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.includes('not attacking'))).toBe(true);
  });
});

// =============================================================================
// 4. ILLEGAL TIMING - Actions at wrong phase/step
// =============================================================================

describe('Illegal Timing', () => {
  test('cannot play land during combat phase', () => {
    const state = createTestGameState();
    const mountain = CardLoader.getByName('Mountain')!;
    const mountainCard = createCardInstance(mountain.id, 'player', 'hand');
    getPlayer(state, 'player').hand.push(mountainCard);

    state.phase = 'combat';
    state.step = 'declare_attackers';

    const action: PlayLandAction = {
      type: 'PLAY_LAND',
      playerId: 'player',
      payload: { cardInstanceId: mountainCard.instanceId },
    };

    const errors = validateAction(state, action);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors).toContain('Can only play lands during main phase');
  });

  test('cannot play land during beginning phase', () => {
    const state = createTestGameState();
    const mountain = CardLoader.getByName('Mountain')!;
    const mountainCard = createCardInstance(mountain.id, 'player', 'hand');
    getPlayer(state, 'player').hand.push(mountainCard);

    state.phase = 'beginning';
    state.step = 'untap';

    const action: PlayLandAction = {
      type: 'PLAY_LAND',
      playerId: 'player',
      payload: { cardInstanceId: mountainCard.instanceId },
    };

    const errors = validateAction(state, action);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors).toContain('Can only play lands during main phase');
  });

  test('cannot cast sorcery during combat phase', () => {
    const state = createTestGameState();
    const wrath = CardLoader.getByName('Wrath of God');
    if (!wrath) return; // Skip if not available

    const wrathCard = createCardInstance(wrath.id, 'player', 'hand');
    getPlayer(state, 'player').hand.push(wrathCard);

    // Add mana
    const plains = CardLoader.getByName('Plains')!;
    for (let i = 0; i < 4; i++) {
      getPlayer(state, 'player').battlefield.push(
        createCardInstance(plains.id, 'player', 'battlefield'),
      );
    }

    state.phase = 'combat';
    state.step = 'declare_attackers';

    const action: CastSpellAction = {
      type: 'CAST_SPELL',
      playerId: 'player',
      payload: { cardInstanceId: wrathCard.instanceId },
    };

    const errors = validateAction(state, action);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors).toContain('Can only cast sorcery-speed spells during main phase');
  });

  test('cannot play land while stack is not empty', () => {
    const state = createTestGameState();
    const mountain = CardLoader.getByName('Mountain')!;
    const mountainCard = createCardInstance(mountain.id, 'player', 'hand');
    getPlayer(state, 'player').hand.push(mountainCard);

    // Put something on the stack
    const bears = CardLoader.getByName('Grizzly Bears')!;
    const stackCard = createCardInstance(bears.id, 'player', 'stack');
    state.stack.push({
      id: 'stack-1',
      controller: 'player',
      card: stackCard,
      targets: [],
      resolved: false,
      countered: false,
    });

    const action: PlayLandAction = {
      type: 'PLAY_LAND',
      playerId: 'player',
      payload: { cardInstanceId: mountainCard.instanceId },
    };

    const errors = validateAction(state, action);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors).toContain('Cannot play lands while the stack is not empty');
  });

  test('cannot cast creature spell while stack is not empty', () => {
    const state = createTestGameState();
    const bears = CardLoader.getByName('Grizzly Bears')!;
    const bearsCard = createCardInstance(bears.id, 'player', 'hand');
    getPlayer(state, 'player').hand.push(bearsCard);

    // Add mana
    const forest = CardLoader.getByName('Forest')!;
    getPlayer(state, 'player').battlefield.push(
      createCardInstance(forest.id, 'player', 'battlefield'),
      createCardInstance(forest.id, 'player', 'battlefield'),
    );

    // Put something on the stack
    const otherCard = createCardInstance(bears.id, 'player', 'stack');
    state.stack.push({
      id: 'stack-1',
      controller: 'player',
      card: otherCard,
      targets: [],
      resolved: false,
      countered: false,
    });

    const action: CastSpellAction = {
      type: 'CAST_SPELL',
      playerId: 'player',
      payload: { cardInstanceId: bearsCard.instanceId },
    };

    const errors = validateAction(state, action);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors).toContain('Cannot cast sorcery-speed spells while stack is not empty');
  });

  test('cannot declare attackers during main2', () => {
    const state = createTestGameState();
    const bears = CardLoader.getByName('Grizzly Bears')!;
    const creature = createCardInstance(bears.id, 'player', 'battlefield');
    creature.summoningSick = false;
    getPlayer(state, 'player').battlefield.push(creature);

    state.phase = 'main2';
    state.step = 'main';

    const action: DeclareAttackersAction = {
      type: 'DECLARE_ATTACKERS',
      playerId: 'player',
      payload: { attackers: [creature.instanceId] },
    };

    const errors = validateAction(state, action);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.includes('declare_attackers'))).toBe(true);
  });

  test('cannot declare blockers outside declare_blockers step', () => {
    const state = createTestGameState();
    state.phase = 'main1';
    state.step = 'main';

    const action: DeclareBlockersAction = {
      type: 'DECLARE_BLOCKERS',
      playerId: 'opponent',
      payload: { blocks: [] },
    };

    const errors = validateAction(state, action);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors).toContain('Can only declare blockers during declare_blockers step');
  });
});

// =============================================================================
// 5. RESOURCE VIOLATIONS - Not enough mana, already played land
// =============================================================================

describe('Resource Violations', () => {
  test('cannot cast spell without enough mana', () => {
    const state = createTestGameState();
    const bears = CardLoader.getByName('Grizzly Bears')!; // Costs {1}{G}
    const bearsCard = createCardInstance(bears.id, 'player', 'hand');
    getPlayer(state, 'player').hand.push(bearsCard);

    // No mana sources - player has empty battlefield

    const action: CastSpellAction = {
      type: 'CAST_SPELL',
      playerId: 'player',
      payload: { cardInstanceId: bearsCard.instanceId },
    };

    const errors = validateAction(state, action);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors).toContain('Not enough mana to cast this spell');
  });

  test('cannot cast spell with wrong color mana', () => {
    const state = createTestGameState();
    const bears = CardLoader.getByName('Grizzly Bears')!; // Costs {1}{G}
    const bearsCard = createCardInstance(bears.id, 'player', 'hand');
    getPlayer(state, 'player').hand.push(bearsCard);

    // Add only mountains (red mana, not green)
    const mountain = CardLoader.getByName('Mountain')!;
    getPlayer(state, 'player').battlefield.push(
      createCardInstance(mountain.id, 'player', 'battlefield'),
      createCardInstance(mountain.id, 'player', 'battlefield'),
    );

    const action: CastSpellAction = {
      type: 'CAST_SPELL',
      playerId: 'player',
      payload: { cardInstanceId: bearsCard.instanceId },
    };

    const errors = validateAction(state, action);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors).toContain('Not enough mana to cast this spell');
  });

  test('cannot play two lands in one turn', () => {
    const state = createTestGameState();
    const mountain = CardLoader.getByName('Mountain')!;
    const forest = CardLoader.getByName('Forest')!;

    const mountain1 = createCardInstance(mountain.id, 'player', 'hand');
    const forest1 = createCardInstance(forest.id, 'player', 'hand');
    getPlayer(state, 'player').hand.push(mountain1, forest1);

    // Play first land
    let newState = applyAction(state, {
      type: 'PLAY_LAND',
      playerId: 'player',
      payload: { cardInstanceId: mountain1.instanceId },
    } as PlayLandAction);

    expect(getPlayer(newState, 'player').landsPlayedThisTurn).toBe(1);

    // Try to play second land
    const action: PlayLandAction = {
      type: 'PLAY_LAND',
      playerId: 'player',
      payload: { cardInstanceId: forest1.instanceId },
    };

    const errors = validateAction(newState, action);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors).toContain('Already played a land this turn');
  });

  test('cannot cast spell if all mana sources are tapped', () => {
    const state = createTestGameState();
    const bears = CardLoader.getByName('Grizzly Bears')!;
    const bearsCard = createCardInstance(bears.id, 'player', 'hand');
    getPlayer(state, 'player').hand.push(bearsCard);

    // Add tapped forests
    const forest = CardLoader.getByName('Forest')!;
    const tappedForest1 = createCardInstance(forest.id, 'player', 'battlefield');
    tappedForest1.tapped = true;
    const tappedForest2 = createCardInstance(forest.id, 'player', 'battlefield');
    tappedForest2.tapped = true;
    getPlayer(state, 'player').battlefield.push(tappedForest1, tappedForest2);

    const action: CastSpellAction = {
      type: 'CAST_SPELL',
      playerId: 'player',
      payload: { cardInstanceId: bearsCard.instanceId },
    };

    const errors = validateAction(state, action);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors).toContain('Not enough mana to cast this spell');
  });

  test('cannot activate ability that requires tap cost when already tapped', () => {
    const state = createTestGameState();
    const elves = CardLoader.getByName('Llanowar Elves')!;
    const elvesCard = createCardInstance(elves.id, 'player', 'battlefield');
    elvesCard.summoningSick = false;
    getPlayer(state, 'player').battlefield.push(elvesCard);

    // Get the actual ability ID (dynamically generated)
    const abilities = getActivatedAbilities(elvesCard, state);
    const tapAbility = abilities.find((a) => a.cost.tap);
    expect(tapAbility).toBeDefined();

    // Now tap the creature
    elvesCard.tapped = true;

    const action: ActivateAbilityAction = {
      type: 'ACTIVATE_ABILITY',
      playerId: 'player',
      payload: {
        sourceId: elvesCard.instanceId,
        abilityId: tapAbility!.id,
      },
    };

    const errors = validateAction(state, action);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.includes('cannot be activated'))).toBe(true);
  });

  test('negative X value for X spells fails validation', () => {
    const state = createTestGameState();
    const fireball = CardLoader.getByName('Fireball');
    if (!fireball) return; // Skip if not available

    const fireballCard = createCardInstance(fireball.id, 'player', 'hand');
    getPlayer(state, 'player').hand.push(fireballCard);

    // Add mana
    const mountain = CardLoader.getByName('Mountain')!;
    for (let i = 0; i < 5; i++) {
      getPlayer(state, 'player').battlefield.push(
        createCardInstance(mountain.id, 'player', 'battlefield'),
      );
    }

    const action: CastSpellAction = {
      type: 'CAST_SPELL',
      playerId: 'player',
      payload: {
        cardInstanceId: fireballCard.instanceId,
        targets: ['opponent'],
        xValue: -5,
      },
    };

    const errors = validateAction(state, action);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors).toContain('X value cannot be negative');
  });
});

// =============================================================================
// 6. STATE CONSISTENCY - State remains valid after rejected actions
// =============================================================================

describe('State Consistency After Rejected Actions', () => {
  test('state is unchanged after validation failure', () => {
    const state = createTestGameState();
    const mountain = CardLoader.getByName('Mountain')!;
    const mountainCard = createCardInstance(mountain.id, 'player', 'hand');
    getPlayer(state, 'player').hand.push(mountainCard);

    // Clone the state before attempting invalid action
    const stateBefore = cloneState(state);

    // Try invalid action (playing land during combat)
    state.phase = 'combat';
    stateBefore.phase = 'combat';

    const action: PlayLandAction = {
      type: 'PLAY_LAND',
      playerId: 'player',
      payload: { cardInstanceId: mountainCard.instanceId },
    };

    // Validate returns errors
    const errors = validateAction(state, action);
    expect(errors.length).toBeGreaterThan(0);

    // State should be unchanged
    expect(getPlayer(state, 'player').hand.length).toBe(getPlayer(stateBefore, 'player').hand.length);
    expect(getPlayer(state, 'player').battlefield.length).toBe(
      getPlayer(stateBefore, 'player').battlefield.length,
    );
    expect(state.phase).toBe(stateBefore.phase);
  });

  test('applyAction throws but does not corrupt original state', () => {
    const state = createTestGameState();
    const mountain = CardLoader.getByName('Mountain')!;
    const mountainCard = createCardInstance(mountain.id, 'player', 'hand');
    getPlayer(state, 'player').hand.push(mountainCard);

    state.phase = 'combat'; // Invalid phase for playing land

    const originalHandLength = getPlayer(state, 'player').hand.length;
    const originalBattlefieldLength = getPlayer(state, 'player').battlefield.length;
    const originalPhase = state.phase;

    const action: PlayLandAction = {
      type: 'PLAY_LAND',
      playerId: 'player',
      payload: { cardInstanceId: mountainCard.instanceId },
    };

    // This should throw
    expect(() => applyAction(state, action)).toThrow('Invalid action');

    // Original state should be unchanged (applyAction uses immutable cloning)
    expect(getPlayer(state, 'player').hand.length).toBe(originalHandLength);
    expect(getPlayer(state, 'player').battlefield.length).toBe(originalBattlefieldLength);
    expect(state.phase).toBe(originalPhase);
  });

  test('life totals unchanged after failed spell cast', () => {
    const state = createTestGameState();
    const blast = CardLoader.getByName('Lightning Blast')!;
    const blastCard = createCardInstance(blast.id, 'player', 'hand');
    getPlayer(state, 'player').hand.push(blastCard);

    // No mana - spell should fail
    const opponentLifeBefore = getPlayer(state, 'opponent').life;

    const action: CastSpellAction = {
      type: 'CAST_SPELL',
      playerId: 'player',
      payload: {
        cardInstanceId: blastCard.instanceId,
        targets: ['opponent'],
      },
    };

    // Should fail validation
    const errors = validateAction(state, action);
    expect(errors.length).toBeGreaterThan(0);

    // Life should be unchanged
    expect(getPlayer(state, 'opponent').life).toBe(opponentLifeBefore);
  });

  test('mana pool unchanged after failed spell cast', () => {
    const state = createTestGameState();
    const bears = CardLoader.getByName('Grizzly Bears')!;
    const bearsCard = createCardInstance(bears.id, 'player', 'hand');
    getPlayer(state, 'player').hand.push(bearsCard);

    // Add some mana to pool
    getPlayer(state, 'player').manaPool = {
      white: 0,
      blue: 0,
      black: 0,
      red: 0,
      green: 1, // Not enough for Grizzly Bears ({1}{G})
      colorless: 0,
    };

    const manaPoolBefore = { ...getPlayer(state, 'player').manaPool };

    const action: CastSpellAction = {
      type: 'CAST_SPELL',
      playerId: 'player',
      payload: { cardInstanceId: bearsCard.instanceId },
    };

    // Should fail validation due to insufficient mana
    const errors = validateAction(state, action);
    expect(errors.length).toBeGreaterThan(0);

    // Mana pool should be unchanged
    expect(getPlayer(state, 'player').manaPool).toEqual(manaPoolBefore);
  });
});

// =============================================================================
// 7. BOUNDARY CONDITIONS - Edge cases at limits
// =============================================================================

describe('Boundary Conditions', () => {
  test('attacking with summoning sick creature fails', () => {
    const state = createTestGameState();
    const bears = CardLoader.getByName('Grizzly Bears')!;
    const creature = createCardInstance(bears.id, 'player', 'battlefield');
    creature.summoningSick = true; // Just entered battlefield
    getPlayer(state, 'player').battlefield.push(creature);

    const action: DeclareAttackersAction = {
      type: 'DECLARE_ATTACKERS',
      playerId: 'player',
      payload: { attackers: [creature.instanceId] },
    };

    const errors = validateAction(state, action);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.includes('summoning sickness'))).toBe(true);
  });

  test('attacking with tapped creature fails', () => {
    const state = createTestGameState();
    const bears = CardLoader.getByName('Grizzly Bears')!;
    const creature = createCardInstance(bears.id, 'player', 'battlefield');
    creature.summoningSick = false;
    creature.tapped = true; // Already tapped
    getPlayer(state, 'player').battlefield.push(creature);

    const action: DeclareAttackersAction = {
      type: 'DECLARE_ATTACKERS',
      playerId: 'player',
      payload: { attackers: [creature.instanceId] },
    };

    const errors = validateAction(state, action);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.includes('tapped'))).toBe(true);
  });

  test('blocking with tapped creature fails', () => {
    const state = createTestGameState();
    const bears = CardLoader.getByName('Grizzly Bears')!;

    // Setup attacker
    const attacker = createCardInstance(bears.id, 'player', 'battlefield');
    attacker.summoningSick = false;
    attacker.attacking = true;
    getPlayer(state, 'player').battlefield.push(attacker);

    // Setup tapped blocker
    const blocker = createCardInstance(bears.id, 'opponent', 'battlefield');
    blocker.summoningSick = false;
    blocker.tapped = true; // Tapped!
    getPlayer(state, 'opponent').battlefield.push(blocker);

    state.phase = 'combat';
    state.step = 'declare_blockers';
    state.activePlayer = 'player';

    const action: DeclareBlockersAction = {
      type: 'DECLARE_BLOCKERS',
      playerId: 'opponent',
      payload: {
        blocks: [{ blockerId: blocker.instanceId, attackerId: attacker.instanceId }],
      },
    };

    const errors = validateAction(state, action);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.includes('tapped'))).toBe(true);
  });

  test('attacking with creature that has Defender fails', () => {
    const state = createTestGameState();
    const wall = CardLoader.getByName('Wall of Stone');
    if (!wall) return; // Skip if not available

    const wallCard = createCardInstance(wall.id, 'player', 'battlefield');
    wallCard.summoningSick = false;
    getPlayer(state, 'player').battlefield.push(wallCard);

    const action: DeclareAttackersAction = {
      type: 'DECLARE_ATTACKERS',
      playerId: 'player',
      payload: { attackers: [wallCard.instanceId] },
    };

    const errors = validateAction(state, action);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.includes('Defender'))).toBe(true);
  });

  test('non-flying cannot block flying without reach', () => {
    const state = createTestGameState();
    const airElemental = CardLoader.getByName('Air Elemental');
    const bears = CardLoader.getByName('Grizzly Bears')!;

    if (!airElemental) return; // Skip if not available

    // Setup flying attacker
    const flyer = createCardInstance(airElemental.id, 'player', 'battlefield');
    flyer.summoningSick = false;
    flyer.attacking = true;
    getPlayer(state, 'player').battlefield.push(flyer);

    // Setup ground blocker
    const groundCreature = createCardInstance(bears.id, 'opponent', 'battlefield');
    groundCreature.summoningSick = false;
    getPlayer(state, 'opponent').battlefield.push(groundCreature);

    state.phase = 'combat';
    state.step = 'declare_blockers';
    state.activePlayer = 'player';

    const action: DeclareBlockersAction = {
      type: 'DECLARE_BLOCKERS',
      playerId: 'opponent',
      payload: {
        blocks: [{ blockerId: groundCreature.instanceId, attackerId: flyer.instanceId }],
      },
    };

    const errors = validateAction(state, action);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.includes('Flying'))).toBe(true);
  });

  test('cannot cast card that is not in hand', () => {
    const state = createTestGameState();
    const bears = CardLoader.getByName('Grizzly Bears')!;

    // Card is on battlefield, not in hand
    const bearsCard = createCardInstance(bears.id, 'player', 'battlefield');
    getPlayer(state, 'player').battlefield.push(bearsCard);

    const action: CastSpellAction = {
      type: 'CAST_SPELL',
      playerId: 'player',
      payload: { cardInstanceId: bearsCard.instanceId },
    };

    const errors = validateAction(state, action);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors).toContain('Card is not in hand');
  });

  test('cannot sacrifice permanent not on battlefield', () => {
    const state = createTestGameState();
    const bears = CardLoader.getByName('Grizzly Bears')!;

    // Card is in hand, not on battlefield
    const bearsCard = createCardInstance(bears.id, 'player', 'hand');
    getPlayer(state, 'player').hand.push(bearsCard);

    const action: SacrificePermanentAction = {
      type: 'SACRIFICE_PERMANENT',
      playerId: 'player',
      payload: { permanentId: bearsCard.instanceId },
    };

    const errors = validateAction(state, action);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors).toContain('Can only sacrifice permanents on the battlefield');
  });

  test('cannot sacrifice opponent permanent', () => {
    const state = createTestGameState();
    const bears = CardLoader.getByName('Grizzly Bears')!;

    // Card belongs to opponent
    const opponentCreature = createCardInstance(bears.id, 'opponent', 'battlefield');
    getPlayer(state, 'opponent').battlefield.push(opponentCreature);

    const action: SacrificePermanentAction = {
      type: 'SACRIFICE_PERMANENT',
      playerId: 'player',
      payload: { permanentId: opponentCreature.instanceId },
    };

    const errors = validateAction(state, action);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors).toContain('You do not control this permanent');
  });

  test('attacking with non-creature fails', () => {
    const state = createTestGameState();
    const mountain = CardLoader.getByName('Mountain')!;

    // Trying to attack with a land
    const landCard = createCardInstance(mountain.id, 'player', 'battlefield');
    getPlayer(state, 'player').battlefield.push(landCard);

    const action: DeclareAttackersAction = {
      type: 'DECLARE_ATTACKERS',
      playerId: 'player',
      payload: { attackers: [landCard.instanceId] },
    };

    const errors = validateAction(state, action);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.includes('not a creature'))).toBe(true);
  });

  test('blocking with non-creature fails', () => {
    const state = createTestGameState();
    const bears = CardLoader.getByName('Grizzly Bears')!;
    const mountain = CardLoader.getByName('Mountain')!;

    // Setup attacker
    const attacker = createCardInstance(bears.id, 'player', 'battlefield');
    attacker.summoningSick = false;
    attacker.attacking = true;
    getPlayer(state, 'player').battlefield.push(attacker);

    // Setup non-creature "blocker" (land)
    const landCard = createCardInstance(mountain.id, 'opponent', 'battlefield');
    getPlayer(state, 'opponent').battlefield.push(landCard);

    state.phase = 'combat';
    state.step = 'declare_blockers';
    state.activePlayer = 'player';

    const action: DeclareBlockersAction = {
      type: 'DECLARE_BLOCKERS',
      playerId: 'opponent',
      payload: {
        blocks: [{ blockerId: landCard.instanceId, attackerId: attacker.instanceId }],
      },
    };

    const errors = validateAction(state, action);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.includes('not a creature'))).toBe(true);
  });

  test('activating ability on card not on battlefield fails', () => {
    const state = createTestGameState();
    const elves = CardLoader.getByName('Llanowar Elves')!;

    // Card is in hand, not on battlefield
    const elvesCard = createCardInstance(elves.id, 'player', 'hand');
    getPlayer(state, 'player').hand.push(elvesCard);

    const action: ActivateAbilityAction = {
      type: 'ACTIVATE_ABILITY',
      playerId: 'player',
      payload: {
        sourceId: elvesCard.instanceId,
        abilityId: 'mana_tap_G',
      },
    };

    const errors = validateAction(state, action);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors).toContain('Card must be on the battlefield');
  });

  test('activating non-existent ability on card fails', () => {
    const state = createTestGameState();
    const elves = CardLoader.getByName('Llanowar Elves')!;

    const elvesCard = createCardInstance(elves.id, 'player', 'battlefield');
    elvesCard.summoningSick = false;
    getPlayer(state, 'player').battlefield.push(elvesCard);

    const action: ActivateAbilityAction = {
      type: 'ACTIVATE_ABILITY',
      playerId: 'player',
      payload: {
        sourceId: elvesCard.instanceId,
        abilityId: 'non_existent_ability_id',
      },
    };

    const errors = validateAction(state, action);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors).toContain('Ability not found on card');
  });

  test('cannot activate opponent creature ability', () => {
    const state = createTestGameState();
    const elves = CardLoader.getByName('Llanowar Elves')!;

    // Opponent's creature
    const elvesCard = createCardInstance(elves.id, 'opponent', 'battlefield');
    elvesCard.summoningSick = false;
    getPlayer(state, 'opponent').battlefield.push(elvesCard);

    // Get the actual ability ID from the card
    const abilities = getActivatedAbilities(elvesCard, state);
    const tapAbility = abilities.find((a) => a.cost.tap);
    expect(tapAbility).toBeDefined();

    const action: ActivateAbilityAction = {
      type: 'ACTIVATE_ABILITY',
      playerId: 'player',
      payload: {
        sourceId: elvesCard.instanceId,
        abilityId: tapAbility!.id,
      },
    };

    const errors = validateAction(state, action);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors).toContain('You do not control this card');
  });
});

// =============================================================================
// 8. ERROR MESSAGE QUALITY - Verify errors are meaningful
// =============================================================================

describe('Error Message Quality', () => {
  test('error messages are human-readable strings', () => {
    const state = createTestGameState();

    const action: PlayLandAction = {
      type: 'PLAY_LAND',
      playerId: 'player',
      payload: { cardInstanceId: 'non-existent' },
    };

    const errors = validateAction(state, action);

    // All errors should be non-empty strings
    for (const error of errors) {
      expect(typeof error).toBe('string');
      expect(error.length).toBeGreaterThan(0);
    }
  });

  test('multiple validation errors are all reported', () => {
    const state = createTestGameState();
    const bears = CardLoader.getByName('Grizzly Bears')!;
    const bearsCard = createCardInstance(bears.id, 'opponent', 'hand');
    getPlayer(state, 'opponent').hand.push(bearsCard);

    // Opponent tries to cast during player's turn, with no mana, during combat
    state.phase = 'combat';
    state.activePlayer = 'player';
    state.priorityPlayer = 'opponent';

    const action: CastSpellAction = {
      type: 'CAST_SPELL',
      playerId: 'opponent',
      payload: { cardInstanceId: bearsCard.instanceId },
    };

    const errors = validateAction(state, action);

    // Should have multiple errors
    expect(errors.length).toBeGreaterThan(1);
    // Check we get timing error and mana error
    expect(errors.some((e) => e.includes('sorcery-speed') || e.includes('turn'))).toBe(true);
    expect(errors.some((e) => e.includes('mana'))).toBe(true);
  });

  test('thrown error contains validation message', () => {
    const state = createTestGameState();

    const action: PlayLandAction = {
      type: 'PLAY_LAND',
      playerId: 'player',
      payload: { cardInstanceId: 'non-existent' },
    };

    try {
      applyAction(state, action);
      expect(true).toBe(false); // Should not reach here
    } catch (e) {
      expect(e instanceof Error).toBe(true);
      expect((e as Error).message).toContain('Invalid action');
      expect((e as Error).message).toContain('Card not found');
    }
  });
});

// =============================================================================
// 9. getLegalActions NEVER RETURNS INVALID ACTIONS
// =============================================================================

describe('getLegalActions Returns Only Valid Actions', () => {
  test('getLegalActions does not return actions that fail validation', () => {
    const state = createTestGameState();
    const forest = CardLoader.getByName('Forest')!;
    const bears = CardLoader.getByName('Grizzly Bears')!;

    // Add some cards to hand
    const land = createCardInstance(forest.id, 'player', 'hand');
    const creature = createCardInstance(bears.id, 'player', 'hand');
    getPlayer(state, 'player').hand.push(land, creature);

    // Add some mana
    getPlayer(state, 'player').battlefield.push(
      createCardInstance(forest.id, 'player', 'battlefield'),
      createCardInstance(forest.id, 'player', 'battlefield'),
    );

    const legalActions = getLegalActions(state, 'player');

    // Every legal action should pass validation
    for (const action of legalActions) {
      const errors = validateAction(state, action);
      expect(errors).toEqual([]);
    }
  });

  test('getLegalActions respects mana constraints', () => {
    const state = createTestGameState();
    const bears = CardLoader.getByName('Grizzly Bears')!;

    // Add creature to hand but no mana sources
    const creature = createCardInstance(bears.id, 'player', 'hand');
    getPlayer(state, 'player').hand.push(creature);

    const legalActions = getLegalActions(state, 'player');

    // Should not have any CAST_SPELL for the creature (no mana)
    const castActions = legalActions.filter(
      (a) => a.type === 'CAST_SPELL' && (a as CastSpellAction).payload.cardInstanceId === creature.instanceId,
    );
    expect(castActions.length).toBe(0);
  });

  test('getLegalActions respects summoning sickness', () => {
    const state = createTestGameState();
    const bears = CardLoader.getByName('Grizzly Bears')!;

    // Add summoning sick creature
    const creature = createCardInstance(bears.id, 'player', 'battlefield');
    creature.summoningSick = true;
    getPlayer(state, 'player').battlefield.push(creature);

    const legalActions = getLegalActions(state, 'player');

    // Should not have any attack actions with this creature
    const attackActions = legalActions.filter(
      (a) =>
        a.type === 'DECLARE_ATTACKERS' &&
        (a as DeclareAttackersAction).payload.attackers.includes(creature.instanceId),
    );
    expect(attackActions.length).toBe(0);
  });

  test('getLegalActions respects land per turn limit', () => {
    const state = createTestGameState();
    const forest = CardLoader.getByName('Forest')!;

    // Add lands to hand
    const land1 = createCardInstance(forest.id, 'player', 'hand');
    const land2 = createCardInstance(forest.id, 'player', 'hand');
    getPlayer(state, 'player').hand.push(land1, land2);

    // Play first land
    let newState = applyAction(state, {
      type: 'PLAY_LAND',
      playerId: 'player',
      payload: { cardInstanceId: land1.instanceId },
    } as PlayLandAction);

    const legalActions = getLegalActions(newState, 'player');

    // Should not have any more PLAY_LAND actions
    const landActions = legalActions.filter((a) => a.type === 'PLAY_LAND');
    expect(landActions.length).toBe(0);
  });
});
