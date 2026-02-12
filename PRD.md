# Dungeon Crawler RPG - Product Requirements Document

## Overview
A top-down dungeon crawler game built with Phaser 3 featuring RPG elements including combat, inventory management, equipment systems, and NPC interactions.

---

## Phase 1: Core Foundation (MVP) ✅

### Project Setup
- [x] Vite + TypeScript configuration
- [x] Phaser 3 integration
- [x] Asset loading system with progress bar
- [x] Scene management architecture

### Player System
- [x] Player entity with sprite rendering
- [x] WASD/Arrow key movement
- [x] Camera follow
- [x] Collision detection with walls
- [x] Player health system
- [x] Player gold/currency system
- [x] Facing direction tracking

### Combat System
- [x] SPACE key to attack
- [x] Directional attack hitbox based on facing
- [x] Damage calculation with weapon stats
- [x] Critical hit system (10% chance, 1.5x damage)
- [x] Damage variance (85%-115%)
- [x] Visual feedback (damage numbers, hit effects)
- [x] Attack cooldown based on weapon speed

### Monster System
- [x] 5 monster types implemented:
  - [x] Zombie (slow, low damage)
  - [x] Skeleton (standard enemy)
  - [x] Goblin (fast, weak)
  - [x] Orc (tough melee)
  - [x] Demon (boss/elite)
- [x] AI state machine (IDLE, CHASING, ATTACKING)
- [x] Detection range and aggro
- [x] Monster health bars
- [x] Death animations
- [x] Loot drops (gold + items)

### NPC & Shop System
- [x] 3 NPC merchants:
  - [x] Marcus the Merchant (basic weapons & potions)
  - [x] Elena the Exotic (rare/exotic weapons)
  - [x] Aldric the Sage (consumables & magic items)
- [x] E key interaction when near NPC
- [x] Interaction prompt display
- [x] NPC dialogue system
- [x] Shop UI with item list and details panel
- [x] Buy functionality with gold deduction
- [x] Stock tracking per item

### Inventory System
- [x] 20-slot inventory grid
- [x] Item stacking for consumables
- [x] Click to equip weapons
- [x] Click to use consumables
- [x] Item tooltips on hover
- [x] I key to open/close inventory

### Equipment System
- [x] 6 equipment slots (weapon, head, chest, legs, boots, shield)
- [x] Equip/unequip functionality
- [x] Stats display (damage, speed, defense)
- [x] Equipment affects combat calculations

### Items & Weapons
- [x] 12 weapons implemented:
  - [x] Wooden Sword, Rusty Sword, Steel Sword, Silver Sword, Ruby Sword, Golden Sword
  - [x] Small Dagger, Steel Dagger, Golden Dagger
  - [x] War Hammer, Sledgehammer
  - [x] Silver Katana
- [x] 5 consumables:
  - [x] Health Potion (25 HP)
  - [x] Large Health Potion (50 HP)
  - [x] Mana Potion
  - [x] Antidote
  - [x] Speed Potion

### Dungeon Generation
- [x] Procedural room generation
- [x] Corridor connections between rooms
- [x] Floor tile variations
- [x] Wall collision boundaries
- [x] Safe room (first room with NPCs)
- [x] Monster spawning in dungeon rooms
- [x] Boss room (last room with Demon)

### UI/HUD
- [x] Health bar with color coding (green/yellow/red)
- [x] Gold counter
- [x] Equipped weapon display
- [x] Controls reminder text
- [x] Item pickup notifications
- [x] Main menu with start button

### Game Flow
- [x] Boot scene with asset loading
- [x] Menu scene
- [x] Game scene with pause functionality
- [x] Game over on player death
- [x] Return to menu on death

### Backend Server ✅
- [x] Express + better-sqlite3 backend (`server/`)
- [x] Save/load game state API (`/api/saves`)
- [x] Vite proxy routing `/api` to `http://localhost:4201`

### LLM-Powered Dynamic Quest Generation ✅
- [x] OpenAI-compatible LLM integration (`server/src/services/llmService.ts`)
- [x] Configurable via environment variables (`LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL`)
- [x] Auto-enabled when `LLM_API_KEY` is set, gracefully disabled otherwise
- [x] Per-NPC quest pools (1 quest per NPC, on-demand generation, background replenishment)
- [x] Quest validator ensures LLM output conforms to game schema (valid NPCs, monsters, items, dialog structure)
- [x] REST endpoints: `GET /api/quests/available`, `GET /api/quests/available/:npcId`, `POST /api/quests/accept`
- [x] Debug endpoint: `GET /api/quests/pool-status`
- [x] Frontend `ApiClient` wired to fetch/accept dynamic quests
- [x] NPC personality profiles influence quest themes, dialog tone, and reward types
- [x] `[LLM]` prefixed server-side logging for all LLM activity

### Hardcoded Quest System ✅
- [x] Quest templates with full dialog trees
- [x] Quest types: rescue, recover, destroy, investigate
- [x] Objective types: kill, collect
- [x] Quest state machine: available → active → completed → turned_in
- [x] Quest map indicators with fog-of-war integration
- [x] NPC quest interaction (offer, in-progress, turn-in dialogs)

### Dynamic Quest Variants ✅
- [x] LLM can generate variant monsters (custom names, scaled stats, reuse base sprites)
- [x] LLM can generate variant items (custom names/descriptions, reuse base sprites)
- [x] Variant schema in LLM system prompt with validation
- [x] Runtime registration of variants into MONSTERS/ITEMS registries on quest accept
- [x] Kill objectives use base type for matching (works with existing QuestSystem)
- [x] Quest-aware monster respawns (50% bias toward active quest target types)
- [x] Server-side kill count cap (max 5) for completability

### Fog of War ✅
- [x] Tile-based visibility system
- [x] Bresenham line-of-sight with diagonal corner blocking
- [x] Explored vs visible vs hidden states

### Game Controller Support ✅
- [x] Gamepad input for movement and actions

---

## Phase 2: Enhanced Gameplay

### Combat Enhancements ✅
- [x] Knockback on hit (weapon-class-specific force)
- [x] Invincibility frames after taking damage (500ms with flashing)
- [x] Combo attack system (up to x5 multiplier within 500ms window)
- [x] Charged attacks (hold SPACE for up to 2.5x damage)
- [x] Dodge/roll mechanic (SHIFT key, afterimage trail, i-frames)
- [x] Attack arc hitbox system (replaces square hitbox, per-weapon-class arc width)
- [x] Weapon class system (sword/dagger/hammer/katana/unarmed with distinct arc, knockback, reach)

### Monster Enhancements
- [ ] Additional monster types (5-10 more)
- [ ] Monster variants (armored, elite, etc.)
- [ ] Ranged enemy attacks
- [ ] Boss attack patterns
- [ ] Monster spawners/nests

### Armor System ✅
- [x] 5 outfit armors (Peasant, Spy, Wizard, Barbarian, Knight) with single "armor" equipment slot
- [x] 3 shield items (wooden, iron, golden) in separate "shield" slot
- [x] Equipping armor changes player sprite appearance
- [x] Shield items (3 tiers: wooden, iron, golden)
- [x] Armor defense calculations (reduction = defense * 0.5)
- [x] Defense stat in inventory tooltips and shop panel
- [x] Armor in NPC shops (Marcus: peasant + spy, Elena: knight + wizard + barbarian)
- [x] Armor in monster loot tables
- [x] Visual equipment on player sprite (outfit sprites from NPC tileset)

### Phase 2c: Quick Gameplay Enhancements ✅
- [x] **Open Door Enhancement** — show `door_open` sprite when doors are opened (keep sprite visible, disable physics)
- [x] **NPC Quest Indicator** — floating "!" (gold, quest available) and "?" (green, ready to turn in) above NPCs, updated every 500ms
- [x] **Chest Loot** — 0-2 random loot chests per room (gold + items), E to open, quest-driven chest spawning via `spawnQuestChest()`
- [x] **NPC Extended Quest Intro** — dramatic multi-line NPC intro before quest offer dialog, with "Continue listening..." / "Leave" options; LLM generates `intro` field

### Phase 2d: Simplified Armor System ✅
- [x] Replace 5 armor slots (head/chest/legs/boots) with single "armor" slot
- [x] 5 outfit types that change player sprite appearance (Knight, Wizard, Spy, Peasant, Barbarian)
- [x] Keep shield as separate stats-only slot (3 slots total: weapon, armor, shield)
- [x] Outfits in NPC shops and monster loot tables
- [x] Remove runtime-generated armor sprites, use NPC sprites for outfits + keep shield sprites

### Phase 2e: Story-arc Quests ✅
- [x] Coherent multi-quest story arcs (configurable quest count + boss fight finale)
- [x] Sequential arc progression — one arc active at a time
- [x] LLM generates arc outline (title, theme, quest summaries) then individual quests with narrative continuity
- [x] Creative naming (evocative enemy/item names mapped to base types)
- [x] LLM picks most fitting NPC per quest based on personality
- [x] Arc progress display in quest log (chapter title, progress bar, "Quest N of M")
- [x] `server/game.config.json` for configurable settings
- [x] Boss quest finale with demon-type enemies, boosted stats (2.5x multiplier), colored name text
- [x] Arc-aware NPC quest indicators (shows "!" on NPC assigned to next arc quest)
- [x] Quest completion notification flow (client → server → auto-generate next arc quest)
- [x] Improved chest placement (wall-adjacent, corner-weighted, door-avoidant)

### Dungeon Improvements
- [ ] Multiple dungeon floors/levels
- [ ] Stairs/ladders between floors
- [ ] Locked doors requiring keys
- [ ] Secret rooms
- [x] Treasure chests with loot
- [ ] Environmental hazards (traps, spikes, lava)

### Items Expansion
- [ ] Keys and lockpicks
- [ ] Scrolls with special effects
- [ ] Rings with passive bonuses
- [ ] Amulets with passive bonuses
- [ ] Throwing weapons
- [ ] Bombs/explosives

---

## Phase 3: Progression Systems

### Experience & Leveling
- [ ] XP gain from killing monsters
- [ ] Level up system
- [ ] Stat increases on level up
- [ ] Level display in UI

### Skills & Abilities
- [ ] Skill tree system
- [ ] Active abilities (fireball, heal, etc.)
- [ ] Passive abilities
- [ ] Ability cooldowns
- [ ] Mana/energy resource

### Quests
- [x] Quest log UI (Q key overlay with active/completed quests, NPC turn-in guidance)
- [x] Quest NPCs (all 3 NPCs give quests — hardcoded + LLM-generated)
- [x] Kill quests
- [x] Fetch quests (collect objectives with loot injection for LLM variant items)
- [x] Quest rewards
- [x] Quest tracking on HUD

### Character Classes
- [ ] Warrior class
- [ ] Rogue class
- [ ] Mage class
- [ ] Class-specific abilities
- [ ] Class selection at game start

---

## Phase 4: World Expansion

### Multiple Areas
- [ ] Town hub area
- [ ] Multiple dungeon themes (cave, castle, crypt)
- [ ] Overworld map
- [ ] Area transitions

### NPCs Expansion
- [ ] Quest-giving NPCs
- [ ] Blacksmith (weapon upgrades)
- [ ] Enchanter (magic enhancements)
- [ ] Healer NPC
- [ ] NPC schedules and locations

### Crafting System
- [ ] Crafting materials
- [ ] Crafting recipes
- [ ] Crafting UI
- [ ] Weapon/armor crafting
- [ ] Potion brewing

---

## Phase 5: Polish & Meta

### Save System
- [ ] Local storage save
- [ ] Auto-save functionality
- [ ] Multiple save slots
- [ ] Save/load UI

### Audio
- [ ] Background music
- [ ] Combat sound effects
- [ ] UI sound effects
- [ ] Ambient dungeon sounds
- [ ] Volume controls

### Visual Polish
- [ ] Particle effects
- [ ] Screen shake
- [ ] Smooth camera transitions
- [ ] Lighting/shadows
- [ ] Weather effects

### Accessibility
- [ ] Rebindable controls
- [ ] Difficulty settings
- [ ] Colorblind mode
- [ ] Screen reader support

### Performance
- [ ] Object pooling
- [ ] Chunk-based rendering
- [ ] Asset optimization
- [ ] Mobile touch controls

---

## Technical Debt & Improvements

### Code Quality
- [ ] Unit tests for systems
- [ ] Integration tests
- [ ] Code documentation
- [ ] Performance profiling

### Architecture
- [ ] Event bus system refinement
- [ ] State management (Redux-like)
- [ ] Entity-Component-System refactor
- [ ] Plugin system for modding

---

## Asset Requirements

### Currently Using
- [x] 0x72 Dungeon Tileset (16x16)
- [x] Individual sprite PNGs from tileset

### Future Needs
- [ ] Additional monster sprites
- [x] Outfit sprites (reuse NPC tileset PNGs) + shield sprites (runtime canvas)
- [ ] Effect animations (spells, explosions)
- [ ] UI elements (buttons, frames)
- [ ] Tileset variations for different dungeon themes

---

## Metrics & Success Criteria

### MVP Success
- [x] Game loads without errors
- [x] Player can move and attack
- [x] Monsters respond to player
- [x] Items can be bought and equipped
- [x] Game loop is functional (play -> die -> restart)

### Phase 2+ Success
- [ ] 30+ minutes of gameplay content
- [ ] 3+ dungeon floors
- [ ] 15+ monster types
- [ ] 50+ items
- [ ] Player retention through progression

---

*Last Updated: Phase 2e Complete (Story-arc Quests)*
