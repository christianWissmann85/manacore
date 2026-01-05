import { CardTemplate } from '../cards/CardTemplate';
import { CardLoader } from '../cards/CardLoader';

/**
 * Create a simple deck (for testing)
 */
export function createSimpleDeck(deckList: Array<{ name: string; count: number }>): CardTemplate[] {
  const cards: CardTemplate[] = [];

  for (const entry of deckList) {
    const template = CardLoader.getByName(entry.name);
    if (!template) {
      console.warn(`Card not found: ${entry.name}`);
      continue;
    }

    for (let i = 0; i < entry.count; i++) {
      cards.push(template);
    }
  }

  return cards;
}
