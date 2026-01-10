import { expect, test, describe, beforeEach } from "bun:test";
import { SessionManager } from "../src/sessions/manager";
import { createGameRoutes } from "../src/routes/game";
import { Hono } from "hono";

describe("Gym Server Debugging APIs", () => {
  let sessionManager: SessionManager;
  let app: Hono;

  beforeEach(() => {
    sessionManager = new SessionManager({ maxSessions: 10 });
    app = new Hono();
    app.route("/game", createGameRoutes(sessionManager));
  });

  test("GET /game/debug/list should return all sessions", async () => {
    sessionManager.createSession("random");
    sessionManager.createSession("greedy");

    const res = await app.request("/game/debug/list");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sessions.length).toBe(2);
    expect(body.sessions[0]).toHaveProperty("turn");
  });

  test("GET /game/:id/history should return action history", async () => {
    const session = sessionManager.createSession("random");
    const gameId = session.id;

    const res = await app.request(`/game/${gameId}/history`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.gameId).toBe(gameId);
    expect(Array.isArray(body.actionHistory)).toBe(true);
  });
});
