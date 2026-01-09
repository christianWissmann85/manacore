const SCRYFALL_API = 'https://api.scryfall.com';
const CACHE_PREFIX = 'manacore_scryfall_';
const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

interface ScryfallCard {
  id: string;
  name: string;
  mana_cost?: string;
  cmc: number;
  type_line: string;
  oracle_text?: string;
  power?: string;
  toughness?: string;
  colors?: string[];
  keywords?: string[];
  image_uris?: {
    small: string;
    normal: string;
    large: string;
    art_crop: string;
  };
  card_faces?: Array<{
    image_uris?: {
      small: string;
      normal: string;
      large: string;
      art_crop: string;
    };
  }>;
}

interface CacheEntry {
  data: ScryfallCard;
  timestamp: number;
}

class ScryfallService {
  private requestQueue: Array<() => Promise<void>> = [];
  private isProcessing = false;
  private lastRequestTime = 0;
  private readonly minRequestInterval = 100; // 10 requests/second max

  /** Get card image URL by name */
  async getCardImage(
    name: string,
    size: 'small' | 'normal' | 'large' = 'normal',
  ): Promise<string | null> {
    const card = await this.getCard(name);
    if (!card) return null;

    // Handle double-faced cards
    const imageUris = card.image_uris ?? card.card_faces?.[0]?.image_uris;
    return imageUris?.[size] ?? null;
  }

  /** Get full card data by name */
  async getCard(name: string): Promise<ScryfallCard | null> {
    const cacheKey = this.getCacheKey(name);

    // Check localStorage cache
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    // Fetch from Scryfall
    try {
      const card = await this.fetchCard(name);
      if (card) {
        this.setCache(cacheKey, card);
      }
      return card;
    } catch (err) {
      console.error(`Failed to fetch card "${name}":`, err);
      return null;
    }
  }

  /** Prefetch multiple cards (for game start) */
  async prefetchCards(names: string[]): Promise<void> {
    const uncached = names.filter((name) => !this.getFromCache(this.getCacheKey(name)));

    // Batch fetch uncached cards with rate limiting
    for (const name of uncached) {
      await this.getCard(name);
    }
  }

  /** Build a direct image URL (no API call needed if you have the Scryfall ID) */
  getImageUrlById(scryfallId: string, size: 'small' | 'normal' | 'large' = 'normal'): string {
    return `https://cards.scryfall.io/${size}/front/${scryfallId.charAt(0)}/${scryfallId.charAt(1)}/${scryfallId}.jpg`;
  }

  private async fetchCard(name: string): Promise<ScryfallCard | null> {
    return new Promise((resolve) => {
      this.requestQueue.push(async () => {
        try {
          // Rate limiting
          const now = Date.now();
          const timeSinceLastRequest = now - this.lastRequestTime;
          if (timeSinceLastRequest < this.minRequestInterval) {
            await this.sleep(this.minRequestInterval - timeSinceLastRequest);
          }

          this.lastRequestTime = Date.now();

          const encodedName = encodeURIComponent(name);
          const response = await fetch(`${SCRYFALL_API}/cards/named?exact=${encodedName}`);

          if (!response.ok) {
            if (response.status === 404) {
              // Try fuzzy search
              const fuzzyResponse = await fetch(`${SCRYFALL_API}/cards/named?fuzzy=${encodedName}`);
              if (fuzzyResponse.ok) {
                resolve(await fuzzyResponse.json());
                return;
              }
            }
            resolve(null);
            return;
          }

          resolve(await response.json());
        } catch {
          resolve(null);
        }
      });

      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.requestQueue.length === 0) return;

    this.isProcessing = true;

    while (this.requestQueue.length > 0) {
      const request = this.requestQueue.shift();
      if (request) {
        await request();
      }
    }

    this.isProcessing = false;
  }

  private getCacheKey(name: string): string {
    return CACHE_PREFIX + name.toLowerCase().replace(/[^a-z0-9]/g, '_');
  }

  private getFromCache(key: string): ScryfallCard | null {
    try {
      const stored = localStorage.getItem(key);
      if (!stored) return null;

      const entry: CacheEntry = JSON.parse(stored);

      // Check if cache is expired
      if (Date.now() - entry.timestamp > CACHE_DURATION) {
        localStorage.removeItem(key);
        return null;
      }

      return entry.data;
    } catch {
      return null;
    }
  }

  private setCache(key: string, data: ScryfallCard): void {
    try {
      const entry: CacheEntry = {
        data,
        timestamp: Date.now(),
      };
      localStorage.setItem(key, JSON.stringify(entry));
    } catch (err) {
      // localStorage might be full, clear old entries
      this.clearOldCache();
    }
  }

  private clearOldCache(): void {
    const keys = Object.keys(localStorage).filter((k) => k.startsWith(CACHE_PREFIX));

    // Sort by timestamp and remove oldest half
    const entries = keys
      .map((key) => {
        try {
          const entry: CacheEntry = JSON.parse(localStorage.getItem(key) ?? '{}');
          return { key, timestamp: entry.timestamp ?? 0 };
        } catch {
          return { key, timestamp: 0 };
        }
      })
      .sort((a, b) => a.timestamp - b.timestamp);

    const toRemove = entries.slice(0, Math.floor(entries.length / 2));
    toRemove.forEach(({ key }) => localStorage.removeItem(key));
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const scryfallService = new ScryfallService();
