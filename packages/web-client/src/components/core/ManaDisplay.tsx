import type { ManaPool } from '../../types';
import { ManaSymbol } from './ManaSymbols';

interface ManaDisplayProps {
  manaPool: ManaPool;
}

const MANA_ORDER: Array<{ key: keyof ManaPool; symbol: string }> = [
  { key: 'white', symbol: 'W' },
  { key: 'blue', symbol: 'U' },
  { key: 'black', symbol: 'B' },
  { key: 'red', symbol: 'R' },
  { key: 'green', symbol: 'G' },
  { key: 'colorless', symbol: 'C' },
];

export function ManaDisplay({ manaPool }: ManaDisplayProps) {
  const totalMana = (Object.values(manaPool) as number[]).reduce((a, b) => a + b, 0);

  if (totalMana === 0) {
    return (
      <div className="flex items-center gap-2 text-glass-text-muted text-sm px-3 py-1 rounded-full border border-transparent">
        <span className="text-[10px] uppercase tracking-wider font-semibold opacity-50">Pool</span>
        <span>Empty</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 bg-black/20 px-3 py-1.5 rounded-full border border-glass-border backdrop-blur-sm shadow-inner">
      <span className="text-[10px] text-glass-text-muted uppercase tracking-wider font-semibold">
        Pool
      </span>
      <div className="flex gap-1.5">
        {MANA_ORDER.map(({ key, symbol }) => {
          const amount = manaPool[key];
          if (amount === 0) return null;

          return (
            <div key={key} className="flex items-center gap-1">
              <ManaSymbol value={symbol} size="sm" />
              {amount > 1 && (
                <span className="text-xs text-white font-mono font-bold shadow-black drop-shadow-md">
                  x{amount}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
