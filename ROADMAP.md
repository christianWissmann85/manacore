# MANACORE: Development Roadmap

**Version:** 1.0.0  
**Last Updated:** January 4, 2026  
**Total Estimated Duration:** 30+ weeks  
**Approach:** Agile, iterative, ship early and often

---

## Quick Reference

| Phase         | Duration    | Focus            | Shippable?            |
| ------------- | ----------- | ---------------- | --------------------- |
| **Phase 0**   | Weeks 1-3   | Foundation       | ❌ CLI only           |
| **Phase 1**   | Weeks 4-11  | Core MTG         | ✅ Complete game      |
| **Phase 1.5** | Weeks 12-18 | Card Library     | ✅ 90% cards          |
| **Phase 1.6** | Weeks 19-20 | Complex Cards    | ✅ 100% cards         |
| **Phase 2**   | Weeks 21-26 | Smart AI         | ✅ Challenging AI     |
| **Phase 3**   | Weeks 27-32 | Polish           | ✅ **PUBLIC RELEASE** |
| **Phase 4**   | Weeks 33-38 | Research Tools   | ✅ AI Lab             |
| **Phase 5**   | Weeks 39+   | Machine Learning | ✅ Advanced AI        |

---

## Phase 0: Foundation (Weeks 1-3)

**Theme:** "Prove the Architecture Works"

### Goals

- Set up monorepo with clean separation of concerns
- Implement minimal game loop (play cards, attack, win/lose)
- Validate that the engine can run headless at high speed
- Establish data pipeline from Scryfall

### Week 1: Project Setup

**Tasks:**

- [x] Initialize Bun workspace monorepo
- [x] Create `packages/engine`, `packages/ai`, `packages/cli-client`
- [x] Configure TypeScript for each package
- [x] Set up Git repo with proper `.gitignore`
- [x] Write project README

**Deliverable:** Empty but properly structured project

### Week 2: Data & Engine Core

**Tasks:**

- [x] Implement Scryfall scraper (`packages/data-scraper`)
- [x] Fetch 6th Edition card data
- [x] Parse and cache JSON locally
- [x] Implement `CardLoader` in engine
- [x] Define core types: `GameState`, `PlayerState`, `CardInstance`
- [x] Implement basic `applyAction` reducer for:
  - Play land
  - Cast creature (sorcery speed)
  - Attack (attacker chooses blocker)

**Deliverable:** Engine can simulate a vanilla creature game

**Test Deck:**

```json
{
  "name": "Vanilla Red",
  "cards": [
    { "name": "Mountain", "count": 24 },
    { "name": "Grizzly Bears", "count": 12 }, // 2/2 for 1G
    { "name": "Hill Giant", "count": 12 }, // 3/3 for 3R
    { "name": "Lightning Bolt", "count": 12 } // 3 damage
  ]
}
```

### Week 3: CLI & RandomBot

**Tasks:**

- [x] Build CLI interface (`packages/cli-client`)
  - Display game state in ASCII art
  - Accept text commands (play 0, attack 1, etc.)
- [x] Implement `RandomBot` that picks random legal actions
- [x] Run 100 games of RandomBot vs RandomBot
- [x] Verify games complete without crashes

**Success Criteria:**

- ✅ Two RandomBots finish 100 games
- ✅ Average game length: 20-50 turns
- ✅ No infinite loops or crashes
- ✅ Simulation speed: >500 games/second

**Deliverable:** Working CLI client you can play against RandomBot

**Screenshot Goal:**

```
BATTLEFIELD
Opponent: 15 life, 5 mana
  [Mountain] [Mountain] [Mountain]
  [Hill Giant] (3/3, untapped)

Your: 12 life, 4 mana
  [Mountain] [Mountain] [Mountain] [Forest]
  [Grizzly Bears] (2/2, tapped)

HAND: [Lightning Bolt] [Grizzly Bears] [Mountain]

> cast 0 target opponent_unit_0
```

---

## Phase 1: Core MTG Rules (Weeks 4-11)

**Theme:** "This Actually Feels Like Magic"

### Goals

- Implement The Stack with priority
- Add proper combat (declare blockers)
- Support instant-speed interaction
- **Implement mana system (CRITICAL!)**
- **Add targeting system (CRITICAL!)**
- **Expand card library to 20-30 working cards**
- Build basic web UI

### Week 4-5: The Stack

**Tasks:**

- [x] Implement stack data structure (LIFO)
- [x] Add priority system (both players must pass to resolve)
- [x] Implement `PASS_PRIORITY` action
- [x] Add instant-speed spells
- [x] Implement `Counterspell` as test case

**New Cards:**

```
Counterspell (U) - Counter target spell
Giant Growth (G) - Target creature gets +3/+3
Unsummon (U) - Return target creature to hand
```

**Test Scenario:**

```
Player A: Cast Lightning Bolt targeting Player B
Player B: Pass priority
[Stack resolves, Player B takes 3 damage]

Player A: Cast Hill Giant
Player B: Cast Counterspell targeting Hill Giant
Player A: Pass priority
[Counterspell resolves, Hill Giant countered]
```

**Success Criteria:**

- ✅ Stack resolves in correct order (LIFO)
- ✅ Both players can respond to spells
- ✅ Counterspell works correctly

### Week 6: Proper Combat

**Tasks:**

- [x] Implement combat phases:
  - Beginning of Combat
  - Declare Attackers
  - Declare Blockers
  - Combat Damage
  - End of Combat
- [x] Add damage assignment for multiple blockers
- [x] Implement keywords: Flying, First Strike, Trample

**New Cards:**

```
Serra Angel (3WW) - 4/4 Flying, Vigilance
Shivan Dragon (4RR) - 5/5 Flying, {R}: +1/+0
Air Elemental (3UU) - 4/4 Flying
```

**Test Scenario:**

```
Player A attacks with Serra Angel (4/4 Flying)
Player B declares blockers: Air Elemental (4/4 Flying)
[Both deal 4 damage to each other, both die]
```

**Success Criteria:**

- ✅ Flying creatures can only be blocked by Flying/Reach
- ✅ First Strike damage happens before normal damage
- ✅ Trample damage goes through to player

### Week 7: State-Based Actions & Triggers

**Tasks:**

- [x] Implement state-based actions:
  - Creatures with 0 or less toughness die
  - Players at 0 or less life lose
  - Legendary rule (if needed)
- [x] Implement triggered abilities:
  - "When ~ enters the battlefield"
  - "When ~ dies"
- [x] Add activated abilities:
  - "Tap: Deal 1 damage" (Prodigal Sorcerer)

**New Cards:**

```
Prodigal Sorcerer (2U) - 1/1, Tap: Deal 1 damage
Nekrataal (2BB) - 2/1, When ~ ETB: Destroy target nonblack creature
```

**Success Criteria:**

- ✅ Creatures die immediately when toughness <= 0
- ✅ ETB triggers happen in correct order
- ✅ Activated abilities can be used at instant speed

### Week 9: Mana System ⚠️ CRITICAL

**Tasks:**

- [x] Implement mana pool system:
  - `ManaPool` type with `{W, U, B, R, G, C}` counts
  - Add mana to pool
  - Remove mana from pool
  - Empty pool at phase transitions
- [x] Add mana costs to all cards:
  - Parse mana cost strings (e.g., `"{2}{R}{R}"`)
  - Validate player can pay cost
  - Deduct mana when casting spell
- [x] Implement mana abilities:
  - "Tap: Add {R}" (basic lands)
  - Auto-tapping for mana
  - Color identity rules
- [x] Update validators to check mana costs
- [x] Update CLI/UI to show mana pools

**New Cards:**

```
Dark Ritual (B) - Add {B}{B}{B}
Llanowar Elves (G) - Creature, Tap: Add {G}
Birds of Paradise (G) - Creature, Tap: Add one mana of any color
```

**Test Scenario:**

```
Player A has 3 Mountains
Turn: Player A taps 2 Mountains for {R}{R}
Action: Cast Shivan Dragon (4RR) - FAIL (need 4 more mana)
Turn: Player A taps third Mountain
Action: Cast Hill Giant (3R) - SUCCESS
```

**Success Criteria:**

- ✅ Cannot cast spells without sufficient mana
- ✅ Mana pool empties between phases
- ✅ Color requirements enforced (can't cast {R}{R} with {U}{U})
- ✅ Mana abilities work correctly

**Why Critical:** The game is literally unplayable without mana costs - you can currently cast anything for free!

### Week 10: Targeting System ⚠️ CRITICAL

**Tasks:**

- [x] Implement target validation:
  - Valid target types (creature, player, "any target")
  - Legal targets (in play, controller restrictions)
  - Protection/Hexproof/Shroud (if needed)
- [x] Add targeting to actions:
  - `CastSpellAction.targets` array
  - `ActivateAbilityAction.targets` array
  - Target validation in validators
- [x] Implement "target" text parser:
  - "Target creature" → filter battlefield for creatures
  - "Target player" → return player list
  - "Any target" → creatures + players
- [x] Update reducers to use targets:
  - Apply effects to specified targets
  - Handle illegal targets (fizzle spell)
- [x] Add targeting to UI:
  - Click-to-target interface
  - Highlight valid targets
  - Cancel targeting

**New Cards:**

```
Lightning Bolt (R) - Deal 3 damage to any target
Giant Growth (G) - Target creature gets +3/+3 until EOT
Terror (1B) - Destroy target nonblack creature
Unsummon (U) - Return target creature to owner's hand
```

**Test Scenario:**

```
Player A casts Lightning Bolt
Game: "Choose target (any target)"
Player A: Clicks opponent's Grizzly Bears
Stack: Lightning Bolt targeting Grizzly Bears
[Resolves: Bears takes 3 damage, dies]
```

**Success Criteria:**

- ✅ Can only target legal targets
- ✅ Spell fizzles if target becomes illegal
- ✅ UI clearly shows valid targets
- ✅ Multi-target spells work (if needed)

**Why Critical:** Most Magic cards target something - without this, we can only play vanilla creatures!

### Week 11: Card Library Expansion

**Tasks:**

- [x] Implement 20-30 common 6th Edition cards (and check if all mentioned Cards from previous Weeks have been implemented):
  - **Creatures (10)**: Shivan Dragon, Serra Angel, Sengir Vampire, Mahamoti Djinn, etc.
  - **Removal (5)**: Swords to Plowshares, Terror, Disenchant, Fireball, etc.
  - **Card Draw (3)**: Ancestral Recall, Brainstorm, Jayemdae Tome
  - **Pump/Combat Tricks (4)**: Giant Growth, Weakness, Holy Strength, Unholy Strength
  - **Counterspells (2)**: Counterspell, Power Sink
  - **Disruption (3)**: Mind Rot, Hymn to Tourach, Icy Manipulator
  - **Enchantments (3)**: Pacifism, Weakness, Holy Strength
- [x] Test each card thoroughly
- [x] Add card-specific logic to:
  - `activatedAbilities.ts` (for activated abilities)
  - `triggers.ts` (for triggered abilities)
  - `reducer.ts` (for special effects)
- [x] Create test decks for each color
- [x] Run 100+ games with expanded card pool

**Card Categories:**

```typescript
// White: Removal, protection, weenie creatures
Swords to Plowshares, Disenchant, Pacifism, White Knight, Serra Angel

// Blue: Counterspells, card draw, flying
Counterspell, Ancestral Recall, Brainstorm, Air Elemental, Mahamoti Djinn

// Black: Removal, disruption, big creatures
Terror, Mind Rot, Hypnotic Specter, Sengir Vampire, Necropotence

// Red: Burn, haste, dragons
Lightning Bolt, Fireball, Ball Lightning, Shivan Dragon, Goblin King

// Green: Mana ramp, big creatures, pump
Llanowar Elves, Giant Growth, Erhnam Djinn, Force of Nature
```

**Success Criteria:**

- ✅ 20+ cards fully implemented and tested
- ✅ Each color has viable cards
- ✅ Can build functional mono-color decks
- ✅ All cards work correctly in combination

**Deliverable:** Complete playable Magic game with real cards and real mana costs!

---

## Phase 1.5: Complete Card Library (Weeks 12-18)

**Theme:** "Every Card Works"

### Goals

- Implement ALL 335 cards from 6th Edition (90% target, ~302 cards)
- Add missing game mechanics required for card effects
- Comprehensive testing with full deck simulations
- Defer only truly complex cards to Phase 1.6

> **Tracking:** See [CARD_STATUS.md](./CARD_STATUS.md) for detailed implementation status of all cards.

### Week 1.5.1: Infrastructure & Lands

**New Mechanics Required:**

- [x] Death triggers (complete TODO in stateBasedActions.ts)
- [x] Sacrifice effects ("Sacrifice a creature:")
- [x] X-cost spell handling (Blaze, Fireball, etc.)
- [x] Token generation framework
- [x] Damage prevention ("Prevent X damage")
- [x] Life gain/loss effects

**Land Tasks:**

- [ ] Pain lands (Adarkar Wastes, etc.) - tap for colorless or colored + damage
- [ ] Depletion lands (Svyelunite Temple, etc.) - counter-based mana
- [ ] City of Brass - any color + damage trigger

**Success Criteria:**

- ✅ All 17 lands working (5 basic + 12 non-basic)
- ✅ Death triggers fire correctly
- ✅ Sacrifice actions work
- ✅ X-cost spells resolve correctly

### Week 1.5.2: Instants & Sorceries

**Instant Tasks (38 cards):**

- [x] Damage spells: Volcanic Geyser, Inferno, Vertigo
- [x] Counter variants: Power Sink, Remove Soul, Memory Lapse, Spell Blast
- [x] Tutors: Enlightened, Mystical, Vampiric, Worldly
- [x] Damage prevention: Fog, Healing Salve, Remedy, Reverse Damage
- [x] Utility: Boomerang, Early Harvest, Flash, Mana Short, Vitalize

**Sorcery Tasks (53 cards):**

- [x] X-cost damage: Blaze, Earthquake, Hurricane
- [x] Board wipes: Wrath of God, Jokulhaups, Shatterstorm, Tranquility
- [x] Land destruction: Armageddon, Stone Rain, Flashfires, Pillage
- [x] Card draw: Ancestral Memories, Dream Cache, Inspiration
- [x] Graveyard: Raise Dead, Elven Cache, Hammer of Bogardan
- [x] Ramp: Rampant Growth, Untamed Wilds, Summer Bloom
- [x] Discard: Mind Warp, Stupor, Painful Memories

**Success Criteria:**

- ✅ All 38 instants implemented
- ✅ All 53 sorceries implemented
- ✅ 100-game simulation passes without crashes

### Week 1.5.3: Creatures (Part 1 - 65 cards)

**Focus: Vanilla, Keywords, and Simple Abilities**

**Vanilla/Keyword Creatures (~40):**

- [x] All vanilla creatures verified working
- [x] All keyword-only creatures verified (Flying, First Strike, etc.)
- [x] Landwalk keywords: Swampwalk, Forestwalk, Islandwalk, Mountainwalk

**Mana Dorks (~8):**

- [x] Fyndhorn Elder ({T}: Add {G}{G})
- [x] Blood Pet (Sac: Add {B})
- [x] Implement remaining mana-producing creatures

**Simple ETB Creatures (~10):**

- [x] Venerable Monk (ETB: Gain 2 life)
- [x] Staunch Defenders (ETB: Gain 4 life)
- [x] Uktabi Orangutan (ETB: Destroy artifact)
- [x] Sage Owl (ETB: Look at top 4, rearrange)
- [x] Hidden Horror (ETB: Discard creature)

**Success Criteria:**

- ✅ 65 creatures working
- ✅ All landwalk keywords functional
- ✅ ETB triggers working reliably
- ✅ 100-game simulation passes

### Week 1.5.4: Creatures (Part 2 - 65 cards)

**Focus: Activated Abilities and Complex Triggers**

**Activated Abilities (~25):**

- [x] Tap to deal damage: Orcish Artillery, Heavy Ballista
- [x] Tap to buff: Infantry Veteran, Wyluli Wolf
- [x] Tap to tap/untap: Elder Druid, Fyndhorn Brownie
- [x] Pump abilities: Flame Spirit, Dragon Engine, Pearl Dragon
- [x] Regeneration: Drudge Skeletons, River Boa, Gorilla Chieftain

**Damage Triggers (~5):**

- [x] Hypnotic Specter (random discard on damage - note: not in 6ed, skip)
- [x] Sibilant Spirit (opponent draws on attack)

**Death/Leave Triggers (~5):**

- [x] Gravebane Zombie (dies: put on library)
- [x] Necrosavant (pay from graveyard: return)

**Lords/Anthems (~5):**

- [x] Goblin King (Goblins get +1/+1 and mountainwalk)
- [x] Lord of Atlantis (Merfolk get +1/+1 and islandwalk)
- [x] Zombie Master (Zombies get regeneration and swampwalk)

**Complex Creatures (~10):**

- [x] Maro (P/T = cards in hand)
- [x] Nightmare (P/T = Swamps)
- [x] Uktabi Wildcats (P/T = Forests)
- [x] Phantom Warrior (can't be blocked)
- [x] Thicket Basilisk (deathtouch-like)

**Success Criteria:**

- ✅ All 130 creatures implemented
- ✅ Lords correctly buff creature types
- ✅ Regeneration mechanic working
- ✅ 100-game simulation passes

### Week 1.5.5: Auras & Enchantments

**Aura Tasks (22 cards):**

**Stat Modifications (~8):**

- [ ] Divine Transformation (+3/+3)
- [ ] Giant Strength (+2/+2)
- [ ] Hero's Resolve (+1/+5)
- [ ] Feast of the Unicorn (+4/+0)
- [ ] Enfeeblement (-2/-2)

**Keyword Granting (~6):**

- [ ] Flight (Flying)
- [ ] Fear (Fear keyword)
- [ ] Burrowing (Mountainwalk)
- [ ] Leshrac's Rite (Swampwalk)

**Ability Granting (~4):**

- [ ] Firebreathing ({R}: +1/+0)
- [ ] Regeneration ({G}: Regenerate)
- [ ] Spirit Link (lifelink-like)

**Land Auras (~4):**

- [ ] Wild Growth (extra mana on tap)
- [ ] Psychic Venom (damage on tap)
- [ ] Blight (destroy on tap)
- [ ] Conquer (steal land)

**Global Enchantment Tasks (34 cards):**

**Static Buffs/Debuffs (~8):**

- [ ] Crusade (White creatures +1/+1)
- [ ] Castle (Untapped creatures +0/+2)
- [ ] Dread of Night (White creatures -1/-1)
- [ ] Orcish Oriflamme (Attacking creatures +1/+0)
- [ ] Fervor (Your creatures have haste)
- [ ] Serra's Blessing (Your creatures have vigilance)

**Restriction Effects (~6):**

- [ ] Light of Day (Black creatures can't attack)
- [ ] Kismet (Opponent's stuff enters tapped)
- [ ] Familiar Ground (Can't be blocked by 2+)
- [ ] Dense Foliage (Creatures can't be targeted)

**Damage Triggers (~4):**

- [ ] Aether Flash (2 damage to entering creatures)
- [ ] Manabarbs (Damage when tapping lands)
- [ ] Pestilence ({B}: 1 damage to all)

**Protection (~5):**

- [ ] Circle of Protection: Black/Blue/Green/Red/White

**Misc (~6):**

- [ ] Greed (Pay life: Draw)
- [ ] Howling Mine (All draw extra) - already noted
- [ ] Warmth/Insight/Chill (color hosers)

**Success Criteria:**

- ✅ All 22 auras working
- ✅ All 34 enchantments working
- ✅ Static effects correctly modify creatures
- ✅ 100-game simulation passes

### Week 1.5.6: Artifacts

**Artifact Tasks (41 cards):**

**Mana Rocks (~7):**

- [ ] Charcoal/Fire/Marble/Moss/Sky Diamond (enters tapped, {T}: Add color)
- [ ] Mana Prism ({1},{T}: Add any color)

**Activated Damage (~4):**

- [ ] Rod of Ruin ({3},{T}: 1 damage)
- [ ] Aladdin's Ring ({8},{T}: 4 damage)
- [ ] Skull Catapult (Sac creature: 2 damage)

**Activated Draw/Discard (~4):**

- [ ] Jayemdae Tome ({4},{T}: Draw)
- [ ] Jalum Tome ({2},{T}: Draw, discard)
- [ ] Disrupting Scepter ({3},{T}: Target discards)

**Triggered Life Gain (~5):**

- [ ] Crystal Rod, Iron Star, Ivory Cup, Throne of Bone, Wooden Sphere

**Tokens (~3):**

- [ ] The Hive ({5},{T}: Create Wasp)
- [ ] Snake Basket ({X},{T},{Sac}: X Snakes)
- [ ] Bottle of Suleiman (random Djinn)

**Static Effects (~6):**

- [ ] Howling Mine (All draw extra)
- [ ] Ankh of Mishra (Damage on land play)
- [ ] Dingus Egg (Damage when land dies)
- [ ] Meekstone (Big creatures don't untap)
- [ ] Cursed Totem (Disable creature abilities)

**Utility (~6):**

- [ ] Millstone ({2},{T}: Mill 2)
- [ ] Flying Carpet ({2},{T}: Grant flying)
- [ ] Dragon Mask ({3}: +2/+2, bounce)
- [ ] Glasses of Urza (See opponent's hand)
- [ ] Grinning Totem (Search opponent's library)

**Misc (~6):**

- [ ] Fountain of Youth ({2},{T}: Gain 1 life)
- [ ] Phyrexian Vault (Sac creature: Draw)
- [ ] Ashnod's Altar (Sac creature: {C}{C})
- [ ] Amber Prison (Detain)
- [ ] Pentagram of the Ages (Prevent damage)
- [ ] Soul Net (Gain life on death)

**Success Criteria:**

- ✅ All 41 artifacts working
- ✅ Mana rocks enter tapped correctly
- ✅ Sacrifice outlets working
- ✅ 100-game simulation passes

### Week 1.5.7: Integration Testing & Documentation

**Testing Tasks:**

- [ ] Run 1,000-game simulation with all cards
- [ ] Test each color pair combination (10 matchups)
- [ ] Verify all 302+ cards work in actual games
- [ ] Identify and document remaining edge cases

**Documentation Tasks:**

- [ ] Update CARD_STATUS.md with final counts
- [ ] Finalize Phase 1.6 deferred list
- [ ] Update CLAUDE.md with Phase 1.5 completion
- [ ] Create release notes for Phase 1.5

**Final Verification:**

- [ ] RandomBot vs RandomBot: 500 games, no crashes
- [ ] Human playtesting: Each color viable
- [ ] Performance check: Still 500+ games/second

**Success Criteria:**

- ✅ 302+ cards (90%) fully implemented
- ✅ 1000-game simulation completes
- ✅ All documentation updated
- ✅ Phase 1.6 scope clearly defined

**Deliverable:** Full 6th Edition card pool playable!

---

## Phase 1.6: Complex Card Mechanics (Weeks 19-20)

**Theme:** "The Last 5%"

### Goals

- Implement remaining 17 complex cards deferred from Phase 1.5
- Add specialized mechanics for unusual effects
- Complete 100% of 6th Edition

### Deferred Card Categories (17 cards)

**Target Redirection & Extra Turns (~3 cards):**

- Deflection (change target of spell)
- Final Fortune (extra turn, then lose)
- Flash (instant-speed creature deployment)

**Control-Changing Effects (~4 cards):**

- Abduction (steal creature, return on death)
- Conquer (steal land - Aura)
- Desertion (counter spell, steal permanent)
- Juxtapose (exchange creatures)

**Replacement Effects (~4 cards):**

- Diminishing Returns (complex draw replacement)
- Forbidden Crypt (graveyard replacement)
- Teferi's Puzzle Box (draw replacement)
- Zur's Weirding (draw denial)

**Type/Color Changing (~3 cards):**

- Celestial Dawn (all colors become white)
- Living Lands (forests become creatures)
- Phantasmal Terrain (change land type - Aura)

**Complex Interactions (~3 cards):**

- Doomsday (build 5-card library)
- Illicit Auction (life bidding)
- Polymorph (creature transformation)
- Primal Clay (shapeshifter choice)
- Psychic Transfer (life exchange)

### Success Criteria

- ✅ All 335 cards implemented
- ✅ No known card bugs
- ✅ Full 6th Edition complete

**Deliverable:** 100% 6th Edition support!

---

## Phase 2: Hidden Information & Smart AI (Weeks 21-26)

**Theme:** "The AI Gets Dangerous"

### Goals

- Implement MCTS with hidden information handling
- Create heuristic evaluation function
- Add card advantage mechanics
- Build replay system for debugging

### Week 21-22: MCTS Core

**Tasks:**

- [ ] Implement MCTS algorithm
  - Selection (UCB1)
  - Expansion
  - Simulation (rollout)
  - Backpropagation
- [ ] Add determinization for hidden info
- [ ] Implement GreedyBot for rollout policy

**Success Criteria:**

- ✅ MCTS can run 1000 iterations in <5 seconds
- ✅ MCTS-Bot beats RandomBot 90%+ of games
- ✅ MCTS-Bot beats GreedyBot 60%+ of games

### Week 23: Evaluation Function

**Tasks:**

- [ ] Implement board evaluation heuristic:
  ```typescript
  evaluation =
    (myLife - oppLife) * 2.0 +
    (myBoardValue - oppBoardValue) * 1.5 +
    (myHandSize - oppHandSize) * 0.5 +
    myLandsInPlay * 0.3 +
    myCardAdvantage * 1.0;
  ```
- [ ] Tune weights through self-play
- [ ] Add tempo bonuses (untapped creatures > tapped)

**Test:**
Run 1000 games with different weight values, find optimal.

### Week 24-25: Card Advantage & Disruption

**Tasks:**

- [ ] Add card draw spells
- [ ] Add discard spells
- [ ] Add removal spells
- [ ] Implement Enchantments (Auras)

**New Cards:**

```
Ancestral Recall (U) - Draw 3 cards
Brainstorm (U) - Draw 3, put 2 back
Mind Rot (2B) - Target player discards 2 cards
Swords to Plowshares (W) - Exile target creature, controller gains life
Pacifism (1W) - Enchant creature, it can't attack or block
```

**Success Criteria:**

- ✅ MCTS values card draw correctly
- ✅ AI uses removal at appropriate times
- ✅ AI doesn't discard important cards

### Week 26: Replay System & Stats

**Tasks:**

- [ ] Implement game replay (save actions + seed)
- [ ] Build statistics dashboard:
  - Win rate by deck
  - Average game length
  - Cards played per game
  - Decision quality metrics
- [ ] Add match history viewer

**Deliverable:**

- Replay any game to debug AI decisions
- Dashboard showing AI performance metrics

---

## Phase 3: Advanced Visualization (Weeks 27-32)

**Theme:** "The Research Dashboard"

### Goals

- Full web visualization dashboard
- Deck construction lab
- Multiple AI Agent configurations
- Audio feedback for events
- Interactive documentation

### Week 27: Basic Web Dashboard

**Tasks:**

- [ ] Set up Vite + React + Tailwind project
- [ ] Implement `useGameState` hook to connect to engine
- [ ] Create `Card` component with Tailwind styling
- [ ] Create `Battlefield` grid layout
- [ ] Implement basic click-to-play actions
- [ ] Add "Inspector Panel" for viewing card JSON data
- [ ] Use fetched Image Data from `packages/web-client/public/assets/cards/` folder
  - Implement Placeholder if Data is not present

**Success Criteria:**

- ✅ Dashboard renders game state via React
- ✅ Responsive grid layout works
- ✅ Can play a full game via UI controls
- ✅ Clean, scientific aesthetic (Dark mode, monospace fonts)

**Deliverable:** Interactive research dashboard

### Week 28-29: Visualization Polish

**Tasks:**

- [ ] Add Framer Motion for simple state transitions
- [ ] Implement "Log View" with filterable action history
- [ ] Add "Mana Pool" visualization with charts
- [ ] Add "Targeting Mode" (click source -> click target)
- [ ] Implement keyboard shortcuts for common actions (Space to pass)

**Assets Needed:**

- Icons (Lucide React)
- Tailwind Config (Custom colors)

### Week 30-31: Deck Lab

**Tasks:**

- [ ] Build deck construction UI:
  - Browse all available cards
  - Filter by color, type, CMC
  - Configure Agent decks
  - View mana curve chart
  - Validate deck (60 cards minimum)
- [ ] Save/load test configurations
- [ ] Create 5-10 standard test decks:
  - Red Aggro
  - Blue Control
  - Green Midrange
  - White Weenie
  - Black Disruption

**Success Criteria:**

- ✅ User can configure test decks quickly
- ✅ Deck validation prevents illegal states
- ✅ Mana curve visualization aids analysis

### Week 32: AI Configuration & Final Polish

**Tasks:**

- [ ] Tune AI Agent profiles:
  - Baseline: RandomBot (random legal moves)
  - Heuristic: GreedyBot (1-ply lookahead)
  - Strong: MCTS-500 (500 iterations)
  - Expert: MCTS-2000 (2000 iterations)
- [ ] Test with researchers/developers
- [ ] Adjust evaluation function based on logs

**Target Win Rates (vs Baseline):**

- Heuristic: 90% win rate
- Strong: 95% win rate
- Expert: 99% win rate

**Additional Tasks:**

- [ ] Interactive guide for new users
- [ ] Rules reference integration
- [ ] Settings (visualization speed, debug mode)
- [ ] Bug fixes from stress testing
- [ ] Performance optimization
- [ ] Write technical documentation

**Deliverable:** 🔬 **RESEARCH PLATFORM v1.0**

---

## Phase 4: AI Research Tools (Weeks 33-38)

**Theme:** "The AI Research Laboratory"

### Goals

- Tournament simulator
- Deck analytics
- MCTS visualization
- Meta-game analysis

### Week 33-34: Tournament Simulator

**Tasks:**

- [ ] Implement Swiss-style tournament
- [ ] Implement Single-Elimination bracket
- [ ] Run large-scale simulations (10,000+ games)
- [ ] Generate reports:
  - Win rate by deck matchup
  - Top-performing cards
  - Meta-game breakdown

**Research Questions:**

```
1. Which deck archetype is strongest?
   Run: 10,000 games, Aggro vs Control vs Midrange

2. What's the optimal land count?
   Test: 20, 22, 24, 26 lands × 1000 games each

3. Which cards are format staples?
   Metric: Win% when card is in deck
```

### Week 35-36: Deck Analytics

**Tasks:**

- [ ] Implement deck scoring algorithms:
  - Mana curve optimization
  - Synergy detection (cards that work well together)
  - Consistency metrics (how often you draw what you need)
- [ ] Build card statistics:
  - Win% when drawn
  - Average turn played
  - Most common targets
- [ ] Create meta-game reports:
  - Most played decks
  - Counter-strategy recommendations

**Example Output:**

```
DECK: Red Burn
Mana Curve: A+ (optimal 1-3 CMC distribution)
Synergy Score: B (Lightning Bolt + creatures)
Win Rate: 58% (above average)

Top Performers:
- Lightning Bolt: 72% win rate when drawn
- Mountain: 60% win rate (baseline)

Weak Cards:
- Goblin King: 45% win rate (underperforming)

Recommendation: Replace Goblin King with more removal
```

### Week 37: MCTS Visualization

**Tasks:**

- [ ] Build decision tree visualizer
- [ ] Show node visit counts
- [ ] Highlight best path
- [ ] Display win rate estimates
- [ ] Animate tree growth in real-time

**Use Cases:**

- Understand why AI makes certain plays
- Debug evaluation function
- Discover novel strategies

**Example Visualization:**

```
                 [Root: 1000 visits, 55% WR]
                    /           |           \
        [Play Land: 400]  [Attack: 350]  [Cast Spell: 250]
           /     \             |              /        \
      [End: 200] [Attack: 200] ...      [Target A]  [Target B]
```

### Week 38: A/B Testing Framework

**Tasks:**

- [ ] Compare different MCTS configurations:
  - Exploration parameter (c value)
  - Rollout depth
  - Determinization count
- [ ] Compare evaluation functions:
  - Material-only
  - Material + tempo
  - Material + tempo + card advantage
- [ ] Statistical significance testing

**Example Test:**

```
Hypothesis: Increasing determinization samples improves win rate

Control: 5 determinizations per MCTS search
Variant: 10 determinizations per MCTS search

Run: 1000 games each
Result: 54% vs 57% win rate (p < 0.05, significant!)
```

**Deliverable:** Research platform for AI experimentation

---

## Phase 5: Machine Learning (Weeks 39+)

**Theme:** "Skynet Learns Magic"

### Goals

- Neural network evaluation function
- Genetic algorithm deck building
- Self-play training
- Novel strategy discovery

### Week 39-42: Neural Network Evaluation

**Tasks:**

- [ ] Collect training data (100,000+ games)
- [ ] Design network architecture:
  ```
  Input: Game state (vectorized)
  Hidden: 3 layers (512, 256, 128 neurons)
  Output: Win probability [0, 1]
  ```
- [ ] Train model with supervised learning
- [ ] Replace heuristic evaluation in MCTS
- [ ] Benchmark: NN-MCTS vs Heuristic-MCTS

**Success Criteria:**

- ✅ NN evaluation is faster than rollout
- ✅ NN-MCTS beats Heuristic-MCTS by 10%+

### Week 43-46: Genetic Algorithm Deck Builder

**Tasks:**

- [ ] Implement GA framework:
  1. Generate random population (100 decks)
  2. Run tournament (fitness = win rate)
  3. Selection (top 20%)
  4. Crossover (combine decks)
  5. Mutation (swap 1-5 cards)
  6. Repeat for 50 generations
- [ ] Visualize deck evolution over generations
- [ ] Compare GA-decks to hand-crafted decks

**Research Questions:**

```
1. Can GA rediscover known archetypes?
   (e.g., does it create a burn deck?)

2. Can GA discover novel strategies?
   (e.g., combos we didn't think of)

3. How many generations to converge?
```

### Week 47+: Self-Play & AlphaZero

**Tasks:**

- [ ] Implement self-play loop:
  1. AI plays against itself
  2. Collect training data
  3. Train NN on outcomes
  4. Update MCTS with new NN
  5. Repeat
- [ ] Compare to AlphaZero paper methodology
- [ ] Measure improvement over time

---

## Maintenance & Future Work

### Post-Release Maintenance

- Bug fixes
- Balance patches (adjust card pool)
- Performance optimization
- User-requested features


---

**End of Roadmap**

_Let's build something amazing! 🎮🤖_
