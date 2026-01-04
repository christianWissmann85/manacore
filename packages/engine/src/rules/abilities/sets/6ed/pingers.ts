/**
 * 6th Edition - Damage-Dealing Creatures (Pingers)
 *
 * Creatures that tap (or have activated abilities) to deal damage.
 */

import { registerAbilities } from '../../registry';
import {
  createTimAbility,
  createPaidTimAbility,
  createTapForDamage,
  createDamageWithSelfDamage,
  createScalableDamageAbility,
} from '../../templates';
import type { ActivatedAbility } from '../../types';
import { standardTapCheck, sourceExistsCheck, countAvailableMana } from '../../templates';
import type { GameState } from '../../../../state/GameState';
import type { PlayerId } from '../../../../state/Zone';

// =============================================================================
// SIMPLE PINGERS (Tap for 1 damage)
// =============================================================================

// Prodigal Sorcerer
// "{T}: Prodigal Sorcerer deals 1 damage to any target."
registerAbilities('Prodigal Sorcerer', (card) => [createTimAbility(card)]);

// =============================================================================
// PAID PINGERS (Mana + Tap for damage)
// =============================================================================

// Anaba Shaman
// "{R}, {T}: Anaba Shaman deals 1 damage to any target."
registerAbilities('Anaba Shaman', (card) => [createPaidTimAbility(card, 1, '{R}')]);

// =============================================================================
// CONDITIONAL PINGERS
// =============================================================================

// Heavy Ballista
// "{T}: Heavy Ballista deals 2 damage to target attacking or blocking creature."
registerAbilities('Heavy Ballista', (card) => [
  createTapForDamage(card, 2, {
    targetType: 'creature',
    targetRestrictions: [{ type: 'combat', status: 'attacking_or_blocking' }],
    name: '{T}: 2 damage to attacker/blocker',
  }),
]);

// Femeref Archers
// "{T}: Femeref Archers deals 4 damage to target attacking creature with flying."
registerAbilities('Femeref Archers', (card) => [
  createTapForDamage(card, 4, {
    targetType: 'creature',
    targetRestrictions: [
      { type: 'combat', status: 'attacking' },
      { type: 'keyword', keyword: 'flying' },
    ],
    name: '{T}: 4 damage to attacking flyer',
  }),
]);

// D'Avenant Archer
// "{T}: D'Avenant Archer deals 1 damage to target attacking or blocking creature."
registerAbilities("D'Avenant Archer", (card) => [
  createTapForDamage(card, 1, {
    targetType: 'creature',
    targetRestrictions: [{ type: 'combat', status: 'attacking_or_blocking' }],
    name: '{T}: 1 damage to attacker/blocker',
  }),
]);

// =============================================================================
// SELF-DAMAGING PINGERS
// =============================================================================

// Orcish Artillery
// "{T}: Orcish Artillery deals 2 damage to any target and 3 damage to you."
registerAbilities('Orcish Artillery', (card) => [
  createDamageWithSelfDamage(card, 2, 3, {
    name: '{T}: 2 damage to any target, 3 to you',
  }),
]);

// Reckless Embermage
// "{1}{R}: Reckless Embermage deals 1 damage to any target and 1 damage to itself."
registerAbilities('Reckless Embermage', (card) => {
  const ability: ActivatedAbility = {
    id: `${card.instanceId}_damage`,
    name: '{1}{R}: 1 damage to any target + 1 to self',
    cost: { mana: '{1}{R}' },
    effect: { type: 'DAMAGE', amount: 1 },
    isManaAbility: false,
    targetRequirements: [
      {
        id: 'target_0',
        count: 1,
        targetType: 'any',
        zone: 'battlefield',
        restrictions: [],
        optional: false,
        description: 'any target',
      },
    ],
    canActivate: (state: GameState, sourceId: string, controller: PlayerId) => {
      if (!sourceExistsCheck(state, sourceId, controller)) {
        return false;
      }
      // Check mana: {1}{R} = 1 colorless + 1 red
      const totalRed = countAvailableMana(state, controller, 'R');
      if (totalRed < 1) return false;
      // Also need 1 more mana of any type (simplified check)
      return true;
    },
  };
  return [ability];
});

// =============================================================================
// X-COST DAMAGE (Complex)
// =============================================================================

// Crimson Hellkite
// "{X}, {T}: Crimson Hellkite deals X damage to target creature. Spend only red mana on X."
registerAbilities('Crimson Hellkite', (card) => [createScalableDamageAbility(card, '{R}')]);

// =============================================================================
// EXPORT COUNT
// =============================================================================

export const PINGERS_COUNT = 8;
