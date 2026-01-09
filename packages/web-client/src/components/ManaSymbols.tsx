import { clsx } from 'clsx';

interface ManaSymbolsProps {
  cost: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
}

const SIZE_CLASSES = {
  xs: 'w-3 h-3 text-[8px]',
  sm: 'w-4 h-4 text-[10px]',
  md: 'w-5 h-5 text-xs',
  lg: 'w-6 h-6 text-sm',
};

export function ManaSymbols({ cost, size = 'sm' }: ManaSymbolsProps) {
  if (!cost) return null;

  // Parse mana cost like "{2}{R}{R}" or "{X}{B}{B}"
  const symbols = cost.match(/\{([^}]+)\}/g) ?? [];

  return (
    <div className="flex gap-0.5">
      {symbols.map((symbol, index) => {
        const value = symbol.slice(1, -1); // Remove { }
        return <ManaSymbol key={index} value={value} size={size} />;
      })}
    </div>
  );
}

interface ManaSymbolProps {
  value: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
}

export function ManaSymbol({ value, size = 'sm' }: ManaSymbolProps) {
  const sizeClass = SIZE_CLASSES[size];

  const getSymbolClass = () => {
    switch (value) {
      case 'W':
        return 'mana-W';
      case 'U':
        return 'mana-U';
      case 'B':
        return 'mana-B';
      case 'R':
        return 'mana-R';
      case 'G':
        return 'mana-G';
      case 'C':
        return 'mana-C';
      case 'X':
        return 'bg-gray-600 text-white';
      default:
        // Generic mana (numbers)
        if (/^\d+$/.test(value)) {
          return 'bg-gray-400 text-black';
        }
        // Hybrid mana (e.g., W/U)
        if (value.includes('/')) {
          return 'bg-gradient-to-br from-amber-200 to-blue-600 text-white';
        }
        return 'bg-gray-600 text-white';
    }
  };

  return (
    <span
      className={clsx(
        'mana-symbol inline-flex items-center justify-center rounded-full font-bold',
        sizeClass,
        getSymbolClass(),
      )}
    >
      {value}
    </span>
  );
}
