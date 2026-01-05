import { describe, test, expect, beforeEach } from 'bun:test';
import {
  createGameState,
  applyAction,
  CardLoader,
  createCardInstance,
  getPlayer,
  getLegalActions,
  type GameState,
  type PlayLandAction,
  type CastSpellAction,
  type DeclareAttackersAction,
  type DeclareBlockersAction,
  type PassPriorityAction,
  type EndTurnAction,
} from '../src/index';

// Helper to find a card in hand by name
function findCardInHand(state: GameState, playerId: 'player' | 'opponent', cardName: string) {
  const player = getPlayer(state, playerId);
  return player.hand.find((c) => {
    const template = CardLoader.getById(c.scryfallId);
    return template?.name === cardName;
  });
}

// Helper to find a card in library by name (to set up hand)
function findCardInLibrary(state: GameState, playerId: 'player' | 'opponent', cardName: string) {
  const player = getPlayer(state, playerId);
  return player.library.find((c) => {
    const template = CardLoader.getById(c.scryfallId);
    return template?.name === cardName;
  });
}

// Helper to move card from library to hand
function drawSpecificCard(state: GameState, playerId: 'player' | 'opponent', cardName: string) {
  const player = getPlayer(state, playerId);
  const cardIndex = player.library.findIndex((c) => {
    const template = CardLoader.getById(c.scryfallId);
    return template?.name === cardName;
  });

  if (cardIndex === -1) throw new Error(`Card ${cardName} not found in library of ${playerId}`);

  const card = player.library[cardIndex];
  player.library.splice(cardIndex, 1);
  card.zone = 'hand';
  player.hand.push(card);
  return card;
}

describe('Full Game Flow Integration', () => {
  let state: GameState;

  // Setup a custom deck for deterministic testing
  beforeEach(() => {
    const forest = CardLoader.getByName('Forest');
    const mountain = CardLoader.getByName('Mountain');
    const bears = CardLoader.getByName('Grizzly Bears'); // {1}{G} 2/2
    const bolt = CardLoader.getByName('Shock'); // {R} 2 damage instant (using Shock as Bolt might not be in 6ed, checking loader)
    // Actually using "Shock" or similar. Let's check what we have.
    // In engine.test.ts "Lightning Blast" was used. Let's use that or something smaller.
    // Let's assume basic 6ed cards.

    if (!forest || !mountain || !bears) {
      throw new Error('Missing required cards for test setup');
    }

    // Create simple decks
    const playerDeck = [];
    const opponentDeck = [];

    // Player: Green Aggro
    for (let i = 0; i < 20; i++)
      playerDeck.push(createCardInstance(forest.id, 'player', 'library'));
    for (let i = 0; i < 20; i++) playerDeck.push(createCardInstance(bears.id, 'player', 'library'));

    // Opponent: Red Burn
    for (let i = 0; i < 20; i++)
      opponentDeck.push(createCardInstance(mountain.id, 'opponent', 'library'));
    // We'll use Lightning Blast as we know it exists from engine.test.ts
    const blast = CardLoader.getByName('Lightning Blast') || CardLoader.getByName('Shock');
    if (!blast) throw new Error('No burn spell found');

    for (let i = 0; i < 20; i++)
      opponentDeck.push(createCardInstance(blast.id, 'opponent', 'library'));

    state = createGameState(playerDeck, opponentDeck);
  });

  test('Simulate first 3 turns: Land, Cast, Attack', () => {
    // --- TURN 1 (Player) ---
    // Start of game, phase is beginning/untap
    expect(state.turnCount).toBe(1);
    expect(state.activePlayer).toBe('player');

    // Step 0: Draw initial hand (7 cards) - usually handled by game init,
    // but createGameState creates empty hands. We need to draw.
    // For this test, let's manually rig the hands to avoid randomness.

    // Player Hand: 2 Forests, 1 Grizzly Bears
    drawSpecificCard(state, 'player', 'Forest');
    drawSpecificCard(state, 'player', 'Forest');
    drawSpecificCard(state, 'player', 'Grizzly Bears');

    // Opponent Hand: 2 Mountains, 1 Lightning Blast
    drawSpecificCard(state, 'opponent', 'Mountain');
    drawSpecificCard(state, 'opponent', 'Mountain');
    // Draw a burn spell if we can find one, otherwise just lands
    try {
      drawSpecificCard(state, 'opponent', 'Lightning Blast');
    } catch (e) {
      // Fallback if Lightning Blast not in deck (should be there though)
    }

    // Advance from Beginning to Main 1
    // Beginning phase: Active player receives priority, passes it.
    // Actually, in untap/upkeep/draw, players get priority.
    // Usually engine auto-passes beginning phase if no triggers?
    // Let's check `getLegalActions`: "Phase 0: Automatically advance through beginning phase by passing priority"

    let actions = getLegalActions(state, 'player');
    const passAction = actions.find((a) => a.type === 'PASS_PRIORITY');
    expect(passAction).toBeDefined();

    // Player passes priority in beginning phase -> triggers auto-advance to Main 1
    state = applyAction(state, passAction!);
    expect(state.phase).toBe('main1');

    // Main 1: Player plays Forest
    const forestCard = findCardInHand(state, 'player', 'Forest');
    state = applyAction(state, {
      type: 'PLAY_LAND',
      playerId: 'player',
      payload: { cardInstanceId: forestCard!.instanceId },
    });

    // Player Ends Turn
    // Note: In Magic, you pass priority to end phase.
    // Our engine has an explicit END_TURN action for convenience in Main phase.
    state = applyAction(state, {
      type: 'END_TURN',
      playerId: 'player',
      payload: {},
    });

    // --- TURN 2 (Opponent) ---
    expect(state.turnCount).toBe(2);
    expect(state.activePlayer).toBe('opponent');
    expect(state.phase).toBe('beginning');

    // Opponent passes beginning phase
    state = applyAction(state, { type: 'PASS_PRIORITY', playerId: 'opponent', payload: {} });
    expect(state.phase).toBe('main1');

    // Opponent plays Mountain
    const mountainCard = findCardInHand(state, 'opponent', 'Mountain');
    state = applyAction(state, {
      type: 'PLAY_LAND',
      playerId: 'opponent',
      payload: { cardInstanceId: mountainCard!.instanceId },
    });

    // Opponent Ends Turn
    state = applyAction(state, { type: 'END_TURN', playerId: 'opponent', payload: {} });

    // --- TURN 3 (Player) ---
    expect(state.turnCount).toBe(3);
    expect(state.activePlayer).toBe('player');

    // Pass beginning
    state = applyAction(state, { type: 'PASS_PRIORITY', playerId: 'player', payload: {} });
    expect(state.phase).toBe('main1');

    // Player plays 2nd Forest
    const forest2 = findCardInHand(state, 'player', 'Forest');
    state = applyAction(state, {
      type: 'PLAY_LAND',
      playerId: 'player',
      payload: { cardInstanceId: forest2!.instanceId },
    });

    // Cast Grizzly Bears
    const bears = findCardInHand(state, 'player', 'Grizzly Bears');
    state = applyAction(state, {
      type: 'CAST_SPELL',
      playerId: 'player',
      payload: { cardInstanceId: bears!.instanceId },
    });

    // Spell on stack
    expect(state.stack.length).toBe(1);
    expect(state.priorityPlayer).toBe('opponent'); // Priority passes after cast

    // Opponent passes (resolves spell)
    state = applyAction(state, { type: 'PASS_PRIORITY', playerId: 'opponent', payload: {} });

    // Player passes (resolves spell - now both passed)
    state = applyAction(state, { type: 'PASS_PRIORITY', playerId: 'player', payload: {} });

    // Stack empty, Creature on battlefield
    expect(state.stack.length).toBe(0);
    const player = getPlayer(state, 'player');
    const creature = player.battlefield.find((c) => {
      const t = CardLoader.getById(c.scryfallId);
      return t?.name === 'Grizzly Bears';
    });
    expect(creature).toBeDefined();
    expect(creature!.summoningSick).toBe(true);

    // End Turn
    state = applyAction(state, { type: 'END_TURN', playerId: 'player', payload: {} });

    // --- TURN 4 (Opponent) ---
    // Pass beginning
    state = applyAction(state, { type: 'PASS_PRIORITY', playerId: 'opponent', payload: {} });

    // Opponent plays 2nd Mountain
    const mountain2 = findCardInHand(state, 'opponent', 'Mountain');
    state = applyAction(state, {
      type: 'PLAY_LAND',
      playerId: 'opponent',
      payload: { cardInstanceId: mountain2!.instanceId },
    });

    // End Turn
    state = applyAction(state, { type: 'END_TURN', playerId: 'opponent', payload: {} });

    // --- TURN 5 (Player) ---
    // Pass beginning
    state = applyAction(state, { type: 'PASS_PRIORITY', playerId: 'player', payload: {} });

    // Grizzly Bears should not be summoning sick anymore
    const playerP = getPlayer(state, 'player');
    const bearsOnField = playerP.battlefield.find((c) => {
      const t = CardLoader.getById(c.scryfallId);
      return t?.name === 'Grizzly Bears';
    });
    expect(bearsOnField!.summoningSick).toBe(false);

    // Player passes priority in Main 1 (going to combat)
    state = applyAction(state, { type: 'PASS_PRIORITY', playerId: 'player', payload: {} });
    // Opponent passes priority
    state = applyAction(state, { type: 'PASS_PRIORITY', playerId: 'opponent', payload: {} });

    // Should be in Combat / Declare Attackers
    expect(state.phase).toBe('combat');
    expect(state.step).toBe('declare_attackers');
    expect(state.activePlayer).toBe('player');

    // Declare Attackers
    state = applyAction(state, {
      type: 'DECLARE_ATTACKERS',
      playerId: 'player',
      payload: { attackers: [bearsOnField!.instanceId] },
    });

    // Should be Declare Blockers
    expect(state.step).toBe('declare_blockers');
    expect(state.priorityPlayer).toBe('opponent'); // Defender gets priority to block

    // Declare Blockers (None)
    state = applyAction(state, {
      type: 'DECLARE_BLOCKERS',
      playerId: 'opponent',
      payload: { blocks: [] },
    });

    // Combat Damage happens automatically after blockers?
    // Let's check reducer logic: "Resolve combat damage... Move to main2"
    expect(state.phase).toBe('main2');

    // Check damage
    const opponent = getPlayer(state, 'opponent');
    // Bears is 2/2, Opponent starts at 20 -> 18
    expect(opponent.life).toBe(18);

    // End Turn
    state = applyAction(state, { type: 'END_TURN', playerId: 'player', payload: {} });

    // Confirm Turn 6
    expect(state.turnCount).toBe(6);
  });
});
