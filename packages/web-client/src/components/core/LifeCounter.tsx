import { clsx } from 'clsx';

interface LifeCounterProps {
  life: number;
  isPlayer: boolean;
}

export function LifeCounter({ life, isPlayer }: LifeCounterProps) {
  const isDanger = life <= 5;
  const isLow = life <= 10;

  return (
    <div
      className={clsx(
        'flex items-center justify-center w-14 h-14 rounded-full font-bold text-2xl backdrop-blur-sm',
        'border-2 transition-all duration-300 shadow-lg',
        // Danger State (Critical Life)
        isDanger &&
          'bg-accent-danger/20 border-accent-danger text-accent-danger animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.4)]',
        // Low Life Warning
        isLow && !isDanger && 'bg-orange-500/10 border-orange-500/50 text-orange-400',
        // Normal State - Player
        !isLow && isPlayer && 'bg-accent-glow/10 border-accent-glow/50 text-accent-glow',
        // Normal State - Opponent
        !isLow && !isPlayer && 'bg-red-500/10 border-red-500/50 text-red-400',
      )}
    >
      {life}
    </div>
  );
}
