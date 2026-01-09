import { useGameStore } from '../store/gameStore';
import { Card } from './Card';
import type { PermanentData } from '../types';
import { clsx } from 'clsx';

interface BattlefieldProps {
  owner: 'player' | 'opponent';
  className?: string;
}

export function Battlefield({ owner, className }: BattlefieldProps) {
  const { gameState, selectedCardId, selectCard, hoverCard, legalActions } = useGameStore();

  if (!gameState) return null;

  const permanents =
    owner === 'player' ? gameState.player.battlefield : gameState.opponent.battlefield;

  // Group permanents by type
  const lands = permanents.filter((p) => p.typeLine?.includes('Land'));
  const creatures = permanents.filter((p) => p.typeLine?.includes('Creature'));
  const others = permanents.filter(
    (p) => !p.typeLine?.includes('Land') && !p.typeLine?.includes('Creature'),
  );

  // Find actions that can be taken with cards on battlefield
  const getActionsForCard = (instanceId: string) => {
    return legalActions.filter((a) => a.cardInstanceId === instanceId);
  };

  const renderPermanent = (permanent: PermanentData) => {
    const actions = getActionsForCard(permanent.instanceId);
    const isSelected = selectedCardId === permanent.instanceId;
    const canAct = actions.length > 0;

    return (
      <Card
        key={permanent.instanceId}
        card={permanent}
        size="small"
        tapped={permanent.tapped}
        attacking={permanent.attacking}
        damage={permanent.damage}
        counters={permanent.counters}
        selected={isSelected}
        canAct={canAct}
        onClick={() => canAct && selectCard(isSelected ? null : permanent.instanceId)}
        onHover={(hovering) => hoverCard(hovering ? permanent.instanceId : null)}
      />
    );
  };

  return (
    <div
      className={clsx('flex flex-col gap-2 p-2 min-h-0 overflow-y-auto scrollbar-hide', className)}
    >
      {/* Creatures row */}
      {creatures.length > 0 && (
        <div className="flex flex-wrap gap-1 justify-center">{creatures.map(renderPermanent)}</div>
      )}

      {/* Other permanents row */}
      {others.length > 0 && (
        <div className="flex flex-wrap gap-1 justify-center">{others.map(renderPermanent)}</div>
      )}

      {/* Lands row */}
      {lands.length > 0 && (
        <div className="flex flex-wrap gap-1 justify-center">{lands.map(renderPermanent)}</div>
      )}

      {/* Empty state */}
      {permanents.length === 0 && (
        <div className="flex-1 flex items-center justify-center text-gray-600 text-sm border-2 border-dashed border-board-accent/20 rounded-lg bg-black/10">
          {owner === 'player' ? 'Your battlefield' : "Opponent's battlefield"}
        </div>
      )}
    </div>
  );
}
