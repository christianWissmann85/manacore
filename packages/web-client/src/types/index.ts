/** Client-side card data for rendering */
export interface CardData {
  instanceId: string;
  scryfallId: string;
  name: string;
  manaCost: string;
  cmc: number;
  typeLine: string;
  oracleText: string;
  power?: string;
  toughness?: string;
  colors: string[];
  keywords: string[];
  imageUrl?: string;
}

/** Permanent on the battlefield */
export interface PermanentData extends CardData {
  controller: 'player' | 'opponent';
  tapped: boolean;
  summoningSick: boolean;
  damage: number;
  attacking: boolean;
  blocking?: string;
  counters: Record<string, number>;
  attachments: string[];
}

/** Item on the stack */
export interface StackItemData {
  id: string;
  controller: 'player' | 'opponent';
  card: CardData;
  targets: string[];
  description: string;
}

/** Client-friendly game state */
export interface ClientGameState {
  gameId: string;
  turn: number;
  phase: string;
  step: string;
  activePlayer: 'player' | 'opponent';
  priorityPlayer: 'player' | 'opponent';

  player: {
    life: number;
    hand: CardData[];
    battlefield: PermanentData[];
    graveyard: CardData[];
    libraryCount: number;
    manaPool: ManaPool;
  };

  opponent: {
    life: number;
    handCount: number;
    battlefield: PermanentData[];
    graveyard: CardData[];
    libraryCount: number;
  };

  stack: StackItemData[];
  gameOver: boolean;
  winner: 'player' | 'opponent' | null;
}

export interface ManaPool {
  white: number;
  blue: number;
  black: number;
  red: number;
  green: number;
  colorless: number;
}

/** Legal action with UI metadata */
export interface LegalAction {
  index: number;
  type: string;
  description: string;
  cardInstanceId?: string;
  targets?: string[];
  isRecommended?: boolean;
}

/** AI thinking data for Glass-Box visualization */
export interface AIThinking {
  agentName: string;
  playerId: 'player' | 'opponent';
  winProbability: number;
  evaluatedNodes: number;
  timeMs: number;

  /** MCTS tree data */
  mctsTree?: MCTSTreeNode;

  /** Evaluation breakdown */
  evaluation?: {
    life: number;
    board: number;
    cards: number;
    mana: number;
    tempo: number;
    total: number;
  };

  /** For neural/PPO bots - action probability distribution */
  policyDistribution?: Array<{
    actionIndex: number;
    description: string;
    probability: number;
  }>;
}

export interface MCTSTreeNode {
  action: string | null;
  visits: number;
  value: number;
  winRate: number;
  children: MCTSTreeNode[];
}

/** Game step response from gym-server */
export interface GameStepResponse {
  gameId: string;
  observation: {
    features: number[];
    featureNames: string[];
  };
  actionMask: boolean[];
  legalActions: LegalAction[];
  reward: number;
  done: boolean;
  truncated: boolean;
  info: {
    turn: number;
    phase: string;
    playerLife: number;
    opponentLife: number;
    winner: string | null;
    stepCount: number;
  };
  /** Extended for web client */
  clientState?: ClientGameState;
  aiThinking?: AIThinking;
}

/** Game history entry for replay */
export interface HistoryEntry {
  turn: number;
  phase: string;
  action: LegalAction | null;
  state: ClientGameState;
  aiThinking?: AIThinking;
  timestamp: number;
}

/** Win probability over time */
export interface WinProbabilityPoint {
  turn: number;
  step: number;
  probability: number;
  event?: string;
}

/** Bot type identifiers */
export type BotType = 'human' | 'random' | 'greedy' | 'mcts' | 'mcts-fast' | 'mcts-strong' | 'ppo';

/** Deck type identifiers */
export type DeckType =
  | 'vanilla'
  | 'red'
  | 'blue'
  | 'green'
  | 'white'
  | 'black'
  | 'red_burn'
  | 'blue_control'
  | 'white_weenie'
  | 'random';
