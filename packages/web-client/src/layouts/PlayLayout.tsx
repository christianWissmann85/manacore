import { useEffect, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { prefetchGameCards } from '../services/cardEnricher';
import { Header } from './Header';
import { Battlefield } from '../components/core/Battlefield';
import { PlayerHUD } from '../components/play/PlayerHUD';
import { PlayStack } from '../components/play/PlayStack';
import { PlayActionBar } from '../components/play/PlayActionBar';

interface PlayLayoutProps {
  mode: 'play' | 'research';
  onModeChange: (mode: 'play' | 'research') => void;
}

export function PlayLayout({ mode, onModeChange }: PlayLayoutProps) {
  const { gameState } = useGameStore();
  const [cardsLoading, setCardsLoading] = useState(false);

  // Prefetch all cards when game state loads
  useEffect(() => {
    if (!gameState) return;

    async function prefetch() {
      if (!gameState) return;

      setCardsLoading(true);
      try {
        // Collect all unique scryfallIds from the game state
        const scryfallIds = new Set<string>();

        // Player cards
        gameState.player.hand.forEach((c) => scryfallIds.add(c.scryfallId));
        gameState.player.battlefield.forEach((c) => scryfallIds.add(c.scryfallId));
        gameState.player.graveyard.forEach((c) => scryfallIds.add(c.scryfallId));

        // Opponent cards
        gameState.opponent.battlefield.forEach((c) => scryfallIds.add(c.scryfallId));
        gameState.opponent.graveyard.forEach((c) => scryfallIds.add(c.scryfallId));

        // Stack cards
        gameState.stack.forEach((s) => scryfallIds.add(s.card.scryfallId));

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

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-app-gradient">
      <Header mode={mode} onModeChange={onModeChange} />

      {/* Full-width game board for Play Mode */}
      <main className="flex-1 relative min-w-0 min-h-0 flex flex-col overflow-hidden">
        {!gameState ? (
          <div className="flex-1 flex items-center justify-center text-glass-text-muted select-none">
            <div className="text-center opacity-50">
              <div className="text-4xl mb-4 grayscale">🃏</div>
              <p>No game in progress</p>
            </div>
          </div>
        ) : cardsLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="glass-panel p-8 rounded-2xl flex flex-col items-center">
              <div className="text-4xl mb-4 animate-bounce">🃏</div>
              <div className="text-glass-text-primary font-bold">Loading Assets</div>
              <div className="text-xs text-glass-text-secondary mt-2">
                Fetching card art from Scryfall...
              </div>
            </div>
          </div>
        ) : (
          <div className="relative flex-1 flex flex-col p-6 gap-4 overflow-hidden h-full">
            {/* Background Decor (Subtle Grid) */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />

            {/* Opponent Area (Top) */}
            <div className="z-10">
              <PlayerHUD player="opponent" />
            </div>

            {/* Battlefields (Middle - Grow) */}
            <div className="flex-1 flex flex-col gap-2 min-h-0 relative z-0">
              {/* Opponent's battlefield */}
              <Battlefield
                owner="opponent"
                className="flex-1 border-b border-glass-border/30 rounded-b-none"
              />

              {/* The Stack (Floating Overlay) */}
              <PlayStack />

              {/* Player's battlefield */}
              <Battlefield owner="player" className="flex-1 rounded-t-none" />
            </div>

            {/* Player Area (Bottom) */}
            <div className="z-10">
              <PlayerHUD player="player" />
            </div>

            {/* Action Dock (Floating) */}
            <PlayActionBar />
          </div>
        )}
      </main>
    </div>
  );
}
