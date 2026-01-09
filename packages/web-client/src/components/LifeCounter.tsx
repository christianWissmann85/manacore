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
        'flex items-center justify-center w-14 h-14 rounded-full font-bold text-2xl',
        'border-2 transition-colors duration-300',
        isDanger && 'bg-red-900/50 border-red-500 text-red-400 animate-pulse',
        isLow && !isDanger && 'bg-yellow-900/30 border-yellow-600 text-yellow-400',
        !isLow && isPlayer && 'bg-blue-900/30 border-blue-600 text-blue-300',
        !isLow && !isPlayer && 'bg-red-900/30 border-red-700 text-red-300',
      )}
    >
      {life}
    </div>
  );
}
