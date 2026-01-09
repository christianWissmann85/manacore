import { useEffect, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { prefetchGameCards } from '../services/cardEnricher';
import { PlayerArea } from './PlayerArea';
import { Battlefield } from './Battlefield';
import { Stack } from './Stack';
import { ActionBar } from './ActionBar';

export function GameBoard() {
  const { gameState } = useGameStore();
  const [cardsLoading, setCardsLoading] = useState(false);

  // Prefetch all cards when game state loads
  useEffect(() => {
    if (!gameState) return;

    async function prefetch() {
      setCardsLoading(true);
      try {
        // Collect all unique scryfallIds from the game state
        const scryfallIds = new Set<string>();
        
        // Player cards
        gameState.player.hand.forEach(c => scryfallIds.add(c.scryfallId));
        gameState.player.battlefield.forEach(c => scryfallIds.add(c.scryfallId));
        gameState.player.graveyard.forEach(c => scryfallIds.add(c.scryfallId));
        
        // Opponent cards
        gameState.opponent.battlefield.forEach(c => scryfallIds.add(c.scryfallId));
        gameState.opponent.graveyard.forEach(c => scryfallIds.add(c.scryfallId));
        
        // Stack cards
        gameState.stack.forEach(s => scryfallIds.add(s.card.scryfallId));

        // Prefetch all unique cards
        await prefetchGameCards([...scryfallIds]);
      } catch (error) {
        console.error('Failed to prefetch cards:', error);
      } finally {
        setCardsLoading(false);
      }
    }

    void prefetch();
  }, [gameState?.gameId]);

  if (!gameState) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        No game in progress
      </div>
    );
  }

  if (cardsLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl mb-2">🃏</div>
          <div className="text-gray-400 animate-pulse">Loading card data from Scryfall...</div>
          <div className="text-xs text-gray-500 mt-2">This only happens once - cards are cached</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col p-4 gap-3 overflow-hidden">
      {/* Opponent Area (top) */}
      <PlayerArea player="opponent" />

      {/* Battlefield (center) */}
      <div className="flex-1 flex gap-3 min-h-0">
        <div className="flex-1 flex flex-col gap-2">
          {/* Opponent's battlefield */}
          <Battlefield owner="opponent" className="flex-1" />

          {/* Divider with Stack */}
          <div className="relative h-px bg-board-accent/50">
            <Stack />
          </div>

          {/* Player's battlefield */}
          <Battlefield owner="player" className="flex-1" />
        </div>
      </div>

      {/* Player Area (bottom) */}
      <PlayerArea player="player" />

      {/* Action Bar */}
      <ActionBar />
    </div>
  );
}
