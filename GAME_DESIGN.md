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
| Max Health | 100 |
| Speed | 120 |
| Starting Gold | 50 |
| Inventory Slots | 20 |
| Interaction Distance | 32px |

### Combat
- Attack with SPACE key (directional arc based on facing)
- Critical hit: 10% chance, 1.5x damage
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

---

## Monsters

### Bestiary

| Type | ID | Sprite | HP | DMG | Speed | Detect | XP | Gold |
|------|----|--------|----|-----|-------|--------|----|------|
| Zombie | `zombie` | `monster_zombie` | 15 | 3 | 40 | 100 | 10 | 2-8 |
| Skeleton | `skelet` | `monster_skelet` | 12 | 4 | 60 | 120 | 15 | 5-12 |
| Goblin | `goblin` | `monster_goblin` | 10 | 2 | 90 | 140 | 12 | 8-20 |
| Orc | `orc` | `monster_orc` | 25 | 6 | 55 | 110 | 25 | 10-25 |
| Demon Lord | `demon` | `monster_demon` | 75 | 10 | 70 | 180 | 100 | 50-100 |

### AI Behavior
- **States:** Idle, Chasing, Attacking
- Monsters detect player within their detect range and begin chasing
- Each monster type has its own attack range and cooldown
- Demon Lord is boss-only (never spawns from respawns)
- **Knockback:** When hit, monsters are pushed away from the player for 150ms. AI is paused during knockback. Knockback force varies by weapon class (dagger=20, sword=40, hammer=80, katana=30). Arcade physics wall colliders prevent monsters from being pushed through walls.

### Boss Variants
Story-arc boss quests spawn variant monsters with boosted stats (2.5x health/damage/speed multiplier) and a **colored name** displayed above them in red (`#ff4444`). This distinguishes arc bosses from regular Demon Lords.

### Spawning
- Initial: 2-4 monsters per room (skip safe room), boss in last room
- Respawn: every 15 seconds, 1-2 monsters in a random room far from the player
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

### Consumables

| Item | ID | Effect | Value | Max Stack |
|------|----|--------|-------|-----------|
| Health Potion | `flask_red` | Heal 25 HP | 20 | 10 |
| Large Health Potion | `flask_big_red` | Heal 50 HP | 45 | 10 |
| Mana Potion | `flask_blue` | (unused) | 25 | 10 |
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
Weapon, Armor, Shield (3 slots total)

---

## NPCs

| NPC | ID | Role | Specialty |
|-----|----|------|-----------|
| Marcus the Merchant | `npc_merchant` | Shop | Basic weapons, potions & starter outfits |
| Elena the Exotic | `npc_merchant_2` | Shop | Rare weapons & high-tier outfits |
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
| Marcus the Merchant | Practical, commerce-focused | destroy, recover | Gold, weapons |
| Elena the Exotic | Adventurous, artifact collector | investigate, recover | Rare weapons, variant items |
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

**Monsters (5 sprites):**
`monster_zombie`, `monster_skelet`, `monster_goblin`, `monster_orc`, `monster_demon`

**Items (25 sprites):**
`weapon_sword_wooden`, `weapon_sword_rusty`, `weapon_sword_steel`, `weapon_sword_silver`, `weapon_sword_golden`, `weapon_sword_ruby`, `weapon_dagger_small`, `weapon_dagger_steel`, `weapon_dagger_golden`, `weapon_katana_silver`, `weapon_hammer`, `weapon_sledgehammer`, `flask_red`, `flask_big_red`, `flask_blue`, `flask_green`, `flask_yellow`, `armor_peasant`, `armor_spy`, `armor_wizard`, `armor_barbarian`, `armor_knight`, `armor_shield_wooden`, `armor_shield_iron`, `armor_shield_golden`

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
| Boss Quest | Final quest uses demon-type enemies with 2.5x stat boost and red colored name |
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
