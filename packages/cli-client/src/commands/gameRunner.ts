/**
 * Game runner - Executes single games between bots
 *
 * Handles the core game loop, action processing, and error detection.
 */

import type { Bot } from '@manacore/ai';
import type { PlayerId, GameState, Action, CardInstance } from '@manacore/engine';
import type { GameResult } from '../types';
import {
  initializeGame,
  getRandomTestDeck,
  getDeckDisplayName,
  applyAction,
  getLegalActions,
  describeAction,
  getPlayer,
  CardLoader,
  getEffectivePowerWithLords,
  getEffectiveToughnessWithLords,
  isCreature,
} from '@manacore/engine';
import { GameError } from '../recording';
import type { Profiler } from '../profiling';

interface GameOptions {
  maxTurns: number;
  verbose: boolean;
  debugVerbose?: boolean;
  seed?: number;
  profiler?: Profiler;
}

const MAX_RECENT_ACTIONS = 50;
const MAX_ACTIONS_PER_PRIORITY = 50;
const MAX_ACTION_HISTORY = 20;

/**
 * Run a single game to completion
 */
export async function runSingleGame(
  playerBot: Bot,
  opponentBot: Bot,
  options: GameOptions,
): Promise<GameResult> {
  // Create decks
  const playerDeck = getRandomTestDeck();
  const opponentDeck = getRandomTestDeck();
  const playerDeckName = getDeckDisplayName(playerDeck);
  const opponentDeckName = getDeckDisplayName(opponentDeck);

  // Initialize game
  let state = initializeGame(playerDeck, opponentDeck, options.seed);

  let turnCount = 0;
  const maxTurns = options.maxTurns;
  let actionCount = 0;
  let lastLoggedTurn = 0;
  let actionsThisTurn = 0;

  // Track recent actions for debugging
  const recentActions: Action[] = [];

  // Hang detection: track actions per priority window
  let actionsThisPriorityWindow = 0;
  let lastPriorityPlayer = state.priorityPlayer;
  let lastPhase = state.phase;
  let lastStep = state.step;

  // Track repeated actions to detect loops
  const actionHistory: string[] = [];

  if (options.debugVerbose) {
    console.log(`\n📋 Starting game with decks: ${playerDeckName} vs ${opponentDeckName}`);
    console.log(`🎲 Seed: ${options.seed ?? 'random'}\n`);
  }

  while (!state.gameOver && turnCount < maxTurns) {
    // Get the bot with priority
    const priorityBot = state.priorityPlayer === 'player' ? playerBot : opponentBot;

    // Get legal actions for the player with priority
    const legalActions = getLegalActions(state, state.priorityPlayer);

    if (legalActions.length === 0) {
      // No legal actions - this is a bug!
      throw new GameError(
        `No legal actions for ${state.priorityPlayer} (phase=${state.phase}, step=${state.step})`,
        state,
        recentActions,
        options.seed,
      );
    }

    // Bot chooses action
    if (options.profiler) options.profiler.startAiDecision();
    const action = priorityBot.chooseAction(state, state.priorityPlayer);
    if (options.profiler) options.profiler.endAiDecision();

    // Create action signature for loop detection
    const actionSignature = `${action.type}_${action.type === 'ACTIVATE_ABILITY' ? action.payload.abilityId : ''}_${state.phase}_${state.step}`;
    actionHistory.push(actionSignature);
    if (actionHistory.length > MAX_ACTION_HISTORY) {
      actionHistory.shift();
    }

    // Track action for debugging
    recentActions.push(action);
    if (recentActions.length > MAX_RECENT_ACTIONS) {
      recentActions.shift();
    }

    // Apply action
    try {
      const previousPhase = state.phase;
      const previousStep = state.step;
      const previousPriorityPlayer = state.priorityPlayer;

      if (options.profiler) options.profiler.startEngineAction();
      state = applyAction(state, action);
      if (options.profiler) options.profiler.endEngineAction();

      actionCount++;
      actionsThisTurn++;

      // Check if priority changed or phase/step advanced
      if (
        state.priorityPlayer !== lastPriorityPlayer ||
        state.phase !== lastPhase ||
        state.step !== lastStep
      ) {
        // Priority window changed - reset counter
        actionsThisPriorityWindow = 0;
        lastPriorityPlayer = state.priorityPlayer;
        lastPhase = state.phase;
        lastStep = state.step;
      } else {
        // Same priority window - increment counter
        actionsThisPriorityWindow++;

        // HANG DETECTION: Too many actions in same priority window
        if (actionsThisPriorityWindow >= MAX_ACTIONS_PER_PRIORITY) {
          const errorMsg = buildInfiniteLoopError(
            state,
            recentActions,
            actionHistory,
            action,
            actionsThisPriorityWindow,
            playerDeckName,
            opponentDeckName,
            options.seed,
          );
          throw new Error(errorMsg);
        }
      }

      // Show progress in debug verbose mode
      if (options.debugVerbose) {
        logGameProgress(
          state,
          previousPhase,
          previousStep,
          previousPriorityPlayer,
          turnCount,
          lastLoggedTurn,
          actionsThisTurn,
          actionCount,
          action,
        );
      }
    } catch (error) {
      // Wrap error with game context
      throw new GameError(
        error instanceof Error ? error.message : String(error),
        state,
        recentActions,
        options.seed,
      );
    }

    // Track turns
    if (state.turnCount > turnCount) {
      if (options.debugVerbose && actionsThisTurn > 10) {
        console.log(`   └─ ${actionsThisTurn} actions on turn ${turnCount}`);
      }
      turnCount = state.turnCount;
      lastLoggedTurn = state.turnCount;
      actionsThisTurn = 0;
    }

    // Safety check for infinite loops
    if (state.turnCount > maxTurns) {
      if (options.verbose) {
        console.log(`Game exceeded ${maxTurns} turns - declaring draw`);
      }
      break;
    }
  }

  // Determine winner and end reason
  const { winner, endReason } = determineWinner(state, turnCount, maxTurns);

  return {
    winner,
    turns: turnCount,
    playerDeck: playerDeckName,
    opponentDeck: opponentDeckName,
    playerDeckCards: playerDeck,
    opponentDeckCards: opponentDeck,
    endReason,
  };
}

/**
 * Determine winner based on game state and provide end reason
 */
function determineWinner(
  state: GameState,
  turnCount: number,
  maxTurns: number,
): { winner: PlayerId | null; endReason: string } {
  const playerLife = state.players.player.life;
  const opponentLife = state.players.opponent.life;

  if (state.gameOver && state.winner) {
    // Normal game ending
    if (playerLife <= 0) {
      return { winner: state.winner, endReason: 'Player life = 0' };
    } else if (opponentLife <= 0) {
      return { winner: state.winner, endReason: 'Opponent life = 0' };
    } else if (state.players.player.library.length === 0) {
      return { winner: state.winner, endReason: 'Player decked' };
    } else if (state.players.opponent.library.length === 0) {
      return { winner: state.winner, endReason: 'Opponent decked' };
    }
    return { winner: state.winner, endReason: 'Game over' };
  }

  // Game didn't complete normally - hit turn limit
  if (turnCount >= maxTurns) {
    if (playerLife > opponentLife) {
      return { winner: 'player', endReason: `Turn limit (${playerLife} vs ${opponentLife} life)` };
    } else if (opponentLife > playerLife) {
      return {
        winner: 'opponent',
        endReason: `Turn limit (${opponentLife} vs ${playerLife} life)`,
      };
    }
    return { winner: null, endReason: `Turn limit (${playerLife} life each)` };
  }

  // Shouldn't reach here, but handle it
  if (playerLife > opponentLife) {
    return { winner: 'player', endReason: 'Life total comparison' };
  } else if (opponentLife > playerLife) {
    return { winner: 'opponent', endReason: 'Life total comparison' };
  }

  return { winner: null, endReason: 'Draw - equal life' };
}

/**
 * Build detailed error message for infinite loop detection
 */
function buildInfiniteLoopError(
  state: GameState,
  recentActions: Action[],
  actionHistory: string[],
  action: Action,
  actionsThisPriorityWindow: number,
  playerDeckName: string,
  opponentDeckName: string,
  seed: number | undefined,
): string {
  const player = getPlayer(state, state.priorityPlayer);
  const opponent = getPlayer(state, state.priorityPlayer === 'player' ? 'opponent' : 'player');

  // Analyze what's causing the loop
  const recentActionTypes = actionHistory.slice(-10);
  const uniqueActions = new Set(recentActionTypes);
  const isRepeating = uniqueActions.size <= 2;

  let loopCause = 'Unknown';
  let problematicCard = '';

  if (action.type === 'ACTIVATE_ABILITY' && isRepeating) {
    const abilityId = action.payload.abilityId;
    const sourceId = action.payload.sourceId;
    const card = player.battlefield.find((c) => c.instanceId === sourceId);
    if (card) {
      const template = CardLoader.getById(card.scryfallId);
      problematicCard = template?.name || 'Unknown Card';
      loopCause = `Infinite ability activation: ${problematicCard} (${abilityId})`;
    }
  }

  // Build error message
  let msg = `\n${'='.repeat(70)}\n`;
  msg += `🚨 INFINITE LOOP DETECTED!\n`;
  msg += `${'='.repeat(70)}\n\n`;
  msg += `Game: ${playerDeckName} vs ${opponentDeckName}\n`;
  msg += `Seed: ${seed ?? 'unknown'}\n`;
  msg += `Turn: ${state.turnCount}, Phase: ${state.phase}, Step: ${state.step}\n`;
  msg += `Priority: ${state.priorityPlayer}\n`;
  msg += `Actions in this priority window: ${actionsThisPriorityWindow}\n\n`;
  msg += `Loop Cause: ${loopCause}\n\n`;

  msg += `Recent Actions (last 10):\n`;
  for (let i = Math.max(0, recentActions.length - 10); i < recentActions.length; i++) {
    const a = recentActions[i];
    if (!a) continue;
    msg += `  ${i + 1}. ${a.type}`;
    if (a.type === 'ACTIVATE_ABILITY') {
      msg += ` (${a.payload.abilityId})`;
    }
    msg += `\n`;
  }

  msg += `\n${state.priorityPlayer.toUpperCase()}'s Battlefield (${player.battlefield.length} cards):\n`;
  for (const card of player.battlefield) {
    msg += formatBattlefieldCard(state, card);
  }

  msg += `\nOpponent's Battlefield (${opponent.battlefield.length} cards):\n`;
  for (const card of opponent.battlefield.slice(0, 5)) {
    msg += formatBattlefieldCard(state, card);
  }
  if (opponent.battlefield.length > 5) {
    msg += `  ... and ${opponent.battlefield.length - 5} more\n`;
  }

  msg += `\n${'='.repeat(70)}\n`;

  return msg;
}

/**
 * Format a battlefield card for display
 */
function formatBattlefieldCard(state: GameState, card: CardInstance): string {
  const template = CardLoader.getById(card.scryfallId);
  if (template && isCreature(template)) {
    const basePower = parseInt(template.power || '0', 10);
    const baseToughness = parseInt(template.toughness || '0', 10);
    const power = getEffectivePowerWithLords(state, card, basePower);
    const toughness = getEffectiveToughnessWithLords(state, card, baseToughness);
    const keywords = template.keywords?.length ? ` [${template.keywords.join(', ')}]` : '';
    return `  • ${template.name} (${power}/${toughness}) ${card.tapped ? '[T]' : '[U]'}${keywords}\n`;
  } else {
    return `  • ${template?.name} ${card.tapped ? '[T]' : '[U]'}\n`;
  }
}

/**
 * Log game progress in debug verbose mode
 */
function logGameProgress(
  state: GameState,
  previousPhase: string,
  previousStep: string | undefined,
  previousPriorityPlayer: PlayerId,
  turnCount: number,
  lastLoggedTurn: number,
  actionsThisTurn: number,
  actionCount: number,
  action: Action,
): void {
  // Show turn changes
  if (state.turnCount > turnCount) {
    console.log(`\n🔄 Turn ${state.turnCount} | ${state.phase} | ${state.activePlayer}'s turn`);
  }
  // Show phase changes
  else if (state.phase !== previousPhase || state.step !== previousStep) {
    console.log(`   ├─ ${state.phase}/${state.step}`);
  }

  // Show every action with details
  const actionDesc = describeAction(action, state);
  const player = getPlayer(state, action.playerId);
  const opponent = getPlayer(state, action.playerId === 'player' ? 'opponent' : 'player');
  console.log(
    `   [${actionCount}] ${action.playerId}: ${actionDesc} (Life: ${player.life}/${opponent.life} | Hand: ${player.hand.length}/${opponent.hand.length} | Board: ${player.battlefield.length}/${opponent.battlefield.length})`,
  );

  // Warn if processing too many actions on one turn
  if (actionsThisTurn > 0 && actionsThisTurn % 100 === 0) {
    console.log(
      `   ⚠️  Turn ${state.turnCount}: ${actionsThisTurn} actions! [${state.phase}/${state.step}] ${previousPriorityPlayer}→${state.priorityPlayer}`,
    );
  }

  // Show periodic action count
  if (actionCount % 50 === 0 && state.turnCount === lastLoggedTurn) {
    console.log(`   ⚡ ${actionCount} actions processed (turn ${state.turnCount})`);
  }
}
