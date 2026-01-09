import { useGameStore } from '../store/gameStore';
import { Hand } from './Hand';
import { ManaDisplay } from './ManaDisplay';
import { LifeCounter } from './LifeCounter';
import { ZoneIndicator } from './ZoneIndicator';

interface PlayerAreaProps {
  player: 'player' | 'opponent';
}

export function PlayerArea({ player }: PlayerAreaProps) {
  const { gameState } = useGameStore();
  if (!gameState) return null;

  const isPlayer = player === 'player';
  const playerData = gameState.player;
  const opponentData = gameState.opponent;
  const isActive = gameState.activePlayer === player;
  const hasPriority = gameState.priorityPlayer === player;

  const life = isPlayer ? playerData.life : opponentData.life;
  const libraryCount = isPlayer ? playerData.libraryCount : opponentData.libraryCount;
  const graveyardCount = isPlayer ? playerData.graveyard.length : opponentData.graveyard.length;

  return (
    <div
      className={`
        flex items-center gap-4 px-4 py-3 rounded-lg
        ${isActive ? 'bg-board-accent/40 ring-1 ring-board-highlight/50' : 'bg-board-surface/50'}
        ${hasPriority ? 'ring-2 ring-yellow-500/50' : ''}
      `}
    >
      {/* Player info */}
      <div className="flex flex-col items-center gap-1 min-w-[80px]">
        <span className="text-xs text-gray-400 uppercase tracking-wider">
          {isPlayer ? 'You' : 'Opponent'}
        </span>
        <LifeCounter life={life} isPlayer={isPlayer} />
        {hasPriority && <span className="text-xs text-yellow-400 animate-pulse">Priority</span>}
      </div>

      {/* Mana pool (only for player) */}
      {isPlayer && <ManaDisplay manaPool={playerData.manaPool} />}

      {/* Hand */}
      <div className="flex-1 min-w-0">
        {isPlayer ? (
          <Hand cards={playerData.hand} />
        ) : (
          <div className="flex items-center gap-2">
            <div className="flex -space-x-8">
              {Array.from({ length: Math.min(opponentData.handCount, 7) }).map((_, i) => (
                <div
                  key={i}
                  className="w-12 h-16 bg-gradient-to-br from-blue-900 to-blue-950 rounded border border-blue-800/50 shadow-md"
                  style={{ transform: `rotate(${(i - 3) * 3}deg)` }}
                />
              ))}
            </div>
            <span className="text-sm text-gray-400">{opponentData.handCount} cards</span>
          </div>
        )}
      </div>

      {/* Zone indicators */}
      <div className="flex gap-3">
        <ZoneIndicator icon="📚" count={libraryCount} label="Library" />
        <ZoneIndicator icon="💀" count={graveyardCount} label="Graveyard" />
      </div>
    </div>
  );
}
