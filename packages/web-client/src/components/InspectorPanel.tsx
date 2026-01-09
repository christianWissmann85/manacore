import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { MCTSTreeView } from './MCTSTreeView';
import { WinProbabilityChart } from './WinProbabilityChart';
import { EvaluationBreakdown } from './EvaluationBreakdown';
import { PolicyDistribution } from './PolicyDistribution';
import { ActionLog } from './ActionLog';
import { CardPreview } from './CardPreview';
import { Card } from './Card';

type Tab = 'ai' | 'card';

export function InspectorPanel() {
  const { aiThinking, showAIThinking, toggleAIThinking, hoveredCardId, gameState } = useGameStore();

  const [activeTab, setActiveTab] = useState<Tab>('ai');

  const hasAIThinking = aiThinking !== null;

  // Find hovered card data for the mini-preview
  const getHoveredCard = () => {
    if (!hoveredCardId || !gameState) return null;
    const allCards = [
      ...gameState.player.hand,
      ...gameState.player.battlefield,
      ...gameState.player.graveyard,
      ...gameState.opponent.battlefield,
      ...gameState.opponent.graveyard,
      ...gameState.stack.map((s) => s.card),
    ];
    return allCards.find((c) => c.instanceId === hoveredCardId);
  };

  const hoveredCard = getHoveredCard();

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-glass-surface/30 backdrop-blur-sm">
      {/* Tabs */}
      <div className="flex border-b border-glass-border bg-glass-surface/50">
        <button
          onClick={() => setActiveTab('ai')}
          className={`flex-1 py-4 text-[10px] font-bold uppercase tracking-widest transition-all ${
            activeTab === 'ai'
              ? 'text-accent-primary border-b-2 border-accent-primary bg-accent-primary/5'
              : 'text-glass-text-muted hover:text-glass-text-primary hover:bg-white/5'
          }`}
        >
          AI Inspector
        </button>
        <button
          onClick={() => setActiveTab('card')}
          className={`flex-1 py-4 text-[10px] font-bold uppercase tracking-widest transition-all ${
            activeTab === 'card'
              ? 'text-accent-secondary border-b-2 border-accent-secondary bg-accent-secondary/5'
              : 'text-glass-text-muted hover:text-glass-text-primary hover:bg-white/5'
          }`}
        >
          Card Inspector
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin scrollbar-thumb-glass-border/50">
        {/* Mini Card Preview (only visible in AI tab when hovering) */}
        {activeTab === 'ai' && hoveredCard && (
          <div className="glass-panel p-3 flex items-center gap-3 animate-in slide-in-from-top-2 duration-200 border-l-4 border-l-accent-secondary">
            <div className="w-12 h-16 shrink-0 pointer-events-none">
              <Card card={hoveredCard} size="small" />
            </div>
            <div className="min-w-0">
              <div className="font-bold text-sm truncate text-white">{hoveredCard.name}</div>
              <div className="text-[10px] text-glass-text-muted truncate">
                {hoveredCard.typeLine}
              </div>
              <div className="text-[10px] text-accent-secondary mt-1">
                Click to inspect full details
              </div>
            </div>
          </div>
        )}

        {activeTab === 'card' ? (
          <CardPreview />
        ) : (
          <>
            {/* AI Control Header */}
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-glass-text-muted uppercase tracking-wider">
                Engine Visualization
              </span>
              <button
                onClick={toggleAIThinking}
                className={`text-[10px] px-3 py-1 rounded-full font-bold transition-all ${
                  showAIThinking
                    ? 'bg-accent-primary text-white shadow-[0_0_10px_rgba(59,130,246,0.5)]'
                    : 'bg-glass-panel text-glass-text-muted hover:text-white border border-glass-border'
                }`}
              >
                {showAIThinking ? 'LIVE' : 'PAUSED'}
              </button>
            </div>

            {showAIThinking && hasAIThinking ? (
              <div className="space-y-6">
                {/* Agent info */}
                <div className="glass-panel p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-white">
                      {aiThinking.agentName}
                      <span className="text-glass-text-muted ml-2 font-normal text-xs">
                        ({aiThinking.playerId === 'player' ? 'You' : 'Opponent'})
                      </span>
                    </span>
                    <span className="text-[10px] font-mono text-accent-primary">
                      {aiThinking.evaluatedNodes.toLocaleString()} nodes
                    </span>
                  </div>

                  {/* Win probability gauge */}
                  <div>
                    <div className="flex items-center justify-between text-xs mb-2">
                      <span className="text-glass-text-secondary">Confidence</span>
                      <span className="font-mono text-lg font-bold text-white">
                        {(aiThinking.winProbability * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-1.5 bg-black/40 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 transition-all duration-500 shadow-[0_0_10px_rgba(255,255,255,0.3)]"
                        style={{ width: `${aiThinking.winProbability * 100}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* MCTS Tree (if available) */}
                {aiThinking.mctsTree && (
                  <div>
                    <h3 className="text-[10px] text-glass-text-muted uppercase tracking-widest font-bold mb-3 flex items-center gap-2">
                      <span className="w-1 h-1 bg-accent-primary rounded-full"></span>
                      Search Tree
                    </h3>
                    <MCTSTreeView tree={aiThinking.mctsTree} />
                  </div>
                )}

                {/* Evaluation breakdown (if available) */}
                {aiThinking.evaluation && (
                  <div>
                    <h3 className="text-[10px] text-glass-text-muted uppercase tracking-widest font-bold mb-3 flex items-center gap-2">
                      <span className="w-1 h-1 bg-accent-secondary rounded-full"></span>
                      Heuristic Factors
                    </h3>
                    <EvaluationBreakdown evaluation={aiThinking.evaluation} />
                  </div>
                )}

                {/* Policy distribution for neural bots */}
                {aiThinking.policyDistribution && (
                  <div>
                    <h3 className="text-[10px] text-glass-text-muted uppercase tracking-widest font-bold mb-3">
                      Policy Distribution
                    </h3>
                    <PolicyDistribution distribution={aiThinking.policyDistribution} />
                  </div>
                )}
              </div>
            ) : showAIThinking ? (
              <div className="text-center py-12 glass-panel border-dashed">
                <div className="text-4xl mb-3 animate-pulse">🧠</div>
                <h3 className="text-white font-medium">Waiting for signal...</h3>
                <p className="text-xs text-glass-text-muted mt-2">
                  Neural engine is processing game state
                </p>
              </div>
            ) : (
              <div className="text-center py-12 glass-panel border-dashed opacity-50">
                <p className="text-sm">Visualization Offline</p>
              </div>
            )}

            {/* Win probability history chart */}
            <div className="pt-4 border-t border-glass-border">
              <h3 className="text-[10px] text-glass-text-muted uppercase tracking-widest font-bold mb-3">
                Win Probability Trend
              </h3>
              <WinProbabilityChart />
            </div>

            {/* Action log */}
            <div>
              <h3 className="text-[10px] text-glass-text-muted uppercase tracking-widest font-bold mb-3">
                Action Log
              </h3>
              <ActionLog />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
