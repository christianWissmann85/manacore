/**
 * Game Routes
 *
 * CRUD operations for game sessions
 */

import { Hono } from 'hono';
import type { SessionManager } from '../sessions/manager';
import {
  createStepResponse,
  serializeObservation,
  createActionMask,
  serializeLegalActions,
} from '../serialization/state';

export function createGameRoutes(sessionManager: SessionManager): Hono {
  const app = new Hono();

  /**
   * POST /game/create
   * Create a new game session
   */
  app.post('/create', async (c) => {
    try {
      const body = await c.req.json().catch(() => ({}));
      const { opponent = 'greedy', deck = 'vanilla', opponentDeck = 'vanilla', seed } = body;

      const session = sessionManager.createSession(opponent, deck, opponentDeck, seed);

      const response = createStepResponse(
        session.state,
        0, // No reward on create
        session.state.gameOver,
        false,
        0,
        'player',
      );

      return c.json({
        gameId: session.id,
        seed: session.seed,
        opponent: session.opponentType,
        ...response,
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
      const body = await c.req.json();
      const { action } = body;

      if (typeof action !== 'number') {
        return c.json({ error: 'action must be a number (action index)' }, 400);
      }

      const result = sessionManager.step(gameId, action);

      const response = createStepResponse(
        result.state,
        result.reward,
        result.done,
        result.truncated,
        result.info.stepCount as number,
        'player',
      );

      return c.json(response);
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
      const body = await c.req.json().catch(() => ({}));
      const { seed } = body;

      const session = sessionManager.reset(gameId, seed);

      const response = createStepResponse(
        session.state,
        0,
        session.state.gameOver,
        false,
        0,
        'player',
      );

      return c.json({
        gameId: session.id,
        seed: session.seed,
        ...response,
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

      return c.json({
        observation: serializeObservation(session.state, 'player'),
        actionMask: createActionMask(session.state, 'player'),
        legalActions: serializeLegalActions(session.state, 'player'),
        done: session.state.gameOver,
        turn: session.state.turnNumber,
        phase: session.state.phase,
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

      return c.json({
        legalActions: serializeLegalActions(session.state, 'player'),
        actionMask: createActionMask(session.state, 'player'),
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

  return app;
}
