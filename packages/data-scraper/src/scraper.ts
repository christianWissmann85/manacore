/**
 * Scryfall API Scraper
 *
 * Fetches card data from Scryfall API and downloads card images
 * Respects Scryfall's rate limiting (100ms between requests)
 */

import type {
  ScryfallCard,
  ScryfallListResponse,
  ScryfallError,
  CachedCard,
  Ruling,
  RulingsResponse,
} from './types';

export class ScryfallScraper {
  private baseUrl = 'https://api.scryfall.com';
  private delayMs = 100; // Scryfall requests 100ms between requests

  /**
   * Fetch all cards from a given set
   */
  async fetchSet(setCode: string): Promise<ScryfallCard[]> {
    const allCards: ScryfallCard[] = [];
    let url = `${this.baseUrl}/cards/search?q=set:${setCode}`;

    console.log(`Fetching cards from set: ${setCode}`);

    while (url) {
      console.log(`  → ${url}`);

      const response = await fetch(url);
      if (!response.ok) {
        const error: ScryfallError = await response.json();
        throw new Error(`Scryfall API error: ${error.details}`);
      }

      const data: ScryfallListResponse = await response.json();
      allCards.push(...data.data);

      console.log(`  ✓ Fetched ${data.data.length} cards (${allCards.length}/${data.total_cards} total)`);

      if (data.has_more && data.next_page) {
        url = data.next_page;
        await this.delay(this.delayMs);
      } else {
        url = '';
      }
    }

    console.log(`\n✅ Fetched ${allCards.length} cards from ${setCode}`);
    return allCards;
  }

  /**
   * Fetch rulings for a specific card
   */
  async fetchRulings(card: ScryfallCard): Promise<Ruling[]> {
    const response = await fetch(card.rulings_uri);
    if (!response.ok) {
      console.warn(`Failed to fetch rulings for ${card.name}`);
      return [];
    }

    const data: RulingsResponse = await response.json();
    await this.delay(this.delayMs);
    return data.data;
  }

  /**
   * Download card image to local filesystem
   */
  async downloadImage(
    imageUrl: string,
    outputPath: string,
  ): Promise<void> {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to download image: ${imageUrl}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    await Bun.write(outputPath, buffer);
    await this.delay(this.delayMs / 2); // Shorter delay for images
  }

  /**
   * Convert ScryfallCard to CachedCard format
   */
  toCachedCard(card: ScryfallCard, imageFilename: string): CachedCard {
    return {
      id: card.id,
      name: card.name,
      mana_cost: card.mana_cost,
      cmc: card.cmc,
      type_line: card.type_line,
      oracle_text: card.oracle_text,
      power: card.power,
      toughness: card.toughness,
      colors: card.colors,
      color_identity: card.color_identity,
      keywords: card.keywords,
      flavor_text: card.flavor_text,
      rarity: card.rarity,
      set: card.set,
      collector_number: card.collector_number,
      image_filename: imageFilename,
      rulings_uri: card.rulings_uri,
    };
  }

  /**
   * Get the best image URI for a card
   * Handles both normal cards and multi-faced cards
   */
  getImageUri(card: ScryfallCard, size: 'small' | 'normal' | 'large' | 'png' = 'normal'): string | null {
    // Normal cards have image_uris
    if (card.image_uris) {
      return card.image_uris[size];
    }

    // Multi-faced cards have card_faces
    if (card.card_faces && card.card_faces[0]?.image_uris) {
      return card.card_faces[0].image_uris[size];
    }

    return null;
  }

  /**
   * Generate filename for card image
   */
  getImageFilename(card: ScryfallCard): string {
    // Sanitize card name for filesystem
    const safeName = card.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    return `${safeName}-${card.set}-${card.collector_number}.jpg`;
  }

  /**
   * Delay helper for rate limiting
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Save card data to JSON file
   */
  async saveCardsToFile(cards: CachedCard[], outputPath: string): Promise<void> {
    const json = JSON.stringify(cards, null, 2);
    await Bun.write(outputPath, json);
    console.log(`\n💾 Saved ${cards.length} cards to ${outputPath}`);
  }

  /**
   * Filter cards to English only
   */
  filterEnglishCards(cards: ScryfallCard[]): ScryfallCard[] {
    return cards.filter(card => card.lang === 'en');
  }
}
