import { useEffect, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { prefetchGameCards } from '../services/cardEnricher';
import { Header } from './Header';
import { Battlefield } from '../components/core/Battlefield';
import { PlayerHUD } from '../components/play/PlayerHUD';
import { PlayStack } from '../components/play/PlayStack';
import { PlayActionBar } from '../components/play/PlayActionBar';

// Research components
import { MCTSTreeView } from '../components/research/MCTSTreeView';
import { WinProbabilityChart } from '../components/research/WinProbabilityChart';
import { EvaluationBreakdown } from '../components/research/EvaluationBreakdown';
import { PolicyDistribution } from '../components/research/PolicyDistribution';
import { ActionLog } from '../components/research/ActionLog';
import { CardPreview } from '../components/research/CardPreview';
import { ResearchControlPanel } from '../components/research/ResearchControlPanel';
import { Card } from '../components/core/Card';

interface ResearchLayoutProps {
  mode: 'play' | 'research';
  onModeChange: (mode: 'play' | 'research') => void;
}

export function ResearchLayout({ mode, onModeChange }: ResearchLayoutProps) {
  const { gameState, aiThinking, showAIThinking, toggleAIThinking, hoveredCardId } = useGameStore();
  const [cardsLoading, setCardsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'ai' | 'card'>('ai');

  // Prefetch all cards when game state loads
  useEffect(() => {
    if (!gameState) return;

    async function prefetch() {
      if (!gameState) return;

      setCardsLoading(true);
      try {
        const scryfallIds = new Set<string>();
        gameState.player.hand.forEach((c) => scryfallIds.add(c.scryfallId));
        gameState.player.battlefield.forEach((c) => scryfallIds.add(c.scryfallId));
        gameState.player.graveyard.forEach((c) => scryfallIds.add(c.scryfallId));
        gameState.opponent.battlefield.forEach((c) => scryfallIds.add(c.scryfallId));
        gameState.opponent.graveyard.forEach((c) => scryfallIds.add(c.scryfallId));
        gameState.stack.forEach((s) => scryfallIds.add(s.card.scryfallId));
        await prefetchGameCards([...scryfallIds]);
      } catch (error) {
        console.error('Failed to prefetch cards:', error);
      } finally {
        setCardsLoading(false);
      }
    }

    void prefetch();
  }, [gameState?.gameId]);

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
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-app-gradient">
      <Header mode={mode} onModeChange={onModeChange} />

      {/* Research Layout: Board + Sidebar */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_400px] xl:grid-cols-[1fr_450px] min-h-0 relative">
        {/* Main Content (Board) */}
        <main className="relative min-w-0 min-h-0 flex flex-col overflow-hidden">
          {!gameState ? (
            <div className="flex-1 flex items-center justify-center text-glass-text-muted select-none">
              <div className="text-center opacity-50">
                <div className="text-4xl mb-4 grayscale">🃏</div>
                <p>No game in progress</p>
              </div>
            </div>
          ) : cardsLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="glass-panel p-8 rounded-2xl flex flex-col items-center">
                <div className="text-4xl mb-4 animate-bounce">🃏</div>
                <div className="text-glass-text-primary font-bold">Loading Assets</div>
                <div className="text-xs text-glass-text-secondary mt-2">
                  Fetching card art from Scryfall...
                </div>
              </div>
            </div>
          ) : (
            <div className="relative flex-1 flex flex-col p-6 gap-4 overflow-hidden h-full">
              {/* Background Decor */}
              <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />

              {/* Opponent Area */}
              <div className="z-10">
                <PlayerHUD player="opponent" />
              </div>

              {/* Battlefields */}
              <div className="flex-1 flex flex-col gap-2 min-h-0 relative z-0">
                <Battlefield
                  owner="opponent"
                  className="flex-1 border-b border-glass-border/30 rounded-b-none"
                />
                <PlayStack />
                <Battlefield owner="player" className="flex-1 rounded-t-none" />
              </div>

              {/* Player Area */}
              <div className="z-10">
                <PlayerHUD player="player" />
              </div>

              {/* Action Dock */}
              <PlayActionBar />
            </div>
          )}
        </main>

        {/* Sidebar (Inspector Panel) */}
        <aside className="hidden lg:flex flex-col border-l border-glass-border bg-glass-surface/30 backdrop-blur-md min-h-0 z-20">
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
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

                      {/* MCTS Tree */}
                      {aiThinking.mctsTree && (
                        <div>
                          <h3 className="text-[10px] text-glass-text-muted uppercase tracking-widest font-bold mb-3 flex items-center gap-2">
                            <span className="w-1 h-1 bg-accent-primary rounded-full"></span>
                            Search Tree
                          </h3>
                          <MCTSTreeView tree={aiThinking.mctsTree} />
                        </div>
                      )}

                      {/* Evaluation breakdown */}
                      {aiThinking.evaluation && (
                        <div>
                          <h3 className="text-[10px] text-glass-text-muted uppercase tracking-widest font-bold mb-3 flex items-center gap-2">
                            <span className="w-1 h-1 bg-accent-secondary rounded-full"></span>
                            Heuristic Factors
                          </h3>
                          <EvaluationBreakdown evaluation={aiThinking.evaluation} />
                        </div>
                      )}

                      {/* Policy distribution */}
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

                  {/* Win probability chart */}
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

            {/* Control Panel at bottom of sidebar */}
            <div className="border-t border-glass-border p-4 bg-glass-surface/50">
              <ResearchControlPanel />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
