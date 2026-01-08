/**
 * Batch Routes
 *
 * Batch operations for vectorized environments
 * Allows multiple games to be stepped in a single request
 */

import { Hono } from 'hono';
import type { SessionManager } from '../sessions/manager';
import { createCompactState } from '../serialization/state';

export function createBatchRoutes(sessionManager: SessionManager): Hono {
  const app = new Hono();

  /**
   * POST /batch/create
   * Create multiple game sessions at once
   */
  app.post('/create', async (c) => {
    try {
      const body = await c.req.json();
      const { count = 1, opponent = 'greedy', deck = 'vanilla', opponentDeck = 'vanilla' } = body;

      if (count < 1 || count > 100) {
        return c.json({ error: 'count must be between 1 and 100' }, 400);
      }

      const games = [];
      for (let i = 0; i < count; i++) {
        const session = sessionManager.createSession(opponent, deck, opponentDeck);
        games.push({
          gameId: session.id,
          state: createCompactState(session.state, 0, false, false, 'player'),
        });
      }

      return c.json({ games });
    } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : 'Unknown error' }, 500);
    }
  });

  /**
   * POST /batch/step
   * Step multiple games at once
   *
   * Request body:
   * {
   *   "steps": [
   *     { "gameId": "...", "action": 0 },
   *     { "gameId": "...", "action": 1 },
   *     ...
   *   ]
   * }
   */
  app.post('/step', async (c) => {
    try {
      const body = await c.req.json();
      const { steps } = body;

      if (!Array.isArray(steps)) {
        return c.json({ error: 'steps must be an array' }, 400);
      }

      if (steps.length > 100) {
        return c.json({ error: 'Maximum 100 steps per batch' }, 400);
      }

      const results = [];

      for (const step of steps) {
        const { gameId, action } = step;

        try {
          const result = sessionManager.step(gameId, action);
          results.push({
            gameId,
            state: createCompactState(
              result.state,
              result.reward,
              result.done,
              result.truncated,
              'player',
            ),
            error: null,
          });
        } catch (error) {
          results.push({
            gameId,
            state: null,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      return c.json({ results });
    } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : 'Unknown error' }, 500);
    }
  });

  /**
   * POST /batch/reset
   * Reset multiple games at once
   *
   * Request body:
   * {
   *   "gameIds": ["...", "...", ...]
   * }
   */
  app.post('/reset', async (c) => {
    try {
      const body = await c.req.json();
      const { gameIds } = body;

      if (!Array.isArray(gameIds)) {
        return c.json({ error: 'gameIds must be an array' }, 400);
      }

      if (gameIds.length > 100) {
        return c.json({ error: 'Maximum 100 games per batch' }, 400);
      }

      const results = [];

      for (const gameId of gameIds) {
        try {
          const session = sessionManager.reset(gameId);
          results.push({
            gameId: session.id,
            state: createCompactState(session.state, 0, false, false, 'player'),
            error: null,
          });
        } catch (error) {
          results.push({
            gameId,
            state: null,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      return c.json({ results });
    } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : 'Unknown error' }, 500);
    }
  });

  /**
   * POST /batch/delete
   * Delete multiple games at once
   */
  app.post('/delete', async (c) => {
    try {
      const body = await c.req.json();
      const { gameIds } = body;

      if (!Array.isArray(gameIds)) {
        return c.json({ error: 'gameIds must be an array' }, 400);
      }

      const results = [];

      for (const gameId of gameIds) {
        const deleted = sessionManager.deleteSession(gameId);
        results.push({ gameId, deleted });
      }

      return c.json({ results });
    } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : 'Unknown error' }, 500);
    }
  });

  return app;
}
