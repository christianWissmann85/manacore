import type { GameStepResponse, DeckType, BotType } from '../types';

const API_BASE = '/api';

class GameService {
  /** Create a new game session */
  async createGame(
    opponent: BotType,
    playerDeck: DeckType = 'red',
    opponentDeck: DeckType = 'red',
    seed?: number,
  ): Promise<GameStepResponse & { gameId: string }> {
    const response = await fetch(`${API_BASE}/game/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        opponent: opponent === 'human' ? 'greedy' : opponent,
        deck: playerDeck,
        opponentDeck,
        seed,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create game: ${error}`);
    }

    return response.json() as Promise<GameStepResponse & { gameId: string }>;
  }

  /** Execute an action */
  async step(gameId: string, actionIndex: number): Promise<GameStepResponse> {
    const response = await fetch(`${API_BASE}/game/${gameId}/step`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: actionIndex }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to execute action: ${error}`);
    }

    return response.json() as Promise<GameStepResponse>;
  }

  /** Get current game state */
  async getState(gameId: string): Promise<GameStepResponse> {
    const response = await fetch(`${API_BASE}/game/${gameId}/state`);

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get state: ${error}`);
    }

    return response.json() as Promise<GameStepResponse>;
  }

  /** Get legal actions */
  async getActions(gameId: string): Promise<{ legalActions: GameStepResponse['legalActions'] }> {
    const response = await fetch(`${API_BASE}/game/${gameId}/actions`);

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get actions: ${error}`);
    }

    return response.json() as Promise<{ legalActions: GameStepResponse['legalActions'] }>;
  }

  /** Reset game to initial state */
  async reset(gameId: string, seed?: number): Promise<GameStepResponse> {
    const response = await fetch(`${API_BASE}/game/${gameId}/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seed }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to reset game: ${error}`);
    }

    return response.json() as Promise<GameStepResponse>;
  }

  /** Get the recommended action from a bot */
  async getBotAction(
    gameId: string,
    botType: BotType,
  ): Promise<{ expertAction: number; expertActionDescription: string }> {
    const response = await fetch(`${API_BASE}/game/${gameId}/expert_action?expert=${botType}`);

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get bot action: ${error}`);
    }

    return response.json() as Promise<{ expertAction: number; expertActionDescription: string }>;
  }

  /** Delete game session */
  async delete(gameId: string): Promise<void> {
    await fetch(`${API_BASE}/game/${gameId}`, {
      method: 'DELETE',
    });
  }

  /** Health check */
  async health(): Promise<{
    status: string;
    version: string;
    sessions: number;
  }> {
    const response = await fetch(`${API_BASE}/health`);
    return response.json() as Promise<{ status: string; version: string; sessions: number }>;
  }
}

export const gameService = new GameService();
