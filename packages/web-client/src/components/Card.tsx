import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import { scryfallService } from '../services/scryfallService';
import type { CardData, PermanentData } from '../types';
import { ManaSymbols } from './ManaSymbols';

interface CardProps {
  card: CardData | PermanentData;
  size?: 'small' | 'medium' | 'large';
  tapped?: boolean;
  attacking?: boolean;
  damage?: number;
  counters?: Record<string, number>;
  selected?: boolean;
  canAct?: boolean;
  onClick?: () => void;
  onHover?: (hovering: boolean) => void;
}

const SIZES = {
  small: { width: 63, height: 88 },
  medium: { width: 126, height: 176 },
  large: { width: 252, height: 352 },
};

export function Card({
  card,
  size = 'medium',
  tapped = false,
  attacking = false,
  damage = 0,
  counters = {},
  selected = false,
  canAct = false,
  onClick,
  onHover,
}: CardProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);

  const dimensions = SIZES[size];
  const isCreature = card.typeLine.includes('Creature');
  const permanent = card as PermanentData;
  const hasSummoningSickness = 'summoningSick' in permanent && permanent.summoningSick;

  // Load image from Scryfall
  useEffect(() => {
    let mounted = true;

    async function loadImage() {
      const url = await scryfallService.getCardImage(
        card.name,
        size === 'small' ? 'small' : 'normal',
      );
      if (mounted) {
        setImageUrl(url);
      }
    }

    loadImage();

    return () => {
      mounted = false;
    };
  }, [card.name, size]);

  const handleImageError = () => {
    setImageError(true);
  };

  return (
    <motion.div
      className={clsx(
        'card-frame relative cursor-pointer',
        tapped && 'card-tapped',
        selected && 'ring-2 ring-yellow-400 shadow-yellow-400/50',
        canAct && !selected && 'ring-1 ring-green-500/50',
        attacking && 'ring-2 ring-red-500 animate-pulse',
      )}
      style={{
        width: dimensions.width,
        height: dimensions.height,
      }}
      whileHover={{ scale: 1.05, zIndex: 10 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      onMouseEnter={() => onHover?.(true)}
      onMouseLeave={() => onHover?.(false)}
    >
      {/* Card image or fallback */}
      {imageUrl && !imageError ? (
        <img
          src={imageUrl}
          alt={card.name}
          className="w-full h-full object-cover"
          onError={handleImageError}
          loading="lazy"
        />
      ) : (
        <CardFallback card={card} size={size} />
      )}

      {/* Overlays */}
      {isCreature && (
        <>
          {/* Power/Toughness badge */}
          <div className="absolute bottom-1 right-1 bg-black/80 px-1.5 py-0.5 rounded text-xs font-bold">
            {card.power}/{card.toughness}
          </div>

          {/* Damage indicator */}
          {damage > 0 && (
            <div className="absolute bottom-1 left-1 bg-red-600 px-1.5 py-0.5 rounded text-xs font-bold">
              -{damage}
            </div>
          )}

          {/* Summoning sickness indicator */}
          {hasSummoningSickness && (
            <div className="absolute top-1 left-1 bg-yellow-600/80 px-1 py-0.5 rounded text-xs">
              SICK
            </div>
          )}
        </>
      )}

      {/* Counters */}
      {Object.entries(counters).map(([type, count]) => {
        if (count === 0) return null;
        return (
          <div
            key={type}
            className="absolute top-1 right-1 bg-purple-600 px-1.5 py-0.5 rounded text-xs font-bold"
          >
            {type === '+1/+1' ? `+${count}/+${count}` : `${count}x ${type}`}
          </div>
        );
      })}

      {/* Attacking arrow */}
      {attacking && (
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-red-500 text-2xl">⚔️</div>
      )}
    </motion.div>
  );
}

/** Fallback card display when image fails to load */
function CardFallback({ card, size }: { card: CardData; size: 'small' | 'medium' | 'large' }) {
  const isLand = card.typeLine.includes('Land');
  const isCreature = card.typeLine.includes('Creature');

  // Determine card color for background
  const getColorClass = () => {
    if (card.colors.length === 0) {
      if (isLand) return 'from-amber-900 to-amber-950';
      return 'from-gray-700 to-gray-900';
    }
    if (card.colors.length > 1) return 'from-yellow-600 to-yellow-900'; // Gold for multicolor

    switch (card.colors[0]) {
      case 'W':
        return 'from-amber-100 to-amber-200 text-black';
      case 'U':
        return 'from-blue-700 to-blue-900';
      case 'B':
        return 'from-gray-800 to-black';
      case 'R':
        return 'from-red-700 to-red-900';
      case 'G':
        return 'from-green-700 to-green-900';
      default:
        return 'from-gray-700 to-gray-900';
    }
  };

  return (
    <div className={clsx('w-full h-full flex flex-col bg-gradient-to-br rounded', getColorClass())}>
      {/* Title bar */}
      <div className="p-1 border-b border-white/20">
        <div className="flex justify-between items-start">
          <span className={clsx('font-bold truncate', size === 'small' ? 'text-[8px]' : 'text-xs')}>
            {card.name}
          </span>
          {size !== 'small' && <ManaSymbols cost={card.manaCost} size="xs" />}
        </div>
      </div>

      {/* Type line */}
      <div
        className={clsx(
          'px-1 border-b border-white/20',
          size === 'small' ? 'text-[6px]' : 'text-[10px]',
        )}
      >
        {card.typeLine}
      </div>

      {/* Text box */}
      {size !== 'small' && (
        <div className="flex-1 p-1 text-[8px] leading-tight overflow-hidden opacity-80">
          {card.oracleText}
        </div>
      )}

      {/* P/T box for creatures */}
      {isCreature && (
        <div className="self-end m-1 bg-black/50 px-1 rounded text-xs font-bold">
          {card.power}/{card.toughness}
        </div>
      )}
    </div>
  );
}
