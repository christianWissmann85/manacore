import { useGameStore } from '../store/gameStore';
import { Card } from './Card';
import type { CardData } from '../types';

export function CardPreview() {
  const { hoveredCardId, gameState, selectedCardId } = useGameStore();

  // Prioritize hovered card, then selected card
  const targetId = hoveredCardId || selectedCardId;

  if (!targetId || !gameState) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-gray-500 text-center h-[400px]">
        <div className="text-4xl mb-4 opacity-20">🎴</div>
        <p className="text-sm">Hover over a card to inspect</p>
      </div>
    );
  }

  // Find the card in the game state
  // We need to check all zones where cards might be
  let card: CardData | undefined;

  // Helper to find card in list
  const findIn = (list: CardData[]) => list.find((c) => c.instanceId === targetId);

  // Check player zones
  card =
    findIn(gameState.player.hand) ||
    findIn(gameState.player.battlefield) ||
    findIn(gameState.player.graveyard);

  // Check opponent zones
  if (!card) {
    card = findIn(gameState.opponent.battlefield) || findIn(gameState.opponent.graveyard);
  }

  // Check stack
  if (!card) {
    const stackItem = gameState.stack.find((s) => s.card.instanceId === targetId);
    if (stackItem) card = stackItem.card;
  }

  if (!card) return null;

  return (
    <div className="flex flex-col items-center p-4 animate-in fade-in duration-200">
      <div className="mb-4 shadow-2xl rounded-lg">
        <Card
          card={card}
          size="large"
          // Disable interactions in preview
          canAct={false}
          selected={false}
        />
      </div>

      {/* Oracle Text Display (for accessibility/clarity) */}
      <div className="w-full space-y-2 mt-2 bg-board-bg/50 p-3 rounded border border-board-accent/20">
        <div className="flex justify-between items-baseline border-b border-white/10 pb-1">
          <span className="font-bold text-board-highlight">{card.name}</span>
          <span className="font-mono text-xs">{card.manaCost}</span>
        </div>

        <div className="text-xs text-gray-300">{card.typeLine}</div>

        {card.oracleText && (
          <div className="text-sm text-gray-200 whitespace-pre-wrap leading-relaxed">
            {card.oracleText}
          </div>
        )}

        {(card.power !== undefined || card.toughness !== undefined) && (
          <div className="text-right font-bold text-lg pt-1">
            {card.power}/{card.toughness}
          </div>
        )}
      </div>
    </div>
  );
}
