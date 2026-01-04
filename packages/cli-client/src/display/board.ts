/**
 * ASCII art renderer for game state
 */

import type { GameState, PlayerState, CardInstance, CardTemplate } from '@manacore/engine';
import {
  CardLoader,
  getPlayer,
  getOpponent,
  hasFlying,
  hasFirstStrike,
  hasDoubleStrike,
  hasTrample,
  hasVigilance,
  hasReach,
  getActivatedAbilities,
  formatManaPool,
  getTotalMana,
} from '@manacore/engine';

/**
 * Render the complete game state to the console
 */
export function renderGameState(
  state: GameState,
  viewingPlayer: 'player' | 'opponent' = 'player',
): string {
  const lines: string[] = [];
  const width = 80;

  // Header
  lines.push('═'.repeat(width));
  lines.push(
    ` TURN ${state.turnCount} - ${state.activePlayer.toUpperCase()} (${state.phase}/${state.step})`,
  );
  lines.push('═'.repeat(width));
  lines.push('');

  // Opponent (top of screen)
  const opponent = getOpponent(state, viewingPlayer);
  lines.push(renderPlayerSummary(opponent, 'OPPONENT', state));
  lines.push(renderZoneSummary(opponent));
  lines.push('');

  // Battlefield
  lines.push('─'.repeat(width));
  lines.push('BATTLEFIELD');
  lines.push('─'.repeat(width));

  // Opponent's battlefield
  lines.push("  Opponent's side:");
  if (opponent.battlefield.length === 0) {
    lines.push('    (empty)');
  } else {
    lines.push(...renderBattlefield(opponent.battlefield, '    ', state));
  }
  lines.push('');

  // Your battlefield
  const player = getPlayer(state, viewingPlayer);
  lines.push('  Your side:');
  if (player.battlefield.length === 0) {
    lines.push('    (empty)');
  } else {
    lines.push(...renderBattlefield(player.battlefield, '    ', state));
  }
  lines.push('');

  // Stack (if active)
  if (state.stack.length > 0) {
    lines.push('─'.repeat(width));
    lines.push(`STACK (resolves top to bottom) - Priority: ${state.priorityPlayer.toUpperCase()}`);
    lines.push('─'.repeat(width));
    for (let i = state.stack.length - 1; i >= 0; i--) {
      const stackObj = state.stack[i]!;
      const cardName = stackObj.card ? getCardName(stackObj.card) : 'Unknown';
      const controller = stackObj.controller.toUpperCase();
      const status = stackObj.countered ? ' [COUNTERED]' : '';
      const targets = stackObj.targets.length > 0 ? ` -> ${stackObj.targets.join(', ')}` : '';
      lines.push(`  [${state.stack.length - i}] ${cardName} (${controller})${status}${targets}`);
    }
    lines.push('');
  }

  // You (bottom of screen)
  lines.push('─'.repeat(width));
  lines.push(renderPlayerSummary(player, 'YOU', state));
  lines.push(renderZoneSummary(player));
  lines.push('');

  // Hand
  lines.push('HAND:');
  if (player.hand.length === 0) {
    lines.push('  (no cards)');
  } else {
    for (let i = 0; i < player.hand.length; i++) {
      const card = player.hand[i]!;
      const template = CardLoader.getById(card.scryfallId);
      lines.push(`  [${i}] ${template?.name || 'Unknown'} ${template?.mana_cost || ''}`);
    }
  }
  lines.push('');

  // Game over
  if (state.gameOver) {
    lines.push('═'.repeat(width));
    lines.push(`🎮 GAME OVER - ${state.winner?.toUpperCase()} WINS!`);
    lines.push('═'.repeat(width));
  }

  return lines.join('\n');
}

/**
 * Render player summary line
 */
function renderPlayerSummary(player: PlayerState, label: string, _state: GameState): string {
  const poolMana = getTotalMana(player.manaPool);
  const poolDisplay = poolMana > 0 ? formatManaPool(player.manaPool) : 'Empty';
  const untappedLands = countUntappedLands(player);

  return `${label}: ❤️  ${player.life} life | 💎 Mana Pool: ${poolDisplay} | ⚡ ${untappedLands} untapped lands`;
}

/**
 * Render zone card counts
 */
function renderZoneSummary(player: PlayerState): string {
  return `  📚 Library: ${player.library.length} | ✋ Hand: ${player.hand.length} | 🪦 Graveyard: ${player.graveyard.length}`;
}

/**
 * Render battlefield cards
 */
function renderBattlefield(
  battlefield: CardInstance[],
  indent: string,
  state: GameState,
): string[] {
  const lines: string[] = [];

  // Group by type
  const lands = battlefield.filter((c) => {
    const template = CardLoader.getById(c.scryfallId);
    return template?.type_line.includes('Land');
  });

  const creatures = battlefield.filter((c) => {
    const template = CardLoader.getById(c.scryfallId);
    return template?.type_line.includes('Creature');
  });

  const others = battlefield.filter((c) => {
    const template = CardLoader.getById(c.scryfallId);
    return !template?.type_line.includes('Land') && !template?.type_line.includes('Creature');
  });

  // Render lands
  if (lands.length > 0) {
    const landSummary = lands
      .map((l) => {
        const template = CardLoader.getById(l.scryfallId);
        const name = template?.name.replace(' ', '').substring(0, 3).toUpperCase() || '???';
        return l.tapped ? `[${name}]` : `${name}`;
      })
      .join(' ');
    lines.push(`${indent}Lands: ${landSummary}`);
  }

  // Render creatures
  if (creatures.length > 0) {
    for (const creature of creatures) {
      lines.push(indent + renderCreature(creature, state));
    }
  }

  // Render others
  if (others.length > 0) {
    for (const card of others) {
      const template = CardLoader.getById(card.scryfallId);
      const status = card.tapped ? '[TAPPED]' : '';
      lines.push(`${indent}${template?.name || 'Unknown'} ${status}`);
    }
  }

  return lines;
}

/**
 * Get keyword abilities for a card
 */
function getKeywords(template: CardTemplate): string[] {
  const keywords: string[] = [];

  if (hasFlying(template)) keywords.push('Flying');
  if (hasFirstStrike(template)) keywords.push('First Strike');
  if (hasDoubleStrike(template)) keywords.push('Double Strike');
  if (hasTrample(template)) keywords.push('Trample');
  if (hasVigilance(template)) keywords.push('Vigilance');
  if (hasReach(template)) keywords.push('Reach');

  return keywords;
}

/**
 * Render a single creature
 */
function renderCreature(creature: CardInstance, state: GameState): string {
  const template = CardLoader.getById(creature.scryfallId);
  if (!template) return 'Unknown creature';

  const name = template.name;
  const pt = `${template.power || '?'}/${template.toughness || '?'}`;
  const damage = creature.damage > 0 ? ` (-${creature.damage})` : '';

  let status = '';
  if (creature.tapped) status += '[T] ';
  if (creature.summoningSick) status += '[SICK] ';
  if (creature.attacking) status += '[ATK] ';
  if (creature.blocking) status += '[BLK] ';

  // Show keyword abilities
  const keywords = getKeywords(template);
  const keywordStr = keywords.length > 0 ? ` {${keywords.join(', ')}}` : '';

  // Show activated abilities
  const abilities = getActivatedAbilities(creature, state);
  const abilityStr = abilities.length > 0 ? ` [${abilities.map((a) => a.name).join(', ')}]` : '';

  return `${status}${name} (${pt})${damage}${keywordStr}${abilityStr}`;
}

/**
 * Count untapped lands
 */
function countUntappedLands(player: PlayerState): number {
  return player.battlefield.filter((card) => {
    const template = CardLoader.getById(card.scryfallId);
    return template?.type_line.includes('Land') && !card.tapped;
  }).length;
}

/**
 * Get card name safely
 */
function getCardName(card: CardInstance): string {
  const template = CardLoader.getById(card.scryfallId);
  return template?.name || 'Unknown';
}

/**
 * Clear the console (cross-platform)
 */
export function clearScreen(): void {
  console.clear();
}

/**
 * Print a separator line
 */
export function printSeparator(width: number = 80): void {
  console.log('─'.repeat(width));
}

/**
 * Print an error message
 */
export function printError(message: string): void {
  console.log(`❌ ERROR: ${message}`);
}

/**
 * Print a success message
 */
export function printSuccess(message: string): void {
  console.log(`✅ ${message}`);
}

/**
 * Print info message
 */
export function printInfo(message: string): void {
  console.log(`ℹ️  ${message}`);
}
