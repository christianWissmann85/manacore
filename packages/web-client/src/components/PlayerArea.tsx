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
        relative flex items-center gap-6 px-6 py-4 rounded-xl transition-all duration-300
        ${isActive ? 'bg-glass-panel border-glass-border shadow-lg' : 'bg-transparent border border-transparent'}
        ${hasPriority ? 'ring-1 ring-accent-glow shadow-[0_0_15px_rgba(96,165,250,0.15)] bg-glass-surface' : ''}
      `}
    >
      {/* Active Player Indicator Label (floating label) */}
      {isActive && (
        <div className="absolute -top-2.5 left-6 bg-glass-base px-2 text-[10px] text-accent-glow uppercase tracking-widest font-bold border border-glass-border rounded-full z-10">
          Active Turn
        </div>
      )}

      {/* Player info column */}
      <div className="flex flex-col items-center gap-2 min-w-[80px]">
        <LifeCounter life={life} isPlayer={isPlayer} />
        <div className="flex flex-col items-center">
          <span className="text-[10px] text-glass-text-muted uppercase tracking-widest font-semibold">
            {isPlayer ? 'You' : 'Opponent'}
          </span>
          {hasPriority && (
            <span className="text-[10px] text-accent-glow animate-pulse font-bold mt-0.5">
              PRIORITY
            </span>
          )}
        </div>
      </div>

      {/* Center Area: Hand & Mana */}
      <div className="flex-1 min-w-0 flex flex-col gap-2">
        {/* Mana Row (only for player, or visible mana for opponent in future) */}
        {isPlayer && (
          <div className="flex justify-start">
            <ManaDisplay manaPool={playerData.manaPool} />
          </div>
        )}

        {/* Hand Area */}
        <div className="relative min-h-[100px] flex items-center">
          {isPlayer ? (
            <Hand cards={playerData.hand} />
          ) : (
            <div className="flex items-center gap-4">
              <div className="flex -space-x-12 pl-4">
                {Array.from({ length: Math.min(opponentData.handCount, 7) }).map((_, i) => (
                  <div
                    key={i}
                    className="w-16 h-24 bg-gradient-to-br from-indigo-900 to-slate-900 rounded border border-white/10 shadow-xl transition-transform hover:-translate-y-2"
                    style={{
                      transform: `rotate(${(i - 3) * 2}deg) translateY(${Math.abs(i - 3) * 2}px)`,
                      zIndex: i,
                    }}
                  >
                    <div className="w-full h-full opacity-30 bg-[url('/card-back-pattern.png')] bg-repeat bg-[length:10px_10px]" />
                  </div>
                ))}
              </div>
              <span className="text-sm text-glass-text-secondary font-medium ml-4">
                {opponentData.handCount} Cards in Hand
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Right Column: Zones */}
      <div className="flex flex-col gap-2 border-l border-glass-border pl-4">
        <ZoneIndicator icon="📚" count={libraryCount} label="Library" />
        <ZoneIndicator icon="💀" count={graveyardCount} label="Graveyard" />
      </div>
    </div>
  );
}
