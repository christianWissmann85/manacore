import { describe, test, expect, beforeEach } from 'bun:test';
import {
  createGameState,
  applyAction,
  CardLoader,
  createCardInstance,
  getPlayer,
  getLegalActions,
  type GameState,
} from '../src/index';

describe('Win Conditions', () => {
  let state: GameState;
  const island = CardLoader.getByName('Island')!;
  const bolt = CardLoader.getByName('Lightning Blast')!; // 4 damage

  test('Lethal Damage: Player dies at 0 life', () => {
    // Setup: Opponent has Bolt, Player has 3 life
    const pDeck = [createCardInstance(island.id, 'player', 'library')];
    const oDeck = [createCardInstance(bolt.id, 'opponent', 'library')];
    
    state = createGameState(pDeck, oDeck);
    
    // Set Player Life to 3
    state.players.player.life = 3;
    
    // Give Opponent mana and Bolt
    const opponent = getPlayer(state, 'opponent');
    for(let i=0; i<10; i++) opponent.battlefield.push(createCardInstance(CardLoader.getByName('Mountain')!.id, 'opponent', 'battlefield'));
    opponent.hand.push(createCardInstance(bolt.id, 'opponent', 'hand'));
    
    // Advance to Opponent Main Phase
    state.activePlayer = 'opponent';
    state.priorityPlayer = 'opponent';
    state.phase = 'main1';
    
    // Opponent Casts Bolt targeting Player
    const boltCard = opponent.hand[0];
    state = applyAction(state, {
        type: 'CAST_SPELL',
        playerId: 'opponent',
        payload: {
            cardInstanceId: boltCard.instanceId,
            targets: ['player']
        }
    });
    
    // Resolve Bolt
    // Priority passes to Player
    state = applyAction(state, { type: 'PASS_PRIORITY', playerId: 'player', payload: {} });
    // Priority passes to Opponent
    state = applyAction(state, { type: 'PASS_PRIORITY', playerId: 'opponent', payload: {} });
    
    // Bolt resolves. Player takes 4 damage -> -1 life.
    expect(state.players.player.life).toBe(-1);
    
    // State Based Actions should trigger Game Over
    // applyAction loop handles SBAs automatically
    expect(state.gameOver).toBe(true);
    expect(state.winner).toBe('opponent');
  });

  test('Decking: Player loses when drawing from empty library', () => {
    // Setup: Player has 0 cards in library
    const pDeck: any[] = []; // Empty
    const oDeck = [createCardInstance(island.id, 'opponent', 'library')];
    
    state = createGameState(pDeck, oDeck);
    
    // Turn 1 (Player) - Skip draw.
    // We need to get to Turn 3 (Player) to trigger a draw that kills them.
    // Or just manually trigger a draw action? 
    // Let's use the game flow to be sure.
    
    // T1 Player: Pass
    state.phase = 'main1';
    state = applyAction(state, { type: 'END_TURN', playerId: 'player', payload: {} });
    
    // T2 Opponent: Draw (OK), Pass
    // Opponent draws 1. Library 0.
    // Opponent Pass
    state = applyAction(state, { type: 'PASS_PRIORITY', playerId: 'opponent', payload: {} }); // Beginning -> Main
    state = applyAction(state, { type: 'END_TURN', playerId: 'opponent', payload: {} });
    
    // T3 Player: Beginning Phase -> Auto Draw -> Die
    expect(state.turnCount).toBe(3);
    expect(state.activePlayer).toBe('player');
    expect(state.phase).toBe('beginning');
    expect(state.players.player.library.length).toBe(0);
    
    // Pass Priority in Beginning Phase should trigger Draw Step logic
    state = applyAction(state, { type: 'PASS_PRIORITY', playerId: 'player', payload: {} });
    
    // Should be Game Over
    expect(state.gameOver).toBe(true);
    expect(state.winner).toBe('opponent'); // Opponent wins because Player decked out
  });
});
