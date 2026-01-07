#!/usr/bin/env bun
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import {
  initializeGame,
  applyAction,
  createVanillaDeck,
  createWhiteDeck,
  createBlueDeck,
  createBlackDeck,
  createRedDeck,
  createGreenDeck,
  CardLoader,
  getLegalActions,
  describeAction,
  type GameState,
  type Action,
  type PlayerId,
} from '@manacore/engine';
import {
  GreedyBot,
  MCTSBot,
  RandomBot,
  TrainingDataCollector,
  saveTrainingData,
} from '@manacore/ai';
import { mkdirSync } from 'fs';
import { join } from 'path';

// --- Game State Rendering (Adapted from cli-client) ---

function renderGameState(state: GameState): string {
  const lines: string[] = [];

  // Header
  lines.push(`TURN ${state.turnCount} - ${state.activePlayer.toUpperCase()} (${state.phase})`);
  lines.push(`Priority: ${state.priorityPlayer}`);
  lines.push('');

  // Opponent
  const opponent = state.players.opponent;
  lines.push(
    `OPPONENT: ❤️ ${opponent.life} | ✋ ${opponent.hand.length} cards | 📚 ${opponent.library.length}`,
  );
  lines.push(`Battlefield:`);
  if (opponent.battlefield.length === 0) lines.push('  (empty)');
  else {
    opponent.battlefield.forEach((c) => {
      const t = CardLoader.getById(c.scryfallId);
      const status = [];
      if (c.tapped) status.push('TAPPED');
      if (c.summoningSick) status.push('SICK');
      const stats = t?.power ? `(${t.power}/${t.toughness})` : '';
      lines.push(`  ${t?.name || '???'} ${stats} ${status.join(' ')}`);
    });
  }
  lines.push('');

  // Player (You)
  const player = state.players.player;
  lines.push(
    `YOU: ❤️ ${player.life} | ✋ ${player.hand.length} cards | 📚 ${player.library.length}`,
  );
  lines.push(
    `Lands: ${player.battlefield.filter((c) => CardLoader.getById(c.scryfallId)?.type_line.includes('Land')).length}`,
  );
  lines.push(`Mana Pool: ${JSON.stringify(player.manaPool)}`);
  lines.push(`Battlefield:`);
  if (player.battlefield.length === 0) lines.push('  (empty)');
  else {
    player.battlefield.forEach((c) => {
      const t = CardLoader.getById(c.scryfallId);
      const status = [];
      if (c.tapped) status.push('TAPPED');
      if (c.summoningSick) status.push('SICK');
      if (c.attacking) status.push('ATTACKING');
      if (c.blocking) status.push('BLOCKING');
      const stats = t?.power ? `(${t.power}/${t.toughness})` : '';
      lines.push(`  ${t?.name || '???'} ${stats} ${status.join(' ')}`);
    });
  }
  lines.push('');
  lines.push(`Hand:`);
  player.hand.forEach((c, i) => {
    const t = CardLoader.getById(c.scryfallId);
    lines.push(`  [${i}] ${t?.name || '???'} (${t?.mana_cost}) - ${t?.type_line}`);
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
    lines.push(`GAME OVER. Winner: ${state.winner}`);
  }

  return lines.join('\n');
}

// --- Server Implementation ---

class GameSession {
  state: GameState;
  opponentBot: any; // Bot interface
  collector: TrainingDataCollector;
  gameId: string;
  outputPath: string;

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
          return createVanillaDeck();
      }
    };

    const playerDeck = getDeck(playerDeckName);
    const opponentDeck = getDeck(opponentDeckName);

    this.state = initializeGame(playerDeck, opponentDeck, seed);
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

    console.error(`Started game ${this.gameId} against ${opponentBotName}`);
  }

  getLegalActions() {
    return getLegalActions(this.state, 'player');
  }

  async playAction(actionIndex: number, reasoning?: string): Promise<string> {
    const legalActions = getLegalActions(this.state, 'player');

    if (actionIndex < 0 || actionIndex >= legalActions.length) {
      throw new Error(
        `Invalid action index ${actionIndex}. Valid range: 0-${legalActions.length - 1}`,
      );
    }

    const action = legalActions[actionIndex];
    if (!action) throw new Error('Action undefined');

    // Record BEFORE applying
    this.collector.recordDecision(this.state, action, legalActions, reasoning);

    // Apply User Action
    this.state = applyAction(this.state, action);

    // Run Game Loop (Opponent + Auto-Pass)
    await this.runGameLoop();

    // Check Game Over
    if (this.state.gameOver) {
      this.saveData();
      return `Game Over! Winner: ${this.state.winner}. Data saved.`;
    }

    return `Action applied. 

${renderGameState(this.state)}`;
  }

  async runGameLoop() {
    while (!this.state.gameOver) {
      // 1. If it's Opponent's priority, run Opponent Bot
      if (this.state.priorityPlayer === 'opponent') {
        const opponentActions = getLegalActions(this.state, 'opponent');
        if (opponentActions.length === 0) break; // Should not happen

        const botAction = this.opponentBot.chooseAction(this.state, 'opponent');
        this.state = applyAction(this.state, botAction);
        continue;
      }

      // 2. If it's Player's priority, check for Auto-Pass
      if (this.state.priorityPlayer === 'player') {
        const playerActions = getLegalActions(this.state, 'player');

        // If only 1 action available (usually Pass Priority), auto-apply it
        if (playerActions.length === 1) {
          const autoAction = playerActions[0];
          // Optional: Log auto-action?
          this.state = applyAction(this.state, autoAction!);
          continue;
        }

        // If multiple choices, stop and wait for User Input
        break;
      }
    }
  }

  async runOpponentLoop() {
    // Deprecated in favor of runGameLoop
    await this.runGameLoop();
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
    version: '0.1.0',
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
        name: 'manacore_get_state',
        description: 'Get the current visible game board',
        inputSchema: { type: 'object', properties: {} },
      },
      {
        name: 'manacore_list_actions',
        description: 'List all currently legal actions with their IDs',
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
      // Ensure initial priority is handled (e.g. if player goes second, though usually player goes first in this engine setup unless specified)
      // Also handle Auto-Pass for the first turn if applicable
      await activeSession.runGameLoop();

      return {
        content: [
          { type: 'text', text: `Game Started!\n\n${renderGameState(activeSession.state)}` },
        ],
      };
    }

    if (!activeSession) {
      throw new Error("No active game. Start one with 'manacore_start_game'.");
    }

    if (name === 'manacore_get_state') {
      return {
        content: [{ type: 'text', text: renderGameState(activeSession.state) }],
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

    throw new Error(`Unknown tool: ${name}`);
  } catch (error: any) {
    return {
      content: [{ type: 'text', text: `Error: ${error.message}` }],
      isError: true,
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error('ManaCore MCP Server running on stdio');
