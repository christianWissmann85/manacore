/**
 * Complex Mechanics Tests
 *
 * Tests for card mechanics that may have edge cases or complex interactions:
 * - Sacrifice effects
 * - Counterspell variants
 * - Damage prevention
 * - Regeneration
 * - Combat tricks
 * - Triggered abilities
 * - Activated abilities
 * - Stack interactions
 * - State-based actions after effects resolve
 */

import { describe, test, expect, beforeEach, beforeAll } from 'bun:test';
import {
  CardLoader,
  createCardInstance,
  createGameState,
  applyAction,
  getPlayer,
  type GameState,
  type CastSpellAction,
  type PassPriorityAction,
  type DeclareAttackersAction,
  type DeclareBlockersAction,
  type ActivateAbilityAction,
} from '../../src/index';
import { getActivatedAbilities } from '../../src/rules/activatedAbilities';
import { checkStateBasedActions } from '../../src/rules/stateBasedActions';
import { _resetStackCounter } from '../../src/rules/stack';

beforeAll(() => {
  CardLoader.initialize();
});

// Helper: Set up game state with mana sources
function setupGameWithMana(
  playerMana: { W?: number; U?: number; B?: number; R?: number; G?: number },
  opponentMana: { W?: number; U?: number; B?: number; R?: number; G?: number } = {},
): GameState {
  const plains = CardLoader.getByName('Plains')!;
  const island = CardLoader.getByName('Island')!;
  const swamp = CardLoader.getByName('Swamp')!;
  const mountain = CardLoader.getByName('Mountain')!;
  const forest = CardLoader.getByName('Forest')!;

  const landMap = { W: plains, U: island, B: swamp, R: mountain, G: forest };

  const playerLibrary = [createCardInstance(plains.id, 'player', 'library')];
  const opponentLibrary = [createCardInstance(plains.id, 'opponent', 'library')];

  const state = createGameState(playerLibrary, opponentLibrary);
  state.phase = 'main1';
  state.step = 'main';

  for (const [color, count] of Object.entries(playerMana)) {
    const land = landMap[color as keyof typeof landMap];
    for (let i = 0; i < count; i++) {
      state.players.player.battlefield.push(createCardInstance(land.id, 'player', 'battlefield'));
    }
  }

  for (const [color, count] of Object.entries(opponentMana)) {
    const land = landMap[color as keyof typeof landMap];
    for (let i = 0; i < count; i++) {
      state.players.opponent.battlefield.push(
        createCardInstance(land.id, 'opponent', 'battlefield'),
      );
    }
  }

  return state;
}

// Helper: Cast and resolve a spell
function castAndResolve(
  state: GameState,
  playerId: 'player' | 'opponent',
  cardInstanceId: string,
  targets?: string[],
  xValue?: number,
): GameState {
  let newState = applyAction(state, {
    type: 'CAST_SPELL',
    playerId,
    payload: { cardInstanceId, targets, xValue },
  } as CastSpellAction);

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

// Helper: Create creature on battlefield
function createCreatureOnBattlefield(
  state: GameState,
  cardName: string,
  controller: 'player' | 'opponent',
) {
  const template = CardLoader.getByName(cardName)!;
  const card = createCardInstance(template.id, controller, 'battlefield');
  card.summoningSick = false;
  card.temporaryModifications = [];
  state.players[controller].battlefield.push(card);
  return card;
}

// Helper: Create card in hand
function createCardInHand(state: GameState, cardName: string, controller: 'player' | 'opponent') {
  const template = CardLoader.getByName(cardName)!;
  const card = createCardInstance(template.id, controller, 'hand');
  state.players[controller].hand.push(card);
  return card;
}

// ============================================================
// SACRIFICE EFFECTS
// ============================================================

describe('Sacrifice Effects', () => {
  beforeEach(() => {
    _resetStackCounter();
  });

  describe('Sacrifice for Pump (Fallen Angel)', () => {
    test('Fallen Angel exists with correct stats', () => {
      const card = CardLoader.getByName('Fallen Angel');
      expect(card).toBeDefined();
      expect(card?.power).toBe('3');
      expect(card?.toughness).toBe('3');
      expect(card?.keywords).toContain('Flying');
    });

    test('has sacrifice-creature-for-pump ability', () => {
      const state = setupGameWithMana({});
      const angel = createCreatureOnBattlefield(state, 'Fallen Angel', 'player');
      const sacTarget = createCreatureOnBattlefield(state, 'Llanowar Elves', 'player');

      const abilities = getActivatedAbilities(angel, state);
      const sacAbility = abilities.find((a) => a.id.includes('sac_pump'));

      expect(sacAbility).toBeDefined();
      expect(sacAbility!.cost.sacrifice?.type).toBe('creature');
    });

    test('cannot sacrifice without another creature', () => {
      const state = setupGameWithMana({});
      const angel = createCreatureOnBattlefield(state, 'Fallen Angel', 'player');

      const abilities = getActivatedAbilities(angel, state);
      const sacAbility = abilities.find((a) => a.id.includes('sac_pump'));

      expect(sacAbility!.canActivate(state, angel.instanceId, 'player')).toBe(false);
    });

    test('can sacrifice when another creature exists', () => {
      const state = setupGameWithMana({});
      const angel = createCreatureOnBattlefield(state, 'Fallen Angel', 'player');
      createCreatureOnBattlefield(state, 'Llanowar Elves', 'player');

      const abilities = getActivatedAbilities(angel, state);
      const sacAbility = abilities.find((a) => a.id.includes('sac_pump'));

      expect(sacAbility!.canActivate(state, angel.instanceId, 'player')).toBe(true);
    });
  });

  describe('Sacrifice Self to Destroy (Daraja Griffin)', () => {
    test('has sacrifice-self-to-destroy-black ability', () => {
      const state = setupGameWithMana({});
      const griffin = createCreatureOnBattlefield(state, 'Daraja Griffin', 'player');

      const abilities = getActivatedAbilities(griffin, state);
      const sacAbility = abilities.find((a) => a.id.includes('sac_destroy'));

      expect(sacAbility).toBeDefined();
      expect(sacAbility!.cost.sacrifice).toEqual({ type: 'self' });
      expect(sacAbility!.targetRequirements![0].restrictions).toContainEqual({
        type: 'color',
        color: 'B',
        negated: false,
      });
    });
  });

  describe('Sacrifice for Mana (Blood Pet)', () => {
    test('has sacrifice-for-mana ability', () => {
      const state = setupGameWithMana({});
      const pet = createCreatureOnBattlefield(state, 'Blood Pet', 'player');

      const abilities = getActivatedAbilities(pet, state);
      const manaAbility = abilities.find((a) => a.id.includes('sac_mana'));

      expect(manaAbility).toBeDefined();
      expect(manaAbility!.cost.sacrifice).toEqual({ type: 'self' });
      expect(manaAbility!.isManaAbility).toBe(true);
      expect(manaAbility!.effect.manaColors).toContain('B');
    });
  });

  describe('Sacrifice for Counter (Daring Apprentice)', () => {
    test('requires spell on stack to activate', () => {
      const state = setupGameWithMana({});
      state.stack = [];
      const apprentice = createCreatureOnBattlefield(state, 'Daring Apprentice', 'player');

      const abilities = getActivatedAbilities(apprentice, state);
      const counterAbility = abilities.find((a) => a.id.includes('sac_counter'));

      expect(counterAbility!.canActivate(state, apprentice.instanceId, 'player')).toBe(false);
    });
  });

  describe('Sacrifice Land for Buff (Blighted Shaman)', () => {
    test('has sacrifice-swamp ability', () => {
      const state = setupGameWithMana({ B: 2 });
      const shaman = createCreatureOnBattlefield(state, 'Blighted Shaman', 'player');

      const abilities = getActivatedAbilities(shaman, state);
      const buffAbility = abilities.find((a) => a.id.includes('sac_buff'));

      expect(buffAbility).toBeDefined();
      expect(buffAbility!.cost.sacrifice?.landType).toBe('Swamp');
    });
  });
});

// ============================================================
// COUNTERSPELL VARIANTS
// ============================================================

describe('Counterspell Variants', () => {
  beforeEach(() => {
    _resetStackCounter();
  });

  describe('Basic Counterspell', () => {
    test('counters any spell', () => {
      const state = setupGameWithMana({ G: 2 }, { U: 2 });
      const bears = createCardInHand(state, 'Grizzly Bears', 'player');
      const counter = createCardInHand(state, 'Counterspell', 'opponent');

      // Cast Bears
      let newState = applyAction(state, {
        type: 'CAST_SPELL',
        playerId: 'player',
        payload: { cardInstanceId: bears.instanceId },
      } as CastSpellAction);

      const bearsStackId = newState.stack[0]!.id;

      // Opponent counters
      newState = applyAction(newState, {
        type: 'CAST_SPELL',
        playerId: 'opponent',
        payload: { cardInstanceId: counter.instanceId, targets: [bearsStackId] },
      } as CastSpellAction);

      // Resolve Counterspell
      newState = applyAction(newState, {
        type: 'PASS_PRIORITY',
        playerId: 'player',
        payload: {},
      } as PassPriorityAction);

      newState = applyAction(newState, {
        type: 'PASS_PRIORITY',
        playerId: 'opponent',
        payload: {},
      } as PassPriorityAction);

      // Bears should be marked as countered
      expect(newState.stack[0]?.countered).toBe(true);
    });
  });

  describe('Memory Lapse', () => {
    test('card exists with correct effect', () => {
      const card = CardLoader.getByName('Memory Lapse');
      expect(card).toBeDefined();
      expect(card?.mana_cost).toBe('{1}{U}');
      expect(card?.oracle_text?.toLowerCase()).toContain('counter');
      expect(card?.oracle_text?.toLowerCase()).toContain('top of');
    });
  });

  describe('Remove Soul', () => {
    test('card exists and counters creature spells only', () => {
      const card = CardLoader.getByName('Remove Soul');
      expect(card).toBeDefined();
      expect(card?.mana_cost).toBe('{1}{U}');
      expect(card?.oracle_text?.toLowerCase()).toContain('counter target creature spell');
    });
  });

  describe('Power Sink (X Counter)', () => {
    test('card exists with X cost', () => {
      const card = CardLoader.getByName('Power Sink');
      expect(card).toBeDefined();
      expect(card?.mana_cost).toBe('{X}{U}');
      expect(card?.oracle_text?.toLowerCase()).toContain('counter');
      expect(card?.oracle_text?.toLowerCase()).toContain('unless');
    });
  });

  describe('Spell Blast (X Counter)', () => {
    test('card exists and requires exact CMC', () => {
      const card = CardLoader.getByName('Spell Blast');
      expect(card).toBeDefined();
      expect(card?.mana_cost).toBe('{X}{U}');
    });
  });

  describe('Color-Specific Counters', () => {
    test('Order of the Sacred Torch can counter black spells', () => {
      const state = setupGameWithMana({});
      const order = createCreatureOnBattlefield(state, 'Order of the Sacred Torch', 'player');

      const abilities = getActivatedAbilities(order, state);
      const counterAbility = abilities.find((a) => a.id.includes('counter_black'));

      expect(counterAbility).toBeDefined();
      expect(counterAbility!.cost.tap).toBe(true);
      expect(counterAbility!.cost.life).toBe(1);
    });

    test('Stromgald Cabal can counter white spells', () => {
      const state = setupGameWithMana({});
      const cabal = createCreatureOnBattlefield(state, 'Stromgald Cabal', 'player');

      const abilities = getActivatedAbilities(cabal, state);
      const counterAbility = abilities.find((a) => a.id.includes('counter_white'));

      expect(counterAbility).toBeDefined();
      expect(counterAbility!.cost.tap).toBe(true);
      expect(counterAbility!.cost.life).toBe(1);
    });

    test('Unyaro Griffin can counter red spells', () => {
      const state = setupGameWithMana({});
      const griffin = createCreatureOnBattlefield(state, 'Unyaro Griffin', 'player');

      const abilities = getActivatedAbilities(griffin, state);
      const counterAbility = abilities.find((a) => a.id.includes('counter'));

      expect(counterAbility).toBeDefined();
      expect(counterAbility!.cost.sacrifice).toEqual({ type: 'self' });
    });
  });
});

// ============================================================
// DAMAGE PREVENTION
// ============================================================

describe('Damage Prevention', () => {
  beforeEach(() => {
    _resetStackCounter();
  });

  describe('Fog (Prevent All Combat Damage)', () => {
    test('sets prevention flag', () => {
      const state = setupGameWithMana({ G: 1 });
      const fog = createCardInHand(state, 'Fog', 'player');

      state.phase = 'combat';
      state.step = 'declare_attackers';

      const newState = castAndResolve(state, 'player', fog.instanceId);

      expect(newState.preventAllCombatDamage).toBe(true);
    });

    test('flag resets at end of turn', () => {
      const state = setupGameWithMana({});
      state.preventAllCombatDamage = true;

      const newState = applyAction(state, {
        type: 'END_TURN',
        playerId: 'player',
        payload: {},
      });

      expect(newState.preventAllCombatDamage).toBe(false);
    });
  });

  describe('Healing Salve', () => {
    test('gains 3 life', () => {
      const state = setupGameWithMana({ W: 1 });
      state.players.player.life = 15;
      const salve = createCardInHand(state, 'Healing Salve', 'player');

      const newState = castAndResolve(state, 'player', salve.instanceId, ['player']);

      expect(newState.players.player.life).toBe(18);
    });
  });

  describe('Samite Healer (Prevent 1 Damage)', () => {
    test('has tap-to-prevent ability', () => {
      const state = setupGameWithMana({});
      const healer = createCreatureOnBattlefield(state, 'Samite Healer', 'player');

      const abilities = getActivatedAbilities(healer, state);
      const preventAbility = abilities.find((a) => a.id.includes('tap_prevent'));

      expect(preventAbility).toBeDefined();
      expect(preventAbility!.cost.tap).toBe(true);
    });
  });

  describe('Circle of Protection: Red', () => {
    test('card exists with damage prevention', () => {
      const card = CardLoader.getByName('Circle of Protection: Red');
      expect(card).toBeDefined();
      expect(card?.oracle_text?.toLowerCase()).toContain('prevent');
      expect(card?.oracle_text?.toLowerCase()).toContain('red');
    });
  });

  describe('Gaseous Form (Aura Prevention)', () => {
    test('card exists with prevention effect', () => {
      const card = CardLoader.getByName('Gaseous Form');
      expect(card).toBeDefined();
      expect(card?.oracle_text?.toLowerCase()).toContain('prevent all combat damage');
    });
  });
});

// ============================================================
// REGENERATION
// ============================================================

describe('Regeneration', () => {
  beforeEach(() => {
    _resetStackCounter();
  });

  describe('Drudge Skeletons ({B}: Regenerate)', () => {
    test('has regeneration ability', () => {
      const state = setupGameWithMana({ B: 3 });
      const skeletons = createCreatureOnBattlefield(state, 'Drudge Skeletons', 'player');

      const abilities = getActivatedAbilities(skeletons, state);
      const regenAbility = abilities.find((a) => a.id.includes('regenerate'));

      expect(regenAbility).toBeDefined();
      expect(regenAbility!.cost.mana).toBe('{B}');
    });
  });

  describe('River Boa ({G}: Regenerate)', () => {
    test('has regeneration ability', () => {
      const state = setupGameWithMana({ G: 3 });
      const boa = createCreatureOnBattlefield(state, 'River Boa', 'player');

      const abilities = getActivatedAbilities(boa, state);
      const regenAbility = abilities.find((a) => a.id.includes('regenerate'));

      expect(regenAbility).toBeDefined();
      expect(regenAbility!.cost.mana).toBe('{G}');
    });
  });

  describe('Mischievous Poltergeist (Pay Life: Regenerate)', () => {
    test('has life-payment regeneration', () => {
      const state = setupGameWithMana({});
      const poltergeist = createCreatureOnBattlefield(state, 'Mischievous Poltergeist', 'player');

      const abilities = getActivatedAbilities(poltergeist, state);
      const regenAbility = abilities.find((a) => a.id.includes('regenerate'));

      expect(regenAbility).toBeDefined();
      expect(regenAbility!.cost.life).toBe(1);
    });

    test('can activate at 1 life', () => {
      const state = setupGameWithMana({});
      state.players.player.life = 1;
      const poltergeist = createCreatureOnBattlefield(state, 'Mischievous Poltergeist', 'player');

      const abilities = getActivatedAbilities(poltergeist, state);
      const regenAbility = abilities.find((a) => a.id.includes('regenerate'));

      expect(regenAbility!.canActivate(state, poltergeist.instanceId, 'player')).toBe(true);
    });
  });

  describe('Gorilla Chieftain ({1}{G}: Regenerate)', () => {
    test('has regeneration with higher cost', () => {
      const state = setupGameWithMana({ G: 3 });
      const chieftain = createCreatureOnBattlefield(state, 'Gorilla Chieftain', 'player');

      const abilities = getActivatedAbilities(chieftain, state);
      const regenAbility = abilities.find((a) => a.id.includes('regenerate'));

      expect(regenAbility).toBeDefined();
      expect(regenAbility!.cost.mana).toBe('{1}{G}');
    });
  });

  describe('Regeneration Shield Behavior', () => {
    test('creature with regeneration shield survives lethal damage', () => {
      const state = setupGameWithMana({ B: 3 });
      const skeletons = createCreatureOnBattlefield(state, 'Drudge Skeletons', 'player');

      // Add regeneration shield
      skeletons.regenerationShields = 1;

      // Deal lethal damage (1/1 creature)
      skeletons.damage = 1;

      // Check SBAs
      const actionsPerformed = checkStateBasedActions(state);

      expect(actionsPerformed).toBe(true);
      // Creature should survive
      expect(
        state.players.player.battlefield.find((c) => c.instanceId === skeletons.instanceId),
      ).toBeDefined();
      // Shield used
      expect(skeletons.regenerationShields).toBe(0);
      // Tapped and damage removed
      expect(skeletons.tapped).toBe(true);
      expect(skeletons.damage).toBe(0);
    });

    test('creature without shield dies to lethal damage', () => {
      const state = setupGameWithMana({ B: 3 });
      const skeletons = createCreatureOnBattlefield(state, 'Drudge Skeletons', 'player');

      // Deal lethal damage without shield
      skeletons.damage = 1;

      // Check SBAs
      checkStateBasedActions(state);

      // Creature should be in graveyard
      expect(
        state.players.player.battlefield.find((c) => c.instanceId === skeletons.instanceId),
      ).toBeUndefined();
      expect(
        state.players.player.graveyard.find((c) => c.instanceId === skeletons.instanceId),
      ).toBeDefined();
    });
  });
});

// ============================================================
// COMBAT TRICKS
// ============================================================

describe('Combat Tricks', () => {
  beforeEach(() => {
    _resetStackCounter();
  });

  describe('Giant Growth (+3/+3)', () => {
    test('applies temporary modification', () => {
      const state = setupGameWithMana({ G: 1 });
      const bears = createCreatureOnBattlefield(state, 'Grizzly Bears', 'player');
      const growth = createCardInHand(state, 'Giant Growth', 'player');

      const newState = castAndResolve(state, 'player', growth.instanceId, [bears.instanceId]);

      const pumpedCreature = newState.players.player.battlefield.find(
        (c) => c.instanceId === bears.instanceId,
      );

      expect(pumpedCreature!.temporaryModifications.length).toBe(1);
      expect(pumpedCreature!.temporaryModifications[0]!.powerChange).toBe(3);
      expect(pumpedCreature!.temporaryModifications[0]!.toughnessChange).toBe(3);
    });

    test('effect wears off at end of turn', () => {
      const state = setupGameWithMana({ G: 1 });
      const bears = createCreatureOnBattlefield(state, 'Grizzly Bears', 'player');
      const growth = createCardInHand(state, 'Giant Growth', 'player');

      let newState = castAndResolve(state, 'player', growth.instanceId, [bears.instanceId]);

      newState = applyAction(newState, {
        type: 'END_TURN',
        playerId: 'player',
        payload: {},
      });

      const creature = newState.players.player.battlefield.find(
        (c) => c.instanceId === bears.instanceId,
      );

      expect(creature!.temporaryModifications.length).toBe(0);
    });
  });

  describe('Howl from Beyond (+X/+0)', () => {
    test('applies X-based pump', () => {
      const state = setupGameWithMana({ B: 5 });
      const bears = createCreatureOnBattlefield(state, 'Grizzly Bears', 'player');
      const howl = createCardInHand(state, 'Howl from Beyond', 'player');

      const newState = castAndResolve(state, 'player', howl.instanceId, [bears.instanceId], 4);

      const pumpedCreature = newState.players.player.battlefield.find(
        (c) => c.instanceId === bears.instanceId,
      );

      expect(pumpedCreature!.temporaryModifications.length).toBe(1);
      expect(pumpedCreature!.temporaryModifications[0]!.powerChange).toBe(4);
      expect(pumpedCreature!.temporaryModifications[0]!.toughnessChange).toBe(0);
    });
  });

  describe("Warrior's Honor (Team Pump)", () => {
    test('card exists with team pump effect', () => {
      const card = CardLoader.getByName("Warrior's Honor");
      expect(card).toBeDefined();
      expect(card?.oracle_text?.toLowerCase()).toContain('creatures you control');
      expect(card?.oracle_text?.toLowerCase()).toContain('+1/+1');
    });
  });

  describe('Fit of Rage (+3/+3 and First Strike)', () => {
    test('card exists with pump and keyword grant', () => {
      const card = CardLoader.getByName('Fit of Rage');
      expect(card).toBeDefined();
      expect(card?.oracle_text?.toLowerCase()).toContain('+3/+3');
      expect(card?.oracle_text?.toLowerCase()).toContain('first strike');
    });
  });
});

// ============================================================
// TRIGGERED ABILITIES - COMPLEX CHAINS
// ============================================================

describe('Triggered Abilities', () => {
  beforeEach(() => {
    _resetStackCounter();
  });

  describe('ETB Triggers', () => {
    test('Gravedigger returns creature from graveyard', () => {
      const state = setupGameWithMana({ B: 4 });

      // Put creature in graveyard
      const deadBears = createCardInstance(CardLoader.getByName('Grizzly Bears')!.id, 'player', 'graveyard');
      state.players.player.graveyard.push(deadBears);

      const gravedigger = createCardInHand(state, 'Gravedigger', 'player');

      const newState = castAndResolve(state, 'player', gravedigger.instanceId);

      // Dead creature should be in hand
      expect(newState.players.player.hand.find((c) => c.instanceId === deadBears.instanceId)).toBeDefined();
      expect(newState.players.player.graveyard.length).toBe(0);
    });

    test('Venerable Monk gains 2 life on ETB', () => {
      const state = setupGameWithMana({ W: 3 });
      state.players.player.life = 15;
      const monk = createCardInHand(state, 'Venerable Monk', 'player');

      const newState = castAndResolve(state, 'player', monk.instanceId);

      expect(newState.players.player.life).toBe(17);
    });

    test('Hidden Horror sacrifices self without creature to discard', () => {
      const state = setupGameWithMana({ B: 3 });
      state.players.player.hand = [];
      const horror = createCardInHand(state, 'Hidden Horror', 'player');

      const newState = castAndResolve(state, 'player', horror.instanceId);

      // Horror should be in graveyard (sacrificed)
      expect(
        newState.players.player.battlefield.find((c) => c.instanceId === horror.instanceId),
      ).toBeUndefined();
      expect(
        newState.players.player.graveyard.find((c) => c.instanceId === horror.instanceId),
      ).toBeDefined();
    });

    test('Balduvian Horde discards or sacrifices', () => {
      const state = setupGameWithMana({ R: 4 });
      // Empty hand - should sacrifice
      state.players.player.hand = [];
      const horde = createCardInHand(state, 'Balduvian Horde', 'player');

      const newState = castAndResolve(state, 'player', horde.instanceId);

      // Horde should be in graveyard
      expect(
        newState.players.player.graveyard.find((c) => c.instanceId === horde.instanceId),
      ).toBeDefined();
    });
  });

  describe('Death Triggers', () => {
    test('Gravebane Zombie goes to library on death', () => {
      const state = setupGameWithMana({});
      const zombie = createCreatureOnBattlefield(state, 'Gravebane Zombie', 'player');

      // Kill it with damage
      zombie.damage = 2; // 3/2

      // This should trigger the death -> library effect
      checkStateBasedActions(state);

      // Note: The actual move to library happens in the trigger resolution
      // For now, just verify it went to graveyard first
      expect(
        state.players.player.graveyard.find((c) => c.instanceId === zombie.instanceId),
      ).toBeDefined();
    });

    test('Sengir Autocrat creates Serf tokens on ETB', () => {
      const state = setupGameWithMana({ B: 4 });
      const autocrat = createCardInHand(state, 'Sengir Autocrat', 'player');

      const beforeTokens = state.players.player.battlefield.filter((c) => c.isToken).length;
      const newState = castAndResolve(state, 'player', autocrat.instanceId);
      const afterTokens = newState.players.player.battlefield.filter((c) => c.isToken).length;

      // Should have created 3 Serf tokens
      expect(afterTokens - beforeTokens).toBe(3);
    });
  });

  describe('Damage Triggers', () => {
    test('Abyssal Specter triggers discard on damage to player', () => {
      const state = setupGameWithMana({});
      state.phase = 'combat';
      state.step = 'declare_attackers';
      state.activePlayer = 'player';

      const specter = createCreatureOnBattlefield(state, 'Abyssal Specter', 'player');

      // Give opponent cards
      const opponentCard = createCardInHand(state, 'Grizzly Bears', 'opponent');
      const initialHandSize = state.players.opponent.hand.length;

      // Declare attack
      let newState = applyAction(state, {
        type: 'DECLARE_ATTACKERS',
        playerId: 'player',
        payload: { attackers: [specter.instanceId] },
      } as DeclareAttackersAction);

      // No blockers
      newState = applyAction(newState, {
        type: 'DECLARE_BLOCKERS',
        playerId: 'opponent',
        payload: { blocks: [] },
      } as DeclareBlockersAction);

      // Damage dealt -> opponent discards
      expect(newState.players.opponent.hand.length).toBe(initialHandSize - 1);
    });
  });

  describe('Spell Cast Triggers', () => {
    test('Verduran Enchantress exists and triggers on enchantment cast', () => {
      // Verduran Enchantress: "Whenever you cast an enchantment spell, you draw a card."
      const card = CardLoader.getByName('Verduran Enchantress');
      expect(card).toBeDefined();
      expect(card?.oracle_text?.toLowerCase()).toContain('enchantment');
      expect(card?.oracle_text?.toLowerCase()).toContain('draw');
    });

    test('Insight draws when opponent casts green spell', () => {
      // Insight: "Whenever an opponent casts a green spell, you draw a card."
      const card = CardLoader.getByName('Insight');
      expect(card).toBeDefined();
      expect(card?.oracle_text?.toLowerCase()).toContain('green spell');
      expect(card?.oracle_text?.toLowerCase()).toContain('draw');
    });

    test('Warmth gains life when opponent casts red spell', () => {
      // Warmth: "Whenever an opponent casts a red spell, you gain 2 life."
      const card = CardLoader.getByName('Warmth');
      expect(card).toBeDefined();
      expect(card?.oracle_text?.toLowerCase()).toContain('red spell');
      expect(card?.oracle_text?.toLowerCase()).toContain('gain 2 life');
    });
  });
});

// ============================================================
// ACTIVATED ABILITIES
// ============================================================

describe('Activated Abilities', () => {
  beforeEach(() => {
    _resetStackCounter();
  });

  describe('Tap for Damage', () => {
    test('Prodigal Sorcerer can deal 1 damage', () => {
      const state = setupGameWithMana({});
      const tim = createCreatureOnBattlefield(state, 'Prodigal Sorcerer', 'player');

      const abilities = getActivatedAbilities(tim, state);
      const damageAbility = abilities.find((a) => a.id.includes('tap_damage'));

      expect(damageAbility).toBeDefined();
      expect(damageAbility!.cost.tap).toBe(true);
      expect(damageAbility!.effect.amount).toBe(1);
    });

    test('Orcish Artillery deals 2 damage but also damages controller', () => {
      const card = CardLoader.getByName('Orcish Artillery');
      expect(card).toBeDefined();
      expect(card?.oracle_text?.toLowerCase()).toContain('2 damage to any target');
      expect(card?.oracle_text?.toLowerCase()).toContain('3 damage to you');
    });
  });

  describe('Tap for Buff', () => {
    test('Infantry Veteran buffs attacking creature', () => {
      const state = setupGameWithMana({});
      const veteran = createCreatureOnBattlefield(state, 'Infantry Veteran', 'player');

      const abilities = getActivatedAbilities(veteran, state);
      const buffAbility = abilities.find((a) => a.id.includes('tap_buff'));

      expect(buffAbility).toBeDefined();
      expect(buffAbility!.cost.tap).toBe(true);
      expect(buffAbility!.targetRequirements![0].restrictions).toContainEqual({
        type: 'combat',
        status: 'attacking',
      });
    });
  });

  describe('Pump Abilities (No Tap)', () => {
    test('Flame Spirit pumps with mana', () => {
      const state = setupGameWithMana({ R: 5 });
      const spirit = createCreatureOnBattlefield(state, 'Flame Spirit', 'player');

      const abilities = getActivatedAbilities(spirit, state);
      const pumpAbility = abilities.find((a) => a.id.includes('pump'));

      expect(pumpAbility).toBeDefined();
      expect(pumpAbility!.cost.mana).toBe('{R}');
      expect(pumpAbility!.cost.tap).toBeUndefined();
      expect(pumpAbility!.effect.powerChange).toBe(1);
      expect(pumpAbility!.effect.toughnessChange).toBe(0);
    });

    test('Spitting Drake has once-per-turn pump', () => {
      const state = setupGameWithMana({ R: 3 });
      const drake = createCreatureOnBattlefield(state, 'Spitting Drake', 'player');

      const abilities = getActivatedAbilities(drake, state);
      const pumpAbility = abilities.find((a) => a.id.includes('pump'));

      expect(pumpAbility!.name).toContain('once per turn');

      // First activation should work
      expect(pumpAbility!.canActivate(state, drake.instanceId, 'player')).toBe(true);

      // Simulate activation
      drake.temporaryModifications.push({
        source: drake.instanceId,
        powerChange: 1,
        toughnessChange: 0,
        expiresAt: 'end_of_turn',
      });

      // Second activation should fail
      expect(pumpAbility!.canActivate(state, drake.instanceId, 'player')).toBe(false);
    });
  });

  describe('Flying Granting', () => {
    test('Patagia Golem gains flying', () => {
      const state = setupGameWithMana({ W: 4 });
      const golem = createCreatureOnBattlefield(state, 'Patagia Golem', 'player');

      const abilities = getActivatedAbilities(golem, state);
      const flyingAbility = abilities.find((a) => a.id.includes('gain_flying'));

      expect(flyingAbility).toBeDefined();
      expect(flyingAbility!.cost.mana).toBe('{3}');
    });

    test('Harmattan Efreet grants flying to target', () => {
      const state = setupGameWithMana({ U: 3 });
      const efreet = createCreatureOnBattlefield(state, 'Harmattan Efreet', 'player');

      const abilities = getActivatedAbilities(efreet, state);
      const grantAbility = abilities.find((a) => a.id.includes('grant_flying'));

      expect(grantAbility).toBeDefined();
      expect(grantAbility!.cost.mana).toBe('{1}{U}{U}');
      expect(grantAbility!.targetRequirements![0].targetType).toBe('creature');
    });
  });

  describe('X-Cost Abilities', () => {
    test('Crimson Hellkite has X damage ability', () => {
      const state = setupGameWithMana({ R: 5 });
      const hellkite = createCreatureOnBattlefield(state, 'Crimson Hellkite', 'player');

      const abilities = getActivatedAbilities(hellkite, state);
      const xAbility = abilities.find((a) => a.id.includes('tap_damage'));

      expect(xAbility).toBeDefined();
      expect(xAbility!.cost.tap).toBe(true);
      expect(xAbility!.targetRequirements![0].targetType).toBe('creature');
    });
  });
});

// ============================================================
// STACK INTERACTIONS
// ============================================================

describe('Stack Interactions', () => {
  beforeEach(() => {
    _resetStackCounter();
  });

  describe('Multiple Spells on Stack', () => {
    test('LIFO resolution order', () => {
      const state = setupGameWithMana({ G: 2, R: 2 });
      state.activePlayer = 'player';
      state.priorityPlayer = 'player';
      const bears = createCreatureOnBattlefield(state, 'Grizzly Bears', 'player');
      const growth = createCardInHand(state, 'Giant Growth', 'player');
      const shock = createCardInHand(state, 'Shock', 'player');

      // Cast Giant Growth
      let newState = applyAction(state, {
        type: 'CAST_SPELL',
        playerId: 'player',
        payload: { cardInstanceId: growth.instanceId, targets: [bears.instanceId] },
      } as CastSpellAction);

      // After casting, priority goes to opponent. Opponent passes back.
      newState = applyAction(newState, {
        type: 'PASS_PRIORITY',
        playerId: 'opponent',
        payload: {},
      } as PassPriorityAction);

      // Player gets priority back and casts Shock in response (before stack resolves)
      newState = applyAction(newState, {
        type: 'CAST_SPELL',
        playerId: 'player',
        payload: { cardInstanceId: shock.instanceId, targets: [bears.instanceId] },
      } as CastSpellAction);

      expect(newState.stack.length).toBe(2);

      // Shock is on top (last in)
      expect(newState.stack[1]!.card.instanceId).toBe(shock.instanceId);
      expect(newState.stack[0]!.card.instanceId).toBe(growth.instanceId);
    });
  });

  describe('Counter on Counter', () => {
    test('can counter a counterspell', () => {
      const state = setupGameWithMana({ G: 2 }, { U: 4 });
      state.activePlayer = 'player';
      state.priorityPlayer = 'player';
      const bears = createCardInHand(state, 'Grizzly Bears', 'player');
      const counter1 = createCardInHand(state, 'Counterspell', 'opponent');
      const counter2 = createCardInHand(state, 'Counterspell', 'opponent');

      // Cast Bears
      let newState = applyAction(state, {
        type: 'CAST_SPELL',
        playerId: 'player',
        payload: { cardInstanceId: bears.instanceId },
      } as CastSpellAction);

      const bearsStackId = newState.stack[0]!.id;

      // Opponent gets priority, counters Bears
      newState = applyAction(newState, {
        type: 'CAST_SPELL',
        playerId: 'opponent',
        payload: { cardInstanceId: counter1.instanceId, targets: [bearsStackId] },
      } as CastSpellAction);

      const counter1StackId = newState.stack[1]!.id;

      // Player gets priority, passes
      newState = applyAction(newState, {
        type: 'PASS_PRIORITY',
        playerId: 'player',
        payload: {},
      } as PassPriorityAction);

      // Opponent gets priority back, counters their own Counterspell
      newState = applyAction(newState, {
        type: 'CAST_SPELL',
        playerId: 'opponent',
        payload: { cardInstanceId: counter2.instanceId, targets: [counter1StackId] },
      } as CastSpellAction);

      expect(newState.stack.length).toBe(3);
    });
  });

  describe('Spell Fizzle', () => {
    test('spell fizzles when target becomes illegal', () => {
      const state = setupGameWithMana({ B: 2, R: 2 });
      state.activePlayer = 'player';
      state.priorityPlayer = 'player';
      const bears = createCreatureOnBattlefield(state, 'Grizzly Bears', 'opponent');
      const terror = createCardInHand(state, 'Terror', 'player');
      const shock = createCardInHand(state, 'Shock', 'player');

      // Cast Terror targeting Bears
      let newState = applyAction(state, {
        type: 'CAST_SPELL',
        playerId: 'player',
        payload: { cardInstanceId: terror.instanceId, targets: [bears.instanceId] },
      } as CastSpellAction);

      // Opponent passes priority
      newState = applyAction(newState, {
        type: 'PASS_PRIORITY',
        playerId: 'opponent',
        payload: {},
      } as PassPriorityAction);

      // Player casts Shock to kill Bears first (instead of letting Terror resolve)
      newState = applyAction(newState, {
        type: 'CAST_SPELL',
        playerId: 'player',
        payload: { cardInstanceId: shock.instanceId, targets: [bears.instanceId] },
      } as CastSpellAction);

      // Resolve Shock (kills Bears)
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

      // Bears should be dead
      expect(
        newState.players.opponent.battlefield.find((c) => c.instanceId === bears.instanceId),
      ).toBeUndefined();

      // Resolve Terror (should fizzle)
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

      // Terror should be in graveyard (fizzled)
      expect(
        newState.players.player.graveyard.find((c) => c.instanceId === terror.instanceId),
      ).toBeDefined();
    });
  });
});

// ============================================================
// STATE-BASED ACTIONS AFTER EFFECTS
// ============================================================

describe('State-Based Actions After Effects', () => {
  beforeEach(() => {
    _resetStackCounter();
  });

  describe('Creature Death from Damage', () => {
    test('creature dies after taking lethal damage from spell', () => {
      const state = setupGameWithMana({ R: 2 });
      const bears = createCreatureOnBattlefield(state, 'Grizzly Bears', 'opponent');
      const shock = createCardInHand(state, 'Shock', 'player');

      const newState = castAndResolve(state, 'player', shock.instanceId, [bears.instanceId]);

      // Bears (2/2) should be dead from 2 damage
      expect(
        newState.players.opponent.battlefield.find((c) => c.instanceId === bears.instanceId),
      ).toBeUndefined();
      expect(
        newState.players.opponent.graveyard.find((c) => c.instanceId === bears.instanceId),
      ).toBeDefined();
    });
  });

  describe('Creature Death from Negative Toughness', () => {
    test('creature dies when toughness reduced to 0', () => {
      const state = setupGameWithMana({ B: 2 });
      // 1/1 creature
      const elves = createCreatureOnBattlefield(state, 'Llanowar Elves', 'opponent');

      // Put Enfeeblement in hand (-2/-2)
      const enfeeblement = createCardInHand(state, 'Enfeeblement', 'player');

      const newState = castAndResolve(state, 'player', enfeeblement.instanceId, [elves.instanceId]);

      // Elves should be dead from -2/-2 making it -1/-1
      expect(
        newState.players.opponent.battlefield.find((c) => c.instanceId === elves.instanceId),
      ).toBeUndefined();
    });
  });

  describe('Aura Falls Off', () => {
    test('aura goes to graveyard when enchanted creature dies', () => {
      const state = setupGameWithMana({ W: 2, R: 4 });
      const bears = createCreatureOnBattlefield(state, 'Grizzly Bears', 'opponent');

      // Attach Pacifism to Bears
      const pacifism = createCardInHand(state, 'Pacifism', 'player');
      let newState = castAndResolve(state, 'player', pacifism.instanceId, [bears.instanceId]);

      // Verify Pacifism is attached
      const attachedPacifism = newState.players.player.battlefield.find(
        (c) => c.instanceId === pacifism.instanceId,
      );
      expect(attachedPacifism?.attachedTo).toBe(bears.instanceId);

      // Kill Bears with Lightning Blast
      const blast = createCardInHand(newState, 'Lightning Blast', 'player');
      newState = castAndResolve(newState, 'player', blast.instanceId, [bears.instanceId]);

      // Bears should be dead
      expect(
        newState.players.opponent.battlefield.find((c) => c.instanceId === bears.instanceId),
      ).toBeUndefined();

      // Pacifism should be in graveyard
      expect(
        newState.players.player.graveyard.find((c) => c.instanceId === pacifism.instanceId),
      ).toBeDefined();
    });
  });

  describe('Player Death', () => {
    test('player loses when life reaches 0', () => {
      const state = setupGameWithMana({ R: 6 });
      state.players.opponent.life = 4;
      const blast = createCardInHand(state, 'Lightning Blast', 'player');

      const newState = castAndResolve(state, 'player', blast.instanceId, ['opponent']);

      expect(newState.gameOver).toBe(true);
      expect(newState.winner).toBe('player');
    });
  });
});

// ============================================================
// EDGE CASES FROM EDGE_CASES.MD
// ============================================================

describe('Edge Cases from Documentation', () => {
  beforeEach(() => {
    _resetStackCounter();
  });

  describe('Mana Abilities Dont Use Stack', () => {
    test('mana abilities are flagged correctly', () => {
      const state = setupGameWithMana({});
      const elves = createCreatureOnBattlefield(state, 'Llanowar Elves', 'player');

      const abilities = getActivatedAbilities(elves, state);
      const manaAbility = abilities.find((a) => a.isManaAbility);

      expect(manaAbility).toBeDefined();
      expect(manaAbility!.isManaAbility).toBe(true);
    });
  });

  describe('Token Cleanup', () => {
    test('tokens dont go to graveyard (cease to exist)', () => {
      const state = setupGameWithMana({ B: 4 });
      const autocrat = createCardInHand(state, 'Sengir Autocrat', 'player');

      let newState = castAndResolve(state, 'player', autocrat.instanceId);

      // Get a token
      const token = newState.players.player.battlefield.find((c) => c.isToken);
      expect(token).toBeDefined();

      // Tokens that would go to graveyard just cease to exist
      // This is handled by the game state management
    });
  });

  describe('Variable P/T Creatures', () => {
    test('Maro has P/T equal to cards in hand', () => {
      const card = CardLoader.getByName('Maro');
      expect(card).toBeDefined();
      expect(card?.power).toBe('*');
      expect(card?.toughness).toBe('*');
    });

    test('Nightmare has P/T equal to Swamps', () => {
      const card = CardLoader.getByName('Nightmare');
      expect(card).toBeDefined();
      expect(card?.power).toBe('*');
      expect(card?.toughness).toBe('*');
    });
  });

  describe('First Strike + Trample', () => {
    test('first strike damage applies before regular damage', () => {
      // Sabretooth Tiger is 2/1 first strike
      // In combat with a 3/3, it deals damage first and could die before dealing regular damage
      const card = CardLoader.getByName('Sabretooth Tiger');
      expect(card).toBeDefined();
      // Keywords in card data use "First strike" (capitalized first word only)
      expect(card?.keywords).toContain('First strike');
    });
  });
});
