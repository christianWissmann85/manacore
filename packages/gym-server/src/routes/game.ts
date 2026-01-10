/**
 * Game Routes
 *
 * CRUD operations for game sessions
 * Extended with clientState and aiThinking for web client visualization
 */

import { Hono } from 'hono';
import { getLegalActions } from '@manacore/engine';
import type { SessionManager } from '../sessions/manager';
import { createStepResponse, serializeObservation, createActionMask } from '../serialization/state';
import { serializeClientState, serializeLegalActionsForClient } from '../serialization/clientState';
import { createThinkingBot } from '../bots/ThinkingCapture';

interface CreateGameBody {
  opponent?: string;
  deck?: string;
  opponentDeck?: string;
  seed?: number;
}

interface StepGameBody {
  action: unknown;
}

interface OpponentStepBody {
  action: unknown;
}

interface ResetGameBody {
  seed?: number;
}

export function createGameRoutes(sessionManager: SessionManager): Hono {
  const app = new Hono();

  /**
   * POST /game/create
   * Create a new game session
   */
  app.post('/create', async (c) => {
    try {
      const body: unknown = await c.req.json().catch(() => ({}));
      const {
        opponent = 'greedy',
        deck = 'vanilla',
        opponentDeck = 'vanilla',
        seed,
      } = body as CreateGameBody;

      const session = sessionManager.createSession(opponent, deck, opponentDeck, seed);

      const response = createStepResponse(
        session.state,
        0, // No reward on create
        session.state.gameOver,
        false,
        0,
        'player',
      );

      // Add client-friendly state and legal actions
      const clientState = serializeClientState(session.state, session.id);
      const clientActions = serializeLegalActionsForClient(session.state, 'player');

      return c.json({
        gameId: session.id,
        seed: session.seed,
        opponent: session.opponentType,
        ...response,
        // Extended fields for web client
        clientState,
        legalActions: clientActions, // Override with enhanced version
        aiThinking: session.lastAIThinking,
      });
    } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : 'Unknown error' }, 500);
    }
  });

  /**
   * POST /game/:id/step
   * Take an action in a game
   */
  app.post('/:id/step', async (c) => {
    try {
      const gameId = c.req.param('id');
      const body: unknown = await c.req.json();
      const { action } = body as StepGameBody;

      if (typeof action !== 'number') {
        return c.json({ error: 'action must be a number (action index)' }, 400);
      }

      const result = sessionManager.step(gameId, action);

      // Get session to access AI thinking
      const session = sessionManager.getSession(gameId);

      const response = createStepResponse(
        result.state,
        result.reward,
        result.done,
        result.truncated,
        result.info.stepCount as number,
        'player',
      );

      // Add client-friendly state and legal actions
      const clientState = serializeClientState(result.state, gameId);
      const clientActions = serializeLegalActionsForClient(result.state, 'player');

      return c.json({
        ...response,
        // Extended fields for web client
        clientState,
        legalActions: clientActions, // Override with enhanced version
        aiThinking: session?.lastAIThinking ?? null,
        actionTrace: result.actionTrace,
      });
    } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : 'Unknown error' }, 400);
    }
  });

  /**
   * POST /game/:id/opponent-step
   * Take an action as the opponent (for external/self-play mode)
   * Only works when opponent has priority and opponentType is 'external' or 'selfplay'
   */
  app.post('/:id/opponent-step', async (c) => {
    try {
      const gameId = c.req.param('id');
      const body: unknown = await c.req.json();
      const { action } = body as OpponentStepBody;

      if (typeof action !== 'number') {
        return c.json({ error: 'action must be a number (action index)' }, 400);
      }

      const result = sessionManager.opponentStep(gameId, action);
      const session = sessionManager.getSession(gameId);

      const response = createStepResponse(
        result.state,
        result.reward,
        result.done,
        result.truncated,
        result.info.stepCount as number,
        'opponent', // Perspective is opponent for this endpoint
      );

      // Add client-friendly state and legal actions (from player perspective)
      const clientState = serializeClientState(result.state, gameId);
      const clientActions = serializeLegalActionsForClient(result.state, 'player');

      return c.json({
        ...response,
        clientState,
        legalActions: clientActions,
        aiThinking: session?.lastAIThinking ?? null,
        actionTrace: result.actionTrace,
        info: result.info,
      });
    } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : 'Unknown error' }, 400);
    }
  });

  /**
   * POST /game/:id/reset
   * Reset a game to initial state
   */
  app.post('/:id/reset', async (c) => {
    try {
      const gameId = c.req.param('id');
      const body: unknown = await c.req.json().catch(() => ({}));
      const { seed } = body as ResetGameBody;

      const session = sessionManager.reset(gameId, seed);

      const response = createStepResponse(
        session.state,
        0,
        session.state.gameOver,
        false,
        0,
        'player',
      );

      // Add client-friendly state and legal actions
      const clientState = serializeClientState(session.state, session.id);
      const clientActions = serializeLegalActionsForClient(session.state, 'player');

      return c.json({
        gameId: session.id,
        seed: session.seed,
        ...response,
        // Extended fields for web client
        clientState,
        legalActions: clientActions, // Override with enhanced version
        aiThinking: session.lastAIThinking,
      });
    } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : 'Unknown error' }, 400);
    }
  });

  /**
   * GET /game/:id/state
   * Get current game state (observation only)
   */
  app.get('/:id/state', (c) => {
    try {
      const gameId = c.req.param('id');
      const session = sessionManager.getSession(gameId);

      if (!session) {
        return c.json({ error: `Game not found: ${gameId}` }, 404);
      }

      // Add client-friendly state and legal actions
      const clientState = serializeClientState(session.state, session.id);
      const clientActions = serializeLegalActionsForClient(session.state, 'player');

      return c.json({
        observation: serializeObservation(session.state, 'player'),
        actionMask: createActionMask(session.state, 'player'),
        legalActions: clientActions,
        done: session.state.gameOver,
        turn: session.state.turnCount,
        phase: session.state.phase,
        // Extended fields for web client
        clientState,
        aiThinking: session.lastAIThinking,
      });
    } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : 'Unknown error' }, 400);
    }
  });

  /**
   * GET /game/:id/actions
   * Get legal actions for current state
   */
  app.get('/:id/actions', (c) => {
    try {
      const gameId = c.req.param('id');
      const session = sessionManager.getSession(gameId);

      if (!session) {
        return c.json({ error: `Game not found: ${gameId}` }, 404);
      }

      const clientActions = serializeLegalActionsForClient(session.state, 'player');

      return c.json({
        legalActions: clientActions,
        actionMask: createActionMask(session.state, 'player'),
      });
    } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : 'Unknown error' }, 400);
    }
  });

  /**
   * GET /game/:id/opponent-actions
   * Get legal actions for opponent (for external/self-play mode)
   */
  app.get('/:id/opponent-actions', (c) => {
    try {
      const gameId = c.req.param('id');
      const session = sessionManager.getSession(gameId);

      if (!session) {
        return c.json({ error: `Game not found: ${gameId}` }, 404);
      }

      const clientActions = serializeLegalActionsForClient(session.state, 'opponent');

      return c.json({
        legalActions: clientActions,
        actionMask: createActionMask(session.state, 'opponent'),
        priorityPlayer: session.state.priorityPlayer,
      });
    } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : 'Unknown error' }, 400);
    }
  });

  /**
   * DELETE /game/:id
   * Delete a game session
   */
  app.delete('/:id', (c) => {
    const gameId = c.req.param('id');
    const deleted = sessionManager.deleteSession(gameId);

    if (deleted) {
      return c.json({ success: true });
    } else {
      return c.json({ error: `Game not found: ${gameId}` }, 404);
    }
  });

  /**
   * GET /game/:id/expert_action
   * Query what an expert bot would choose at the current state.
   * Used for DAgger (Dataset Aggregation) data collection.
   *
   * Query params:
   *   - expert: Bot type to query (default: "greedy")
   *
   * Returns:
   *   - expertAction: The action index the expert would choose
   *   - expertActionDescription: Human-readable description
   */
  app.get('/:id/expert_action', (c) => {
    try {
      const gameId = c.req.param('id');
      const expertType = c.req.query('expert') || 'greedy';

      const session = sessionManager.getSession(gameId);
      if (!session) {
        return c.json({ error: `Game not found: ${gameId}` }, 404);
      }

      // Create an expert bot to query
      const expert = createThinkingBot(expertType, session.seed);

      // Get what the expert would do as the player
      const expertAction = expert.chooseAction(session.state, 'player');

      // Find the action index in legal actions
      const legalActions = getLegalActions(session.state, 'player');

      // Find matching action by comparing stringified actions
      const actionStr = JSON.stringify(expertAction);
      let expertActionIndex = -1;
      for (let i = 0; i < legalActions.length; i++) {
        if (JSON.stringify(legalActions[i]) === actionStr) {
          expertActionIndex = i;
          break;
        }
      }

      // Get action description
      const clientActions = serializeLegalActionsForClient(session.state, 'player');
      const expertActionDescription =
        expertActionIndex >= 0 && expertActionIndex < clientActions.length
          ? clientActions[expertActionIndex]?.description || 'Unknown'
          : 'Unknown';

      return c.json({
        expertAction: expertActionIndex,
        expertActionDescription,
        expertType,
        thinking: expert.getLastThinking(),
      });
    } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : 'Unknown error' }, 500);
    }
  });

  return app;
}
