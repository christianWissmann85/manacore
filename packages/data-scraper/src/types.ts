/**
 * TypeScript types for Scryfall API
 * API Documentation: https://scryfall.com/docs/api
 */

export interface ScryfallCard {
  // Core Identity
  id: string;                          // UUID: "f5b6c9e4-..."
  oracle_id: string;                   // Shared across printings
  name: string;                        // "Lightning Bolt"
  lang: string;                        // "en"
  released_at: string;                 // "1999-04-21"

  // Set Information
  set: string;                         // "6ed"
  set_name: string;                    // "Classic Sixth Edition"
  set_type: string;                    // "core"
  collector_number: string;            // "198"
  rarity: string;                      // "common" | "uncommon" | "rare" | "mythic"

  // Game Mechanics
  mana_cost?: string;                  // "{R}"
  cmc: number;                         // 1
  type_line: string;                   // "Instant"
  oracle_text?: string;                // "Lightning Bolt deals 3 damage..."
  power?: string;                      // "2" (creatures only)
  toughness?: string;                  // "2" (creatures only)
  loyalty?: string;                    // For planeswalkers (not in 6ed)
  colors: string[];                    // ["R"]
  color_identity: string[];            // ["R"]
  keywords: string[];                  // ["Flying", "Haste"]

  // Legality (we don't need this, but it's there)
  legalities: Record<string, string>;

  // Visual Assets
  image_uris?: {
    small: string;                     // 146x204
    normal: string;                    // 488x680
    large: string;                     // 672x936
    png: string;                       // Full resolution
    art_crop: string;                  // Just the artwork
    border_crop: string;               // Includes border
  };

  // Multi-faced cards have card_faces instead of image_uris
  card_faces?: Array<{
    name: string;
    mana_cost?: string;
    type_line: string;
    oracle_text?: string;
    power?: string;
    toughness?: string;
    image_uris?: ScryfallCard['image_uris'];
  }>;

  // Flavor
  flavor_text?: string;                // Italic text

  // Rulings
  rulings_uri: string;                 // Link to official rulings

  // Layout (for detecting special cards)
  layout: string;                      // "normal" | "split" | "flip" | etc.
}

export interface ScryfallListResponse {
  object: 'list';
  total_cards: number;
  has_more: boolean;
  next_page?: string;
  data: ScryfallCard[];
}

export interface ScryfallError {
  object: 'error';
  code: string;
  status: number;
  details: string;
}

export interface Ruling {
  published_at: string;
  source: string;
  comment: string;
}

export interface RulingsResponse {
  object: 'list';
  data: Ruling[];
}

/**
 * Simplified card data for local storage
 * This is what we'll save to 6ed.json
 */
export interface CachedCard {
  id: string;
  name: string;
  mana_cost?: string;
  cmc: number;
  type_line: string;
  oracle_text?: string;
  power?: string;
  toughness?: string;
  colors: string[];
  color_identity: string[];
  keywords: string[];
  flavor_text?: string;
  rarity: string;
  set: string;
  collector_number: string;
  image_filename: string;              // Local path to downloaded image
  rulings_uri: string;
}
