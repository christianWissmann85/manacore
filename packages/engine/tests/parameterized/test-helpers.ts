/**
 * Parameterized Test Helpers
 *
 * Reusable helper functions for parameterized card tests.
 * These helpers reduce boilerplate and ensure consistent test setup.
 */

import {
  CardLoader,
  createCardInstance,
  createGameState,
  applyAction,
  validateAction,
  type GameState,
  type CardInstance,
  type CastSpellAction,
  type PassPriorityAction,
  hasFlying,
  hasFirstStrike,
  hasVigilance,
  hasReach,
  hasHaste,
  hasDefender,
  hasFear,
  hasMenace,
  hasSwampwalk,
  hasIslandwalk,
  hasForestwalk,
  hasMountainwalk,
  hasPlainswalk,
  isCreature,
  isLand,
} from '../../src/index';

// ============================================
// MANA CONFIGURATION TYPE
// ============================================

export type ManaConfig = {
  W?: number;
  U?: number;
  B?: number;
  R?: number;
  G?: number;
};

// ============================================
// GAME STATE SETUP HELPERS
// ============================================

/**
 * Create a basic game state with empty libraries
 */
export function createBasicGameState(): GameState {
  const plains = CardLoader.getByName('Plains')!;
  return createGameState(
    [createCardInstance(plains.id, 'player', 'library')],
    [createCardInstance(plains.id, 'opponent', 'library')],
  );
}

/**
 * Create a game state with specified mana sources on battlefield
 */
export function setupGameWithMana(
  playerMana: ManaConfig = {},
  opponentMana: ManaConfig = {},
): GameState {
  const landMap = {
    W: CardLoader.getByName('Plains')!,
    U: CardLoader.getByName('Island')!,
    B: CardLoader.getByName('Swamp')!,
    R: CardLoader.getByName('Mountain')!,
    G: CardLoader.getByName('Forest')!,
  };

  const state = createBasicGameState();
  state.phase = 'main1';
  state.step = 'main';

  // Add player's mana sources
  for (const [color, count] of Object.entries(playerMana)) {
    const land = landMap[color as keyof typeof landMap];
    for (let i = 0; i < (count ?? 0); i++) {
      state.players.player.battlefield.push(
        createCardInstance(land.id, 'player', 'battlefield'),
      );
    }
  }

  // Add opponent's mana sources
  for (const [color, count] of Object.entries(opponentMana)) {
    const land = landMap[color as keyof typeof landMap];
    for (let i = 0; i < (count ?? 0); i++) {
      state.players.opponent.battlefield.push(
        createCardInstance(land.id, 'opponent', 'battlefield'),
      );
    }
  }

  return state;
}

/**
 * Setup game state for blocking scenarios
 */
export function setupBlockingState(
  playerMana: ManaConfig = {},
  opponentMana: ManaConfig = {},
): GameState {
  const state = setupGameWithMana(playerMana, opponentMana);
  state.step = 'declare_blockers';
  state.activePlayer = 'player';
  state.priorityPlayer = 'opponent';
  return state;
}

// ============================================
// CARD CREATION HELPERS
// ============================================

/**
 * Create a creature on the battlefield (not summoning sick, ready to attack)
 */
export function createCreatureOnBattlefield(
  state: GameState,
  cardName: string,
  controller: 'player' | 'opponent',
  options: { summoningSick?: boolean; attacking?: boolean; tapped?: boolean } = {},
): CardInstance {
  const template = CardLoader.getByName(cardName);
  if (!template) {
    throw new Error(`Card not found: ${cardName}`);
  }

  const card = createCardInstance(template.id, controller, 'battlefield');
  card.summoningSick = options.summoningSick ?? false;
  card.attacking = options.attacking ?? false;
  card.tapped = options.tapped ?? false;

  state.players[controller].battlefield.push(card);
  return card;
}

/**
 * Create a card in a player's hand
 */
export function createCardInHand(
  state: GameState,
  cardName: string,
  controller: 'player' | 'opponent',
): CardInstance {
  const template = CardLoader.getByName(cardName);
  if (!template) {
    throw new Error(`Card not found: ${cardName}`);
  }

  const card = createCardInstance(template.id, controller, 'hand');
  state.players[controller].hand.push(card);
  return card;
}

/**
 * Create a card in a player's graveyard
 */
export function createCardInGraveyard(
  state: GameState,
  cardName: string,
  controller: 'player' | 'opponent',
): CardInstance {
  const template = CardLoader.getByName(cardName);
  if (!template) {
    throw new Error(`Card not found: ${cardName}`);
  }

  const card = createCardInstance(template.id, controller, 'graveyard');
  state.players[controller].graveyard.push(card);
  return card;
}

/**
 * Add a land to a player's battlefield
 */
export function addLandToBattlefield(
  state: GameState,
  landName: string,
  controller: 'player' | 'opponent',
): CardInstance {
  const template = CardLoader.getByName(landName);
  if (!template) {
    throw new Error(`Land not found: ${landName}`);
  }

  const card = createCardInstance(template.id, controller, 'battlefield');
  state.players[controller].battlefield.push(card);
  return card;
}

// ============================================
// SPELL CASTING HELPERS
// ============================================

/**
 * Cast a spell and resolve it (both players pass priority)
 */
export function castAndResolve(
  state: GameState,
  playerId: 'player' | 'opponent',
  cardInstanceId: string,
  targets?: string[],
  xValue?: number,
): GameState {
  // Cast the spell
  let newState = applyAction(state, {
    type: 'CAST_SPELL',
    playerId,
    payload: { cardInstanceId, targets, xValue },
  } as CastSpellAction);

  // Both players pass priority to resolve
  newState = applyAction(newState, {
    type: 'PASS_PRIORITY',
    playerId: 'opponent',
    payload: {},
  } as PassPriorityAction);

  newState = applyAction(newState, {
    type: 'PASS_PRIORITY',
    playerId: 'player',
    payload: {},
  } as PassPriorityAction);

  return newState;
}

// ============================================
// COMBAT HELPERS
// ============================================

/**
 * Declare attackers and get the resulting state
 */
export function declareAttackers(
  state: GameState,
  attackerIds: string[],
): GameState {
  return applyAction(state, {
    type: 'DECLARE_ATTACKERS',
    playerId: 'player',
    payload: { attackers: attackerIds },
  });
}

/**
 * Declare blockers and get the resulting state
 */
export function declareBlockers(
  state: GameState,
  blocks: Array<{ blockerId: string; attackerId: string }>,
): GameState {
  return applyAction(state, {
    type: 'DECLARE_BLOCKERS',
    playerId: 'opponent',
    payload: { blocks },
  });
}

/**
 * Perform a full combat with attacker going unblocked
 */
export function performUnblockedAttack(
  state: GameState,
  attackerIds: string[],
): GameState {
  let newState = declareAttackers(state, attackerIds);
  newState = declareBlockers(newState, []);
  return newState;
}

/**
 * Validate if a blocking declaration would be legal
 */
export function validateBlocking(
  state: GameState,
  blocks: Array<{ blockerId: string; attackerId: string }>,
): string[] {
  return validateAction(state, {
    type: 'DECLARE_BLOCKERS',
    playerId: 'opponent',
    payload: { blocks },
  });
}

// ============================================
// KEYWORD CHECK HELPERS
// ============================================

/**
 * Map of keyword names to their checker functions
 */
export const keywordCheckers: Record<string, (card: any) => boolean> = {
  Flying: hasFlying,
  'First strike': hasFirstStrike,
  Vigilance: hasVigilance,
  Reach: hasReach,
  Haste: hasHaste,
  Defender: hasDefender,
  Fear: hasFear,
  Menace: hasMenace,
  Swampwalk: hasSwampwalk,
  Islandwalk: hasIslandwalk,
  Forestwalk: hasForestwalk,
  Mountainwalk: hasMountainwalk,
  Plainswalk: hasPlainswalk,
};

/**
 * Check if a card has a specific keyword using the appropriate helper
 */
export function checkKeyword(cardName: string, keyword: string): boolean {
  const card = CardLoader.getByName(cardName);
  if (!card) return false;

  const checker = keywordCheckers[keyword];
  if (checker) {
    return checker(card);
  }

  // Fallback to checking keywords array directly
  return card.keywords?.includes(keyword) ?? false;
}

// ============================================
// ASSERTION HELPERS
// ============================================

/**
 * Check if a card exists on a player's battlefield
 */
export function isOnBattlefield(
  state: GameState,
  instanceId: string,
  controller: 'player' | 'opponent',
): boolean {
  return state.players[controller].battlefield.some(
    (c) => c.instanceId === instanceId,
  );
}

/**
 * Check if a card is in a player's graveyard
 */
export function isInGraveyard(
  state: GameState,
  instanceId: string,
  controller: 'player' | 'opponent',
): boolean {
  return state.players[controller].graveyard.some(
    (c) => c.instanceId === instanceId,
  );
}

/**
 * Check if a card is in a player's hand
 */
export function isInHand(
  state: GameState,
  instanceId: string,
  controller: 'player' | 'opponent',
): boolean {
  return state.players[controller].hand.some(
    (c) => c.instanceId === instanceId,
  );
}

/**
 * Get the card instance on the battlefield
 */
export function getCreatureOnBattlefield(
  state: GameState,
  instanceId: string,
  controller: 'player' | 'opponent',
): CardInstance | undefined {
  return state.players[controller].battlefield.find(
    (c) => c.instanceId === instanceId,
  );
}

// ============================================
// CARD DATA HELPERS
// ============================================

/**
 * Get a card template by name (throws if not found)
 */
export function getCard(cardName: string) {
  const card = CardLoader.getByName(cardName);
  if (!card) {
    throw new Error(`Card not found: ${cardName}`);
  }
  return card;
}

/**
 * Check if a card exists in the card database
 */
export function cardExists(cardName: string): boolean {
  return CardLoader.getByName(cardName) !== undefined;
}

/**
 * Get all creatures from the card database
 */
export function getAllCreatures() {
  return CardLoader.getAllCards().filter(isCreature);
}

/**
 * Get all lands from the card database
 */
export function getAllLands() {
  return CardLoader.getAllCards().filter(isLand);
}
