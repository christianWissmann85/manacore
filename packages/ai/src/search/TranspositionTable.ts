/**
 * TranspositionTable - Cache for MCTS statistics across equivalent positions
 *
 * In MTG, passing priority creates many duplicate states. This table allows
 * MCTS to share statistics between equivalent positions, improving search
 * efficiency by avoiding redundant exploration.
 *
 * Key design decisions:
 * - Hash only relevant features (life, board, hand sizes, phase)
 * - Ignore: instance IDs, library order, exact mana pool breakdown
 * - LRU eviction when table is full
 */

import type { GameState, PlayerId, CardInstance } from '@manacore/engine';
import { getPlayer, getOpponent } from '@manacore/engine';

/**
 * Entry stored in the transposition table
 */
export interface TranspositionEntry {
  /** Total visits to this position */
  visits: number;
  /** Total reward accumulated */
  totalReward: number;
  /** Depth when this entry was created (for potential depth-based eviction) */
  depth: number;
  /** Timestamp of last access (for LRU eviction) */
  lastAccess: number;
}

/**
 * Statistics about table performance
 */
export interface TranspositionStats {
  /** Current number of entries */
  size: number;
  /** Maximum table size */
  maxSize: number;
  /** Number of successful lookups */
  hits: number;
  /** Number of failed lookups */
  misses: number;
  /** Hit rate (hits / total lookups) */
  hitRate: number;
  /** Number of evictions performed */
  evictions: number;
}

/**
 * Configuration for transposition table
 */
export interface TranspositionConfig {
  /** Maximum number of entries (default: 100,000) */
  maxSize: number;
  /** Eviction policy (default: 'lru') */
  evictionPolicy: 'lru' | 'depth';
  /** Percentage of entries to evict when full (default: 0.1 = 10%) */
  evictionRatio: number;
}

export const DEFAULT_TRANSPOSITION_CONFIG: TranspositionConfig = {
  maxSize: 100_000,
  evictionPolicy: 'lru',
  evictionRatio: 0.1,
};

/**
 * Transposition table for caching MCTS statistics
 */
export class TranspositionTable {
  private entries = new Map<string, TranspositionEntry>();
  private config: TranspositionConfig;

  // Statistics
  private hits = 0;
  private misses = 0;
  private evictions = 0;

  constructor(config: Partial<TranspositionConfig> = {}) {
    this.config = { ...DEFAULT_TRANSPOSITION_CONFIG, ...config };
  }

  /**
   * Compute hash from relevant game features only.
   *
   * This creates a canonical representation of the game state that:
   * - Ignores instance IDs (same card in different games should match)
   * - Ignores library order (hidden information)
   * - Ignores exact mana pool breakdown (just total available matters less)
   * - Captures board state, life totals, hand sizes, and game phase
   */
  computeHash(state: GameState, playerId: PlayerId): string {
    const player = getPlayer(state, playerId);
    const opponent = getOpponent(state, playerId);

    // Hash relevant features
    const features = [
      // Life totals (critical)
      `L:${player.life}/${opponent.life}`,

      // Board presence - sorted card names for canonical form
      `PB:${this.hashBattlefield(player.battlefield)}`,
      `OB:${this.hashBattlefield(opponent.battlefield)}`,

      // Hand sizes (not contents - that's hidden information)
      `H:${player.hand.length}/${opponent.hand.length}`,

      // Game phase and active player
      `P:${state.phase}:${state.step || ''}`,
      `A:${state.activePlayer === playerId ? 'us' : 'them'}`,

      // Stack state (simplified - just whether something is on stack)
      `S:${state.stack.length > 0 ? state.stack.length : 0}`,

      // Turn number (helps differentiate early vs late game)
      `T:${Math.floor(state.turnCount / 5)}`, // Group by 5 turns
    ];

    return features.join('|');
  }

  /**
   * Hash battlefield cards into canonical form
   *
   * Captures: card ID, tapped status, counters, temporary modifications
   * Sorted alphabetically for consistent ordering
   */
  private hashBattlefield(cards: CardInstance[]): string {
    if (cards.length === 0) return '';

    const cardHashes = cards.map((card) => {
      // Use scryfallId as the card identifier
      const parts = [card.scryfallId];

      // Include tapped status
      if (card.tapped) parts.push('T');

      // Include summoning sickness for creatures
      if (card.summoningSick) parts.push('S');

      // Include counters if any
      if (card.counters && Object.keys(card.counters).length > 0) {
        const counterStr = Object.entries(card.counters)
          .filter(([, count]) => count > 0)
          .map(([type, count]) => `${type}:${count}`)
          .sort()
          .join(',');
        if (counterStr) parts.push(`[${counterStr}]`);
      }

      // Include temporary modifications if any (pump effects)
      if (card.temporaryModifications && card.temporaryModifications.length > 0) {
        const totalPower = card.temporaryModifications.reduce(
          (sum, mod) => sum + mod.powerChange,
          0,
        );
        const totalToughness = card.temporaryModifications.reduce(
          (sum, mod) => sum + mod.toughnessChange,
          0,
        );
        if (totalPower !== 0 || totalToughness !== 0) {
          parts.push(`(${totalPower}/${totalToughness})`);
        }
      }

      return parts.join('');
    });

    // Sort for canonical ordering
    return cardHashes.sort().join(',');
  }

  /**
   * Look up an entry in the table
   *
   * @returns Entry if found, undefined otherwise
   */
  lookup(hash: string): TranspositionEntry | undefined {
    const entry = this.entries.get(hash);

    if (entry) {
      this.hits++;
      entry.lastAccess = Date.now();
      return entry;
    }

    this.misses++;
    return undefined;
  }

  /**
   * Store or update an entry in the table
   *
   * If entry exists, merges statistics (adds visits and rewards)
   * If table is full, triggers eviction before storing
   */
  store(hash: string, visits: number, totalReward: number, depth: number): void {
    // Check if we need to evict
    if (this.entries.size >= this.config.maxSize && !this.entries.has(hash)) {
      this.evict();
    }

    const existing = this.entries.get(hash);

    if (existing) {
      // Merge statistics - use max visits approach (more robust to tree structure)
      existing.visits = Math.max(existing.visits, visits);
      existing.totalReward = Math.max(existing.totalReward, totalReward);
      existing.depth = Math.min(existing.depth, depth); // Prefer shallower depth
      existing.lastAccess = Date.now();
    } else {
      // New entry
      this.entries.set(hash, {
        visits,
        totalReward,
        depth,
        lastAccess: Date.now(),
      });
    }
  }

  /**
   * Evict entries based on configured policy
   */
  private evict(): void {
    const toEvict = Math.floor(this.config.maxSize * this.config.evictionRatio);

    if (this.config.evictionPolicy === 'lru') {
      this.evictLRU(toEvict);
    } else {
      this.evictByDepth(toEvict);
    }

    this.evictions += toEvict;
  }

  /**
   * Evict least recently used entries
   */
  private evictLRU(count: number): void {
    // Sort by lastAccess ascending (oldest first)
    const entries = [...this.entries.entries()].sort((a, b) => a[1].lastAccess - b[1].lastAccess);

    for (let i = 0; i < count && i < entries.length; i++) {
      this.entries.delete(entries[i]![0]);
    }
  }

  /**
   * Evict entries at deepest depths (least likely to be reused)
   */
  private evictByDepth(count: number): void {
    // Sort by depth descending (deepest first)
    const entries = [...this.entries.entries()].sort((a, b) => b[1].depth - a[1].depth);

    for (let i = 0; i < count && i < entries.length; i++) {
      this.entries.delete(entries[i]![0]);
    }
  }

  /**
   * Get performance statistics
   */
  getStats(): TranspositionStats {
    const total = this.hits + this.misses;
    return {
      size: this.entries.size,
      maxSize: this.config.maxSize,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? this.hits / total : 0,
      evictions: this.evictions,
    };
  }

  /**
   * Reset the table and statistics
   */
  clear(): void {
    this.entries.clear();
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
  }

  /**
   * Get current entry count
   */
  get size(): number {
    return this.entries.size;
  }
}
