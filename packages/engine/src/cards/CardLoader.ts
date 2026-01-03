/**
 * CardLoader - loads card data from cached Scryfall JSON
 *
 * This provides fast in-memory access to all card data without
 * requiring API calls during gameplay.
 */

import type { CardTemplate } from './CardTemplate';

// Import the card data at compile time
import cards6ed from '../../data/cards/6ed.json';

export class CardLoader {
  private static cache: Map<string, CardTemplate> = new Map();
  private static nameIndex: Map<string, CardTemplate> = new Map();
  private static initialized: boolean = false;

  /**
   * Initialize the card loader (loads all cards into memory)
   */
  static initialize(): void {
    if (this.initialized) return;

    const cardData = cards6ed as CardTemplate[];

    for (const card of cardData) {
      // Index by ID
      this.cache.set(card.id, card);

      // Index by name (lowercase for case-insensitive lookup)
      this.nameIndex.set(card.name.toLowerCase(), card);
    }

    this.initialized = true;
    console.log(`🃏 CardLoader: Loaded ${this.cache.size} cards from 6th Edition`);
  }

  /**
   * Get a card by Scryfall ID
   */
  static getById(id: string): CardTemplate | undefined {
    this.ensureInitialized();
    return this.cache.get(id);
  }

  /**
   * Get a card by name (case-insensitive)
   */
  static getByName(name: string): CardTemplate | undefined {
    this.ensureInitialized();
    return this.nameIndex.get(name.toLowerCase());
  }

  /**
   * Get all cards
   */
  static getAllCards(): CardTemplate[] {
    this.ensureInitialized();
    return Array.from(this.cache.values());
  }

  /**
   * Get cards by color
   */
  static getCardsByColor(color: string): CardTemplate[] {
    this.ensureInitialized();
    return this.getAllCards().filter(card =>
      card.colors.includes(color.toUpperCase())
    );
  }

  /**
   * Get cards by type
   */
  static getCardsByType(type: string): CardTemplate[] {
    this.ensureInitialized();
    return this.getAllCards().filter(card =>
      card.type_line.toLowerCase().includes(type.toLowerCase())
    );
  }

  /**
   * Search cards by partial name
   */
  static searchByName(query: string): CardTemplate[] {
    this.ensureInitialized();
    const lowerQuery = query.toLowerCase();
    return this.getAllCards().filter(card =>
      card.name.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Get cards by converted mana cost
   */
  static getCardsByCMC(cmc: number): CardTemplate[] {
    this.ensureInitialized();
    return this.getAllCards().filter(card => card.cmc === cmc);
  }

  /**
   * Get cards by rarity
   */
  static getCardsByRarity(rarity: string): CardTemplate[] {
    this.ensureInitialized();
    return this.getAllCards().filter(card =>
      card.rarity.toLowerCase() === rarity.toLowerCase()
    );
  }

  /**
   * Ensure the loader is initialized
   */
  private static ensureInitialized(): void {
    if (!this.initialized) {
      this.initialize();
    }
  }
}

// Auto-initialize on import
CardLoader.initialize();
