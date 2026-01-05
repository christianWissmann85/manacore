import { describe, test, expect, beforeEach } from 'bun:test';
import {
  createGameState,
  applyAction,
  CardLoader,
  createCardInstance,
  getPlayer,
  type GameState,
  checkStateBasedActions,
  addTemporaryModification,
} from '../src/index';

describe('State-Based Actions (SBAs)', () => {
  let state: GameState;

  beforeEach(() => {
    // Basic setup
    const bears = CardLoader.getByName('Grizzly Bears'); // 2/2
    const giantGrowth = CardLoader.getByName('Giant Growth'); // +3/+3

    if (!bears || !giantGrowth) throw new Error('Cards not found');

    // Create minimal valid state
    state = createGameState([], []);
  });

  test('Creature dies from lethal damage', () => {
    const bears = CardLoader.getByName('Grizzly Bears')!;
    const player = getPlayer(state, 'player');

    // Add bear to battlefield
    const bearCard = createCardInstance(bears.id, 'player', 'battlefield');
    player.battlefield.push(bearCard);

    // Apply 2 damage (equal to toughness)
    bearCard.damage = 2;

    // Run SBAs manually (usually run by reducer)
    const performed = checkStateBasedActions(state);

    expect(performed).toBe(true);
    expect(player.battlefield.length).toBe(0);
    expect(player.graveyard.length).toBe(1);
    expect(player.graveyard[0].instanceId).toBe(bearCard.instanceId);
  });

  test('Creature dies from zero toughness', () => {
    const bears = CardLoader.getByName('Grizzly Bears')!;
    const player = getPlayer(state, 'player');

    // Add bear to battlefield
    const bearCard = createCardInstance(bears.id, 'player', 'battlefield');
    player.battlefield.push(bearCard);

    // Apply -2/-2 effect
    addTemporaryModification(bearCard, -2, -2, 'end_of_turn');

    // Run SBAs
    const performed = checkStateBasedActions(state);

    expect(performed).toBe(true);
    expect(player.battlefield.length).toBe(0);
    expect(player.graveyard.length).toBe(1);
  });

  test('Regeneration saves creature from lethal damage', () => {
    const bears = CardLoader.getByName('Grizzly Bears')!;
    const player = getPlayer(state, 'player');

    const bearCard = createCardInstance(bears.id, 'player', 'battlefield');
    player.battlefield.push(bearCard);

    // Add regen shield
    bearCard.regenerationShields = 1;
    bearCard.tapped = false; // Untapped initially

    // Apply lethal damage
    bearCard.damage = 5;

    // Run SBAs
    const performed = checkStateBasedActions(state);

    expect(performed).toBe(true);
    expect(player.battlefield.length).toBe(1); // Still there
    expect(player.graveyard.length).toBe(0);

    // Check regeneration side effects
    expect(bearCard.damage).toBe(0); // Damage removed
    expect(bearCard.tapped).toBe(true); // Tapped
    expect(bearCard.regenerationShields).toBe(0); // Shield used
  });

  test('Regeneration does NOT save from zero toughness', () => {
    const bears = CardLoader.getByName('Grizzly Bears')!;
    const player = getPlayer(state, 'player');

    const bearCard = createCardInstance(bears.id, 'player', 'battlefield');
    player.battlefield.push(bearCard);

    // Add regen shield
    bearCard.regenerationShields = 1;

    // Apply -2/-2 effect (toughness becomes 0)
    addTemporaryModification(bearCard, -2, -2, 'end_of_turn');

    // Run SBAs
    const performed = checkStateBasedActions(state);

    expect(performed).toBe(true);
    expect(player.battlefield.length).toBe(0); // Died
    expect(player.graveyard.length).toBe(1);
  });

  test('Player loses game when life <= 0', () => {
    const player = getPlayer(state, 'player');
    player.life = 0;

    const performed = checkStateBasedActions(state);

    expect(performed).toBe(true);
    expect(state.gameOver).toBe(true);
    expect(state.winner).toBe('opponent');
  });

  test('Unattached Aura goes to graveyard', () => {
    const aura = CardLoader.getByName('Holy Strength') || CardLoader.getByName('Fear');
    // Just create a dummy aura if needed, but lets assume Holy Strength {W} Aura
    // If not found, skip or mock

    if (!aura) {
      // Mock check manually if card not found
      console.warn('Skipping Aura test - card not found');
      return;
    }

    const player = getPlayer(state, 'player');
    const auraCard = createCardInstance(aura.id, 'player', 'battlefield');

    // Set type line manually if needed, but Loader should handle it
    // auraCard attachedTo is undefined

    player.battlefield.push(auraCard);

    const performed = checkStateBasedActions(state);

    expect(performed).toBe(true);
    expect(player.battlefield.length).toBe(0);
    expect(player.graveyard.length).toBe(1);
  });
});
