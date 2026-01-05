/**
 * Blue vs White game with detailed logging to debug stalls
 */

import {
  initializeGame,
  getTestDeck,
  applyAction,
  getLegalActions,
  getPlayer,
  CardLoader,
  isCreature,
  type Action
} from '@manacore/engine';
import { GreedyBot } from '../../packages/ai/src/bots/GreedyBot';
import { RandomBot } from '../../packages/ai/src/bots/RandomBot';
import { quickEvaluate } from '../../packages/ai/src/evaluation/evaluate';

// Blue (Greedy) vs White (Random)
const playerDeck = getTestDeck('blue');
const opponentDeck = getTestDeck('white');

// Use a fixed seed for reproducibility
let state = initializeGame(playerDeck, opponentDeck, 12345);

const greedyBot = new GreedyBot(42, true); // Enable debug
const randomBot = new RandomBot(43);

let turnCount = 0;
let actionCount = 0;

console.log('🎮 Detailed Blue (Greedy) vs White (Random) Game\n');

// Run for 50 turns or until game over
while (!state.gameOver && turnCount < 50) {
  // Log turn start
  if (state.turnCount > turnCount) {
    turnCount = state.turnCount;
    const player = getPlayer(state, 'player');
    const opponent = getPlayer(state, 'opponent');
    
    const playerCreatures = player.battlefield.filter(c => {
      const t = CardLoader.getById(c.scryfallId);
      return t && isCreature(t);
    });
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Turn ${turnCount}`);
    console.log(`  Blue (Greedy): ${player.life} life, ${playerCreatures.length} creatures, ${player.hand.length} cards, ${player.manaPool.blue}U`);
    
    // Check for Fog Elementals
    const fogElementals = playerCreatures.filter(c => CardLoader.getById(c.scryfallId)?.name === 'Fog Elemental');
    if (fogElementals.length > 0) {
      console.log(`    ⚠️ Has ${fogElementals.length} Fog Elementals!`);
    }

    console.log(`  White (Random): ${opponent.life} life, ${opponent.hand.length} cards`);
    // Log White's hand
    const whiteHand = opponent.hand.map(c => CardLoader.getById(c.scryfallId)?.name).join(', ');
    console.log(`    Hand: ${whiteHand}`);
    console.log(`    Lands: ${opponent.battlefield.filter(c => CardLoader.getById(c.scryfallId)?.type_line?.includes('Land')).length}`);
  }

  const legalActions = getLegalActions(state, state.priorityPlayer);
  if (state.priorityPlayer === 'opponent') { // White
     console.log(`  [White Legal Actions]: ${legalActions.map(a => a.type === 'CAST_SPELL' ? `CAST(${CardLoader.getById(getPlayer(state, 'opponent').hand.find(c => c.instanceId === a.payload.cardInstanceId)?.scryfallId!)?.name})` : a.type).join(', ')}`);
  }

  if (legalActions.length === 0) {
    console.log(`❌ No legal actions for ${state.priorityPlayer}!`);
    break;
  }

  const bot = state.priorityPlayer === 'player' ? greedyBot : randomBot;
  
  // Capture decision logic for Fog Elemental attacks
  if (state.priorityPlayer === 'player' && state.phase === 'combat' && state.step === 'declare_attackers') {
    const attackAction = legalActions.find(a => a.type === 'DECLARE_ATTACKERS' && a.payload.attackers.length > 0);
    if (attackAction) {
       // Check if we are attacking with Fog Elemental
       const player = getPlayer(state, 'player');
       const attackingFog = attackAction.payload.attackers.some(id => {
         const card = player.battlefield.find(c => c.instanceId === id);
         return CardLoader.getById(card?.scryfallId!)?.name === 'Fog Elemental';
       });
       
       if (attackingFog) {
         console.log(`\n🚨 GreedyBot is considering attacking with Fog Elemental!`);
         // Let's see if it chooses it
       }
    }
  }

  // Monitor Trigger resolution (paying costs)
  // We need to see if a TRIGGERED_ABILITY is on the stack for Fog Elemental
  const fogTrigger = state.stack.find(item => {
    // This is hard to detect directly without looking at the item source/effect
    // But we can look for logs
    return false; 
  });

  const action = bot.chooseAction(state, state.priorityPlayer);
  
  // Log specific actions
  if (state.priorityPlayer === 'player') {
    if (action.type === 'DECLARE_ATTACKERS' && action.payload.attackers.length > 0) {
       console.log(`  ⚔️ GreedyBot attacks with ${action.payload.attackers.length} creatures`);
    }
    if (action.type === 'CAST_SPELL') {
       // Identify spell
       const player = getPlayer(state, 'player');
       const card = player.hand.find(c => c.instanceId === action.payload.cardInstanceId);
       const name = CardLoader.getById(card?.scryfallId!)?.name;
       console.log(`  ✨ GreedyBot casts ${name}`);
    }
  }

  // Apply action
  try {
    const prevState = structuredClone(state);
    state = applyAction(state, action);
    
    // Check if Fog Elemental died immediately after attack declaration (due to trigger?)
    // Actually, trigger goes on stack.
    
  } catch (e) {
    console.error(`Error applying action: ${e}`);
    break;
  }
  
  actionCount++;
}

console.log(`\n${'='.repeat(60)}`);
console.log(`Game ended after ${state.turnCount} turns`);

