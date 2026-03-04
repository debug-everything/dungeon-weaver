# Dungeon Crawler RPG - Game Design Document

## World

### Dungeon Layout
- Procedurally generated per session
- 40x30 tile grid (each tile 16px, rendered at 2x scale)
- Up to 8 rooms connected by 3-tile-wide corridors
- Room 0 is the **safe room** (NPCs, no monsters)
- Last room is the **boss room** (always contains a Demon Lord)
- Doors appear at room entrances (60% chance, 100% for boss room). Opened with E key. Door sprite swaps to `door_open` (stays visible, physics disabled).
- 0-2 loot chests per non-safe room, placed along walls and in corners (avoids blocking corridors/paths). Press E to open: gold (5-30) + random items (potions common, weapons rare). Sprites: `chest_closed` → `chest_open_full` → `chest_open_empty`. Quest system can spawn chests with specific items.

### Fog of War
- Tile-based visibility with Bresenham line-of-sight
- Visibility radius: 6 tiles
- Three states: **hidden** (black), **explored** (dimmed), **visible** (clear)
- Diagonal corners block vision when both adjacent orthogonal tiles are walls

---

## Player

| Stat | Value |
|------|-------|
| Base Max Health | 100 (+ Constitution × 5) |
| Speed | 120 |
| Starting Gold | 50 |
| Inventory Slots | 20 |
| Interaction Distance | 32px |
| Max Level | 20 |
| Stat Points per Level | 3 |

### Leveling & Stats
- XP earned from monster kills (`xpReward`) and quest turn-ins (`rewards.xp`)
- XP curve: cumulative thresholds `80n + 20n²` (Lv2: 120, Lv5: 900, Lv10: 2800, Lv15: 5700, Lv20: 9600)
- On level up: full HP restore, golden flash VFX, floating "LEVEL UP!" text, auto-opens stat allocation screen
- 3 stat points per level, allocated freely. Unspent points are banked.
- All stats start at 1.

| Stat | Effect per point |
|------|-----------------|
| Strength (STR) | +0.5 melee damage (additive to weapon base) |
| Dexterity (DEX) | +0.5% crit chance (base 10%) |
| Constitution (CON) | +5 max HP (base 100) |
| Luck (LCK) | +2% gold bonus on loot drops |
| Intelligence (INT) | +0.8 spell damage per point (base from spell book), +0.3 mana regen/sec per point |

### Combat
- Attack with SPACE key (directional arc based on facing)
- Critical hit: 10% + DEX bonus, 1.5x damage
- Damage formula: `(weaponDamage + STR bonus) × variance × combo × charge`
- Damage variance: 85%-115% of base
- Attack cooldown: 400ms base (modified by weapon speed)
- **Attack arcs**: Each weapon class has a distinct arc width, reach multiplier, and knockback force
- **Invincibility frames**: 500ms after taking damage (flashes at 80ms intervals)
- **Dodge/roll**: SHIFT key, dashes in facing direction at speed 300 for 200ms, 250ms of i-frames, 600ms cooldown, creates afterimage trail
- **Combo system**: Chain attacks within 500ms window for increasing damage multipliers (x1.0, x1.2, x1.5, x1.8, x2.0). Taking damage resets combo.
- **Charged attacks**: Hold SPACE to charge (200ms minimum, 800ms max). Charged attacks deal up to 2.5x damage, 2x knockback, +30 degrees arc. Getting hit cancels charge. Charged attacks don't advance combo.

### Weapon Classes

| Class | Arc Width | Knockback | Playstyle |
|-------|-----------|-----------|-----------|
| Dagger | 90° | 20 | Fast, narrow, close range |
| Sword | 120° | 40 | Balanced, good arc and reach |
| Hammer | 160° | 80 | Slow, wide arc, massive knockback |
| Katana | 100° | 30 | Fast, longest reach |
| Unarmed | 90° | 10 | Fallback when no weapon equipped |
| Staff | 100° | 50 | Blunt melee, required for spell casting |
| Spell | N/A | 0 | Projectile-based ranged attack (via tome) |

### Staff Weapons

| Staff | ID | Damage | Speed | Range | Element | Value |
|-------|----|--------|-------|-------|---------|-------|
| Fire Staff | `weapon_staff_fire` | 6 | 0.9 | 22 | fireball | 120 |
| Storm Staff | `weapon_staff_storm` | 7 | 0.9 | 22 | lightning | 100 |
| Frost Staff | `weapon_staff_frost` | 8 | 0.8 | 24 | frost | 140 |

Staffs are blunt melee weapons with lower damage than swords (6-8 range). They use arc-based melee attacks via SPACE key. Each staff has an `element` property linking it to a specific spell type. Sold by Aldric the Sage.

**Planned**: Universal staff (e.g. "Archmagos Staff") — compatible with all tome types, very high cost (~2000g).

### Spell System
- Spell tomes equip in the **spellbook slot** (separate from the weapon slot)
- **Casting requires a matching staff** equipped in the weapon slot. Fire Staff → Fireball Tome, Storm Staff → Lightning Tome, Frost Staff → Frost Tome.
  - No staff equipped: "Requires a Staff!" floating error
  - Wrong element staff: "Requires [Element] Staff!" floating error
- Spells fire on ENTER key press — no combo, no charge
- **Mana cost**: Fireball = 15, Lightning = 10, Frost = 12. Casting with insufficient mana shows "Not enough mana!" floating error.
- Spell damage formula: `(baseDamage + (INT-1) × 0.8) × variance` (90%-110%), 8% base crit + DEX bonus
- Projectiles are graphics-based (glowing circles with particle trails), destroyed on wall/monster hit or max range
- **Fireball**: Single target, 200px/s projectile, orange/red visuals
- **Lightning**: Chains to up to 2 additional nearby enemies within 60px. Damage decays per chain: 100% → 60% → 35%. Visual: jagged blue lightning arcs between chained targets (fades in 200ms)
- **Frost**: Single target, 160px/s projectile, ice-blue crystalline shard visual. Freezes enemies on hit for 1-2 seconds (HP-based resistance: `clamp(2000 - (maxHP / 200) * 1000, 1000, 2000)` ms). Frozen enemies turn blue, cannot move or attack.
- Sold by Aldric the Sage

### Mana System
- **Max mana**: 50 (`PLAYER_MAX_MANA`)
- **Regen**: Base 1.0 mana/sec + 0.3/sec per INT above 1. Ticks every 500ms.
- **Mana potion** (`flask_blue`): Restores 30 mana
- **HUD**: Blue mana bar below health bar, shows current/max values
- Mana fully restores on level up
- Melee weapons do not consume mana

---

## Monsters

### Bestiary

#### Undead Family (Tier 1)

| Type | ID | Sprite | HP | DMG | Speed | Detect | XP | Gold | Boss? |
|------|----|--------|----|-----|-------|--------|----|------|-------|
| Zombie | `zombie` | `monster_zombie` | 15 | 3 | 40 | 100 | 10 | 2-8 | No |
| Zombie Runt | `zombie_small` | `monster_zombie_small` | 8 | 2 | 35 | 80 | 6 | 1-5 | No |
| Plague Zombie | `zombie_green` | `monster_zombie_green` | 20 | 4 | 38 | 100 | 14 | 3-10 | No |
| Hulking Zombie | `zombie_tall` | `monster_zombie_tall` | 30 | 5 | 30 | 90 | 20 | 5-15 | No |
| Skeleton | `skelet` | `monster_skelet` | 12 | 4 | 60 | 140 | 15 | 5-12 | No (Ranged) |
| Necromancer | `necromancer` | `monster_necromancer` | 70 | 9 | 50 | 180 | 100 | 40-80 | Boss (Ranged) |

#### Beast Family (Tier 1)

| Type | ID | Sprite | HP | DMG | Speed | Detect | XP | Gold | Boss? |
|------|----|--------|----|-----|-------|--------|----|------|-------|
| Bat | `bat` | `monster_bat` | 6 | 2 | 100 | 160 | 8 | 1-4 | No |
| Wogol | `wogol` | `monster_wogol` | 18 | 5 | 70 | 120 | 18 | 6-14 | No |
| Rokita | `rokita` | `monster_rokita` | 28 | 6 | 75 | 130 | 22 | 8-18 | No |
| Tentacle Horror | `tentacle` | `monster_tentackle` | 80 | 11 | 35 | 170 | 110 | 50-100 | Boss (32x32) |

#### Orc Family (Tier 2)

| Type | ID | Sprite | HP | DMG | Speed | Detect | XP | Gold | Boss? |
|------|----|--------|----|-----|-------|--------|----|------|-------|
| Goblin | `goblin` | `monster_goblin` | 10 | 2 | 90 | 140 | 12 | 8-20 | No |
| Orc Warrior | `orc` | `monster_orc` | 25 | 6 | 55 | 110 | 25 | 10-25 | No |
| Armored Orc | `orc_armored` | `monster_orc_armored` | 35 | 7 | 45 | 110 | 30 | 12-28 | No |
| Masked Orc | `orc_masked` | `monster_orc_masked` | 28 | 8 | 65 | 130 | 28 | 10-25 | No |
| Orc Shaman | `orc_shaman` | `monster_orc_shaman` | 22 | 6 | 50 | 150 | 25 | 10-22 | No (Ranged) |
| Orc Veteran | `orc_veteran` | `monster_orc_veteran` | 40 | 9 | 50 | 120 | 35 | 15-35 | No |
| Ogre | `ogre` | `monster_ogre` | 90 | 12 | 40 | 160 | 120 | 60-120 | Boss (32x32) |

#### Demon Family (Tier 2)

| Type | ID | Sprite | HP | DMG | Speed | Detect | XP | Gold | Boss? |
|------|----|--------|----|-----|-------|--------|----|------|-------|
| Imp | `imp` | `monster_imp` | 10 | 3 | 85 | 140 | 12 | 5-12 | No (Ranged) |
| Chort | `chort` | `monster_chort` | 30 | 7 | 65 | 140 | 30 | 15-30 | No |
| Bies | `bies` | `monster_bies` | 45 | 8 | 60 | 150 | 40 | 20-40 | No |
| Demon Lord | `demon` | `monster_demon` | 75 | 10 | 70 | 180 | 100 | 50-100 | Boss |

#### Elemental Family (Tier 3)

| Type | ID | Sprite | HP | DMG | Speed | Detect | XP | Gold | Boss? |
|------|----|--------|----|-----|-------|--------|----|------|-------|
| Goo Elemental | `elemental_goo` | `monster_elemental_goo` | 15 | 3 | 45 | 100 | 12 | 4-10 | No |
| Fire Elemental | `elemental_fire` | `monster_elemental_fire` | 25 | 8 | 60 | 130 | 28 | 10-22 | No |
| Water Elemental | `elemental_water` | `monster_elemental_water` | 30 | 5 | 55 | 120 | 25 | 8-20 | No |
| Air Elemental | `elemental_air` | `monster_elemental_air` | 20 | 6 | 80 | 140 | 22 | 8-18 | No |
| Earth Elemental | `elemental_earth` | `monster_elemental_earth` | 40 | 7 | 35 | 100 | 30 | 12-25 | No |
| Plant Elemental | `elemental_plant` | `monster_elemental_plant` | 22 | 4 | 50 | 110 | 18 | 6-14 | No |
| Gold Elemental | `elemental_gold` | `monster_elemental_gold` | 50 | 9 | 45 | 120 | 45 | 30-60 | No |
| Elemental Lord | `elemental_lord` | `npc_wizzard` | 85 | 11 | 55 | 180 | 110 | 50-100 | Boss (Ranged) |

#### Dark Knight Family (Tier 3)

| Type | ID | Sprite | HP | DMG | Speed | Detect | XP | Gold | Boss? |
|------|----|--------|----|-----|-------|--------|----|------|-------|
| Dark Knight | `dark_knight` | `monster_dark_knight` | 55 | 10 | 55 | 140 | 50 | 25-50 | No |

### AI Behavior
- **States:** Idle, Chasing, Attacking, Retreating
- Monsters detect player within their detect range and begin chasing
- Each monster type has its own attack range and cooldown
- Boss-only monsters (necromancer, tentacle, ogre, demon, elemental_lord) never spawn from respawns
- **Knockback:** When hit, monsters are pushed away from the player for 150ms. AI is paused during knockback. Knockback force varies by weapon class (dagger=20, sword=40, staff=50, hammer=80, katana=30). Arcade physics wall colliders prevent monsters from being pushed through walls.

### Ranged Attacks
5 monsters have ranged projectile attacks. Ranged monsters use a hybrid AI: they fire projectiles at preferred range, retreat when the player closes in, and fall back to melee when cornered.

| Monster | Style | Proj DMG | Cooldown | Preferred Range | Melee Range |
|---------|-------|----------|----------|-----------------|-------------|
| Skeleton | bone_arrow (white) | 3 | 1500ms | 80 | 22 |
| Orc Shaman | poison_bolt (green) | 5 | 1800ms | 70 | 24 |
| Imp | fire_bolt (orange) | 2 | 1200ms | 60 | 16 |
| Necromancer (boss) | skull_bolt (purple) | 8 | 1400ms | 100 | 26 |
| Elemental Lord (boss) | energy_orb (cyan) | 9 | 1300ms | 100 | 28 |

**Ranged AI Priority** (requires line-of-sight):
1. `dist ≤ meleeRange` → melee attack
2. `dist ≤ meleeRange × 1.5` → retreat (move away at 70% speed, face player)
3. `dist ≤ attackRange` → ranged attack (stop, fire projectile)
4. `dist ≤ detectRange` → chase
5. else → idle

**Projectile behavior:** Graphics-only visuals (no sprite assets), wall collision via tile lookup, player hit radius 12px, defense reduction applied, dodge/i-frames work automatically.

### Boss Labels
- **Mini-boss** (dungeon boss room): orange name label `#ffaa00`
- **Arc boss** (story-arc final quest): red name label `#ff4444`, boosted stats (2.5x multiplier)
- Story-arc boss quests can use any boss-only monster type (demon, ogre, tentacle, necromancer, elemental_lord)

### Boss Attack Patterns
All 5 boss monsters have a 2-phase system. At 50% HP they enter phase 2 ("ENRAGED!" floating text, red flash, camera shake). Phase 2 boosts speed and reduces cooldowns.

| Boss | Abilities | Phase 2 Speed | Phase 2 Cooldown | Details |
|------|-----------|---------------|------------------|---------|
| Necromancer | summon, barrage | 1.2x | 0.7x | Summons 2 zombie runts; 3-spread skull_bolt |
| Tentacle Horror | slam, charge | 1.3x | 0.75x | Slam radius 50px; charge at 250 speed |
| Ogre | slam, charge | 1.4x | 0.8x | Slam radius 40px; charge at 200 speed |
| Demon Lord | teleport, barrage | 1.2x | 0.65x | Blinks behind player; 5-spread fire_bolt |
| Elemental Lord | summon, barrage | 1.2x | 0.7x | Summons 2 goo elementals; 5-spread energy_orb |

**Ability types:**
- **Slam**: 300ms wind-up ring, AOE damage + knockback within radius
- **Summon**: Spawn N minions near boss (cap: maxMonsters), purple flash VFX
- **Charge**: Dash toward player at high speed for 400ms, afterimage trail, melee hit on arrival
- **Teleport**: Blink 60px behind player, purple flash at old and new position
- **Barrage**: Fire N spread projectiles in an arc (±30° for 3, ±40° for 5)

Shared ability cooldown: 5s base, reduced in phase 2 by cooldown multiplier.

### Monster Spawner Nests
Destructible bone pile objects ("nests") placed in ~30% of non-safe, non-boss rooms. Wall-adjacent placement, tinted by family color.

- **HP**: Tier 1: 20, Tier 2: 30, Tier 3: 40
- **Spawn rate**: One monster every 8s (only when player is in the room)
- **Max alive**: 3 monsters per spawner
- **XP reward**: Tier 1: 15, Tier 2: 20, Tier 3: 25
- **Damageable by**: melee attacks and spell projectiles
- **On destroy**: bone scatter particles, XP award; spawned monsters persist
- **Family tints**: undead=gray, beast=green, orc=tan, demon=red, elemental=blue, dark_knight=purple

### Multi-Floor Dungeon
The game uses a 3-floor descent system (configurable via `TOTAL_FLOORS`). Each floor generates a fresh dungeon.

- **Progression**: One-way — defeating the floor boss reveals stairs, interact with E to descend
- **Player state carries**: health, mana, gold, inventory, equipment, level, XP, stats, active quests
- **Monster scaling per floor**:
  | Floor | HP Multiplier | Damage Multiplier |
  |-------|--------------|-------------------|
  | 1     | 1.0x         | 1.0x              |
  | 2     | 1.3x         | 1.3x              |
  | 3     | 1.7x         | 1.6x              |
- **Stairs**: Appear in boss room after boss is killed. Uses `stairs_mid.png` sprite with pulsing glow and "Floor N" label. Notification says "Press E to descend."
- **NPCs**: Present on every floor (safe room always has merchants)
- **Save system**: Floor state only lives in memory during a run (no save/load across floors)
- **Arc-boss integration**: When a story arc boss quest is active, the arc's boss monster spawns in the boss room. Non-boss quest targets go in regular rooms. When no arc is active (LLM off), a random tier-appropriate boss is used. Unlock message includes arc boss name when applicable.

### Monster Tier System
Tiers unlock new monster families as the player completes story arcs:
- **Tier 1** (0 arcs completed): Undead + Beast
- **Tier 2** (1+ arcs completed): + Orc + Demon
- **Tier 3** (2+ arcs completed): + Elemental + Dark Knight

### Spawning
- **Family-based rooms**: Each room picks one family from the current tier's allowed families; all monsters in that room are from that family
- Initial: 2-4 monsters per room (skip safe room), boss from unlocked families in boss room (orange name label)
- Respawn: every 15 seconds, 1-2 non-boss monsters from allowed families in a random room far from the player
- Max monsters: 20
- Quest-aware respawning: 50% bias toward active kill quest target types

### Loot Tables

| Monster | Drops |
|---------|-------|
| Zombie | Health Potion (20%), Small Dagger (5%), Peasant Garments (3%) |
| Skeleton | Health Potion (15%), Rusty Sword (8%), Peasant Garments (5%) |
| Goblin | Health Potion (25%), Steel Dagger (10%), Spy Vestments (4%) |
| Orc | Large Health Potion (15%), Steel Sword (8%), War Hammer (5%), Barbarian Rawhide (5%), Iron Shield (4%) |
| Demon Lord | Large Health Potion (50%), Ruby Sword (20%), Silver Katana (15%), Knight Armor (15%), Golden Shield (10%) |

---

## Items

### Weapons - Swords

| Item | ID | DMG | Speed | Range | Class | Value |
|------|----|-----|-------|-------|-------|-------|
| Wooden Sword | `weapon_sword_wooden` | 5 | 1.2 | 24 | sword | 15 |
| Rusty Sword | `weapon_sword_rusty` | 8 | 1.0 | 26 | sword | 25 |
| Steel Sword | `weapon_sword_steel` | 15 | 1.0 | 28 | sword | 100 |
| Silver Sword | `weapon_sword_silver` | 20 | 1.1 | 28 | sword | 200 |
| Golden Sword | `weapon_sword_golden` | 25 | 0.9 | 28 | sword | 400 |
| Ruby Sword | `weapon_sword_ruby` | 30 | 1.0 | 30 | sword | 500 |

### Weapons - Daggers

| Item | ID | DMG | Speed | Range | Class | Value |
|------|----|-----|-------|-------|-------|-------|
| Small Dagger | `weapon_dagger_small` | 4 | 1.8 | 16 | dagger | 10 |
| Steel Dagger | `weapon_dagger_steel` | 8 | 1.6 | 18 | dagger | 50 |
| Golden Dagger | `weapon_dagger_golden` | 12 | 1.5 | 18 | dagger | 150 |

### Weapons - Heavy / Katana

| Item | ID | DMG | Speed | Range | Class | Value |
|------|----|-----|-------|-------|-------|-------|
| War Hammer | `weapon_hammer` | 22 | 0.7 | 24 | hammer | 180 |
| Sledgehammer | `weapon_sledgehammer` | 35 | 0.5 | 28 | hammer | 350 |
| Silver Katana | `weapon_katana_silver` | 28 | 1.3 | 32 | katana | 450 |
| Fireball Tome | `spell_fireball` | 18 | 0.8 | 120 | spell | 300 |
| Lightning Tome | `spell_lightning` | 12 | 1.4 | 150 | spell | 240 |
| Frost Tome | `spell_frost` | 14 | 1.0 | 130 | spell | 280 |

### Consumables

| Item | ID | Effect | Value | Max Stack |
|------|----|--------|-------|-----------|
| Health Potion | `flask_red` | Heal 25 HP | 20 | 10 |
| Large Health Potion | `flask_big_red` | Heal 50 HP | 45 | 10 |
| Mana Potion | `flask_blue` | Restore 30 mana | 25 | 10 |
| Antidote | `flask_green` | (unused) | 30 | 10 |
| Speed Potion | `flask_yellow` | (unused) | 40 | 10 |

### Armor - Outfits

Equipping an outfit changes the player's sprite appearance.

| Item | ID | Sprite | Defense | Value |
|------|----|--------|---------|-------|
| Peasant Garments | `armor_peasant` | `npc_elf` | 1 | 15 |
| Spy Vestments | `armor_spy` | `npc_trickster` | 3 | 80 |
| Wizard Cloak | `armor_wizard` | `npc_wizzard` | 4 | 150 |
| Barbarian Rawhide | `armor_barbarian` | `npc_dwarf` | 5 | 200 |
| Knight Armor | `armor_knight` | `npc_knight_blue` | 7 | 350 |

### Shields

| Item | ID | Defense | Value |
|------|----|---------|-------|
| Wooden Shield | `armor_shield_wooden` | 2 | 25 |
| Iron Shield | `armor_shield_iron` | 4 | 130 |
| Golden Shield | `armor_shield_golden` | 6 | 400 |

### Defense Formula
`damage_reduction = total_defense * 0.5` (minimum 1 damage always applies)

| Setup | Armor + Shield Defense | Reduction | vs Demon Lord (10 DMG) |
|-------|----------------------|-----------|------------------------|
| Peasant + Wooden Shield | 3 | 1.5 | ~8.5 damage |
| Spy + Iron Shield | 7 | 3.5 | ~6.5 damage |
| Knight + Golden Shield | 13 | 6.5 | ~3.5 damage |

### Equipment Slots
Weapon, Armor, Shield, Spellbook (4 slots total)
- **Weapon**: Melee weapon (sword, dagger, hammer, katana, staff) — used with SPACE
- **Armor**: Body armor that changes player sprite
- **Shield**: Adds defense
- **Spellbook**: Spell tome — cast with ENTER (requires matching staff in weapon slot)

---

## NPCs

| NPC | ID | Role | Specialty |
|-----|----|------|-----------|
| Marcus the Barterer | `npc_merchant` | Shop | Basic weapons, potions & starter outfits |
| Elena the Divine | `npc_merchant_2` | Shop | Rare weapons & high-tier outfits |
| Aldric the Sage | `npc_sage` | Shop | Consumables & potions |

All NPCs are located in the safe room (room 0), spread to separate corners to avoid label overlap.

### NPC Quest Indicators
- Floating **"!"** (gold `#ffdd44`) above NPC = quest available to accept
- Floating **"?"** (green `#88ff88`) above NPC = completed quest ready to turn in
- No indicator when NPC has only active (in-progress) quests or no quests
- Updates every 500ms in GameScene

---

## Quest System

### Quest Types
- **Destroy** — kill monsters
- **Recover** — collect items
- **Rescue** — (narrative, described in quest text)
- **Investigate** — (narrative, described in quest text)

### Objective Types
- **Kill** — target is a monster base type (e.g. `"goblin"`)
- **Collect** — target is an item ID or variant item ID

### Quest Flow
`available` -> `active` -> `completed` -> `turned_in`

Each quest is assigned a target room (non-safe) when accepted. Quest map indicators show the target area with fog-of-war integration.

**NPC quest priority:** When a player interacts with an NPC, the most actionable quest is shown: `completed (ready to turn in)` > `active (in progress)` > `available`. An NPC will not offer a new quest while it has an active quest in progress. Declined quests remain `available` and will be re-offered on next interaction.

**Quest option** is always visible in the NPC menu (even when all hardcoded quests are done) so LLM-generated quests can be discovered. If no quests are available, the NPC says so.

### Extended Quest Intro
Quests can have an optional `intro: string[]` field (2-4 atmospheric lines). When present:
- Before showing the quest offer dialog, NPC delivers intro lines one at a time
- Player can "Continue listening..." or "Leave conversation" at each step
- After the last intro line, the normal quest offer dialog appears
- LLM-generated quests include intro lines; hardcoded quests can too

### Quest Log (Q key)
Overlay scene showing all active and completed quests grouped by status:
- **Ready to Turn In** (green) — shows NPC name to return to
- **In Progress** (gold) — shows objective progress (e.g. "Kill goblins: 2/3")
- Scrollable with arrow keys / d-pad
- Close with Q, ESC, or gamepad B

### Sources
- **Hardcoded quests** — defined in `src/data/quests.json`, always available
- **LLM-generated quests** — fetched from per-NPC backend quest pools when player interacts with NPC

### Per-NPC Quest Pools
Each NPC has its own independent quest pool (1 quest pre-generated at startup). When a quest is accepted, only that NPC's pool is replenished in the background. If a player talks to an NPC with an empty pool, a quest is generated on-demand. This ensures every NPC always has quests available regardless of how many the player completes.

### NPC Quest Personalities
Quest generation includes NPC personality context that shapes quest themes, dialog tone, and reward types:

| NPC | Personality | Preferred Quest Types | Reward Tendencies |
|-----|------------|----------------------|-------------------|
| Marcus the Barterer | Practical, commerce-focused | destroy, recover | Gold, weapons |
| Elena the Divine | Adventurous, artifact collector | investigate, recover | Rare weapons, variant items |
| Aldric the Sage | Scholarly, mystical | investigate, destroy | Potions, consumables |

### Balance Constraints
| Parameter | Range |
|-----------|-------|
| Kill objective count | 1-4 (server caps at 5) |
| Collect objective count | 1-3 |
| XP reward | 25-200 |
| Gold reward | 10-100 |
| Quest level | 1-5 |
| Max objectives per quest | 3 |

---

## Dynamic Quest Variants

LLM-generated quests can define **variant** monsters and items — custom-named versions of existing base types that reuse their sprites.

### Monster Variants
- Clone a base monster (e.g. `monster_goblin`)
- Apply a `statMultiplier` (0.5-2.0) to health, damage, XP reward, and gold drop
- Keep the base `type` for quest kill matching (e.g. killing any `goblin`-type counts)
- Keep the base `sprite` (no new art needed)
- Example: "Hunchback Goblin" — baseType `goblin`, statMultiplier 1.3

### Item Variants
- Clone a base item (e.g. `weapon_sword_steel`)
- Set a custom name and description
- Keep the base sprite and stats
- Can be used as collect objectives or quest rewards
- Example: "Cursed Blade" — baseItem `weapon_sword_steel`

### Quest Loot Injection
When a quest has **collect** objectives, `injectQuestLoot()` adds the target item to monster loot tables (50% drop chance per kill) so it can actually drop. If the quest also has kill objectives, the item is only injected into matching monster types; otherwise into all non-boss monsters. This ensures LLM-generated collect quests are always completable.

### Available Base Types

**Monsters (28 sprites):**
`monster_zombie`, `monster_zombie_small`, `monster_zombie_green`, `monster_zombie_tall`, `monster_skelet`, `monster_necromancer`, `monster_bat`, `monster_wogol`, `monster_rokita`, `monster_tentackle`, `monster_goblin`, `monster_orc`, `monster_orc_armored`, `monster_orc_masked`, `monster_orc_shaman`, `monster_orc_veteran`, `monster_ogre`, `monster_imp`, `monster_chort`, `monster_bies`, `monster_demon`, `monster_elemental_goo`, `monster_elemental_fire`, `monster_elemental_water`, `monster_elemental_air`, `monster_elemental_earth`, `monster_elemental_plant`, `monster_elemental_gold`, `npc_wizzard` (Elemental Lord), `monster_dark_knight`

**Items (25 sprites):**
`weapon_sword_wooden`, `weapon_sword_rusty`, `weapon_sword_steel`, `weapon_sword_silver`, `weapon_sword_golden`, `weapon_sword_ruby`, `weapon_dagger_small`, `weapon_dagger_steel`, `weapon_dagger_golden`, `weapon_katana_silver`, `weapon_hammer`, `weapon_sledgehammer`, `spell_fireball`, `spell_lightning`, `flask_red`, `flask_big_red`, `flask_blue`, `flask_green`, `flask_yellow`, `armor_peasant`, `armor_spy`, `armor_wizard`, `armor_barbarian`, `armor_knight`, `armor_shield_wooden`, `armor_shield_iron`, `armor_shield_golden`

---

## Shops

### Pricing
Each NPC has fixed buy/sell prices per item. Sell price is roughly 40% of buy price.

### Stock
Each item has a fixed stock count per NPC. Stock does not replenish.

---

## Story-arc Quests

### Overview
LLM-generated quests are organized into coherent **story arcs** — multi-quest narrative sequences with a theme, escalating stakes, and a boss fight finale. One arc is active at a time. When an arc completes, a new one auto-generates.

### Arc Structure
| Element | Description |
|---------|-------------|
| Title | Evocative arc name (e.g. "The Heartforge Conspiracy") |
| Theme | Thematic description guiding all quests in the arc |
| Quest Count | Configurable via `server/game.config.json` (default: 3) |
| Boss Quest | Final quest uses any boss-type enemy (demon, ogre, tentacle, necromancer, elemental_lord) with 2.5x stat boost and red colored name |
| NPC Assignment | LLM picks the most fitting NPC per quest based on personality profiles |

### Arc Flow
1. Server generates arc outline (title, theme, quest summaries, NPC assignments)
2. First quest is generated immediately for the assigned NPC
3. Player interacts with assigned NPC → arc quest offered
4. On quest turn-in → client notifies server → next quest generated in background
5. Server responds with `nextQuestNpcId` → client shows "!" indicator on that NPC
6. After all quests + boss quest complete → new arc auto-generates

### Quest Log Display
- Purple header: "Chapter: [Arc Title]"
- Progress bar showing quest N of M
- Individual quest entries below with normal quest log formatting

### Configuration (`server/game.config.json`)
```json
{
  "storyArc": {
    "questsPerArc": 3,
    "bossQuestEnabled": true
  }
}
```

---

## Game Flow

1. **Boot** — Load assets with progress bar
2. **Menu** — Start game
3. **Gameplay** — Explore dungeon, fight monsters, talk to NPCs, complete quests
4. **Death** — Camera fade, return to menu
5. **Save** — F5 quick-save via backend API
