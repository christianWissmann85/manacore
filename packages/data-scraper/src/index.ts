/**
 * @manacore/data-scraper - Scryfall API integration
 *
 * This package provides:
 * - Scryfall API client
 * - Card data fetching and caching
 * - Rate limiting (100ms between requests)
 */

export { ScryfallScraper } from './scraper';
export type {
  ScryfallCard,
  ScryfallListResponse,
  ScryfallError,
  CachedCard,
  Ruling,
  RulingsResponse,
} from './types';
