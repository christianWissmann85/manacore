# 6th Edition Card Implementation Status

**Last Updated:** January 4, 2026 (Day 9-10 Complete)
**Total Cards:** 335
**Implemented:** 192 (~57%)
**Deferred to Phase 1.6:** 17 (~5%)
**Target:** 318 (95%) by end of Phase 1.5

---

## Summary by Category

| Category | Total | Implemented | Deferred | Remaining | Phase 1.5 Target |
|----------|-------|-------------|----------|-----------|------------------|
| Basic Land | 5 | 5 | 0 | 0 | 5 ✅ |
| Land | 12 | 12 | 0 | 0 | 12 ✅ |
| Creature | 130 | 77 | 1 | 52 | 129 (99%) |
| Instant | 38 | 34 | 4 | 0 | 34 ✅ |
| Sorcery | 53 | 47 | 6 | 0 | 47 ✅ |
| Aura | 22 | 1 | 1 | 20 | 21 (95%) |
| Enchantment | 34 | 6 | 4 | 24 | 30 (88%) |
| Artifact | 41 | 0 | 1 | 40 | 40 (98%) |
| **Total** | **335** | **192** | **17** | **126** | **318 (95%)** |

*Note: 17 cards deferred to Phase 1.6 due to complex mechanics*

---

## Status Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Complete - fully implemented and tested |
| 🚧 | In Progress - partially implemented |
| ❌ | Not Started |
| 🕐 | Deferred to Phase 1.6 (complex) |

---

## Phase 1.5 Schedule

| Week | Focus | Cards |
|------|-------|-------|
| 1.5.1 | Infrastructure & Basic Lands | Mechanics + 17 lands |
| 1.5.2 | Instants & Sorceries | 91 spells |
| 1.5.3 | Creatures (Part 1) | 65 creatures |
| 1.5.4 | Creatures (Part 2) | 65 creatures |
| 1.5.5 | Auras & Enchantments | 56 enchantments |
| 1.5.6 | Artifacts | 41 artifacts |
| 1.5.7 | Integration Testing | Validation + deferred list |

---

## Basic Lands (5/5 Complete)

| Card | Status | Notes |
|------|--------|-------|
| Forest | ✅ | {T}: Add {G} |
| Island | ✅ | {T}: Add {U} |
| Mountain | ✅ | {T}: Add {R} |
| Plains | ✅ | {T}: Add {W} |
| Swamp | ✅ | {T}: Add {B} |

---

## Non-Basic Lands (12/12 Complete)

| Card | Status | Ability | Notes |
|------|--------|---------|-------|
| Adarkar Wastes | ✅ | Pain land (W/U) | Tap: {C} or {W}/{U} + 1 damage |
| Brushland | ✅ | Pain land (G/W) | Tap: {C} or {G}/{W} + 1 damage |
| City of Brass | ✅ | Any color + damage | Triggered: 1 damage when tapped |
| Crystal Vein | ✅ | Sacrifice for {C}{C} | Tap for {C} or tap+sac for {C}{C} |
| Dwarven Ruins | ✅ | Sacrifice land (R) | Enters tapped, tap+sac for {R}{R} |
| Ebon Stronghold | ✅ | Sacrifice land (B) | Enters tapped, tap+sac for {B}{B} |
| Havenwood Battleground | ✅ | Sacrifice land (G) | Enters tapped, tap+sac for {G}{G} |
| Karplusan Forest | ✅ | Pain land (R/G) | Tap: {C} or {R}/{G} + 1 damage |
| Ruins of Trokair | ✅ | Sacrifice land (W) | Enters tapped, tap+sac for {W}{W} |
| Sulfurous Springs | ✅ | Pain land (B/R) | Tap: {C} or {B}/{R} + 1 damage |
| Svyelunite Temple | ✅ | Sacrifice land (U) | Enters tapped, tap+sac for {U}{U} |
| Underground River | ✅ | Pain land (U/B) | Tap: {C} or {U}/{B} + 1 damage |

---

## Creatures (77/130 Complete)

| Card | Status | P/T | Keywords | Abilities |
|------|--------|-----|----------|-----------|
| Abyssal Hunter | ✅ | 1/1 | | {B},{T}: Tap + damage |
| Abyssal Specter | ✅ | 2/3 | Flying | Damage trigger: discard |
| Air Elemental | ✅ | 4/4 | Flying | Keywords only |
| Anaba Shaman | ✅ | 2/2 | | {R},{T}: 1 damage |
| Birds of Paradise | ✅ | 0/1 | Flying | {T}: Add any color |
| Blighted Shaman | ✅ | 1/1 | | {T}, Sac Swamp: +1/+1 |
| Blood Pet | ✅ | 1/1 | | Sac: Add {B} |
| Crimson Hellkite | ✅ | 6/6 | Flying | {X},{T}: X damage |
| D'Avenant Archer | ✅ | 1/2 | | {T}: 1 damage to attacker |
| Daraja Griffin | ✅ | 2/2 | Flying | Sac: Destroy black |
| Daring Apprentice | ✅ | 1/1 | | {T}, Sac: Counter |
| Dragon Engine | ✅ | 1/3 | | {2}: +1/+0 |
| Elder Druid | ✅ | 2/2 | | {3}{G},{T}: Tap/untap |
| Elvish Mystic | ✅ | 1/1 | | {T}: Add {G} |
| Ethereal Champion | ✅ | 3/4 | | Pay life: Prevent damage |
| Fallen Angel | ✅ | 3/3 | Flying | Sac creature: +2/+1 |
| Femeref Archers | ✅ | 2/2 | | {T}: 4 damage to flyer |
| Flame Spirit | ✅ | 2/3 | | {R}: +1/+0 |
| Fyndhorn Brownie | ✅ | 1/1 | | {2}{G},{T}: Untap creature |
| Fyndhorn Elder | ✅ | 1/1 | | {T}: Add {G}{G} |
| Fyndhorn Elves | ✅ | 1/1 | | {T}: Add {G} |
| Goblin Digging Team | ✅ | 1/1 | | {T}, Sac: Destroy wall |
| Gravedigger | ✅ | 2/2 | | ETB: Return creature |
| Grizzly Bears | ✅ | 2/2 | | Vanilla |
| Harmattan Efreet | ✅ | 2/2 | Flying | {1}{U}{U}: Grant flying |
| Heavy Ballista | ✅ | 2/3 | | {T}: 2 damage to attacker |
| Hidden Horror | ✅ | 4/4 | | ETB: Discard creature or sac |
| Infantry Veteran | ✅ | 1/1 | | {T}: Attacker +1/+1 |
| Kjeldoran Royal Guard | ✅ | 2/5 | | {T}: Redirect damage |
| Llanowar Elves | ✅ | 1/1 | | {T}: Add {G} |
| Mesa Falcon | ✅ | 1/1 | Flying | {1}{W}: +0/+1 |
| Mischievous Poltergeist | ✅ | 1/1 | Flying | Pay life: Regenerate |
| Orcish Artillery | ✅ | 1/3 | | {T}: 2 damage + 3 to self |
| Order of the Sacred Torch | ✅ | 2/2 | | {T}, Pay life: Counter black |
| Patagia Golem | ✅ | 2/3 | | {3}: Gains flying |
| Pearl Dragon | ✅ | 4/4 | Flying | {1}{W}: +0/+1 |
| Pradesh Gypsies | ✅ | 1/1 | | {1}{G},{T}: -2/-0 |
| Prodigal Sorcerer | ✅ | 1/1 | | {T}: 1 damage |
| Radjan Spirit | ✅ | 3/2 | | {T}: Remove flying |
| Rag Man | ✅ | 2/1 | | {B}{B}{B},{T}: Discard |
| Reckless Embermage | ✅ | 2/2 | | {1}{R}: 1 damage + self |
| Resistance Fighter | ✅ | 1/1 | | Sac: Prevent damage |
| Sage Owl | ✅ | 1/1 | Flying | ETB: Look at top 4 |
| Samite Healer | ✅ | 1/1 | | {T}: Prevent 1 damage |
| Soldevi Sage | ✅ | 1/1 | | {T}, Sac lands: Draw 3 |
| Spitting Drake | ✅ | 2/2 | Flying | {R}: +1/+0 once/turn |
| Staunch Defenders | ✅ | 3/4 | | ETB: Gain 4 life |
| Stromgald Cabal | ✅ | 2/2 | | {T}, Pay life: Counter white |
| Uktabi Orangutan | ✅ | 2/2 | | ETB: Destroy artifact |
| Unyaro Griffin | ✅ | 2/2 | Flying | Sac: Counter red |
| Venerable Monk | ✅ | 2/2 | | ETB: Gain 2 life |
| Wall of Fire | ✅ | 0/5 | Defender | {R}: +1/+0 |
| Wyluli Wolf | ✅ | 1/1 | | {T}: Creature +1/+1 |
| Drudge Skeletons | ✅ | 1/1 | | {B}: Regenerate |
| Gorilla Chieftain | ✅ | 3/3 | | {1}{G}: Regenerate |
| River Boa | ✅ | 2/1 | Islandwalk | {G}: Regenerate |
| Mischievous Poltergeist | ✅ | 1/1 | Flying | Pay 1 life: Regenerate |
| Maro | ✅ | */* | | P/T = cards in hand |
| Nightmare | ✅ | */* | Flying | P/T = Swamps you control |
| Uktabi Wildcats | ✅ | */* | | P/T = Forests, {G} sac Forest: Regenerate |
| Primal Clay | ✅ | */* | | Choice: 3/3, 2/2 flying, or 1/6 wall |
| Wind Spirit | ✅ | 3/2 | Flying, Menace | Menace evasion |
| Razortooth Rats | ✅ | 2/1 | Fear | Fear evasion |
| Goblin Matron | ✅ | 1/1 | | ETB: Search for Goblin |
| Balduvian Horde | ✅ | 5/5 | | ETB: Discard or sacrifice |
| Kjeldoran Dead | ✅ | 3/1 | | {B}: Regenerate, ETB: Sac creature |
| Abyssal Hunter | ❌ | 1/1 | | {B},{T}: Tap + damage |
| Anaba Bodyguard | ❌ | 2/3 | First Strike | Keywords only |
| Archangel | ❌ | 5/5 | Flying, Vigilance | Keywords only |
| Ardent Militia | ❌ | 2/4 | Vigilance | Keywords only |
| Armored Pegasus | ❌ | 1/2 | Flying | Keywords only |
| Balduvian Barbarians | ❌ | 3/2 | | Vanilla |
| Blighted Shaman | ❌ | 1/1 | | {T},{Sac}: -1/-1 |
| Bog Imp | ❌ | 1/1 | Flying | Keywords only |
| Bog Rats | ❌ | 1/1 | | Can't be blocked by Walls |
| Bog Wraith | ❌ | 3/3 | Swampwalk | Keywords only |
| Cat Warriors | ❌ | 2/2 | Forestwalk | Keywords only |
| Crimson Hellkite | ❌ | 6/6 | Flying | {X},{R},{T}: X damage |
| D'Avenant Archer | ❌ | 1/2 | | {T}: 1 damage to attacking |
| Dancing Scimitar | ❌ | 1/5 | Flying | Keywords only |
| Daraja Griffin | ❌ | 2/2 | Flying | Sac: Destroy black |
| Daring Apprentice | ❌ | 1/1 | | {T},{Sac}: Counter |
| Derelor | ❌ | 4/4 | | Black spells cost more |
| Dragon Engine | ❌ | 1/3 | | {2}: +1/+0 |
| Drudge Skeletons | ✅ | 1/1 | | {B}: Regenerate |
| Ekundu Griffin | ❌ | 2/2 | Flying, First Strike | Keywords only |
| Elder Druid | ❌ | 2/2 | | {3}{G},{T}: Untap/tap |
| Elven Riders | ❌ | 3/3 | | Can't be blocked except by flyers/walls |
| Elvish Archers | ❌ | 2/1 | First Strike | Keywords only |
| Ethereal Champion | ❌ | 3/3 | | Protection from color spell |
| Evil Eye of Orms-by-Gore | ❌ | 3/6 | | Blocks alone, non-Eyes can't attack |
| Fallen Angel | ❌ | 3/3 | Flying | Sac creature: +2/+1 |
| Femeref Archers | ❌ | 2/2 | | {T}: 4 damage to attacking flyer |
| Feral Shadow | ❌ | 2/1 | Flying | Keywords only |
| Fire Elemental | ❌ | 5/4 | | Vanilla |
| Flame Spirit | ❌ | 2/3 | | {R}: +1/+0 |
| Fog Elemental | ❌ | 4/4 | Flying | Attacks → sacrifice unless {U} |
| Fyndhorn Brownie | ❌ | 1/1 | | {2}{G},{T}: Untap creature |
| Giant Spider | ❌ | 2/4 | Reach | Keywords only |
| Glacial Wall | ❌ | 0/7 | Defender | Keywords only |
| Goblin Digging Team | ❌ | 1/1 | | {T},{Sac}: Destroy wall |
| Goblin Elite Infantry | ❌ | 2/2 | | Attacks alone restrictions |
| Goblin Hero | ❌ | 2/2 | | Vanilla |
| Goblin King | ✅ | 2/2 | | Lord: Goblins +1/+1 mountainwalk |
| Goblin Recruiter | ❌ | 1/1 | | ETB: Stack goblins |
| Gorilla Chieftain | ✅ | 3/3 | | {1}{G}: Regenerate |
| Gravebane Zombie | ❌ | 3/2 | | Dies: Put on library |
| Harmattan Efreet | ❌ | 2/2 | Flying | {1}{U}{U}: Creature gains flying |
| Heavy Ballista | ❌ | 2/3 | | {T}: 2 damage to attacker/blocker |
| Horned Turtle | ❌ | 1/4 | | Vanilla |
| Hulking Cyclops | ❌ | 5/5 | | Can't block |
| Infantry Veteran | ❌ | 1/1 | | {T}: +1/+1 to attacker |
| Kjeldoran Dead | ✅ | 3/1 | | {B}: Regenerate, ETB sac creature |
| Kjeldoran Royal Guard | ❌ | 2/5 | | {T}: Redirect damage |
| Lead Golem | ❌ | 3/5 | | Doesn't untap if attacked |
| Longbow Archer | ❌ | 2/1 | First Strike, Reach | Keywords only |
| Lord of Atlantis | ✅ | 2/2 | | Lord: Merfolk +1/+1 islandwalk |
| Lost Soul | ❌ | 2/1 | Swampwalk | Keywords only |
| Merfolk of the Pearl Trident | ❌ | 1/1 | | Vanilla |
| Mesa Falcon | ❌ | 1/1 | Flying | {1}{W}: +0/+1 |
| Mountain Goat | ❌ | 1/1 | Mountainwalk | Keywords only |
| Necrosavant | ❌ | 5/5 | | Sac creature: Return from graveyard |
| Obsianus Golem | ❌ | 4/6 | | Vanilla |
| Orcish Artillery | ❌ | 1/3 | | {T}: 2 damage to any target, 3 to you |
| Order of the Sacred Torch | ❌ | 2/2 | | Protection from black, counter black |
| Ornithopter | ❌ | 0/2 | Flying | Free to cast |
| Panther Warriors | ❌ | 6/3 | | Vanilla |
| Patagia Golem | ❌ | 2/3 | | {3}: Gains flying |
| Pearl Dragon | ❌ | 4/4 | Flying | {W}: +0/+1 |
| Phantom Warrior | ❌ | 2/2 | | Can't be blocked |
| Pradesh Gypsies | ❌ | 1/1 | | {1}{G},{T}: -2/-0 |
| Python | ❌ | 3/2 | | Vanilla |
| Radjan Spirit | ❌ | 3/2 | | Loses flying from target |
| Rag Man | ❌ | 2/1 | | {B}{B}{B},{T}: Random discard creature |
| Raging Goblin | ❌ | 1/1 | Haste | Keywords only |
| Reckless Embermage | ❌ | 2/2 | | {R}: 1 damage, same to self |
| Redwood Treefolk | ❌ | 3/6 | | Vanilla |
| Regal Unicorn | ❌ | 2/3 | | Vanilla |
| Resistance Fighter | ❌ | 1/1 | | Sac: Prevent damage |
| River Boa | ✅ | 2/1 | Islandwalk | {G}: Regenerate |
| Sabretooth Tiger | ❌ | 2/1 | First Strike | Keywords only |
| Samite Healer | ❌ | 1/1 | | {T}: Prevent 1 damage |
| Scaled Wurm | ❌ | 7/6 | | Vanilla |
| Scathe Zombies | ❌ | 2/2 | | Vanilla |
| Sea Monster | ❌ | 6/6 | | Can't attack unless opponent has island |
| Segovian Leviathan | ❌ | 3/3 | Islandwalk | Keywords only |
| Sengir Autocrat | ❌ | 2/2 | | ETB/Dies: Serf tokens |
| Shanodin Dryads | ❌ | 1/1 | Forestwalk | Keywords only |
| Sibilant Spirit | ❌ | 5/6 | Flying | Opponent draws on attack |
| Soldevi Sage | ❌ | 1/1 | | {T},{Sac}: Draw 3, discard 4 |
| Spitting Drake | ❌ | 2/2 | Flying | {R}: +1/+0 |
| Stalking Tiger | ❌ | 3/3 | | Must be blocked by 2+ |
| Standing Troops | ❌ | 1/4 | Vigilance | Keywords only |
| Storm Crow | ❌ | 1/2 | Flying | Keywords only |
| Stromgald Cabal | ❌ | 2/2 | | {T}, pay life: Counter white |
| Sunweb | ❌ | 5/6 | Defender, Flying | Can't block small |
| Talruum Minotaur | ❌ | 3/3 | Haste | Keywords only |
| Thicket Basilisk | ❌ | 2/4 | | Deathtouch-like |
| Trained Armodon | ❌ | 3/3 | | Vanilla |
| Tundra Wolves | ❌ | 1/1 | First Strike | Keywords only |
| Unseen Walker | ❌ | 1/1 | Forestwalk | {1}{G}: Creature gains forestwalk |
| Unyaro Griffin | ❌ | 2/2 | Flying | Sac: Counter red |
| Verduran Enchantress | ❌ | 0/2 | | Draw on enchantment cast |
| Viashino Warrior | ❌ | 4/2 | | Vanilla |
| Vodalian Soldiers | ❌ | 1/2 | | Vanilla |
| Volcanic Dragon | ❌ | 4/4 | Flying, Haste | Keywords only |
| Wall of Air | ❌ | 1/5 | Defender, Flying | Keywords only |
| Wall of Fire | ❌ | 0/5 | Defender | {R}: +1/+0 |
| Wall of Swords | ❌ | 3/5 | Defender, Flying | Keywords only |
| Warthog | ❌ | 3/2 | Swampwalk | Keywords only |
| Wind Drake | ❌ | 2/2 | Flying | Keywords only |
| Wyluli Wolf | ❌ | 1/1 | | {T}: Creature gets +1/+1 |
| Zombie Master | ✅ | 2/3 | | Lord: Zombies regenerate + swampwalk |

## Instants (34/38 Complete)

| Card | Status | Cost | Effect | Notes |
|------|--------|------|--------|-------|
| Boil | ✅ | {3}{R} | Destroy all Islands | Week 1.5.2 |
| Boomerang | ✅ | {U}{U} | Return permanent to hand | Week 1.5.2 |
| Counterspell | ✅ | {U}{U} | Counter target spell | |
| Disenchant | ✅ | {1}{W} | Destroy artifact/enchantment | |
| Early Harvest | ✅ | {1}{G}{G} | Untap all basic lands you control | Week 1.5.2 |
| Enlightened Tutor | ✅ | {W} | Search for artifact/enchantment | Week 1.5.2 |
| Exile | ✅ | {2}{W} | Exile attacking creature, gain life | |
| Fatal Blow | ✅ | {B} | Destroy damaged creature | Week 1.5.2 |
| Fog | ✅ | {G} | Prevent all combat damage | Week 1.5.1 |
| Giant Growth | ✅ | {G} | +3/+3 until EOT | |
| Healing Salve | ✅ | {W} | Gain 3 life or prevent 3 | Week 1.5.1 |
| Howl from Beyond | ✅ | {X}{B} | +X/+0 until EOT | |
| Inferno | ✅ | {5}{R}{R} | 6 damage to all creatures/players | Week 1.5.2 |
| Inspiration | ✅ | {3}{U} | Draw 2 cards | Week 1.5.2 |
| Lightning Blast | ✅ | {3}{R} | 4 damage to any target | |
| Mana Short | ✅ | {2}{U} | Tap lands, empty mana pool | Week 1.5.2 |
| Memory Lapse | ✅ | {1}{U} | Counter, put on top of library | Week 1.5.2 |
| Mystical Tutor | ✅ | {U} | Search for instant/sorcery | Week 1.5.2 |
| Power Sink | ✅ | {X}{U} | Counter unless pay X | |
| Remedy | ✅ | {1}{W} | Prevent 5 damage to creature | Week 1.5.2 |
| Remove Soul | ✅ | {1}{U} | Counter creature spell | Week 1.5.2 |
| Reprisal | ✅ | {1}{W} | Destroy 4+ power creature | Week 1.5.2 |
| Reverse Damage | ✅ | {1}{W}{W} | Prevent damage, gain life | Week 1.5.2 |
| Shatter | ✅ | {1}{R} | Destroy artifact | Week 1.5.2 |
| Shock | ✅ | {R} | 2 damage to any target | |
| Spell Blast | ✅ | {X}{U} | Counter CMC X spell | |
| Terror | ✅ | {1}{B} | Destroy nonblack creature | |
| Unsummon | ✅ | {U} | Return creature to hand | |
| Vampiric Tutor | ✅ | {B} | Search for any card | Week 1.5.2 |
| Vertigo | ✅ | {R} | 2 damage to flyer | Week 1.5.2 |
| Vitalize | ✅ | {G} | Untap your creatures | Week 1.5.2 |
| Volcanic Geyser | ✅ | {X}{R}{R} | X damage to any target | |
| Warrior's Honor | ✅ | {2}{W} | Your creatures +1/+1 | Week 1.5.2 |
| Worldly Tutor | ✅ | {G} | Search for creature | Week 1.5.2 |

### Deferred to Phase 1.6

| Card | Status | Cost | Effect | Reason |
|------|--------|------|--------|--------|
| Deflection | 🕐 | {3}{U} | Change target of spell | Target redirection |
| Desertion | 🕐 | {3}{U}{U} | Counter spell, steal permanent | Control change |
| Final Fortune | 🕐 | {R}{R} | Extra turn, then lose | Extra turns |
| Flash | 🕐 | {1}{U} | Flash in creature from hand | Flash mechanic |

---

## Sorceries (47/53 Complete)


| Card | Status | Cost | Effect | Notes |
|------|--------|------|--------|-------|
| Agonizing Memories | ✅ | {2}{B}{B} | Put 2 cards on top of library | Week 1.5.2 |
| Ancestral Memories | ✅ | {2}{U}{U}{U} | Look at 7, keep 2 | Week 1.5.2 |
| Armageddon | ✅ | {3}{W} | Destroy all lands | Week 1.5.2 |
| Ashen Powder | ✅ | {2}{B}{B} | Return creature from any graveyard | Week 1.5.2 |
| Blaze | ✅ | {X}{R} | X damage to any target | |
| Coercion | ✅ | {2}{B} | Target player discards (you choose) | |
| Creeping Mold | ✅ | {2}{G}{G} | Destroy artifact/enchantment/land | Week 1.5.2 |
| Dream Cache | ✅ | {2}{U} | Draw 3, put 2 back | Week 1.5.2 |
| Dry Spell | ✅ | {1}{B} | 1 damage to creatures and players | Week 1.5.2 |
| Earthquake | ✅ | {X}{R} | X damage to non-flyers and players | |
| Elven Cache | ✅ | {2}{G}{G} | Return 2 cards from graveyard | Week 1.5.2 |
| Fallow Earth | ✅ | {2}{G} | Put land on top of library | Week 1.5.2 |
| Fit of Rage | ✅ | {1}{R} | +3/+3 and first strike until EOT | Week 1.5.2 |
| Flashfires | ✅ | {3}{R} | Destroy all Plains | Week 1.5.2 |
| Forget | ✅ | {U}{U} | Discard 2, draw 2 | Week 1.5.2 |
| Hammer of Bogardan | ✅ | {1}{R}{R} | 3 damage, recursion | Week 1.5.2 |
| Hurricane | ✅ | {X}{G} | X damage to flyers and players | |
| Icatian Town | ✅ | {5}{W} | Create 4 Citizen tokens | Week 1.5.2 |
| Infernal Contract | ✅ | {B}{B}{B} | Draw 4, lose half life | Week 1.5.2 |
| Jokulhaups | ✅ | {4}{R}{R} | Destroy all non-enchantment | Week 1.5.2 |
| Library of Lat-Nam | ✅ | {4}{U} | Opponent chooses: draw 3 or tutor | Week 1.5.2 |
| Lightning Blast | ✅ | {3}{R} | 4 damage to any target | |
| Mind Warp | ✅ | {X}{3}{B} | Target discards X cards | |
| Nature's Resurgence | ✅ | {2}{G}{G} | Return all creatures from graveyards | Week 1.5.2 |
| Painful Memories | ✅ | {1}{B} | Put card from hand on library | Week 1.5.2 |
| Perish | ✅ | {2}{B} | Destroy all green creatures | Week 1.5.2 |
| Pillage | ✅ | {1}{R}{R} | Destroy artifact or land | Week 1.5.2 |
| Prosperity | ✅ | {X}{U} | All players draw X cards | |
| Pyrotechnics | ✅ | {4}{R} | 4 damage divided | Week 1.5.2 |
| Raise Dead | ✅ | {B} | Return creature to hand | Week 1.5.2 |
| Rampant Growth | ✅ | {1}{G} | Search for basic land | Week 1.5.2 |
| Recall | ✅ | {X}{X}{U} | Return X cards from graveyard | |
| Relearn | ✅ | {1}{U}{U} | Return instant/sorcery | Week 1.5.2 |
| Shatterstorm | ✅ | {2}{R}{R} | Destroy all artifacts | Week 1.5.2 |
| Spitting Earth | ✅ | {1}{R} | Damage = Mountains | Week 1.5.2 |
| Stone Rain | ✅ | {2}{R} | Destroy land | Week 1.5.2 |
| Stream of Life | ✅ | {X}{G} | Target gains X life | |
| Stupor | ✅ | {2}{B} | Discard 2 (1 random, 1 choice) | Week 1.5.2 |
| Summer Bloom | ✅ | {1}{G} | Play 3 additional lands | Week 1.5.2 |
| Syphon Soul | ✅ | {2}{B} | 2 damage to opponents, gain that life | Week 1.5.2 |
| Tariff | ✅ | {1}{W} | Each player sacrifices creature | Week 1.5.2 |
| Tidal Surge | ✅ | {1}{U} | Tap all non-flyers | Week 1.5.2 |
| Tranquility | ✅ | {2}{G} | Destroy all enchantments | Week 1.5.2 |
| Tremor | ✅ | {R} | 1 damage to non-flyers | Week 1.5.2 |
| Untamed Wilds | ✅ | {2}{G} | Search for basic land to battlefield | Week 1.5.2 |
| Waiting in the Weeds | ✅ | {1}{G}{G} | Create Cat tokens | Week 1.5.2 |
| Wrath of God | ✅ | {2}{W}{W} | Destroy all creatures | Week 1.5.2 |

### Deferred to Phase 1.6

| Card | Status | Cost | Effect | Reason |
|------|--------|------|--------|--------|
| Diminishing Returns | 🕐 | {2}{U}{U} | Exile hand+grave, draw 7, exile top 10 | Complex replacement |
| Doomsday | 🕐 | {B}{B}{B} | Build 5-card library | Library building |
| Illicit Auction | 🕐 | {3}{R}{R} | Bid life for creature control | Bidding mechanic |
| Juxtapose | 🕐 | {3}{U} | Exchange creatures | Control exchange |
| Polymorph | 🕐 | {3}{U} | Transform creature | Transformation |
| Psychic Transfer | 🕐 | {4}{U} | Exchange life totals partially | Life exchange |

## Auras (1/22 Complete)


| Card | Status | Cost | Effect |
|------|--------|------|--------|
| Pacifism | ✅ | {1}{W} | Can't attack or block |
| Abduction | ❌ | {2}{U}{U} | Steal creature, untap ETB, return on death | Control change |
| Animate Wall | ❌ | {W} | Wall can attack | Enable attack |
| Blight | ❌ | {B}{B} | Destroy land when tapped | Triggered destroy |
| Burrowing | ❌ | {R} | Mountainwalk | Grant keyword |
| Conquer | ❌ | {3}{R}{R} | Control enchanted land | Control change |
| Divine Transformation | ❌ | {2}{W}{W} | +3/+3 | Stat buff |
| Enfeeblement | ❌ | {B}{B} | -2/-2 | Stat debuff |
| Fear | ❌ | {B}{B} | Fear (can't be blocked except by...) | Grant keyword |
| Feast of the Unicorn | ❌ | {3}{B} | +4/+0 | Stat buff |
| Firebreathing | ❌ | {R} | {R}: +1/+0 | Grant activated ability |
| Flight | ❌ | {U} | Flying | Grant keyword |
| Gaseous Form | ❌ | {2}{U} | Prevent all combat damage | Damage prevention |
| Giant Strength | ❌ | {R}{R} | +2/+2 | Stat buff |
| Hero's Resolve | ❌ | {1}{W} | +1/+5 | Stat buff |
| Leshrac's Rite | ❌ | {B} | Swampwalk | Grant keyword |
| Lure | ❌ | {1}{G}{G} | Must be blocked by all | Block requirement |
| Phantasmal Terrain | ❌ | {U}{U} | Change land type | Type change |
| Psychic Venom | ❌ | {1}{U} | 2 damage when tapped | Triggered damage |
| Regeneration | ❌ | {1}{G} | {G}: Regenerate | Grant activated ability |
| Spirit Link | ❌ | {W} | Lifelink-like | Damage trigger |
| Wild Growth | ❌ | {G} | Add extra mana | Mana ability |

---

## Enchantments (0/34 Complete)

| Card | Status | Cost | Effect | Notes |
|------|--------|------|--------|-------|
| Aether Flash | ❌ | {2}{R}{R} | 2 damage to entering creatures | ETB trigger |
| Browse | ❌ | {2}{U}{U} | Look at 5, take 1, exile rest | Repeatable |
| Call of the Wild | ❌ | {2}{G}{G} | Reveal + put creature into play | Library reveal |
| Castle | ✅ | {3}{W} | Untapped creatures +0/+2 | Static buff |
| Celestial Dawn | ❌ | {1}{W}{W} | All lands are Plains, all colors are white | Color change |
| Chill | ❌ | {1}{U} | Red spells cost more | Cost modification |
| Circle of Protection: Black | ❌ | {1}{W} | Prevent black damage | Damage prevention |
| Circle of Protection: Blue | ❌ | {1}{W} | Prevent blue damage | Damage prevention |
| Circle of Protection: Green | ❌ | {1}{W} | Prevent green damage | Damage prevention |
| Circle of Protection: Red | ❌ | {1}{W} | Prevent red damage | Damage prevention |
| Circle of Protection: White | ❌ | {1}{W} | Prevent white damage | Damage prevention |
| Crusade | ✅ | {W}{W} | White creatures +1/+1 | Static buff |
| Dense Foliage | ❌ | {2}{G} | Creatures can't be targeted | Shroud granting |
| Dread of Night | ✅ | {B} | White creatures -1/-1 | Static debuff |
| Familiar Ground | ❌ | {2}{G} | Your creatures can't be blocked by more than one | Block restriction |
| Fervor | ✅ | {2}{R} | Your creatures have haste | Grant keyword |
| Forbidden Crypt | ❌ | {3}{B}{B} | Graveyard replacement | Replacement effect |
| Goblin Warrens | ❌ | {2}{R} | Sac 2 Goblins: Make 3 | Token generation |
| Greed | ❌ | {3}{B} | Pay life: Draw card | Activated ability |
| Hecatomb | ❌ | {1}{B}{B} | Sac creatures: Damage | Complex sacrifice |
| Insight | ❌ | {2}{U} | Draw when opponent casts green | Triggered draw |
| Kismet | ❌ | {3}{W} | Opponent's stuff enters tapped | Static effect |
| Light of Day | ❌ | {3}{W} | Black creatures can't attack | Attack restriction |
| Living Lands | ❌ | {3}{G} | Forests are 1/1 creatures | Animate lands |
| Manabarbs | ❌ | {3}{R} | Damage when tapping lands | Triggered damage |
| Orcish Oriflamme | ✅ | {3}{R} | Attacking creatures +1/+0 | Static buff |
| Pestilence | ❌ | {2}{B}{B} | {B}: 1 damage to all | Activated damage |
| Rowen | ❌ | {2}{G}{G} | Draw on basic land reveal | Conditional draw |
| Serenity | ❌ | {1}{W} | Destroy all artifacts/enchantments | Triggered destroy |
| Serra's Blessing | ✅ | {1}{W} | Your creatures have vigilance | Grant keyword |
| Strands of Night | ❌ | {2}{B}{B} | Pay life + sac land: Return creature | Reanimation |
| Tranquil Grove | ❌ | {1}{G} | {1}{G}{G}: Destroy all enchantments | Activated destroy |
| Warmth | ❌ | {1}{W} | Gain life when opponent casts red | Triggered life |
| Zur's Weirding | ❌ | {3}{U} | Reveal draws, pay life to deny | Replacement effect |

---

## Artifacts (0/41 Complete)

| Card | Status | Cost | Effect | Notes |
|------|--------|------|--------|-------|
| Aladdin's Ring | ❌ | {8} | {8},{T}: 4 damage | Activated damage |
| Amber Prison | ❌ | {4} | Tap to detain permanent | Detain mechanic |
| Ankh of Mishra | ❌ | {2} | 2 damage on land play | Triggered damage |
| Ashnod's Altar | ❌ | {3} | Sac creature: Add {C}{C} | Sacrifice outlet |
| Bottle of Suleiman | ❌ | {4} | Flip for Djinn token | Random token |
| Charcoal Diamond | ❌ | {2} | Enters tapped, {T}: Add {B} | Mana rock |
| Crystal Rod | ❌ | {1} | Pay on blue spell: Gain 1 life | Triggered life |
| Cursed Totem | ❌ | {2} | Creatures' activated abilities disabled | Static disable |
| Dingus Egg | ❌ | {4} | 2 damage when land dies | Death trigger |
| Disrupting Scepter | ❌ | {3} | {3},{T}: Target discards | Activated discard |
| Dragon Mask | ❌ | {3} | {3}: +2/+2, return to hand | Temporary buff |
| Fire Diamond | ❌ | {2} | Enters tapped, {T}: Add {R} | Mana rock |
| Flying Carpet | ❌ | {4} | {2},{T}: Creature gains flying | Grant ability |
| Fountain of Youth | ❌ | {0} | {2},{T}: Gain 1 life | Life gain |
| Glasses of Urza | ❌ | {1} | Look at opponent's hand | Information |
| Grinning Totem | ❌ | {4} | Search opponent's library, play or exile | Tutor opponent |
| Howling Mine | ❌ | {2} | All players draw extra | Symmetrical draw |
| Iron Star | ❌ | {1} | Pay on red spell: Gain 1 life | Triggered life |
| Ivory Cup | ❌ | {1} | Pay on white spell: Gain 1 life | Triggered life |
| Jade Monolith | ❌ | {4} | {1}: Redirect 1 damage | Damage redirect |
| Jalum Tome | ❌ | {3} | {2},{T}: Draw then discard | Looting |
| Jayemdae Tome | ❌ | {4} | {4},{T}: Draw a card | Card draw |
| Mana Prism | ❌ | {3} | {1},{T}: Add any color | Mana filter |
| Marble Diamond | ❌ | {2} | Enters tapped, {T}: Add {W} | Mana rock |
| Meekstone | ❌ | {1} | Creatures 3+ power don't untap | Untap prevention |
| Millstone | ❌ | {2} | {2},{T}: Mill 2 | Mill |
| Moss Diamond | ❌ | {2} | Enters tapped, {T}: Add {G} | Mana rock |
| Mystic Compass | ❌ | {2} | {1},{T}: Land becomes basic type | Type change |
| Pentagram of the Ages | ❌ | {4} | {4},{T}: Prevent 1 damage | Damage prevention |
| Phyrexian Vault | ❌ | {3} | {2},{T},{Sac creature}: Draw | Sacrifice draw |
| Rod of Ruin | ❌ | {4} | {3},{T}: 1 damage | Activated damage |
| Skull Catapult | ❌ | {4} | {1},{T},{Sac creature}: 2 damage | Sacrifice damage |
| Sky Diamond | ❌ | {2} | Enters tapped, {T}: Add {U} | Mana rock |
| Snake Basket | ❌ | {4} | {X},{T},{Sac}: X Snake tokens | Token generation |
| Soul Net | ❌ | {1} | Pay when creature dies: Gain 1 life | Death trigger |
| Storm Cauldron | ❌ | {5} | Lands bounce, extra land drop | Land bounce |
| Teferi's Puzzle Box | ❌ | {4} | Draw step replacement | Replacement effect |
| The Hive | ❌ | {5} | {5},{T}: Create Wasp token | Token generation |
| Throne of Bone | ❌ | {1} | Pay on black spell: Gain 1 life | Triggered life |
| Wand of Denial | ❌ | {2} | {T}: Look at top, exile non-land | Library exile |
| Wooden Sphere | ❌ | {1} | Pay on green spell: Gain 1 life | Triggered life |

---

## Deferred Cards (Phase 1.6)

These cards require complex mechanics that will be addressed after Phase 1.5:

| Card | Category | Reason |
|------|----------|--------|
| Abduction | Aura | Control change + complex triggers |
| Celestial Dawn | Enchantment | Color/type changing |
| Deflection | Instant | Target redirection system |
| Desertion | Instant | Counter + control change combo |
| Diminishing Returns | Sorcery | Complex exile/draw replacement |
| Doomsday | Sorcery | Library building |
| Final Fortune | Instant | Extra turn system |
| Flash | Instant | Non-standard creature deployment |
| Forbidden Crypt | Enchantment | Replacement effects |
| Illicit Auction | Sorcery | Bidding mechanic |
| Juxtapose | Sorcery | Permanent exchange |
| Living Lands | Enchantment | Land animation |
| Polymorph | Sorcery | Creature transformation |
| Primal Clay | Creature | Shapeshifter choice |
| Psychic Transfer | Sorcery | Life total exchange |
| Teferi's Puzzle Box | Artifact | Draw replacement |
| Zur's Weirding | Enchantment | Replacement effect |

**Total Deferred:** 17 cards (~5% of 6th Edition)

---

## Mechanics Status

| Mechanic | Status | Notes |
|----------|--------|-------|
| Mana costs | ✅ | Full parsing and payment |
| Targeting | ✅ | All target types |
| Stack/Priority | ✅ | LIFO resolution |
| Combat keywords | ✅ | Flying, First Strike, Trample, etc. |
| ETB triggers | ✅ | Working |
| Death triggers | ✅ | Wired in stateBasedActions.ts (Week 1.5.1) |
| Sacrifice effects | ✅ | SACRIFICE_PERMANENT action + ability costs (Week 1.5.1) |
| Regeneration | ✅ | Needed for ~10 cards |
| X-cost spells | ✅ | Earthquake, Hurricane, Blaze, etc. (Week 1.5.1) |
| Token generation | ✅ | Full framework: createToken(), 7 token types (Week 1.5.1) |
| Damage prevention | ✅ | Fog, Healing Salve, Remedy, Reverse Damage (Week 1.5.2) |
| Life gain/loss | ✅ | Stream of Life, life payment costs (Week 1.5.1) |
| Tutors (simplified) | ✅ | First-match search: Vampiric, Mystical, Worldly, Enlightened (Week 1.5.2) |
| Mass effects | ✅ | destroyAllOfType, untapPermanents, dealDamageToAll (Week 1.5.2) |
| Team pump | ✅ | applyTeamPump until EOT (Week 1.5.2) |
| Counter variants | ✅ | Memory Lapse, Remove Soul (Week 1.5.2) |
| Graveyard recursion | ✅ | returnFromGraveyard, Raise Dead, Ashen Powder (Week 1.5.2) |
| Extra turns/combats | 🕐 | Deferred to Phase 1.6 |
| Control changing | 🕐 | Deferred to Phase 1.6 |
| Land type changing | 🕐 | Deferred to Phase 1.6 |
| Cost modification | ❌ | Needed for ~5 cards |
| Landwalk | ✅ | All landwalk types (Week 1.5.3) |
| Fear/Intimidate | ✅ | Evasion keywords (Week 1.5.3) |
| Defender | ✅ | Attack prevention (Week 1.5.3) |
| Protection | 🚧 | Partial |
| Lords/Anthems | ✅ | Needed for ~8 cards |

---

## Weekly Progress

### Week 1.5.1 (Infrastructure) ✅ COMPLETE
- [x] Death triggers (wired in stateBasedActions.ts)
- [x] Sacrifice mechanics (SACRIFICE_PERMANENT action + ability costs)
- [x] X-cost handling (11 spells: Earthquake, Hurricane, Blaze, etc.)
- [x] Token generation (full framework: 7 token types, createToken/createTokens functions)
- [x] All 12 lands working (Pain lands: 5, Sacrifice lands: 5, City of Brass, Crystal Vein)
  - Pain lands: tap for {C} or tap for colored + 1 damage (life cost)
  - Sacrifice lands: enter tapped, tap for 1 mana or tap+sac for 2 mana
  - City of Brass: triggered ability deals 1 damage when tapped
  - Added BECOMES_TAPPED trigger event
- [x] Damage prevention (Fog, Healing Salve)
  - Fog: sets preventAllCombatDamage flag, prevents all combat damage
  - Healing Salve: life gain mode implemented (3 life)
  - COPs deferred to Phase 1.5.5 (activated ability enchantments)

### Week 1.5.2 (Spells) ✅ COMPLETE
- [x] All Instants implemented (34/38, 4 deferred)
- [x] All Sorceries implemented (47/53, 6 deferred)
- [x] 100-game simulation: 0 errors
- [x] 333 unit tests passing
- [x] Helper functions in effects.ts:
  - destroyAllOfType, destroyAllCreaturesOfColor
  - untapAllLands, untapAllCreatures
  - searchLibrary with filter support
  - returnFromGraveyard, returnCreatureFromGraveyard
  - applyTeamPump, dealDamageToAll
  - drainLife, drawCardsPayLife

### Week 1.5.3 (Creatures Part 1) ✅ COMPLETE
- [x] Keyword systems: Defender, Fear, Intimidate, Landwalk (all types)
- [x] Mana dorks: Fyndhorn Elder ({T}: Add {G}{G}), Blood Pet (verified)
- [x] ETB creatures: Venerable Monk (+2 life), Staunch Defenders (+4 life), Uktabi Orangutan (destroy artifact), Sage Owl (look at top 4), Hidden Horror (discard or sacrifice)
- [x] 100-game stability test: 0 errors
- [x] 372 unit tests passing
- [ ] Remaining vanilla/keyword creatures (Week 1.5.4)
- [ ] Remaining activated ability creatures (Week 1.5.4)

### Week 1.5.4 (Creatures Part 2) ✅ COMPLETE
- [x] Vanilla & keyword creature batch tests (75 tests passing)
- [x] Activated ability creatures (~39 cards implemented):
  - Tap damage: Orcish Artillery, Heavy Ballista, D'Avenant Archer, Femeref Archers, Anaba Shaman, Abyssal Hunter
  - Tap buff: Infantry Veteran, Wyluli Wolf, Pradesh Gypsies, Blighted Shaman
  - Pump: Flame Spirit, Dragon Engine, Pearl Dragon, Mesa Falcon, Wall of Fire, Spitting Drake
  - Tap/untap: Elder Druid, Fyndhorn Brownie, Radjan Spirit
  - Flying: Patagia Golem, Harmattan Efreet
  - Prevention: Samite Healer, Ethereal Champion
  - Sacrifice: Daraja Griffin, Daring Apprentice, Unyaro Griffin, Resistance Fighter, Goblin Digging Team, Fallen Angel
  - Counter spells: Order of the Sacred Torch, Stromgald Cabal
  - Life payment: Mischievous Poltergeist
  - Mana: Blood Pet, Fyndhorn Elder, Soldevi Sage
  - X-cost: Crimson Hellkite, Reckless Embermage, Rag Man
- [x] 525 unit tests passing
- [ ] Lords system (Day 5-6)
- [ ] Regeneration mechanic (Day 7-8)
- [ ] Variable P/T creatures (Day 9-10)

### Week 1.5.5 (Enchantments)
- [ ] All Auras working
- [ ] Global enchantments
- [ ] Triggered enchantments
- [ ] 100-game stability test

### Week 1.5.6 (Artifacts)
- [ ] Mana rocks
- [ ] Activated artifacts
- [ ] Triggered artifacts
- [ ] 100-game stability test

### Week 1.5.7 (Integration)
- [ ] 1000-game simulation
- [ ] All categories tested
- [ ] Deferred list finalized
- [ ] Documentation updated

### Week 1.5.8 (Adcanced Testing and Deckbuilding)
- [ ] Create more Test Decks
- [ ] Thoroughly test each Deck with AutBots
- [ ] Observe any Issues or Errors

---

*This document is manually updated as implementation progresses.*
