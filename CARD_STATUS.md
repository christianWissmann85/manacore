# 6th Edition Card Implementation Status

**Last Updated:** January 4, 2026
**Total Cards:** 335
**Implemented:** 20 (~6%)
**Target:** 302 (90%) by end of Phase 1.5

---

## Summary by Category

| Category | Total | Implemented | Remaining | Phase 1.5 Target |
|----------|-------|-------------|-----------|------------------|
| Basic Land | 5 | 5 | 0 | 5 (100%) |
| Land | 12 | 0 | 12 | 12 (100%) |
| Creature | 130 | 10 | 120 | 117 (90%) |
| Instant | 38 | 8 | 30 | 34 (90%) |
| Sorcery | 53 | 2 | 51 | 48 (90%) |
| Aura | 22 | 1 | 21 | 20 (90%) |
| Enchantment | 34 | 0 | 34 | 31 (90%) |
| Artifact | 41 | 0 | 41 | 37 (90%) |
| **Total** | **335** | **20** | **315** | **302 (90%)** |

---

## Status Legend

| Symbol | Meaning |
|--------|---------|
| :white_check_mark: | Complete - fully implemented and tested |
| :construction: | In Progress - partially implemented |
| :x: | Not Started |
| :clock1: | Deferred to Phase 1.6 (complex) |

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
| Forest | :white_check_mark: | {T}: Add {G} |
| Island | :white_check_mark: | {T}: Add {U} |
| Mountain | :white_check_mark: | {T}: Add {R} |
| Plains | :white_check_mark: | {T}: Add {W} |
| Swamp | :white_check_mark: | {T}: Add {B} |

---

## Non-Basic Lands (0/12 Complete)

| Card | Status | Ability | Notes |
|------|--------|---------|-------|
| Adarkar Wastes | :x: | Pain land (W/U) | Needs pain land mechanic |
| Brushland | :x: | Pain land (G/W) | Needs pain land mechanic |
| City of Brass | :x: | Any color + damage | Needs triggered damage |
| Crystal Vein | :x: | Sacrifice for {C}{C} | Needs sacrifice mechanic |
| Dwarven Ruins | :x: | Depletion land | Needs counter mechanic |
| Ebon Stronghold | :x: | Depletion land | Needs counter mechanic |
| Havenwood Battleground | :x: | Depletion land | Needs counter mechanic |
| Karplusan Forest | :x: | Pain land (R/G) | Needs pain land mechanic |
| Ruins of Trokair | :x: | Depletion land | Needs counter mechanic |
| Sulfurous Springs | :x: | Pain land (B/R) | Needs pain land mechanic |
| Svyelunite Temple | :x: | Depletion land | Needs counter mechanic |
| Underground River | :x: | Pain land (U/B) | Needs pain land mechanic |

---

## Creatures (10/130 Complete)

### Implemented Creatures

| Card | Status | P/T | Keywords | Abilities |
|------|--------|-----|----------|-----------|
| Abyssal Specter | :white_check_mark: | 2/3 | Flying | Damage trigger: discard |
| Anaba Shaman | :white_check_mark: | 2/2 | | {R},{T}: 1 damage |
| Birds of Paradise | :white_check_mark: | 0/1 | Flying | {T}: Add any color |
| Elvish Mystic | :white_check_mark: | 1/1 | | {T}: Add {G} |
| Fyndhorn Elves | :white_check_mark: | 1/1 | | {T}: Add {G} |
| Gravedigger | :white_check_mark: | 2/2 | | ETB: Return creature |
| Grizzly Bears | :white_check_mark: | 2/2 | | Vanilla |
| Llanowar Elves | :white_check_mark: | 1/1 | | {T}: Add {G} |
| Prodigal Sorcerer | :white_check_mark: | 1/1 | | {T}: 1 damage |
| Air Elemental | :white_check_mark: | 4/4 | Flying | Keywords only |

### Not Yet Implemented

| Card | Status | P/T | Keywords | Ability Summary |
|------|--------|-----|----------|-----------------|
| Abyssal Hunter | :x: | 1/1 | | {B},{T}: Tap + damage |
| Anaba Bodyguard | :x: | 2/3 | First Strike | Keywords only |
| Archangel | :x: | 5/5 | Flying, Vigilance | Keywords only |
| Ardent Militia | :x: | 2/4 | Vigilance | Keywords only |
| Armored Pegasus | :x: | 1/2 | Flying | Keywords only |
| Balduvian Barbarians | :x: | 3/2 | | Vanilla |
| Balduvian Horde | :x: | 5/5 | | ETB: Discard/sacrifice |
| Blighted Shaman | :x: | 1/1 | | {T},{Sac}: -1/-1 |
| Blood Pet | :x: | 1/1 | | Sac: Add {B} |
| Bog Imp | :x: | 1/1 | Flying | Keywords only |
| Bog Rats | :x: | 1/1 | | Can't be blocked by Walls |
| Bog Wraith | :x: | 3/3 | Swampwalk | Keywords only |
| Cat Warriors | :x: | 2/2 | Forestwalk | Keywords only |
| Crimson Hellkite | :x: | 6/6 | Flying | {X},{R},{T}: X damage |
| D'Avenant Archer | :x: | 1/2 | | {T}: 1 damage to attacking |
| Dancing Scimitar | :x: | 1/5 | Flying | Keywords only |
| Daraja Griffin | :x: | 2/2 | Flying | Sac: Destroy black |
| Daring Apprentice | :x: | 1/1 | | {T},{Sac}: Counter |
| Derelor | :x: | 4/4 | | Black spells cost more |
| Dragon Engine | :x: | 1/3 | | {2}: +1/+0 |
| Drudge Skeletons | :x: | 1/1 | | {B}: Regenerate |
| Ekundu Griffin | :x: | 2/2 | Flying, First Strike | Keywords only |
| Elder Druid | :x: | 2/2 | | {3}{G},{T}: Untap/tap |
| Elven Riders | :x: | 3/3 | | Can't be blocked except by flyers/walls |
| Elvish Archers | :x: | 2/1 | First Strike | Keywords only |
| Ethereal Champion | :x: | 3/3 | | Protection from color spell |
| Evil Eye of Orms-by-Gore | :x: | 3/6 | | Blocks alone, non-Eyes can't attack |
| Fallen Angel | :x: | 3/3 | Flying | Sac creature: +2/+1 |
| Femeref Archers | :x: | 2/2 | | {T}: 4 damage to attacking flyer |
| Feral Shadow | :x: | 2/1 | Flying | Keywords only |
| Fire Elemental | :x: | 5/4 | | Vanilla |
| Flame Spirit | :x: | 2/3 | | {R}: +1/+0 |
| Fog Elemental | :x: | 4/4 | Flying | Attacks → sacrifice unless {U} |
| Fyndhorn Brownie | :x: | 1/1 | | {2}{G},{T}: Untap creature |
| Fyndhorn Elder | :x: | 1/1 | | {T}: Add {G}{G} |
| Giant Spider | :x: | 2/4 | Reach | Keywords only |
| Glacial Wall | :x: | 0/7 | Defender | Keywords only |
| Goblin Digging Team | :x: | 1/1 | | {T},{Sac}: Destroy wall |
| Goblin Elite Infantry | :x: | 2/2 | | Attacks alone restrictions |
| Goblin Hero | :x: | 2/2 | | Vanilla |
| Goblin King | :x: | 2/2 | | Lord: Goblins +1/+1 mountainwalk |
| Goblin Recruiter | :x: | 1/1 | | ETB: Stack goblins |
| Gorilla Chieftain | :x: | 3/3 | | {1}{G}: Regenerate |
| Gravebane Zombie | :x: | 3/2 | | Dies: Put on library |
| Harmattan Efreet | :x: | 2/2 | Flying | {1}{U}{U}: Creature gains flying |
| Heavy Ballista | :x: | 2/3 | | {T}: 2 damage to attacker/blocker |
| Hidden Horror | :x: | 4/4 | | ETB: Discard creature |
| Horned Turtle | :x: | 1/4 | | Vanilla |
| Hulking Cyclops | :x: | 5/5 | | Can't block |
| Infantry Veteran | :x: | 1/1 | | {T}: +1/+1 to attacker |
| Kjeldoran Dead | :x: | 3/1 | | Sac: Regenerate, sac creature on ETB |
| Kjeldoran Royal Guard | :x: | 2/5 | | {T}: Redirect damage |
| Lead Golem | :x: | 3/5 | | Doesn't untap if attacked |
| Longbow Archer | :x: | 2/1 | First Strike, Reach | Keywords only |
| Lord of Atlantis | :x: | 2/2 | | Lord: Merfolk +1/+1 islandwalk |
| Lost Soul | :x: | 2/1 | Swampwalk | Keywords only |
| Maro | :x: | */* | | P/T = cards in hand |
| Merfolk of the Pearl Trident | :x: | 1/1 | | Vanilla |
| Mesa Falcon | :x: | 1/1 | Flying | {1}{W}: +0/+1 |
| Mischievous Poltergeist | :x: | 1/1 | Flying | Pay life: Regenerate |
| Mountain Goat | :x: | 1/1 | Mountainwalk | Keywords only |
| Necrosavant | :x: | 5/5 | | Sac creature: Return from graveyard |
| Nightmare | :x: | */* | Flying | P/T = Swamps you control |
| Obsianus Golem | :x: | 4/6 | | Vanilla |
| Orcish Artillery | :x: | 1/3 | | {T}: 2 damage to any target, 3 to you |
| Order of the Sacred Torch | :x: | 2/2 | | Protection from black, counter black |
| Ornithopter | :x: | 0/2 | Flying | Free to cast |
| Panther Warriors | :x: | 6/3 | | Vanilla |
| Patagia Golem | :x: | 2/3 | | {3}: Gains flying |
| Pearl Dragon | :x: | 4/4 | Flying | {W}: +0/+1 |
| Phantom Warrior | :x: | 2/2 | | Can't be blocked |
| Pradesh Gypsies | :x: | 1/1 | | {1}{G},{T}: -2/-0 |
| Primal Clay | :x: | */* | | Shapeshifter |
| Python | :x: | 3/2 | | Vanilla |
| Radjan Spirit | :x: | 3/2 | | Loses flying from target |
| Rag Man | :x: | 2/1 | | {B}{B}{B},{T}: Random discard creature |
| Raging Goblin | :x: | 1/1 | Haste | Keywords only |
| Razortooth Rats | :x: | 2/1 | Fear | Keywords only |
| Reckless Embermage | :x: | 2/2 | | {R}: 1 damage, same to self |
| Redwood Treefolk | :x: | 3/6 | | Vanilla |
| Regal Unicorn | :x: | 2/3 | | Vanilla |
| Resistance Fighter | :x: | 1/1 | | Sac: Prevent damage |
| River Boa | :x: | 2/1 | Islandwalk | {G}: Regenerate |
| Sabretooth Tiger | :x: | 2/1 | First Strike | Keywords only |
| Sage Owl | :x: | 1/1 | Flying | ETB: Look at top 4, rearrange |
| Samite Healer | :x: | 1/1 | | {T}: Prevent 1 damage |
| Scaled Wurm | :x: | 7/6 | | Vanilla |
| Scathe Zombies | :x: | 2/2 | | Vanilla |
| Sea Monster | :x: | 6/6 | | Can't attack unless opponent has island |
| Segovian Leviathan | :x: | 3/3 | Islandwalk | Keywords only |
| Sengir Autocrat | :x: | 2/2 | | ETB/Dies: Serf tokens |
| Shanodin Dryads | :x: | 1/1 | Forestwalk | Keywords only |
| Sibilant Spirit | :x: | 5/6 | Flying | Opponent draws on attack |
| Soldevi Sage | :x: | 1/1 | | {T},{Sac}: Draw 3, discard 4 |
| Spitting Drake | :x: | 2/2 | Flying | {R}: +1/+0 |
| Stalking Tiger | :x: | 3/3 | | Must be blocked by 2+ |
| Standing Troops | :x: | 1/4 | Vigilance | Keywords only |
| Staunch Defenders | :x: | 3/4 | | ETB: Gain 4 life |
| Storm Crow | :x: | 1/2 | Flying | Keywords only |
| Stromgald Cabal | :x: | 2/2 | | {T}, pay life: Counter white |
| Sunweb | :x: | 5/6 | Defender, Flying | Can't block small |
| Talruum Minotaur | :x: | 3/3 | Haste | Keywords only |
| Thicket Basilisk | :x: | 2/4 | | Deathtouch-like |
| Trained Armodon | :x: | 3/3 | | Vanilla |
| Tundra Wolves | :x: | 1/1 | First Strike | Keywords only |
| Uktabi Orangutan | :x: | 2/2 | | ETB: Destroy artifact |
| Uktabi Wildcats | :x: | */* | | P/T = Forests, sac forest: regenerate |
| Unseen Walker | :x: | 1/1 | Forestwalk | {1}{G}: Creature gains forestwalk |
| Unyaro Griffin | :x: | 2/2 | Flying | Sac: Counter red |
| Venerable Monk | :x: | 2/2 | | ETB: Gain 2 life |
| Verduran Enchantress | :x: | 0/2 | | Draw on enchantment cast |
| Viashino Warrior | :x: | 4/2 | | Vanilla |
| Vodalian Soldiers | :x: | 1/2 | | Vanilla |
| Volcanic Dragon | :x: | 4/4 | Flying, Haste | Keywords only |
| Wall of Air | :x: | 1/5 | Defender, Flying | Keywords only |
| Wall of Fire | :x: | 0/5 | Defender | {R}: +1/+0 |
| Wall of Swords | :x: | 3/5 | Defender, Flying | Keywords only |
| Warthog | :x: | 3/2 | Swampwalk | Keywords only |
| Wind Drake | :x: | 2/2 | Flying | Keywords only |
| Wind Spirit | :x: | 3/2 | Flying | Can't be blocked by 1 creature |
| Wyluli Wolf | :x: | 1/1 | | {T}: Creature gets +1/+1 |
| Zombie Master | :x: | 2/3 | | Lord: Zombies regenerate + swampwalk |

---

## Instants (8/38 Complete)

### Implemented Instants

| Card | Status | Cost | Effect |
|------|--------|------|--------|
| Counterspell | :white_check_mark: | {U}{U} | Counter target spell |
| Disenchant | :white_check_mark: | {1}{W} | Destroy artifact/enchantment |
| Exile | :white_check_mark: | {2}{W} | Exile attacking creature, gain life |
| Giant Growth | :white_check_mark: | {G} | +3/+3 until EOT |
| Lightning Blast | :white_check_mark: | {3}{R} | 4 damage to any target |
| Shock | :white_check_mark: | {R} | 2 damage to any target |
| Terror | :white_check_mark: | {1}{B} | Destroy nonblack creature |
| Unsummon | :white_check_mark: | {U} | Return creature to hand |

### Not Yet Implemented

| Card | Status | Cost | Effect | Notes |
|------|--------|------|--------|-------|
| Boil | :x: | {3}{R} | Destroy all Islands | Land destruction |
| Boomerang | :x: | {U}{U} | Return permanent to hand | Needs permanent bounce |
| Deflection | :x: | {3}{U} | Change target of spell | Target redirection |
| Desertion | :x: | {3}{U}{U} | Counter spell, steal permanent | Complex counter |
| Early Harvest | :x: | {1}{G}{G} | Untap your lands | Untap mechanic |
| Enlightened Tutor | :x: | {W} | Search for artifact/enchantment | Tutor mechanic |
| Fatal Blow | :x: | {B} | Destroy damaged creature | Conditional destroy |
| Final Fortune | :x: | {R}{R} | Extra turn, then lose | Extra turn |
| Flash | :x: | {1}{U} | Flash in creature from hand | Flash mechanic |
| Fog | :x: | {G} | Prevent all combat damage | Damage prevention |
| Healing Salve | :x: | {W} | Gain 3 life or prevent 3 | Modal spell |
| Howl from Beyond | :x: | {X}{B} | +X/+0 until EOT | X-cost pump |
| Inferno | :x: | {5}{R}{R} | 6 damage to all creatures/players | Board damage |
| Inspiration | :x: | {3}{U} | Draw 2 cards | Card draw |
| Mana Short | :x: | {2}{U} | Tap lands, empty mana pool | Mana denial |
| Memory Lapse | :x: | {1}{U} | Counter, put on top of library | Counter variant |
| Mystical Tutor | :x: | {U} | Search for instant/sorcery | Tutor mechanic |
| Power Sink | :x: | {X}{U} | Counter unless pay X | Conditional counter |
| Remedy | :x: | {1}{W} | Prevent 5 damage to creature | Damage prevention |
| Remove Soul | :x: | {1}{U} | Counter creature spell | Counter variant |
| Reprisal | :x: | {1}{W} | Destroy 4+ power creature | Conditional destroy |
| Reverse Damage | :x: | {1}{W}{W} | Prevent damage, gain life | Damage prevention |
| Shatter | :x: | {1}{R} | Destroy artifact | Simple destroy |
| Spell Blast | :x: | {X}{U} | Counter CMC X spell | X-cost counter |
| Vampiric Tutor | :x: | {B} | Search for any card | Tutor mechanic |
| Vertigo | :x: | {R} | 2 damage to flyer | Conditional damage |
| Vitalize | :x: | {G} | Untap your creatures | Untap mechanic |
| Volcanic Geyser | :x: | {X}{R}{R} | X damage to any target | X-cost damage |
| Warrior's Honor | :x: | {2}{W} | Your creatures +1/+1 | Team pump |
| Worldly Tutor | :x: | {G} | Search for creature | Tutor mechanic |

---

## Sorceries (2/53 Complete)

### Implemented Sorceries

| Card | Status | Cost | Effect |
|------|--------|------|--------|
| Coercion | :white_check_mark: | {2}{B} | Target player discards (you choose) |
| Lightning Blast | :white_check_mark: | {3}{R} | 4 damage to any target |

### Not Yet Implemented

| Card | Status | Cost | Effect | Notes |
|------|--------|------|--------|-------|
| Agonizing Memories | :x: | {2}{B}{B} | Put 2 cards on top of library | Library manipulation |
| Ancestral Memories | :x: | {2}{U}{U}{U} | Look at 7, keep 2 | Card selection |
| Armageddon | :x: | {3}{W} | Destroy all lands | Mass land destroy |
| Ashen Powder | :x: | {2}{B}{B} | Return creature from any graveyard | Graveyard steal |
| Blaze | :x: | {X}{R} | X damage to any target | X-cost damage |
| Creeping Mold | :x: | {2}{G}{G} | Destroy artifact/enchantment/land | Modal destroy |
| Diminishing Returns | :x: | {2}{U}{U} | Exile hand+grave, draw 7, exile top 10 | Complex draw |
| Doomsday | :x: | {B}{B}{B} | Build 5-card library | Complex setup |
| Dream Cache | :x: | {2}{U} | Draw 3, put 2 back | Card filtering |
| Dry Spell | :x: | {1}{B} | 1 damage to creatures and players | Board damage |
| Earthquake | :x: | {X}{R} | X damage to non-flyers and players | X-cost board damage |
| Elven Cache | :x: | {2}{G}{G} | Return 2 cards from graveyard | Graveyard recursion |
| Fallow Earth | :x: | {2}{G} | Put land on top of library | Land bounce |
| Fit of Rage | :x: | {1}{R} | +3/+3 and first strike until EOT | Pump spell |
| Flashfires | :x: | {3}{R} | Destroy all Plains | Land destruction |
| Forget | :x: | {U}{U} | Discard 2, draw 2 | Discard/draw |
| Hammer of Bogardan | :x: | {1}{R}{R} | 3 damage, recursion | Graveyard return |
| Hurricane | :x: | {X}{G} | X damage to flyers and players | X-cost selective |
| Icatian Town | :x: | {5}{W} | Create 4 Citizen tokens | Token generation |
| Illicit Auction | :x: | {3}{R}{R} | Bid life for creature control | Complex bidding |
| Infernal Contract | :x: | {B}{B}{B} | Draw 4, lose half life | Life payment draw |
| Jokulhaups | :x: | {4}{R}{R} | Destroy all non-enchantment | Mass destroy |
| Juxtapose | :x: | {3}{U} | Exchange creatures | Control exchange |
| Library of Lat-Nam | :x: | {4}{U} | Opponent chooses: draw 3 or tutor | Punisher spell |
| Mind Warp | :x: | {X}{3}{B} | Target discards X | X-cost discard |
| Nature's Resurgence | :x: | {2}{G}{G} | Return all creatures from graveyards | Mass recursion |
| Painful Memories | :x: | {1}{B} | Put card from hand on library | Library manipulation |
| Perish | :x: | {2}{B} | Destroy all green creatures | Color hoser |
| Pillage | :x: | {1}{R}{R} | Destroy artifact or land | Modal destroy |
| Polymorph | :x: | {3}{U} | Transform creature | Transform mechanic |
| Prosperity | :x: | {X}{U} | All players draw X | Symmetrical draw |
| Psychic Transfer | :x: | {4}{U} | Exchange life totals partially | Life exchange |
| Pyrotechnics | :x: | {4}{R} | 4 damage divided | Divided damage |
| Raise Dead | :x: | {B} | Return creature to hand | Simple recursion |
| Rampant Growth | :x: | {1}{G} | Search for basic land | Land ramp |
| Recall | :x: | {X}{X}{U} | Return X cards from graveyard | Graveyard recursion |
| Relearn | :x: | {1}{U}{U} | Return instant/sorcery | Graveyard recursion |
| Relentless Assault | :x: | {2}{R}{R} | Extra combat phase | Extra combat |
| Shatterstorm | :x: | {2}{R}{R} | Destroy all artifacts | Mass destroy |
| Spitting Earth | :x: | {1}{R} | Damage = Mountains | Mountain count |
| Stone Rain | :x: | {2}{R} | Destroy land | Land destruction |
| Stream of Life | :x: | {X}{G} | Gain X life | X-cost life gain |
| Stupor | :x: | {2}{B} | Discard 2 (1 random, 1 choice) | Mixed discard |
| Summer Bloom | :x: | {1}{G} | Play 3 additional lands | Extra land drops |
| Syphon Soul | :x: | {2}{B} | 2 damage to opponents, gain that life | Drain |
| Tariff | :x: | {1}{W} | Each player sacrifices creature | Forced sacrifice |
| Tidal Surge | :x: | {1}{U} | Tap all non-flyers | Mass tap |
| Tranquility | :x: | {2}{G} | Destroy all enchantments | Mass enchant destroy |
| Tremor | :x: | {R} | 1 damage to non-flyers | Board damage |
| Untamed Wilds | :x: | {2}{G} | Search for basic land to battlefield | Land ramp |
| Waiting in the Weeds | :x: | {1}{G}{G} | Create Cat tokens | Token generation |
| Wrath of God | :x: | {2}{W}{W} | Destroy all creatures | Board wipe |

---

## Auras (1/22 Complete)

### Implemented Auras

| Card | Status | Cost | Effect |
|------|--------|------|--------|
| Pacifism | :white_check_mark: | {1}{W} | Can't attack or block |

### Not Yet Implemented

| Card | Status | Cost | Effect | Notes |
|------|--------|------|--------|-------|
| Abduction | :x: | {2}{U}{U} | Steal creature, untap ETB, return on death | Control change |
| Animate Wall | :x: | {W} | Wall can attack | Enable attack |
| Blight | :x: | {B}{B} | Destroy land when tapped | Triggered destroy |
| Burrowing | :x: | {R} | Mountainwalk | Grant keyword |
| Conquer | :x: | {3}{R}{R} | Control enchanted land | Control change |
| Divine Transformation | :x: | {2}{W}{W} | +3/+3 | Stat buff |
| Enfeeblement | :x: | {B}{B} | -2/-2 | Stat debuff |
| Fear | :x: | {B}{B} | Fear (can't be blocked except by...) | Grant keyword |
| Feast of the Unicorn | :x: | {3}{B} | +4/+0 | Stat buff |
| Firebreathing | :x: | {R} | {R}: +1/+0 | Grant activated ability |
| Flight | :x: | {U} | Flying | Grant keyword |
| Gaseous Form | :x: | {2}{U} | Prevent all combat damage | Damage prevention |
| Giant Strength | :x: | {R}{R} | +2/+2 | Stat buff |
| Hero's Resolve | :x: | {1}{W} | +1/+5 | Stat buff |
| Leshrac's Rite | :x: | {B} | Swampwalk | Grant keyword |
| Lure | :x: | {1}{G}{G} | Must be blocked by all | Block requirement |
| Phantasmal Terrain | :x: | {U}{U} | Change land type | Type change |
| Psychic Venom | :x: | {1}{U} | 2 damage when tapped | Triggered damage |
| Regeneration | :x: | {1}{G} | {G}: Regenerate | Grant activated ability |
| Spirit Link | :x: | {W} | Lifelink-like | Damage trigger |
| Wild Growth | :x: | {G} | Add extra mana | Mana ability |

---

## Enchantments (0/34 Complete)

| Card | Status | Cost | Effect | Notes |
|------|--------|------|--------|-------|
| Aether Flash | :x: | {2}{R}{R} | 2 damage to entering creatures | ETB trigger |
| Browse | :x: | {2}{U}{U} | Look at 5, take 1, exile rest | Repeatable |
| Call of the Wild | :x: | {2}{G}{G} | Reveal + put creature into play | Library reveal |
| Castle | :x: | {3}{W} | Untapped creatures +0/+2 | Static buff |
| Celestial Dawn | :x: | {1}{W}{W} | All lands are Plains, all colors are white | Color change |
| Chill | :x: | {1}{U} | Red spells cost more | Cost modification |
| Circle of Protection: Black | :x: | {1}{W} | Prevent black damage | Damage prevention |
| Circle of Protection: Blue | :x: | {1}{W} | Prevent blue damage | Damage prevention |
| Circle of Protection: Green | :x: | {1}{W} | Prevent green damage | Damage prevention |
| Circle of Protection: Red | :x: | {1}{W} | Prevent red damage | Damage prevention |
| Circle of Protection: White | :x: | {1}{W} | Prevent white damage | Damage prevention |
| Crusade | :x: | {W}{W} | White creatures +1/+1 | Static buff |
| Dense Foliage | :x: | {2}{G} | Creatures can't be targeted | Shroud granting |
| Dread of Night | :x: | {B} | White creatures -1/-1 | Static debuff |
| Familiar Ground | :x: | {2}{G} | Your creatures can't be blocked by more than one | Block restriction |
| Fervor | :x: | {2}{R} | Your creatures have haste | Grant keyword |
| Forbidden Crypt | :x: | {3}{B}{B} | Graveyard replacement | Replacement effect |
| Goblin Warrens | :x: | {2}{R} | Sac 2 Goblins: Make 3 | Token generation |
| Greed | :x: | {3}{B} | Pay life: Draw card | Activated ability |
| Hecatomb | :x: | {1}{B}{B} | Sac creatures: Damage | Complex sacrifice |
| Insight | :x: | {2}{U} | Draw when opponent casts green | Triggered draw |
| Kismet | :x: | {3}{W} | Opponent's stuff enters tapped | Static effect |
| Light of Day | :x: | {3}{W} | Black creatures can't attack | Attack restriction |
| Living Lands | :x: | {3}{G} | Forests are 1/1 creatures | Animate lands |
| Manabarbs | :x: | {3}{R} | Damage when tapping lands | Triggered damage |
| Orcish Oriflamme | :x: | {3}{R} | Attacking creatures +1/+0 | Static buff |
| Pestilence | :x: | {2}{B}{B} | {B}: 1 damage to all | Activated damage |
| Rowen | :x: | {2}{G}{G} | Draw on basic land reveal | Conditional draw |
| Serenity | :x: | {1}{W} | Destroy all artifacts/enchantments | Triggered destroy |
| Serra's Blessing | :x: | {1}{W} | Your creatures have vigilance | Grant keyword |
| Strands of Night | :x: | {2}{B}{B} | Pay life + sac land: Return creature | Reanimation |
| Tranquil Grove | :x: | {1}{G} | {1}{G}{G}: Destroy all enchantments | Activated destroy |
| Warmth | :x: | {1}{W} | Gain life when opponent casts red | Triggered life |
| Zur's Weirding | :x: | {3}{U} | Reveal draws, pay life to deny | Replacement effect |

---

## Artifacts (0/41 Complete)

| Card | Status | Cost | Effect | Notes |
|------|--------|------|--------|-------|
| Aladdin's Ring | :x: | {8} | {8},{T}: 4 damage | Activated damage |
| Amber Prison | :x: | {4} | Tap to detain permanent | Detain mechanic |
| Ankh of Mishra | :x: | {2} | 2 damage on land play | Triggered damage |
| Ashnod's Altar | :x: | {3} | Sac creature: Add {C}{C} | Sacrifice outlet |
| Bottle of Suleiman | :x: | {4} | Flip for Djinn token | Random token |
| Charcoal Diamond | :x: | {2} | Enters tapped, {T}: Add {B} | Mana rock |
| Crystal Rod | :x: | {1} | Pay on blue spell: Gain 1 life | Triggered life |
| Cursed Totem | :x: | {2} | Creatures' activated abilities disabled | Static disable |
| Dingus Egg | :x: | {4} | 2 damage when land dies | Death trigger |
| Disrupting Scepter | :x: | {3} | {3},{T}: Target discards | Activated discard |
| Dragon Mask | :x: | {3} | {3}: +2/+2, return to hand | Temporary buff |
| Fire Diamond | :x: | {2} | Enters tapped, {T}: Add {R} | Mana rock |
| Flying Carpet | :x: | {4} | {2},{T}: Creature gains flying | Grant ability |
| Fountain of Youth | :x: | {0} | {2},{T}: Gain 1 life | Life gain |
| Glasses of Urza | :x: | {1} | Look at opponent's hand | Information |
| Grinning Totem | :x: | {4} | Search opponent's library, play or exile | Tutor opponent |
| Howling Mine | :x: | {2} | All players draw extra | Symmetrical draw |
| Iron Star | :x: | {1} | Pay on red spell: Gain 1 life | Triggered life |
| Ivory Cup | :x: | {1} | Pay on white spell: Gain 1 life | Triggered life |
| Jade Monolith | :x: | {4} | {1}: Redirect 1 damage | Damage redirect |
| Jalum Tome | :x: | {3} | {2},{T}: Draw then discard | Looting |
| Jayemdae Tome | :x: | {4} | {4},{T}: Draw a card | Card draw |
| Mana Prism | :x: | {3} | {1},{T}: Add any color | Mana filter |
| Marble Diamond | :x: | {2} | Enters tapped, {T}: Add {W} | Mana rock |
| Meekstone | :x: | {1} | Creatures 3+ power don't untap | Untap prevention |
| Millstone | :x: | {2} | {2},{T}: Mill 2 | Mill |
| Moss Diamond | :x: | {2} | Enters tapped, {T}: Add {G} | Mana rock |
| Mystic Compass | :x: | {2} | {1},{T}: Land becomes basic type | Type change |
| Pentagram of the Ages | :x: | {4} | {4},{T}: Prevent 1 damage | Damage prevention |
| Phyrexian Vault | :x: | {3} | {2},{T},{Sac creature}: Draw | Sacrifice draw |
| Rod of Ruin | :x: | {4} | {3},{T}: 1 damage | Activated damage |
| Skull Catapult | :x: | {4} | {1},{T},{Sac creature}: 2 damage | Sacrifice damage |
| Sky Diamond | :x: | {2} | Enters tapped, {T}: Add {U} | Mana rock |
| Snake Basket | :x: | {4} | {X},{T},{Sac}: X Snake tokens | Token generation |
| Soul Net | :x: | {1} | Pay when creature dies: Gain 1 life | Death trigger |
| Storm Cauldron | :x: | {5} | Lands bounce, extra land drop | Land bounce |
| Teferi's Puzzle Box | :x: | {4} | Draw step replacement | Replacement effect |
| The Hive | :x: | {5} | {5},{T}: Create Wasp token | Token generation |
| Throne of Bone | :x: | {1} | Pay on black spell: Gain 1 life | Triggered life |
| Wand of Denial | :x: | {2} | {T}: Look at top, exile non-land | Library exile |
| Wooden Sphere | :x: | {1} | Pay on green spell: Gain 1 life | Triggered life |

---

## Deferred Cards (Phase 1.6)

These cards require complex mechanics that will be addressed after Phase 1.5:

| Card | Category | Reason |
|------|----------|--------|
| Abduction | Aura | Control change + complex triggers |
| Celestial Dawn | Enchantment | Color/type changing |
| Control Magic | (Not in 6ed) | - |
| Doomsday | Sorcery | Library building |
| Forbidden Crypt | Enchantment | Replacement effects |
| Illicit Auction | Sorcery | Bidding mechanic |
| Juxtapose | Sorcery | Permanent exchange |
| Living Lands | Enchantment | Land animation |
| Polymorph | Sorcery | Creature transformation |
| Primal Clay | Creature | Shapeshifter choice |
| Psychic Transfer | Sorcery | Life total exchange |
| Teferi's Puzzle Box | Artifact | Draw replacement |
| Zur's Weirding | Enchantment | Replacement effect |

*(List will be finalized during Phase 1.5.7)*

---

## Mechanics Status

| Mechanic | Status | Notes |
|----------|--------|-------|
| Mana costs | :white_check_mark: | Full parsing and payment |
| Targeting | :white_check_mark: | All target types |
| Stack/Priority | :white_check_mark: | LIFO resolution |
| Combat keywords | :white_check_mark: | Flying, First Strike, Trample, etc. |
| ETB triggers | :white_check_mark: | Working |
| Death triggers | :construction: | Infrastructure ready |
| Sacrifice effects | :x: | Needed for ~30 cards |
| Regeneration | :x: | Needed for ~10 cards |
| X-cost spells | :x: | Needed for ~15 cards |
| Token generation | :x: | Needed for ~8 cards |
| Damage prevention | :x: | Needed for ~15 cards |
| Life gain/loss | :construction: | Partial |
| Tutors | :x: | Needed for ~6 cards |
| Extra turns/combats | :x: | Needed for ~3 cards |
| Control changing | :x: | Needed for ~5 cards |
| Land type changing | :x: | Needed for ~5 cards |
| Cost modification | :x: | Needed for ~5 cards |
| Landwalk | :x: | Needed for ~10 cards |
| Protection | :construction: | Partial |
| Lords/Anthems | :x: | Needed for ~8 cards |

---

## Weekly Progress

### Week 1.5.1 (Infrastructure)
- [ ] Death triggers
- [ ] Sacrifice mechanics
- [ ] X-cost handling
- [ ] Token generation
- [ ] All lands working

### Week 1.5.2 (Spells)
- [ ] All Instants implemented
- [ ] All Sorceries implemented
- [ ] 100-game stability test

### Week 1.5.3 (Creatures Part 1)
- [ ] Vanilla/keyword creatures
- [ ] Mana dorks
- [ ] ETB creatures
- [ ] 100-game stability test

### Week 1.5.4 (Creatures Part 2)
- [ ] Activated ability creatures
- [ ] Death trigger creatures
- [ ] Lord creatures
- [ ] 100-game stability test

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

---

*This document is auto-generated and manually updated as implementation progresses.*
