import { useGameStore } from '../../store/gameStore';
import { Card } from './Card';
import type { PermanentData } from '../../types';
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
      className={clsx(
        'relative flex flex-col gap-4 p-4 min-h-0 transition-colors rounded-xl',
        className,
      )}
    >
      {/* Background Hint Label */}
      {permanents.length === 0 && (
        <div className="absolute inset-0 m-4 border-2 border-dashed border-glass-border rounded-xl flex items-center justify-center pointer-events-none">
          <span className="text-glass-text-muted/50 text-sm font-medium uppercase tracking-widest">
            {owner === 'player' ? 'Your Battlefield' : "Opponent's Battlefield"}
          </span>
        </div>
      )}

      {/* Creatures & Planeswalkers (Front Row) */}
      {(creatures.length > 0 || others.length > 0) && (
        <div className="flex flex-wrap gap-2 justify-center z-10 min-h-[100px] items-center">
          {creatures.map(renderPermanent)}
          {others.map(renderPermanent)}
        </div>
      )}

      {/* Lands & Enchantments (Back Row) */}
      {lands.length > 0 && (
        <div className="flex flex-wrap gap-1.5 justify-center z-0 opacity-90 scale-95 origin-top">
          {lands.map(renderPermanent)}
        </div>
      )}
    </div>
  );
}
