/**
 * Health Routes
 *
 * Health check and server info endpoints
 */

import { Hono } from 'hono';
import type { SessionManager } from '../sessions/manager';
import { ENGINE_VERSION } from '@manacore/engine';
import { AI_VERSION } from '@manacore/ai';
import { FEATURE_VECTOR_SIZE } from '@manacore/ai';
import { MAX_ACTIONS, FEATURE_NAMES } from '../serialization/state';

export const GYM_SERVER_VERSION = '0.1.0';

export function createHealthRoutes(sessionManager: SessionManager): Hono {
  const app = new Hono();

  /**
   * GET /health
   * Basic health check
   */
  app.get('/', (c) => {
    const stats = sessionManager.getStats();

    return c.json({
      status: 'ok',
      version: GYM_SERVER_VERSION,
      engine: ENGINE_VERSION,
      ai: AI_VERSION,
      sessions: {
        active: stats.activeSessions,
        max: stats.maxSessions,
      },
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * GET /health/info
   * Detailed server information
   */
  app.get('/info', (c) => {
    const stats = sessionManager.getStats();

    return c.json({
      server: {
        version: GYM_SERVER_VERSION,
        engineVersion: ENGINE_VERSION,
        aiVersion: AI_VERSION,
      },
      sessions: {
        active: stats.activeSessions,
        max: stats.maxSessions,
        oldestCreatedAt: stats.oldestSession ? new Date(stats.oldestSession).toISOString() : null,
      },
      gym: {
        observationSize: FEATURE_VECTOR_SIZE,
        maxActions: MAX_ACTIONS,
        featureNames: FEATURE_NAMES,
      },
      opponents: ['random', 'greedy', 'mcts', 'mcts-fast', 'mcts-strong'],
      endpoints: {
        'POST /game/create': 'Create a new game session',
        'POST /game/:id/step': 'Take an action',
        'POST /game/:id/reset': 'Reset game to initial state',
        'GET /game/:id/state': 'Get current state',
        'GET /game/:id/actions': 'Get legal actions',
        'DELETE /game/:id': 'Delete a session',
        'POST /batch/create': 'Create multiple games',
        'POST /batch/step': 'Step multiple games',
        'POST /batch/reset': 'Reset multiple games',
        'GET /health': 'Health check',
        'GET /health/info': 'Server info',
      },
    });
  });

  /**
   * GET /health/sessions
   * List active sessions (for debugging)
   */
  app.get('/sessions', (c) => {
    const sessionIds = sessionManager.getSessionIds();
    const stats = sessionManager.getStats();

    return c.json({
      count: sessionIds.length,
      max: stats.maxSessions,
      sessions: sessionIds,
    });
  });

  return app;
}
