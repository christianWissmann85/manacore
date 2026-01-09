/**
 * Client State Serialization
 *
 * Converts GameState into human-readable format for web client rendering.
 * Maps card IDs to names, organizes zones, and provides UI-friendly data.
 */

import type { GameState, CardInstance, PlayerId } from '@manacore/engine';
import { CardLoader, getLegalActions, describeAction } from '@manacore/engine';

/**
 * Client-friendly card data
 */
export interface CardData {
  instanceId: string;
  scryfallId: string;
  name: string;
  manaCost: string;
  cmc: number;
  typeLine: string;
  oracleText: string;
  power?: string;
  toughness?: string;
  colors: string[];
  keywords: string[];
}

/**
 * Permanent on the battlefield
 */
export interface PermanentData extends CardData {
  controller: 'player' | 'opponent';
  tapped: boolean;
  summoningSick: boolean;
  damage: number;
  attacking: boolean;
  blocking?: string;
  counters: Record<string, number>;
  attachments: string[];
}

/**
 * Item on the stack
 */
export interface StackItemData {
  id: string;
  controller: 'player' | 'opponent';
  card: CardData;
  targets: string[];
  description: string;
}

/**
 * Mana pool
 */
export interface ManaPool {
  white: number;
  blue: number;
  black: number;
  red: number;
  green: number;
  colorless: number;
}

/**
 * Client-friendly game state
 */
export interface ClientGameState {
  gameId: string;
  turn: number;
  phase: string;
  step: string;
  activePlayer: 'player' | 'opponent';
  priorityPlayer: 'player' | 'opponent';

  player: {
    life: number;
    hand: CardData[];
    battlefield: PermanentData[];
    graveyard: CardData[];
    libraryCount: number;
    manaPool: ManaPool;
  };

  opponent: {
    life: number;
    handCount: number;
    battlefield: PermanentData[];
    graveyard: CardData[];
    libraryCount: number;
  };

  stack: StackItemData[];
  gameOver: boolean;
  winner: 'player' | 'opponent' | null;
}

/**
 * Legal action with UI metadata
 */
export interface LegalActionData {
  index: number;
  type: string;
  description: string;
  cardInstanceId?: string;
  targets?: string[];
}

/**
 * Convert a CardInstance to client-friendly CardData
 */
function serializeCard(card: CardInstance): CardData {
  const template = CardLoader.getById(card.scryfallId);

  return {
    instanceId: card.instanceId,
    scryfallId: card.scryfallId,
    name: template?.name ?? 'Unknown Card',
    manaCost: template?.mana_cost ?? '',
    cmc: template?.cmc ?? 0,
    typeLine: template?.type_line ?? 'Unknown',
    oracleText: template?.oracle_text ?? '',
    power: template?.power,
    toughness: template?.toughness,
    colors: template?.colors ?? [],
    keywords: template?.keywords ?? [],
  };
}

/**
 * Convert a CardInstance on battlefield to PermanentData
 */
function serializePermanent(card: CardInstance, controller: PlayerId): PermanentData {
  const baseData = serializeCard(card);

  return {
    ...baseData,
    controller,
    tapped: card.tapped,
    summoningSick: card.summoningSick,
    damage: card.damage,
    attacking: card.attacking ?? false,
    blocking: card.blocking,
    counters: card.counters ?? {},
    attachments: card.attachments ?? [],
  };
}

/**
 * Convert ManaPool to client format
 */
function serializeManaPool(manaPool: {
  white: number;
  blue: number;
  black: number;
  red: number;
  green: number;
  colorless: number;
}): ManaPool {
  return {
    white: manaPool.white,
    blue: manaPool.blue,
    black: manaPool.black,
    red: manaPool.red,
    green: manaPool.green,
    colorless: manaPool.colorless,
  };
}

/**
 * Serialize the stack
 */
function serializeStack(state: GameState): StackItemData[] {
  return state.stack.map((stackObj) => ({
    id: stackObj.id,
    controller: stackObj.controller,
    card: serializeCard(stackObj.card),
    targets: stackObj.targets ?? [],
    description: getStackItemDescription(stackObj, state),
  }));
}

/**
 * Get a human-readable description for a stack item
 */
function getStackItemDescription(
  stackObj: { card: CardInstance; targets?: string[]; controller: PlayerId },
  state: GameState,
): string {
  const cardName = CardLoader.getById(stackObj.card.scryfallId)?.name ?? 'Unknown';
  const targets = stackObj.targets ?? [];

  if (targets.length === 0) {
    return cardName;
  }

  const targetNames = targets.map((targetId) => {
    if (targetId === 'player') return 'You';
    if (targetId === 'opponent') return 'Opponent';

    // Find card by instanceId
    for (const player of Object.values(state.players)) {
      for (const card of player.battlefield) {
        if (card.instanceId === targetId) {
          return CardLoader.getById(card.scryfallId)?.name ?? 'Unknown';
        }
      }
    }
    return targetId;
  });

  return `${cardName} targeting ${targetNames.join(', ')}`;
}

/**
 * Serialize legal actions with card instance IDs for UI
 */
export function serializeLegalActionsForClient(
  state: GameState,
  playerId: PlayerId = 'player',
): LegalActionData[] {
  const actions = getLegalActions(state, playerId);

  return actions.map((action, index): LegalActionData => {
    const result: LegalActionData = {
      index,
      type: action.type,
      description: describeAction(action, state),
    };

    // Extract card instance ID based on action type
    if (action.type === 'PLAY_LAND') {
      result.cardInstanceId = action.payload.cardInstanceId;
    } else if (action.type === 'CAST_SPELL') {
      result.cardInstanceId = action.payload.cardInstanceId;
      if (action.payload.targets) {
        result.targets = action.payload.targets;
      }
    } else if (action.type === 'ACTIVATE_ABILITY') {
      result.cardInstanceId = action.payload.sourceId;
      if (action.payload.targets) {
        result.targets = action.payload.targets;
      }
    } else if (action.type === 'DECLARE_ATTACKERS') {
      // For attackers, the first attacker is the "card"
      if (action.payload.attackers?.length > 0) {
        result.cardInstanceId = action.payload.attackers[0];
      }
    } else if (action.type === 'DECLARE_BLOCKERS') {
      // For blockers, the first blocker is the "card"
      if (action.payload.blocks?.length > 0) {
        result.cardInstanceId = action.payload.blocks[0]?.blockerId;
      }
    }

    return result;
  });
}

/**
 * Serialize full game state for web client
 */
export function serializeClientState(
  state: GameState,
  gameId: string = 'unknown',
): ClientGameState {
  const playerState = state.players.player;
  const opponentState = state.players.opponent;

  return {
    gameId,
    turn: state.turnCount,
    phase: state.phase,
    step: state.step ?? 'main',
    activePlayer: state.activePlayer,
    priorityPlayer: state.priorityPlayer,

    player: {
      life: playerState.life,
      hand: playerState.hand.map(serializeCard),
      battlefield: playerState.battlefield.map((card) => serializePermanent(card, 'player')),
      graveyard: playerState.graveyard.map(serializeCard),
      libraryCount: playerState.library.length,
      manaPool: serializeManaPool(playerState.manaPool),
    },

    opponent: {
      life: opponentState.life,
      handCount: opponentState.hand.length,
      battlefield: opponentState.battlefield.map((card) => serializePermanent(card, 'opponent')),
      graveyard: opponentState.graveyard.map(serializeCard),
      libraryCount: opponentState.library.length,
    },

    stack: serializeStack(state),
    gameOver: state.gameOver,
    winner: state.winner as 'player' | 'opponent' | null,
  };
}
