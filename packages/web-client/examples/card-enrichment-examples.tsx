/**
 * Example: Using Card Enrichment in React Components
 * 
 * This shows how to work with the IP-safe minimal card data from the server
 * and enrich it with Scryfall data for display.
 */

import React, { useEffect, useState } from 'react';
import { enrichCard, prefetchGameCards } from '../services/cardEnricher';
import type { CardData } from '../types';

/**
 * Example 1: Basic Card Component
 */
export function CardDisplay({ card }: { card: CardData }) {
  const [enrichedCard, setEnrichedCard] = useState<CardData>(card);
  const [isLoading, setIsLoading] = useState(!card.name);

  useEffect(() => {
    async function loadCardData() {
      if (!card.name) {
        // Card data not yet loaded - fetch from Scryfall
        setIsLoading(true);
        const enriched = await enrichCard(card);
        setEnrichedCard(enriched);
        setIsLoading(false);
      }
    }

    void loadCardData();
  }, [card.scryfallId, card.name]);

  if (isLoading) {
    return <div className="card-loading">Loading...</div>;
  }

  return (
    <div className="card">
      <img 
        src={enrichedCard.imageUrl} 
        alt={enrichedCard.name}
        loading="lazy"
      />
      <h3>{enrichedCard.name}</h3>
      <p className="mana-cost">{enrichedCard.manaCost}</p>
      <p className="oracle-text">{enrichedCard.oracleText}</p>
    </div>
  );
}

/**
 * Example 2: Game Board with Prefetching
 */
export function GameBoard({ gameState }: { gameState: ClientGameState }) {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    async function prefetchAllCards() {
      // Extract all unique Scryfall IDs from game state
      const allCards = [
        ...gameState.player.hand,
        ...gameState.player.battlefield,
        ...gameState.opponent.battlefield,
        ...gameState.stack.map(s => s.card),
      ];

      const scryfallIds = [...new Set(allCards.map(c => c.scryfallId))];

      // Prefetch all cards in parallel (rate-limited internally)
      await prefetchGameCards(scryfallIds);
      
      setIsReady(true);
    }

    void prefetchAllCards();
  }, [gameState.gameId]);

  if (!isReady) {
    return <LoadingScreen message="Loading card data from Scryfall..." />;
  }

  return (
    <div className="game-board">
      <Hand cards={gameState.player.hand} />
      <Battlefield permanents={gameState.player.battlefield} />
      {/* ... */}
    </div>
  );
}

/**
 * Example 3: Batch Enrichment for Lists
 */
export function HandDisplay({ cards }: { cards: CardData[] }) {
  const [enrichedCards, setEnrichedCards] = useState<CardData[]>(cards);

  useEffect(() => {
    async function enrichAll() {
      const enriched = await Promise.all(
        cards.map(card => enrichCard(card))
      );
      setEnrichedCards(enriched);
    }

    void enrichAll();
  }, [cards]);

  return (
    <div className="hand">
      {enrichedCards.map(card => (
        <CardDisplay key={card.instanceId} card={card} />
      ))}
    </div>
  );
}

/**
 * Example 4: Custom Hook for Card Data
 */
export function useEnrichedCard(card: CardData) {
  const [enrichedCard, setEnrichedCard] = useState<CardData>(card);
  const [isLoading, setIsLoading] = useState(!card.name);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function loadCardData() {
      if (card.name) {
        // Already enriched
        setEnrichedCard(card);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const enriched = await enrichCard(card);
        setEnrichedCard(enriched);
        setError(null);
      } catch (err) {
        setError(err as Error);
      } finally {
        setIsLoading(false);
      }
    }

    void loadCardData();
  }, [card.scryfallId, card.name]);

  return { enrichedCard, isLoading, error };
}

// Usage:
function MyComponent({ card }: { card: CardData }) {
  const { enrichedCard, isLoading, error } = useEnrichedCard(card);

  if (error) return <div>Error loading card</div>;
  if (isLoading) return <div>Loading...</div>;

  return <div>{enrichedCard.name}</div>;
}

/**
 * Example 5: Optimized Image Loading
 */
export function CardImage({ 
  scryfallId, 
  size = 'normal' 
}: { 
  scryfallId: string; 
  size?: 'small' | 'normal' | 'large' 
}) {
  // Direct image URL - no API call needed!
  const imageUrl = `https://cards.scryfall.io/${size}/front/${scryfallId.charAt(0)}/${scryfallId.charAt(1)}/${scryfallId}.jpg`;

  return (
    <img 
      src={imageUrl} 
      loading="lazy"
      alt="Card"
      className="card-image"
    />
  );
}

/**
 * Example 6: Cache Status Display
 */
export function CacheStatus() {
  const [stats, setStats] = useState({ total: 0, size: 0 });

  useEffect(() => {
    // Count cached cards
    const keys = Object.keys(localStorage)
      .filter(k => k.startsWith('manacore_scryfall_'));
    
    const totalSize = keys.reduce((acc, key) => {
      const item = localStorage.getItem(key);
      return acc + (item?.length ?? 0);
    }, 0);

    setStats({
      total: keys.length,
      size: Math.round(totalSize / 1024), // KB
    });
  }, []);

  return (
    <div className="cache-status">
      Cached Cards: {stats.total} ({stats.size} KB)
    </div>
  );
}
