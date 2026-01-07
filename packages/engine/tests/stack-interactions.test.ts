import { describe, test, expect, beforeEach } from 'bun:test';
import {
  createGameState,
  applyAction,
  CardLoader,
  createCardInstance,
  getPlayer,
  type GameState,
  type CastSpellAction,
  type PassPriorityAction,
} from '../src/index';

describe('Stack Interactions', () => {
  let state: GameState;

  beforeEach(() => {
    // Setup basic state with islands/mountains
    const island = CardLoader.getByName('Island');
    const mountain = CardLoader.getByName('Mountain');

    if (!island || !mountain) throw new Error('Basic lands not found');

    const pDeck = Array(40)
      .fill(null)
      .map(() => createCardInstance(island.id, 'player', 'library'));
    const oDeck = Array(40)
      .fill(null)
      .map(() => createCardInstance(mountain.id, 'opponent', 'library'));

    state = createGameState(pDeck, oDeck);
  });

  test('Counterspell War: P Casts -> O Counters -> P Counters O', () => {
    const lightningBlast = CardLoader.getByName('Lightning Blast'); // {3}{R}
    const counterspell = CardLoader.getByName('Counterspell'); // {U}{U}
    const mountain = CardLoader.getByName('Mountain');
    const island = CardLoader.getByName('Island');

    if (!lightningBlast || !counterspell || !mountain || !island)
      throw new Error('Cards not found');

    const player = getPlayer(state, 'player');
    const opponent = getPlayer(state, 'opponent');

    // Setup Hands
    player.hand.push(createCardInstance(lightningBlast.id, 'player', 'hand'));
    player.hand.push(createCardInstance(counterspell.id, 'player', 'hand'));
    opponent.hand.push(createCardInstance(counterspell.id, 'opponent', 'hand'));

    // Setup Mana
    // Player needs 4R for Blast + 2U for Counter = 6 mana total (4 red sources, 2 blue)
    // Actually Blast is 3R. So 4 mana.
    // Let's just give infinite mana for simplicity
    for (let i = 0; i < 10; i++)
      player.battlefield.push(createCardInstance(mountain.id, 'player', 'battlefield'));
    for (let i = 0; i < 10; i++)
      player.battlefield.push(createCardInstance(island.id, 'player', 'battlefield'));
    for (let i = 0; i < 10; i++)
      opponent.battlefield.push(createCardInstance(island.id, 'opponent', 'battlefield'));

    state.phase = 'main1';

    // 1. Player casts Lightning Blast targeting Opponent
    const blastCard = player.hand.find((c) => c.scryfallId === lightningBlast.id);
    state = applyAction(state, {
      type: 'CAST_SPELL',
      playerId: 'player',
      payload: {
        cardInstanceId: blastCard!.instanceId,
        targets: ['opponent'],
      },
    });

    // Stack: [Blast]
    expect(state.stack.length).toBe(1);
    const blastStackId = state.stack[0].id;

    // 2. Opponent casts Counterspell targeting Blast
    const oCounterCard = opponent.hand.find((c) => c.scryfallId === counterspell.id);
    state = applyAction(state, {
      type: 'CAST_SPELL',
      playerId: 'opponent',
      payload: {
        cardInstanceId: oCounterCard!.instanceId,
        targets: [blastStackId],
      },
    });

    // Stack: [Blast, O-Counter]
    expect(state.stack.length).toBe(2);
    const oCounterStackId = state.stack[1].id;

    // 3. Player casts Counterspell targeting Opponent's Counterspell
    const pCounterCard = player.hand.find((c) => c.scryfallId === counterspell.id);
    state = applyAction(state, {
      type: 'CAST_SPELL',
      playerId: 'player',
      payload: {
        cardInstanceId: pCounterCard!.instanceId,
        targets: [oCounterStackId],
      },
    });

    // Stack: [Blast, O-Counter, P-Counter]
    expect(state.stack.length).toBe(3);

    // 4. Resolve P-Counter
    // Opponent passes
    state = applyAction(state, { type: 'PASS_PRIORITY', playerId: 'opponent', payload: {} });
    // Player passes
    state = applyAction(state, { type: 'PASS_PRIORITY', playerId: 'player', payload: {} });

    // P-Counter resolves, countering O-Counter but it stays on stack
    // Stack: [Blast, O-Counter (countered)]
    expect(state.stack.length).toBe(2);
    expect(state.stack[0].card.scryfallId).toBe(lightningBlast.id);
    expect(state.stack[1].countered).toBe(true);

    // 5. Resolve O-Counter (countered spell)
    // Both players pass to resolve the countered spell
    state = applyAction(state, { type: 'PASS_PRIORITY', playerId: 'player', payload: {} });
    state = applyAction(state, { type: 'PASS_PRIORITY', playerId: 'opponent', payload: {} });

    // O-Counter resolves as countered (no effect), removed from stack
    // Stack: [Blast]
    expect(state.stack.length).toBe(1);
    expect(state.stack[0].card.scryfallId).toBe(lightningBlast.id);

    // 6. Resolve Blast
    // Priority is with active player (player) after resolution
    state = applyAction(state, { type: 'PASS_PRIORITY', playerId: 'player', payload: {} });
    state = applyAction(state, { type: 'PASS_PRIORITY', playerId: 'opponent', payload: {} });

    // Refresh player ref
    const finalOpponent = getPlayer(state, 'opponent');

    // Blast resolves! Opponent takes 4 damage.
    expect(state.stack.length).toBe(0);
    expect(finalOpponent.life).toBe(16);
  });

  test('Spell Fizzles when target becomes illegal', () => {
    const shock = CardLoader.getByName('Shock') || CardLoader.getByName('Lightning Blast');
    const unsummon = CardLoader.getByName('Unsummon');
    const bears = CardLoader.getByName('Grizzly Bears');
    const island = CardLoader.getByName('Island');
    const mountain = CardLoader.getByName('Mountain');

    if (!shock || !unsummon || !bears || !island || !mountain) throw new Error('Cards not found');

    const player = getPlayer(state, 'player');
    const opponent = getPlayer(state, 'opponent');

    // Setup: Opponent has a Bear
    opponent.battlefield.push(createCardInstance(bears.id, 'opponent', 'battlefield'));
    const bearId = opponent.battlefield[0].instanceId;

    // Player Hand: Shock
    player.hand.push(createCardInstance(shock.id, 'player', 'hand'));

    // Opponent Hand: Unsummon
    opponent.hand.push(createCardInstance(unsummon.id, 'opponent', 'hand'));

    // Mana
    for (let i = 0; i < 5; i++)
      player.battlefield.push(createCardInstance(mountain.id, 'player', 'battlefield'));
    for (let i = 0; i < 5; i++)
      opponent.battlefield.push(createCardInstance(island.id, 'opponent', 'battlefield'));

    state.phase = 'main1';

    // 1. Player casts Shock targeting Bear
    const shockCard = player.hand[0];
    state = applyAction(state, {
      type: 'CAST_SPELL',
      playerId: 'player',
      payload: {
        cardInstanceId: shockCard.instanceId,
        targets: [bearId],
      },
    });

    // 2. Opponent casts Unsummon targeting Bear (saving it)
    const unsummonCard = opponent.hand[0];
    state = applyAction(state, {
      type: 'CAST_SPELL',
      playerId: 'opponent',
      payload: {
        cardInstanceId: unsummonCard.instanceId,
        targets: [bearId],
      },
    });

    // Stack: [Shock, Unsummon]

    // 3. Resolve Unsummon
    state = applyAction(state, { type: 'PASS_PRIORITY', playerId: 'player', payload: {} });
    state = applyAction(state, { type: 'PASS_PRIORITY', playerId: 'opponent', payload: {} });

    // Refresh opponent ref
    const finalOpponent = getPlayer(state, 'opponent');
    const finalPlayer = getPlayer(state, 'player');

    // Bear returned to hand.
    expect(finalOpponent.battlefield.length).toBe(5); // Just lands
    expect(finalOpponent.hand.length).toBe(1); // Bear is back (was empty before, unsummon used, bear returned)
    // Actually Unsummon goes to GY, Bear goes to Hand.

    // 4. Resolve Shock
    // Target (bearId) is no longer on battlefield.
    state = applyAction(state, { type: 'PASS_PRIORITY', playerId: 'opponent', payload: {} });
    state = applyAction(state, { type: 'PASS_PRIORITY', playerId: 'player', payload: {} });

    // Refresh refs again after Shock resolve
    const finalPlayerAfterShock = getPlayer(state, 'player');

    // Shock should fizzle (go to GY, no damage dealt).
    expect(state.stack.length).toBe(0);
    // How to verify fizzle?
    // If it hit, it might have errored (trying to deal damage to non-existent permanent) or done nothing.
    // If we had a life total target, we could check life.
    // But since target was creature, main check is "did it crash" and "is it gone".

    // Verify Shock is in GY
    expect(finalPlayerAfterShock.graveyard.length).toBe(1);
    expect(finalPlayerAfterShock.graveyard[0].scryfallId).toBe(shock.id);
  });
});
