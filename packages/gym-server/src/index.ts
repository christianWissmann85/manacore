/**
 * ManaCore Gym Server
 *
 * HTTP server exposing the ManaCore engine API for Python ML frameworks.
 *
 * Usage:
 *   bun run packages/gym-server/src/index.ts [--port 3333]
 *
 * Endpoints:
 *   POST /game/create      - Create a new game session
 *   POST /game/:id/step    - Take an action
 *   POST /game/:id/reset   - Reset game
 *   GET  /game/:id/state   - Get current state
 *   GET  /game/:id/actions - Get legal actions
 *   DELETE /game/:id       - Delete session
 *
 *   POST /batch/create     - Create multiple games
 *   POST /batch/step       - Step multiple games
 *   POST /batch/reset      - Reset multiple games
 *
 *   GET  /health           - Health check
 *   GET  /health/info      - Server info
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';

import { SessionManager, DEFAULT_SESSION_CONFIG } from './sessions/manager';
import { createGameRoutes } from './routes/game';
import { createBatchRoutes } from './routes/batch';
import { createHealthRoutes, GYM_SERVER_VERSION } from './routes/health';

// Parse command line arguments
function parseArgs(): { port: number; host: string } {
  const args = process.argv.slice(2);
  let port = 3333;
  let host = '0.0.0.0';

  for (let i = 0; i < args.length; i++) {
    const nextArg = args[i + 1];
    if (args[i] === '--port' && nextArg !== undefined) {
      port = parseInt(nextArg, 10);
      i++;
    } else if (args[i] === '--host' && nextArg !== undefined) {
      host = nextArg;
      i++;
    } else if (args[i] === '-p' && nextArg !== undefined) {
      port = parseInt(nextArg, 10);
      i++;
    } else if (args[i] === '-h' || args[i] === '--help') {
      console.log(`
ManaCore Gym Server v${GYM_SERVER_VERSION}

Usage:
  bun run src/index.ts [options]

Options:
  --port, -p <number>  Port to listen on (default: 3333)
  --host <string>      Host to bind to (default: 0.0.0.0)
  --help, -h           Show this help message

Examples:
  bun run src/index.ts
  bun run src/index.ts --port 8080
  bun run src/index.ts --host localhost --port 3333
`);
      process.exit(0);
    }
  }

  return { port, host };
}

// Create and configure the server application
function createServer(): Hono {
  const app = new Hono();
  const sessionManager = new SessionManager({
    maxSessions: 1000,
    inactivityTimeoutMs: 5 * 60 * 1000, // 5 minutes
    cleanupIntervalMs: 60 * 1000, // 1 minute
  });

  // Middleware
  app.use('*', cors());

  // Only log in non-silent mode
  if (!process.env.MANACORE_SILENT_INIT) {
    app.use('*', logger());
  }

  // API Routes
  app.route('/game', createGameRoutes(sessionManager));
  app.route('/batch', createBatchRoutes(sessionManager));
  app.route('/health', createHealthRoutes(sessionManager));

  // Serve static web client files (for HuggingFace deployment)
  const publicPath = process.env.PUBLIC_PATH || '../../../public';
  try {
    app.get('/*', async (c) => {
      const path = c.req.path === '/' ? '/index.html' : c.req.path;
      const filePath = `${publicPath}${path}`;

      try {
        const file = Bun.file(filePath);
        const exists = await file.exists();

        if (exists) {
          return new Response(file);
        }

        // For SPA routing, return index.html for non-API routes
        if (
          !path.startsWith('/game') &&
          !path.startsWith('/batch') &&
          !path.startsWith('/health')
        ) {
          const indexFile = Bun.file(`${publicPath}/index.html`);
          if (await indexFile.exists()) {
            return new Response(indexFile);
          }
        }

        return c.notFound();
      } catch {
        return c.notFound();
      }
    });
  } catch (err) {
    console.warn('Static file serving not available:', err);
  }

  // Root redirect to health
  app.get('/', (c) => c.redirect('/health'));

  // 404 handler
  app.notFound((c) => {
    return c.json(
      {
        error: 'Not Found',
        message: 'The requested endpoint does not exist',
        hint: 'Try GET /health/info for available endpoints',
      },
      404,
    );
  });

  // Error handler
  app.onError((err, c) => {
    console.error('[GymServer Error]', err);
    return c.json(
      {
        error: 'Internal Server Error',
        message: err.message,
      },
      500,
    );
  });

  // Cleanup on shutdown
  process.on('SIGINT', () => {
    console.log('\n[GymServer] Shutting down...');
    sessionManager.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\n[GymServer] Shutting down...');
    sessionManager.stop();
    process.exit(0);
  });

  return app;
}

// Main entry point
const { port, host } = parseArgs();
const app = createServer();

console.log(`
╔═══════════════════════════════════════════════════════════╗
║           ManaCore Gym Server v${GYM_SERVER_VERSION.padEnd(24)}║
║═══════════════════════════════════════════════════════════║
║  HTTP server for Python ML frameworks                     ║
║                                                           ║
║  Endpoints:                                               ║
║    POST /game/create      Create a new game               ║
║    POST /game/:id/step    Take an action                  ║
║    POST /game/:id/reset   Reset game                      ║
║    POST /batch/step       Step multiple games             ║
║    GET  /health           Health check                    ║
║    GET  /health/info      Full API documentation          ║
╚═══════════════════════════════════════════════════════════╝
`);

console.log(`🚀 Server starting on http://${host}:${port}`);

export default {
  port,
  hostname: host,
  fetch: app.fetch,
};
