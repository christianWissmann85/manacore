import { useGameStore } from '../store/gameStore';
import { Card } from './Card';
import type { CardData } from '../types';

interface HandProps {
  cards: CardData[];
}

export function Hand({ cards }: HandProps) {
  const { selectedCardId, selectCard, hoverCard, legalActions, showHints } = useGameStore();

  if (cards.length === 0) {
    return <div className="text-sm text-gray-500">No cards in hand</div>;
  }

  // Find playable cards
  const getActionsForCard = (instanceId: string) => {
    return legalActions.filter((a) => a.cardInstanceId === instanceId);
  };

  return (
    <div className="flex items-end justify-center gap-1 py-2">
      {cards.map((card, index) => {
        const actions = getActionsForCard(card.instanceId);
        const isSelected = selectedCardId === card.instanceId;
        const canAct = actions.length > 0;

        // Fan out effect
        const totalCards = cards.length;
        const midpoint = (totalCards - 1) / 2;
        const offset = index - midpoint;
        const rotation = offset * 3;
        const translateY = Math.abs(offset) * 4;

        return (
          <div
            key={card.instanceId}
            className="relative transition-transform duration-150"
            style={{
              transform: `rotate(${rotation}deg) translateY(${translateY}px)`,
              zIndex: isSelected ? 50 : index,
            }}
          >
            <Card
              card={card}
              size="medium"
              selected={isSelected}
              canAct={canAct}
              onClick={() => canAct && selectCard(isSelected ? null : card.instanceId)}
              onHover={(hovering) => hoverCard(hovering ? card.instanceId : null)}
            />
            {showHints && canAct && !isSelected && (
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse" />
            )}
          </div>
        );
      })}
    </div>
  );
}
