#!/usr/bin/env bun
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import {
  initializeGame,
  applyAction,
  createWhiteDeck,
  createBlueDeck,
  createBlackDeck,
  createRedDeck,
  createGreenDeck,
  CardLoader,
  getLegalActions,
  describeAction,
  enableF6Mode,
  formatManaPool,
  getTotalMana,
  hasHaste,
  type GameState,
  type Action,
} from '@manacore/engine';
import {
  type Bot,
  GreedyBot,
  MCTSBot,
  RandomBot,
  TrainingDataCollector,
  saveTrainingData,
} from '@manacore/ai';
import { mkdirSync } from 'fs';
import { join } from 'path';

// --- Game State Rendering (Adapted from cli-client) ---

function renderGameState(state: GameState, opponentActions?: string[]): string {
  const lines: string[] = [];

  // Header - show whose turn it is more clearly
  const isPlayerTurn = state.activePlayer === 'player';
  lines.push(
    `=== TURN ${state.turnCount} - ${isPlayerTurn ? 'YOUR TURN' : "OPPONENT'S TURN"} (${state.phase}) ===`,
  );
  lines.push(`Priority: ${state.priorityPlayer === 'player' ? 'You' : 'Opponent'}`);
  lines.push('');

  // Show opponent actions summary if provided
  if (opponentActions && opponentActions.length > 0) {
    lines.push('Opponent actions this cycle:');
    opponentActions.forEach((a) => lines.push(`  - ${a}`));
    lines.push('');
  }

  // Opponent
  const opponent = state.players.opponent;
  lines.push(
    `OPPONENT: Life ${opponent.life} | Hand ${opponent.hand.length} cards | Library ${opponent.library.length}`,
  );
  lines.push(`Battlefield:`);
  if (opponent.battlefield.length === 0) lines.push('  (empty)');
  else {
    opponent.battlefield.forEach((c) => {
      const t = CardLoader.getById(c.scryfallId);
      const status = [];
      if (c.tapped) status.push('TAPPED');
      // Don't show SICK for creatures with Haste (they can act immediately)
      if (c.summoningSick && t && !hasHaste(t)) status.push('SICK');
      if (c.attacking) status.push('ATTACKING');
      if (c.blocking) status.push('BLOCKING');
      const stats = t?.power ? `(${t.power}/${t.toughness})` : '';
      const damageStr = c.damage > 0 ? ` [${c.damage} dmg]` : '';
      const statusStr = status.length > 0 ? ` ${status.join(' ')}` : '';
      lines.push(`  [${c.instanceId}] ${t?.name || '???'} ${stats}${damageStr}${statusStr}`);
    });
  }
  lines.push('');

  // Player (You)
  const player = state.players.player;
  lines.push(
    `YOU: Life ${player.life} | Hand ${player.hand.length} cards | Library ${player.library.length}`,
  );
  const landCount = player.battlefield.filter((c) =>
    CardLoader.getById(c.scryfallId)?.type_line.includes('Land'),
  ).length;
  lines.push(`Lands: ${landCount} | Lands played this turn: ${player.landsPlayedThisTurn}`);
  const manaDisplay = getTotalMana(player.manaPool) > 0 ? formatManaPool(player.manaPool) : 'Empty';
  lines.push(`Mana Pool: ${manaDisplay}`);
  lines.push(`Battlefield:`);
  if (player.battlefield.length === 0) lines.push('  (empty)');
  else {
    player.battlefield.forEach((c) => {
      const t = CardLoader.getById(c.scryfallId);
      const status = [];
      if (c.tapped) status.push('TAPPED');
      // Don't show SICK for creatures with Haste (they can act immediately)
      if (c.summoningSick && t && !hasHaste(t)) status.push('SICK');
      if (c.attacking) status.push('ATTACKING');
      if (c.blocking) status.push('BLOCKING');
      const stats = t?.power ? `(${t.power}/${t.toughness})` : '';
      const damageStr = c.damage > 0 ? ` [${c.damage} dmg]` : '';
      const statusStr = status.length > 0 ? ` ${status.join(' ')}` : '';
      lines.push(`  [${c.instanceId}] ${t?.name || '???'} ${stats}${damageStr}${statusStr}`);
    });
  }
  lines.push('');
  lines.push(`Hand:`);
  player.hand.forEach((c, i) => {
    const t = CardLoader.getById(c.scryfallId);
    lines.push(`  [${i}] ${t?.name || '???'} (${t?.mana_cost || 'no cost'}) - ${t?.type_line}`);
  });

  if (state.stack.length > 0) {
    lines.push('');
    lines.push('STACK:');
    state.stack.forEach((item, i) => {
      const t = item.card ? CardLoader.getById(item.card.scryfallId) : null;
      lines.push(`  ${i}: ${t?.name || 'Ability'} (${item.controller})`);
    });
  }

  if (state.gameOver) {
    lines.push('');
    lines.push(`=== GAME OVER. Winner: ${state.winner || 'Draw'} ===`);
  }

  return lines.join('\n');
}

/**
 * Check if there are any attackers declared in combat
 */
function hasAttackers(state: GameState): boolean {
  const attackingPlayer = state.activePlayer;
  const attacker = state.players[attackingPlayer];
  return attacker.battlefield.some((c) => c.attacking);
}

/**
 * Filter out "Don't block" action if there are no attackers
 */
function filterBlockActions(actions: Action[], state: GameState): Action[] {
  if (state.phase !== 'combat') return actions;

  // If no attackers, remove DECLARE_BLOCKERS with empty blocks
  if (!hasAttackers(state)) {
    return actions.filter((a) => {
      if (a.type === 'DECLARE_BLOCKERS') {
        const blocks = a.payload.blocks || [];
        return blocks.length > 0; // Only keep if actually blocking
      }
      return true;
    });
  }
  return actions;
}

// --- Server Implementation ---

class GameSession {
  state: GameState;
  opponentBot: Bot;
  collector: TrainingDataCollector;
  gameId: string;
  outputPath: string;
  lastOpponentActions: string[] = [];
  previousPlayerLife: number = 20;
  previousOpponentLife: number = 20;

  constructor(opponentBotName: string, playerDeckName: string, opponentDeckName: string) {
    const seed = Date.now();

    // Initialize decks
    const getDeck = (name: string) => {
      switch (name.toLowerCase()) {
        case 'white':
          return createWhiteDeck();
        case 'blue':
          return createBlueDeck();
        case 'black':
          return createBlackDeck();
        case 'red':
          return createRedDeck();
        case 'green':
          return createGreenDeck();
        default:
          return createGreenDeck();
      }
    };

    const playerDeck = getDeck(playerDeckName);
    const opponentDeck = getDeck(opponentDeckName);

    this.state = initializeGame(playerDeck, opponentDeck, seed);

    // Enable F6 auto-pass for faster gameplay
    // This eliminates forced non-decisions at the engine level
    enableF6Mode(this.state, true);

    this.gameId = `game-${seed}`;
    this.outputPath = join(process.cwd(), 'packages/ai/data/human-training');
    mkdirSync(this.outputPath, { recursive: true });

    // Setup Bot
    switch (opponentBotName.toLowerCase()) {
      case 'mcts':
        this.opponentBot = new MCTSBot();
        break;
      case 'greedy':
        this.opponentBot = new GreedyBot();
        break;
      default:
        this.opponentBot = new RandomBot();
    }

    // Setup Collector
    this.collector = new TrainingDataCollector(seed, 'human', opponentBotName, {
      recordPlayer: 'player',
      sampleRate: 1.0,
    });

    this.previousPlayerLife = this.state.players.player.life;
    this.previousOpponentLife = this.state.players.opponent.life;

    console.error(`Started game ${this.gameId} against ${opponentBotName}`);
  }

  getLegalActions() {
    const actions = getLegalActions(this.state, 'player');
    // Filter out useless "Don't block" when no attackers
    return filterBlockActions(actions, this.state);
  }

  async playAction(actionIndex: number, reasoning?: string): Promise<string> {
    if (this.state.gameOver) {
      return `Game is already over. Winner: ${this.state.winner}`;
    }

    const legalActions = this.getLegalActions();

    if (actionIndex < 0 || actionIndex >= legalActions.length) {
      throw new Error(
        `Invalid action index ${actionIndex}. Valid range: 0-${legalActions.length - 1}`,
      );
    }

    const action = legalActions[actionIndex];
    if (!action) throw new Error('Action undefined');

    // Record BEFORE applying
    this.collector.recordDecision(this.state, action, legalActions, reasoning);

    // Track life before action
    this.previousPlayerLife = this.state.players.player.life;
    this.previousOpponentLife = this.state.players.opponent.life;

    // Apply User Action
    this.state = applyAction(this.state, action);

    // Clear opponent actions for new cycle
    this.lastOpponentActions = [];

    // Run Game Loop (Opponent + Auto-Pass)
    await this.runGameLoop();

    // Check for life changes and report
    const lifeChangeInfo = this.getLifeChangeInfo();

    // Check Game Over
    if (this.state.gameOver) {
      this.saveData();
      return `Game Over! Winner: ${this.state.winner}. Training data saved.${lifeChangeInfo}`;
    }

    return `Action applied.${lifeChangeInfo}\n\n${renderGameState(this.state, this.lastOpponentActions)}`;
  }

  getLifeChangeInfo(): string {
    const playerLifeChange = this.state.players.player.life - this.previousPlayerLife;
    const opponentLifeChange = this.state.players.opponent.life - this.previousOpponentLife;

    const changes: string[] = [];
    if (playerLifeChange !== 0) {
      changes.push(
        `You ${playerLifeChange > 0 ? 'gained' : 'lost'} ${Math.abs(playerLifeChange)} life`,
      );
    }
    if (opponentLifeChange !== 0) {
      changes.push(
        `Opponent ${opponentLifeChange > 0 ? 'gained' : 'lost'} ${Math.abs(opponentLifeChange)} life`,
      );
    }

    if (changes.length > 0) {
      return '\n\nLife changes: ' + changes.join(', ');
    }
    return '';
  }

  async runGameLoop() {
    while (!this.state.gameOver) {
      // 1. If it's Opponent's priority, run Opponent Bot
      if (this.state.priorityPlayer === 'opponent') {
        const opponentActions = getLegalActions(this.state, 'opponent');
        if (opponentActions.length === 0) break; // Should not happen

        const prevState = this.state;
        const botAction = this.opponentBot.chooseAction(this.state, 'opponent');

        // Log the opponent's action
        const actionDesc = describeAction(botAction, this.state);
        if (botAction.type !== 'PASS_PRIORITY') {
          this.lastOpponentActions.push(actionDesc);
        }

        this.state = applyAction(this.state, botAction);

        // Check for suspicious life changes (debugging)
        const lifeDelta = prevState.players.player.life - this.state.players.player.life;
        if (lifeDelta > 20) {
          console.error(
            `[WARNING] Large damage detected: ${lifeDelta} damage, action: ${actionDesc}`,
          );
          console.error(`[DEBUG] Turn: ${this.state.turnCount}, Phase: ${this.state.phase}`);
        }

        continue;
      }

      // 2. If it's Player's priority, check for Auto-Pass
      if (this.state.priorityPlayer === 'player') {
        const playerActions = this.getLegalActions();

        // If only 1 action available (usually Pass Priority), auto-apply it
        if (playerActions.length === 1) {
          const autoAction = playerActions[0];
          this.state = applyAction(this.state, autoAction!);
          continue;
        }

        // Filter out non-meaningful actions for auto-pass decisions:
        // - PASS_PRIORITY and END_TURN are always auto-passable
        // - ACTIVATE_ABILITY for mana abilities (tapping lands) during opponent's turn
        const meaningfulActions = playerActions.filter((a) => {
          if (a.type === 'PASS_PRIORITY' || a.type === 'END_TURN') return false;

          // During opponent's turn, mana abilities are rarely useful
          // (can't cast sorcery-speed spells anyway)
          if (this.state.activePlayer === 'opponent' && a.type === 'ACTIVATE_ABILITY') {
            const desc = describeAction(a, this.state);
            // Filter out pure mana abilities like "Forest: Tap: Add {G}"
            if (desc.includes('Tap: Add {')) return false;
          }

          return true;
        });

        if (meaningfulActions.length === 0 && playerActions.length > 0) {
          // Prefer END_TURN to skip phases, otherwise PASS_PRIORITY
          const autoAction =
            playerActions.find((a) => a.type === 'END_TURN') ||
            playerActions.find((a) => a.type === 'PASS_PRIORITY');
          if (autoAction) {
            this.state = applyAction(this.state, autoAction);
            continue;
          }
        }

        // If multiple meaningful choices, stop and wait for User Input
        break;
      }
    }
  }

  resign(): string {
    if (this.state.gameOver) {
      return `Game is already over. Winner: ${this.state.winner}`;
    }

    // Mark game as over with opponent winning
    this.state = {
      ...this.state,
      gameOver: true,
      winner: 'opponent',
    };

    this.saveData();
    return `You resigned. Opponent wins. Training data saved.`;
  }

  saveData() {
    const finalData = this.collector.finalize(this.state, 'player');
    const filename = join(this.outputPath, `${this.gameId}.json`);
    saveTrainingData(finalData, filename);
    console.error(`Saved training data to ${filename}`);
  }
}

let activeSession: GameSession | null = null;

const server = new Server(
  {
    name: 'manacore-server',
    version: '0.3.0',
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

// --- Tools ---

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'manacore_start_game',
        description: 'Start a new Magic: The Gathering game against a bot',
        inputSchema: {
          type: 'object',
          properties: {
            opponent: {
              type: 'string',
              enum: ['random', 'greedy', 'mcts'],
              description: 'The AI bot to play against',
            },
            myDeck: {
              type: 'string',
              description: 'Your deck color/type (white, blue, black, red, green, vanilla)',
              default: 'vanilla',
            },
            opponentDeck: {
              type: 'string',
              description: 'Opponent deck color/type',
              default: 'vanilla',
            },
          },
          required: ['opponent'],
        },
      },
      {
        name: 'manacore_get_game',
        description:
          'Get current game state AND legal actions in one call (recommended - saves tokens)',
        inputSchema: { type: 'object', properties: {} },
      },
      {
        name: 'manacore_get_state',
        description: 'Get the current visible game board (use manacore_get_game instead)',
        inputSchema: { type: 'object', properties: {} },
      },
      {
        name: 'manacore_list_actions',
        description:
          'List all currently legal actions with their IDs (use manacore_get_game instead)',
        inputSchema: { type: 'object', properties: {} },
      },
      {
        name: 'manacore_play_action',
        description: 'Execute an action by its ID. Provide reasoning for better training data.',
        inputSchema: {
          type: 'object',
          properties: {
            actionId: {
              type: 'number',
              description: 'The ID of the action to take (from list_actions)',
            },
            reasoning: {
              type: 'string',
              description: 'Explanation of why this move was chosen (Strategy, tactics, etc.)',
            },
          },
          required: ['actionId'],
        },
      },
      {
        name: 'manacore_inspect_card',
        description: 'Get detailed information about a card by name (oracle text, abilities, etc.)',
        inputSchema: {
          type: 'object',
          properties: {
            cardName: {
              type: 'string',
              description: 'Name of the card to look up',
            },
          },
          required: ['cardName'],
        },
      },
      {
        name: 'manacore_resign',
        description: 'Resign the current game (opponent wins)',
        inputSchema: { type: 'object', properties: {} },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const { name, arguments: args } = request.params;

    if (name === 'manacore_start_game') {
      const schema = z.object({
        opponent: z.string(),
        myDeck: z.string().default('vanilla'),
        opponentDeck: z.string().default('vanilla'),
      });
      const { opponent, myDeck, opponentDeck } = schema.parse(args);

      activeSession = new GameSession(opponent, myDeck, opponentDeck);
      // Handle Auto-Pass for the first turn if applicable
      await activeSession.runGameLoop();

      return {
        content: [
          { type: 'text', text: `Game Started!\n\n${renderGameState(activeSession.state)}` },
        ],
      };
    }

    if (name === 'manacore_inspect_card') {
      const schema = z.object({
        cardName: z.string(),
      });
      const { cardName } = schema.parse(args);

      const card = CardLoader.getByName(cardName);
      if (!card) {
        return {
          content: [{ type: 'text', text: `Card not found: "${cardName}"` }],
          isError: true,
        };
      }

      const info = [
        `**${card.name}** ${card.mana_cost || ''}`,
        `Type: ${card.type_line}`,
        card.power !== undefined ? `Stats: ${card.power}/${card.toughness}` : null,
        card.oracle_text ? `\nOracle Text:\n${card.oracle_text}` : null,
        card.flavor_text ? `\n_${card.flavor_text}_` : null,
      ]
        .filter(Boolean)
        .join('\n');

      return {
        content: [{ type: 'text', text: info }],
      };
    }

    if (!activeSession) {
      throw new Error("No active game. Start one with 'manacore_start_game'.");
    }

    if (name === 'manacore_get_game') {
      // Combined state + actions in one call (recommended for token efficiency)
      const stateText = renderGameState(activeSession.state, activeSession.lastOpponentActions);
      const actions = activeSession.getLegalActions();
      const actionList = actions
        .map((a, i) => {
          const desc = describeAction(a, activeSession!.state);
          return `${i}: ${desc}`;
        })
        .join('\n');

      const combinedText = `${stateText}\n\n=== LEGAL ACTIONS ===\n${actionList || 'No legal actions'}`;
      return {
        content: [{ type: 'text', text: combinedText }],
      };
    }

    if (name === 'manacore_get_state') {
      return {
        content: [
          {
            type: 'text',
            text: renderGameState(activeSession.state, activeSession.lastOpponentActions),
          },
        ],
      };
    }

    if (name === 'manacore_list_actions') {
      const actions = activeSession.getLegalActions();
      const actionList = actions
        .map((a, i) => {
          const desc = describeAction(a, activeSession!.state);
          return `${i}: ${desc}`;
        })
        .join('\n');

      return {
        content: [{ type: 'text', text: actionList || 'No legal actions (should not happen)' }],
      };
    }

    if (name === 'manacore_play_action') {
      const schema = z.object({
        actionId: z.number(),
        reasoning: z.string().optional(),
      });
      const { actionId, reasoning } = schema.parse(args);

      const result = await activeSession.playAction(actionId, reasoning);
      return {
        content: [{ type: 'text', text: result }],
      };
    }

    if (name === 'manacore_resign') {
      const result = activeSession.resign();
      activeSession = null;
      return {
        content: [{ type: 'text', text: result }],
      };
    }

    throw new Error(`Unknown tool: ${name}`);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: 'text', text: `Error: ${message}` }],
      isError: true,
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error('ManaCore MCP Server running on stdio');
