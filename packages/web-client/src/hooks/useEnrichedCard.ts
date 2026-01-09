/**
 * useEnrichedCard Hook
 *
 * Enriches minimal card data from server with full data from Scryfall.
 * Handles loading states, caching, and error recovery.
 */

import { useState, useEffect } from 'react';
import { enrichCard } from '../services/cardEnricher';
import type { CardData } from '../types';

interface UseEnrichedCardResult {
  card: CardData;
  loading: boolean;
  error: Error | null;
}

/**
 * Hook to enrich a single card with Scryfall data
 */
export function useEnrichedCard(card: CardData): UseEnrichedCardResult {
  const [enrichedCard, setEnrichedCard] = useState<CardData>(card);
  const [loading, setLoading] = useState(!card.name); // Already enriched if has name
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // If already enriched, just use it
    if (card.name && card.typeLine) {
      setEnrichedCard(card);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function enrich() {
      try {
        setLoading(true);
        setError(null);
        const enriched = await enrichCard(card);

        if (!cancelled) {
          setEnrichedCard(enriched);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err as Error);
          console.error('Failed to enrich card:', err);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void enrich();

    return () => {
      cancelled = true;
    };
  }, [card.scryfallId, card.name, card.typeLine]);

  return { card: enrichedCard, loading, error };
}

/**
 * Hook to enrich multiple cards with Scryfall data
 */
export function useEnrichedCards(cards: CardData[]): {
  cards: CardData[];
  loading: boolean;
  error: Error | null;
} {
  const [enrichedCards, setEnrichedCards] = useState<CardData[]>(cards);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Check if any cards need enrichment
    const needsEnrichment = cards.some((c) => !c.name || !c.typeLine);

    if (!needsEnrichment) {
      setEnrichedCards(cards);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function enrichAll() {
      try {
        setLoading(true);
        setError(null);

        const enriched = await Promise.all(cards.map((card) => enrichCard(card)));

        if (!cancelled) {
          setEnrichedCards(enriched);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err as Error);
          console.error('Failed to enrich cards:', err);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void enrichAll();

    return () => {
      cancelled = true;
    };
  }, [cards.map((c) => c.scryfallId).join(',')]);

  return { cards: enrichedCards, loading, error };
}
