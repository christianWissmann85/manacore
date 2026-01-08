/**
 * State Serialization for Machine Learning
 *
 * Converts GameState into formats optimized for neural networks:
 * - Feature vectors (25 dimensions, normalized)
 * - Action masks (boolean array for legal actions)
 * - Compact JSON for API transfer
 */

import type { GameState, PlayerId } from '@manacore/engine';
import { getLegalActions, describeAction } from '@manacore/engine';
import { extractFeatures, featuresToArray, FEATURE_VECTOR_SIZE } from '@manacore/ai';

/**
 * Maximum action space size
 * This determines the size of the action mask
 */
export const MAX_ACTIONS = 200;

/**
 * Serialized observation for the Gym environment
 */
export interface GymObservation {
  features: number[];
  featureNames: string[];
}

/**
 * Action info with description
 */
export interface ActionInfo {
  index: number;
  type: string;
  description: string;
}

/**
 * Full response for a game step
 */
export interface StepResponse {
  observation: GymObservation;
  actionMask: boolean[];
  legalActions: ActionInfo[];
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
}

/**
 * Feature names for documentation and debugging
 */
export const FEATURE_NAMES = [
  'playerLife',
  'opponentLife',
  'lifeDelta',
  'playerCreatureCount',
  'opponentCreatureCount',
  'playerTotalPower',
  'opponentTotalPower',
  'playerTotalToughness',
  'opponentTotalToughness',
  'boardAdvantage',
  'playerHandSize',
  'opponentHandSize',
  'cardAdvantage',
  'playerLibrarySize',
  'opponentLibrarySize',
  'playerLandsTotal',
  'playerLandsUntapped',
  'opponentLandsTotal',
  'opponentLandsUntapped',
  'turnNumber',
  'isPlayerTurn',
  'phase',
  'canAttack',
  'attackersAvailable',
  'blockersAvailable',
];

/**
 * Serialize game state to feature vector
 */
export function serializeObservation(
  state: GameState,
  playerId: PlayerId = 'player',
): GymObservation {
  const features = extractFeatures(state, playerId);
  const featureArray = featuresToArray(features);

  return {
    features: featureArray,
    featureNames: FEATURE_NAMES,
  };
}

/**
 * Create action mask for legal actions
 * True = action is legal, False = action is illegal
 */
export function createActionMask(state: GameState, playerId: PlayerId = 'player'): boolean[] {
  const legalActions = getLegalActions(state, playerId);
  const mask: boolean[] = new Array(MAX_ACTIONS).fill(false) as boolean[];

  // Mark legal actions as true
  for (let i = 0; i < Math.min(legalActions.length, MAX_ACTIONS); i++) {
    mask[i] = true;
  }

  return mask;
}

/**
 * Serialize legal actions with descriptions
 */
export function serializeLegalActions(
  state: GameState,
  playerId: PlayerId = 'player',
): ActionInfo[] {
  const actions = getLegalActions(state, playerId);

  return actions.slice(0, MAX_ACTIONS).map(
    (action, index): ActionInfo => ({
      index,
      type: action.type,
      description: describeAction(action, state),
    }),
  );
}

/**
 * Create full step response
 */
export function createStepResponse(
  state: GameState,
  reward: number,
  done: boolean,
  truncated: boolean,
  stepCount: number,
  playerId: PlayerId = 'player',
): StepResponse {
  const player = state.players[playerId];
  const opponent = state.players[playerId === 'player' ? 'opponent' : 'player'];

  return {
    observation: serializeObservation(state, playerId),
    actionMask: createActionMask(state, playerId),
    legalActions: serializeLegalActions(state, playerId),
    reward,
    done,
    truncated,
    info: {
      turn: state.turnCount,
      phase: state.phase,
      playerLife: player.life,
      opponentLife: opponent.life,
      winner: state.winner,
      stepCount,
    },
  };
}

/**
 * Compact JSON for minimal transfer
 * Only includes essential fields
 */
export interface CompactState {
  f: number[]; // features
  m: boolean[]; // action mask
  n: number; // number of legal actions
  r: number; // reward
  d: boolean; // done
  t: boolean; // truncated
}

/**
 * Create compact state for batch operations
 */
export function createCompactState(
  state: GameState,
  reward: number,
  done: boolean,
  truncated: boolean,
  playerId: PlayerId = 'player',
): CompactState {
  const features = extractFeatures(state, playerId);
  const featureArray = featuresToArray(features);
  const legalActions = getLegalActions(state, playerId);
  const mask = createActionMask(state, playerId);

  return {
    f: featureArray,
    m: mask,
    n: legalActions.length,
    r: reward,
    d: done,
    t: truncated,
  };
}

/**
 * Validate feature vector size
 */
export function validateFeatureSize(): void {
  if (FEATURE_NAMES.length !== FEATURE_VECTOR_SIZE) {
    throw new Error(
      `Feature names (${FEATURE_NAMES.length}) don't match vector size (${FEATURE_VECTOR_SIZE})`,
    );
  }
}

// Run validation on import
validateFeatureSize();
