/**
 * Card Data Enricher
 *
 * Enriches minimal card data from the server with full card information from Scryfall.
 * This ensures we never distribute copyrighted content from our server.
 */

import { scryfallService } from './scryfallService';
import type { CardData, PermanentData } from '../types';

/**
 * Enrich a single card with data from Scryfall
 */
export async function enrichCard(card: CardData): Promise<CardData> {
  // If already enriched, return as-is
  if (card.name && card.typeLine && card.oracleText !== undefined) {
    return card;
  }

  // Fetch from Scryfall
  const scryfallCard = await scryfallService.getCardById(card.scryfallId);
  if (!scryfallCard) {
    console.warn(`Failed to fetch card data for ${card.scryfallId}`);
    return card;
  }

  // Merge with existing data
  return {
    ...card,
    name: scryfallCard.name,
    manaCost: scryfallCard.mana_cost ?? '',
    cmc: scryfallCard.cmc,
    typeLine: scryfallCard.type_line,
    oracleText: scryfallCard.oracle_text ?? '',
    power: scryfallCard.power,
    toughness: scryfallCard.toughness,
    colors: scryfallCard.colors ?? [],
    keywords: scryfallCard.keywords ?? [],
    imageUrl: scryfallService.getImageUrlById(card.scryfallId, 'normal'),
  };
}

/**
 * Enrich an array of cards
 */
export async function enrichCards(cards: CardData[]): Promise<CardData[]> {
  return Promise.all(cards.map(enrichCard));
}

/**
 * Enrich permanents (which extend CardData)
 */
export async function enrichPermanents(permanents: PermanentData[]): Promise<PermanentData[]> {
  const enriched = await Promise.all(
    permanents.map(async (perm) => {
      const enrichedCard = await enrichCard(perm);
      return { ...perm, ...enrichedCard };
    }),
  );
  return enriched;
}

/**
 * Prefetch all unique cards in a game state
 * Call this when a game starts to populate cache
 */
export async function prefetchGameCards(scryfallIds: string[]): Promise<void> {
  const uniqueIds = [...new Set(scryfallIds)];
  await scryfallService.prefetchCardsByIds(uniqueIds);
}
