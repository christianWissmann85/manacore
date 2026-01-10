import { useGameStore } from '../../store/gameStore';
import { Card } from '../core/Card';
import type { CardData } from '../../types';

export function CardPreview() {
  const { hoveredCardId, gameState, selectedCardId } = useGameStore();

  // Prioritize hovered card, then selected card
  const targetId = hoveredCardId || selectedCardId;

  if (!targetId || !gameState) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-glass-text-muted text-center h-[400px] border-2 border-dashed border-glass-border/30 rounded-xl m-4">
        <div className="text-4xl mb-4 opacity-20 grayscale">🎴</div>
        <p className="text-sm font-medium">No Card Signal</p>
        <p className="text-xs opacity-50 mt-1">Hover over a card to scan</p>
      </div>
    );
  }

  // Find the card in the game state
  // We need to check all zones where cards might be
  let card: CardData | undefined;

  // Helper to find card in list
  const findIn = (list: CardData[]) => list.find((c) => c.instanceId === targetId);

  // Check player zones
  card =
    findIn(gameState.player.hand) ||
    findIn(gameState.player.battlefield) ||
    findIn(gameState.player.graveyard);

  // Check opponent zones
  if (!card) {
    card = findIn(gameState.opponent.battlefield) || findIn(gameState.opponent.graveyard);
  }

  // Check stack
  if (!card) {
    const stackItem = gameState.stack.find((s) => s.card.instanceId === targetId);
    if (stackItem) card = stackItem.card;
  }

  if (!card) return null;

  return (
    <div className="flex flex-col items-center p-2 animate-in fade-in duration-300">
      {/* Scanner Visuals */}
      <div className="relative mb-6 group">
        <div className="absolute -inset-4 bg-accent-primary/20 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="relative shadow-2xl rounded-xl overflow-hidden ring-1 ring-white/10">
          <Card
            card={card}
            size="large"
            // Disable interactions in preview
            canAct={false}
            selected={false}
          />
          {/* Scanner Line */}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-accent-primary/20 to-transparent h-[10%] w-full animate-[scan_2s_ease-in-out_infinite] pointer-events-none" />
        </div>
      </div>

      {/* Data Readout */}
      <div className="w-full space-y-3 bg-glass-panel p-4 rounded-xl border border-glass-border shadow-lg relative overflow-hidden">
        {/* Tech Decor */}
        <div className="absolute top-0 right-0 p-1">
          <div className="flex gap-0.5">
            <div className="w-1 h-1 bg-accent-primary rounded-full animate-pulse" />
            <div className="w-1 h-1 bg-accent-primary/50 rounded-full" />
          </div>
        </div>

        <div className="flex justify-between items-baseline border-b border-white/5 pb-2">
          <span className="font-display font-bold text-lg text-white tracking-wide">
            {card.name}
          </span>
          <span className="font-mono text-xs text-accent-glow bg-accent-glow/10 px-1.5 py-0.5 rounded border border-accent-glow/30">
            {card.manaCost || '0'}
          </span>
        </div>

        <div className="text-xs font-bold text-glass-text-secondary uppercase tracking-wider">
          {card.typeLine}
        </div>

        {card.oracleText && (
          <div className="text-sm text-glass-text-primary whitespace-pre-wrap leading-relaxed font-body opacity-90">
            {card.oracleText}
          </div>
        )}

        {(card.power !== undefined || card.toughness !== undefined) && (
          <div className="flex justify-end pt-2">
            <div className="bg-glass-base px-3 py-1 rounded text-lg font-bold border border-glass-border">
              <span className="text-white">{card.power}</span>
              <span className="text-glass-text-muted mx-1">/</span>
              <span className="text-white">{card.toughness}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
