import { useGameStore } from '../../store/gameStore';

export function Header() {
  const { gameState } = useGameStore();

  return (
    <header className="h-14 flex items-center justify-between px-6 border-b border-glass-border bg-glass-surface/50 backdrop-blur-md z-10 shrink-0">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-gradient-to-br from-accent-primary to-accent-secondary flex items-center justify-center shadow-lg shadow-accent-primary/20">
            <span className="text-white font-bold text-lg">M</span>
          </div>
          <div>
            <h1 className="text-lg font-bold text-white leading-none tracking-tight">ManaCore</h1>
            <span className="text-[10px] text-accent-primary uppercase tracking-[0.15em] font-semibold">
              Glass-Box AI Lab
            </span>
          </div>
        </div>
      </div>

      {gameState && (
        <div className="flex items-center gap-6">
          <div className="flex flex-col items-end">
            <span className="text-[10px] text-glass-text-muted uppercase tracking-wider font-semibold">
              Current Turn
            </span>
            <span className="text-sm text-glass-text-primary font-mono font-bold">
              {gameState.turn}
            </span>
          </div>
          <div className="h-8 w-px bg-glass-border"></div>
          <div className="flex flex-col items-end">
            <span className="text-[10px] text-glass-text-muted uppercase tracking-wider font-semibold">
              Phase
            </span>
            <span className="text-sm text-accent-glow font-bold uppercase">{gameState.phase}</span>
          </div>
        </div>
      )}
    </header>
  );
}
