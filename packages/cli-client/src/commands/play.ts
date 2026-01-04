/**
 * Interactive play mode - human vs bot
 */

import type { Bot } from '@manacore/ai';
import type { GameState, Action } from '@manacore/engine';
import {
  initializeGame,
  createVanillaDeck,
  applyAction,
  getLegalActions,
  describeAction,
} from '@manacore/engine';
import { renderGameState, printError, printSuccess, printInfo } from '../display/board';
import readline from 'readline';

/**
 * Play an interactive game against a bot
 */
export async function playGame(opponentBot: Bot): Promise<void> {
  console.log('\n🎮 ManaCore - Play Mode\n');
  console.log(`You vs ${opponentBot.getName()}\n`);
  console.log('Commands:');
  console.log('  [number] - Perform action');
  console.log('  list     - Show legal actions');
  console.log('  state    - Show game state');
  console.log('  quit     - Exit game\n');

  // Create decks
  const playerDeck = createVanillaDeck();
  const opponentDeck = createVanillaDeck();

  // Initialize game
  let state = initializeGame(playerDeck, opponentDeck);

  console.log('Game started! Opening hands drawn.\n');

  // Game loop
  while (!state.gameOver) {
    // Clear screen for cleaner display (optional)
    // clearScreen();

    // Show game state
    console.log(renderGameState(state, 'player'));
    console.log('');

    // Check whose turn
    if (state.activePlayer === 'player') {
      // Human turn
      const action = await getHumanAction(state);

      if (!action) {
        console.log('\nExiting game...');
        break;
      }

      try {
        state = applyAction(state, action);
        printSuccess(`Action applied: ${describeAction(action, state)}`);
      } catch (error) {
        printError(
          `Failed to apply action: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    } else {
      // Bot turn
      printInfo(`${opponentBot.getName()} is thinking...`);

      const action = opponentBot.chooseAction(state, 'opponent');
      console.log(`  → ${describeAction(action, state)}`);

      try {
        state = applyAction(state, action);
      } catch (error) {
        printError(`Bot action failed: ${error instanceof Error ? error.message : String(error)}`);
        break;
      }

      // Pause briefly so human can see bot's move
      await sleep(500);
    }
  }

  // Game over
  console.log('\n' + '═'.repeat(80));
  if (state.winner === 'player') {
    console.log('🎉 YOU WIN! 🎉');
  } else if (state.winner === 'opponent') {
    console.log('💀 YOU LOSE! The bot wins.');
  } else {
    console.log('🤝 DRAW!');
  }
  console.log('═'.repeat(80));
  console.log(`\nGame lasted ${state.turnCount} turns.`);
}

/**
 * Get action from human player
 */
async function getHumanAction(state: GameState): Promise<Action | null> {
  const legalActions = getLegalActions(state, 'player');

  if (legalActions.length === 0) {
    printError('No legal actions available!');
    return null;
  }

  // Show available actions
  console.log('Your turn! Available actions:');
  for (let i = 0; i < legalActions.length; i++) {
    const action = legalActions[i]!;
    console.log(`  [${i}] ${describeAction(action, state)}`);
  }
  console.log('');

  // Get input
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise<Action | null>((resolve) => {
    rl.question('Choose action (number or command): ', (answer: string) => {
      rl.close();

      const input = answer.trim().toLowerCase();

      // Check for commands
      if (input === 'quit' || input === 'q' || input === 'exit') {
        resolve(null);
        return;
      }

      if (input === 'list' || input === 'l') {
        resolve(getHumanAction(state)); // Recursive - show actions again
        return;
      }

      if (input === 'state' || input === 's') {
        console.log(renderGameState(state, 'player'));
        resolve(getHumanAction(state)); // Recursive
        return;
      }

      // Try to parse as action index
      const index = parseInt(input, 10);
      if (isNaN(index) || index < 0 || index >= legalActions.length) {
        printError('Invalid action number. Try again.');
        resolve(getHumanAction(state)); // Recursive - try again
        return;
      }

      resolve(legalActions[index]!);
    });
  });
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
