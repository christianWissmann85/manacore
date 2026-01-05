# Edge Cases and Known Limitations

**Last Updated:** January 5, 2026 (Phase 1.5)
**Engine Version:** 0.0.1

This document tracks known edge cases, quirks, and limitations in the ManaCore engine that may need attention in future phases.

---

## Simulation Results Summary

### Phase 1.5 Stress Test (2,000 games)

- **Games:** 2,000
- **Errors:** 0
- **Turn Range:** 24-50 (avg 49.6)
- **Draw Rate:** 56% (games hitting turn limit)

### Performance Metrics

- **Simulation Speed:** 1000+ games/second
- **Memory Usage:** Stable (no leaks detected)
- **Test Coverage:** 676 tests, 5,042 assertions

---

## Known Edge Cases

### 1. Turn Limit and Draw Rate

**Observation:** 56% of games end in draws (hitting the 50-turn limit).

**Cause:** RandomBot doesn't optimize for winning - it just picks legal actions randomly. This leads to suboptimal plays and prolonged games.

**Impact:** None for engine correctness. This will naturally improve when MCTS AI is implemented in Phase 2.

**Status:** Expected behavior, no action needed.

---

### 2. Deck Balance

**Observation:** Green decks have ~71% win rate, while White/Blue/Black hover around 5%.

**Cause:**

- Green's mana acceleration (Llanowar Elves, Birds of Paradise) gives significant tempo advantage
- RandomBot doesn't understand the value of counterspells or removal timing
- Green's creatures are more efficiently costed

**Impact:** None for engine correctness. Balance testing requires intelligent AI.

**Status:** Expected with RandomBot. Will re-evaluate in Phase 2 with MCTS.

---

### 3. Cards Marked Implemented but Not in 6ed.json

**Observation:** Some cards in CARD_STATUS.md marked as implemented don't exist in the 6th Edition data file.

**Example:** Goblin Matron (from Urza's Saga, not 6th Edition)

**Impact:** Deck building will silently skip missing cards (with console warning).

**Status:** CARD_STATUS.md should be audited to match actual 6ed.json contents.

---

### 4. Complex Mechanics Deferred (Out of Scope)

The following mechanics are intentionally not implemented for ML research scope:

| Mechanic             | Reason                   | Cards Affected                     |
| -------------------- | ------------------------ | ---------------------------------- |
| Extra Turns          | Complex state management | Final Fortune                      |
| Control Change       | Ownership tracking       | Abduction, Conquer, Desertion      |
| Land Type Change     | Type system changes      | Phantasmal Terrain, Celestial Dawn |
| Library Manipulation | Complex ordering         | Goblin Recruiter, Doomsday         |
| Replacement Effects  | Complex priority         | Forbidden Crypt, Zur's Weirding    |
| Bidding Mechanics    | Player interaction       | Illicit Auction                    |

**Total Deferred:** 35 cards (~10% of 6th Edition)

**Status:** Intentionally out of scope. These would require significant refactoring and are not essential for ML research.

---

### 5. Targeting Edge Cases

#### 5.1 Fizzle on Illegal Target

**Status:** Implemented correctly

- Spells fizzle if all targets become illegal
- Partially legal targets still resolve with legal targets

#### 5.2 Shroud/Hexproof

**Status:** Implemented

- Creatures with Shroud cannot be targeted by any spells/abilities
- Dense Foliage grants Shroud to all creatures

#### 5.3 Protection

**Status:** Partially implemented

- Protection from color prevents targeting
- Protection from damage prevention: needs verification

---

### 6. Combat Edge Cases

#### 6.1 Multiple Blockers

**Status:** Implemented

- Damage assignment order respected
- Trample calculates correctly with lethal damage assignment

#### 6.2 First Strike + Trample

**Status:** Implemented

- First strike damage is assigned before regular damage
- Trample excess goes through after first strike kills blockers

#### 6.3 Banding

**Status:** Not in 6th Edition (no cards have Banding)

---

### 7. State-Based Actions

All standard SBAs are implemented:

- [x] Creature death (toughness <= 0 or damage >= toughness)
- [x] Player death (life <= 0)
- [x] Aura detachment (enchanted permanent leaves)
- [x] Legend rule (not applicable - no legendary creatures in 6ed)
- [x] Token cleanup (tokens cease to exist in non-battlefield zones)

---

### 8. Stack and Priority

#### 8.1 Mana Abilities

**Status:** Implemented

- Mana abilities don't use the stack
- Can be activated while another spell is being cast

#### 8.2 Split Second

**Status:** Not in 6th Edition

#### 8.3 Priority Passing

**Status:** Implemented

- Both players must pass in succession to resolve
- Active player gets priority after each resolution

---

### 9. Token Interactions

**Implemented Token Types:**

- Citizen (1/1 white)
- Serf (0/1 black)
- Cat (1/1 green)
- Snake (1/1 green)
- Wasp (1/1 artifact flying)
- Goblin (1/1 red)

**Edge Cases:**

- Tokens are correctly removed when leaving battlefield
- Token copies are not implemented (no cards need this)

---

### 10. Regeneration

**Status:** Implemented for ~10 cards

**Mechanics:**

- Creates a regeneration shield
- When creature would die, shield is used instead
- Creature is tapped and removed from combat
- Damage is removed

**Edge Cases:**

- Multiple regeneration shields stack correctly
- Regeneration works with sacrifice effects (cannot regenerate from sacrifice)

---

## Performance Considerations

### Memory Usage

- `structuredClone` is used for all state updates
- No memory leaks detected in 10,000+ game simulations
- Average state size: ~50KB

### CPU Usage

- Single-threaded execution
- 1,000+ games/second on modern hardware
- Main bottleneck: state cloning and legal action generation

### Optimization Opportunities (Phase 2+)

1. Incremental state updates instead of full clone
2. Legal action caching
3. Web worker parallelization for simulations

---

## Test Coverage Gaps

### Untested Scenarios

1. **Multiplayer:** Engine supports 2 players only
2. **Sideboard:** Not implemented
3. **Mulligan:** Not implemented (draw 7, keep 7)
4. **Mana Burn:** Removed in modern rules, not implemented

### Cards Needing More Tests

- Complex triggered abilities with multiple triggers
- Replacement effects (limited implementation)
- "Choose one" modal spells

---

## Future Improvements (Post Phase 2)

1. **Deterministic Replay:** Save/replay games with seeds
2. **Game State Hashing:** For transposition tables in MCTS
3. **Parallel Simulation:** Web workers for faster AI training
4. **Action Undo:** For human-friendly UI

---

_This document will be updated as new edge cases are discovered._
