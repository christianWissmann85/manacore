import { create } from 'zustand';
import type {
  ClientGameState,
  LegalAction,
  AIThinking,
  HistoryEntry,
  WinProbabilityPoint,
  BotType,
  DeckType,
} from '../types';
import { gameService } from '../services/gameService';

interface GameStore {
  // Game state
  gameId: string | null;
  gameState: ClientGameState | null;
  legalActions: LegalAction[];
  isLoading: boolean;
  error: string | null;

  // Players
  playerType: BotType;
  opponentType: BotType;
  playerDeck: DeckType;
  opponentDeck: DeckType;

  // AI visualization
  aiThinking: AIThinking | null;
  winProbabilityHistory: WinProbabilityPoint[];
  showAIThinking: boolean;

  // History & replay
  history: HistoryEntry[];
  isReplaying: boolean;
  replayIndex: number;
  replaySpeed: number;

  // UI state
  selectedCardId: string | null;
  hoveredCardId: string | null;
  previewState: ClientGameState | null;
  showHints: boolean;

  // Actions
  startGame: (
    player: BotType,
    opponent: BotType,
    playerDeck?: DeckType,
    opponentDeck?: DeckType,
  ) => Promise<void>;
  executeAction: (actionIndex: number) => Promise<void>;
  resetGame: () => Promise<void>;
  endGame: () => void;

  // AI actions (for AI vs AI mode)
  stepAI: () => Promise<void>;
  runAIGame: () => Promise<void>;
  pauseAIGame: () => void;

  // Replay actions
  startReplay: () => void;
  stopReplay: () => void;
  setReplayIndex: (index: number) => void;
  setReplaySpeed: (speed: number) => void;

  // UI actions
  selectCard: (instanceId: string | null) => void;
  hoverCard: (instanceId: string | null) => void;
  previewAction: (actionIndex: number | null) => void;
  toggleHints: () => void;
  toggleAIThinking: () => void;
  clearError: () => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  // Initial state
  gameId: null,
  gameState: null,
  legalActions: [],
  isLoading: false,
  error: null,

  playerType: 'human',
  opponentType: 'greedy',
  playerDeck: 'red',
  opponentDeck: 'red',

  aiThinking: null,
  winProbabilityHistory: [],
  showAIThinking: true,

  history: [],
  isReplaying: false,
  replayIndex: 0,
  replaySpeed: 1,

  selectedCardId: null,
  hoveredCardId: null,
  previewState: null,
  showHints: true,

  // Game lifecycle
  startGame: async (player, opponent, playerDeck = 'red', opponentDeck = 'red') => {
    set({ isLoading: true, error: null });

    try {
      const response = await gameService.createGame(opponent, playerDeck, opponentDeck);

      set({
        gameId: response.gameId,
        gameState: response.clientState ?? createMockState(response),
        legalActions: response.legalActions,
        playerType: player,
        opponentType: opponent,
        playerDeck,
        opponentDeck,
        aiThinking: response.aiThinking ?? null,
        winProbabilityHistory: [],
        history: [],
        isLoading: false,
      });

      // Record initial state in history
      const state = get();
      if (state.gameState) {
        get().history.push({
          turn: state.gameState.turn,
          phase: state.gameState.phase,
          action: null,
          state: state.gameState,
          aiThinking: state.aiThinking ?? undefined,
          timestamp: Date.now(),
        });
      }
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to start game', isLoading: false });
    }
  },

  executeAction: async (actionIndex) => {
    const { gameId, legalActions } = get();
    if (!gameId) return;

    const action = legalActions.find((a) => a.index === actionIndex);
    set({ isLoading: true, error: null });

    try {
      const response = await gameService.step(gameId, actionIndex);
      const newState = response.clientState ?? createMockState(response);

      // Update win probability history
      const winProbHistory = [...get().winProbabilityHistory];
      if (response.aiThinking?.winProbability !== undefined) {
        winProbHistory.push({
          turn: newState.turn,
          step: winProbHistory.length,
          probability: response.aiThinking.winProbability,
          event: action?.description,
        });
      }

      // Add to history
      const history = [...get().history];
      history.push({
        turn: newState.turn,
        phase: newState.phase,
        action: action ?? null,
        state: newState,
        aiThinking: response.aiThinking,
        timestamp: Date.now(),
      });

      set({
        gameState: newState,
        legalActions: response.legalActions,
        aiThinking: response.aiThinking ?? null,
        winProbabilityHistory: winProbHistory,
        history,
        isLoading: false,
        selectedCardId: null,
        previewState: null,
      });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to execute action',
        isLoading: false,
      });
    }
  },

  resetGame: async () => {
    const { gameId, opponentType, playerDeck, opponentDeck, playerType } = get();
    if (!gameId) return;

    set({ isLoading: true, error: null });

    try {
      const response = await gameService.reset(gameId);

      set({
        gameState: response.clientState ?? createMockState(response),
        legalActions: response.legalActions,
        aiThinking: response.aiThinking ?? null,
        winProbabilityHistory: [],
        history: [],
        isLoading: false,
        selectedCardId: null,
        previewState: null,
        isReplaying: false,
        replayIndex: 0,
      });
    } catch {
      // If reset fails, try starting a new game
      await get().startGame(playerType, opponentType, playerDeck, opponentDeck);
    }
  },

  endGame: () => {
    const { gameId } = get();
    if (gameId) {
      gameService.delete(gameId).catch(() => {});
    }

    set({
      gameId: null,
      gameState: null,
      legalActions: [],
      aiThinking: null,
      winProbabilityHistory: [],
      history: [],
      selectedCardId: null,
      previewState: null,
      isReplaying: false,
    });
  },

  // AI game control
  stepAI: async () => {
    const { legalActions, playerType } = get();
    if (playerType !== 'human' && legalActions.length > 0) {
      // For AI player, pick the first legal action (server handles AI choice)
      await get().executeAction(0);
    }
  },

  runAIGame: async () => {
    // Implemented with interval in component
  },

  pauseAIGame: () => {
    // Implemented with interval in component
  },

  // Replay
  startReplay: () => {
    set({ isReplaying: true, replayIndex: 0 });
  },

  stopReplay: () => {
    set({ isReplaying: false });
  },

  setReplayIndex: (index) => {
    const { history } = get();
    if (index >= 0 && index < history.length) {
      const entry = history[index];
      set({
        replayIndex: index,
        gameState: entry.state,
        aiThinking: entry.aiThinking ?? null,
      });
    }
  },

  setReplaySpeed: (speed) => {
    set({ replaySpeed: Math.max(0.25, Math.min(4, speed)) });
  },

  // UI
  selectCard: (instanceId) => {
    set({ selectedCardId: instanceId });
  },

  hoverCard: (instanceId) => {
    set({ hoveredCardId: instanceId });
  },

  previewAction: (actionIndex) => {
    if (actionIndex === null) {
      set({ previewState: null });
      return;
    }

    // TODO: Implement one-ply lookahead preview via API
    // For now, just highlight the action
  },

  toggleHints: () => {
    set((state) => ({ showHints: !state.showHints }));
  },

  toggleAIThinking: () => {
    set((state) => ({ showAIThinking: !state.showAIThinking }));
  },

  clearError: () => {
    set({ error: null });
  },
}));

/** Create a mock client state from gym-server response (until clientState is implemented) */
function createMockState(response: {
  info: {
    turn: number;
    phase: string;
    playerLife: number;
    opponentLife: number;
    winner: string | null;
  };
  gameId?: string;
}): ClientGameState {
  return {
    gameId: response.gameId ?? 'unknown',
    turn: response.info.turn,
    phase: response.info.phase,
    step: 'main',
    activePlayer: 'player',
    priorityPlayer: 'player',
    player: {
      life: response.info.playerLife,
      hand: [],
      battlefield: [],
      graveyard: [],
      libraryCount: 40,
      manaPool: { white: 0, blue: 0, black: 0, red: 0, green: 0, colorless: 0 },
    },
    opponent: {
      life: response.info.opponentLife,
      handCount: 7,
      battlefield: [],
      graveyard: [],
      libraryCount: 40,
    },
    stack: [],
    gameOver: response.info.winner !== null,
    winner: response.info.winner as 'player' | 'opponent' | null,
  };
}
