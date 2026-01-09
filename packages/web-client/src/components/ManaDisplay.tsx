import type { ManaPool } from '../types';
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
  const totalMana = Object.values(manaPool).reduce((a, b) => a + b, 0);

  if (totalMana === 0) {
    return (
      <div className="flex items-center gap-2 text-gray-500 text-sm">
        <span className="text-xs uppercase tracking-wider">Mana:</span>
        <span>Empty</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-400 uppercase tracking-wider">Mana:</span>
      <div className="flex gap-1">
        {MANA_ORDER.map(({ key, symbol }) => {
          const amount = manaPool[key];
          if (amount === 0) return null;

          return (
            <div key={key} className="flex items-center gap-0.5">
              <ManaSymbol value={symbol} size="sm" />
              {amount > 1 && <span className="text-xs text-gray-300 font-mono">x{amount}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
