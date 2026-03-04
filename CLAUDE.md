# Dungeon Crawler RPG - Claude Context

## Project Overview
A top-down dungeon crawler game built with Phaser 3, TypeScript, and Vite. Features procedural dungeons, combat, inventory management, equipment systems, and NPC shops.

## Quick Start
```bash
npm install
npm run dev
# Open http://localhost:4200
```

## Tech Stack
- **Framework**: Phaser 3.80+
- **Language**: TypeScript
- **Build Tool**: Vite
- **Dungeon Generation**: rot.js (BSP Digger)
- **Assets**: 0x72 DungeonTileset (16x16 pixel art)

## Project Structure
```
src/
├── main.ts                    # Game bootstrap & Phaser config
├── config/constants.ts        # Game constants, events, scene keys
├── types/index.ts             # TypeScript interfaces
├── services/
│   └── ApiClient.ts           # REST client for backend API
├── data/
│   ├── items.ts               # Weapon/consumable definitions
│   ├── monsters.ts            # Monster stats & loot tables
│   └── npcs.ts                # NPC shop inventories
├── entities/
│   ├── Player.ts              # Player movement, combat, inventory
│   ├── Monster.ts             # Monster AI (idle/chase/attack)
│   └── NPC.ts                 # Shop NPCs with interaction
├── systems/
│   ├── InventorySystem.ts     # 20-slot inventory management
│   ├── EquipmentSystem.ts     # Equipment slot handling
│   ├── CombatSystem.ts        # Damage calculations
│   ├── QuestSystem.ts         # Quest state machine & tracking
│   ├── FogOfWarSystem.ts      # Tile-based visibility
│   ├── ShopSystem.ts          # Buy/sell logic
│   ├── DungeonGenerator.ts   # BSP dungeon generation (rot.js) + mission graph
│   └── VariantRegistry.ts    # Runtime registration of LLM variant monsters/items
└── scenes/
    ├── BootScene.ts           # Asset loading
    ├── MenuScene.ts           # Main menu
    ├── GameScene.ts           # Main gameplay loop
    ├── UIScene.ts             # HUD overlay
    ├── InventoryScene.ts      # Inventory modal
    ├── NPCInteractionScene.ts # NPC dialog & quest UI
    ├── QuestLogScene.ts       # Quest log overlay (Q key)
    ├── NarratorScene.ts       # Cinematic narrator/boss dialog overlay
    ├── LevelUpScene.ts        # Stat allocation overlay (L key / TAB)
    └── ShopScene.ts           # Shop interface

render.yaml                    # Render Blueprint (single web service + disk)
server/
├── game.config.json           # Story arc settings (questsPerArc, bossQuestEnabled)
├── src/
│   ├── index.ts               # Express app entry point
│   ├── config.ts              # Environment + game config (port, DB, LLM, arc settings)
│   ├── db/database.ts         # SQLite setup
│   ├── routes/
│   │   ├── gameState.ts       # /api/saves CRUD
│   │   └── quests.ts          # /api/quests LLM quest + arc endpoints
│   ├── services/
│   │   ├── gameStateService.ts
│   │   ├── llmService.ts      # OpenAI-compatible LLM wrapper (quests + story arcs)
│   │   ├── storyArcService.ts # Story arc lifecycle (generate, advance, complete)
│   │   ├── questPoolService.ts # Arc-driven quest serving + fallback per-NPC pools
│   │   └── questValidator.ts  # Quest schema validation
│   └── types/api.ts
├── .env.example
└── package.json
```

## Game Controls
- **WASD / Arrow Keys**: Move player
- **SPACE**: Melee attack (tap for normal, hold to charge)
- **SHIFT**: Dodge/roll in facing direction
- **TAB**: Open player menu (cycles: Inventory → Quests → Map → Stats)
- **I**: Open/close inventory
- **ENTER**: Cast spell (requires matching staff + tome equipped)
- **E**: Interact with NPCs
- **Q**: Open/close quest log
- **M**: Open/close dungeon map
- **L**: Open/close stats/level-up screen
- **ESC**: Close modals

## Key Patterns

### Scene Communication
Scenes communicate via Phaser events defined in `config/constants.ts`:
```typescript
this.scene.events.emit(EVENTS.PLAYER_HEALTH_CHANGED, health, maxHealth);
this.scene.get(SCENE_KEYS.GAME).events.on(EVENTS.PLAYER_HEALTH_CHANGED, callback);
```

### Adding New Items
Add to `src/data/items.ts`:
```typescript
new_weapon: {
  id: 'new_weapon',
  name: 'Display Name',
  type: 'weapon',
  slot: 'weapon',
  stats: { damage: 10, speed: 1.0, range: 24 },
  value: 100,
  sprite: 'sprite_key',  // Must be loaded in BootScene
  description: 'Item description',
  stackable: false
}
```

### Adding New Monsters
Add to `src/data/monsters.ts`:
```typescript
monster_new: {
  id: 'monster_new',
  name: 'Display Name',
  type: 'new',
  sprite: 'monster_new',  // Must be loaded in BootScene
  health: 50,
  damage: 10,
  speed: 60,
  attackRange: 20,
  attackCooldown: 1000,
  detectRange: 120,
  xpReward: 20,
  goldDrop: { min: 5, max: 15 },
  lootTable: [
    { itemId: 'flask_red', chance: 0.2 }
  ]
}
```

### Adding New Assets
1. Place PNG in `assets/items/`
2. Load in `src/scenes/BootScene.ts`:
```typescript
this.load.image('sprite_key', 'assets/items/filename.png');
```

## Asset Naming Conventions
- Monsters: `monster_<name>.png`
- NPCs: `npc_<name>.png`
- Weapons: `weapon_<type>_<variant>.png`
- Potions: `flask_<color>.png`
- Environment: `floor_*.png`, `wall_*.png`

## Constants (config/constants.ts)
- `TILE_SIZE`: 16 (base tile size)
- `SCALE`: 2 (sprite scaling)
- `PLAYER_SPEED`: 120
- `DUNGEON_WIDTH/HEIGHT`: 60x45 tiles
- `INVENTORY_SLOTS`: 20
- `INTERACTION_DISTANCE`: 32

## Current Features (Phase 1 + 2a + 2b + 2c + 2d + 2e + 2f + 3a + 3a-boss)
- ✅ BSP dungeon generation (rot.js Digger + mission graph, room clearing, locked boss door)
- ✅ 28 monster types with AI across 6 families (undead, beast, orc, demon, elemental, dark_knight)
- ✅ 3 NPC merchants
- ✅ 12 melee weapons, 3 staffs, 3 spell tomes, 5 outfits, 3 shields, 5 consumables
- ✅ Inventory & equipment system (4 slots: weapon, armor, shield, spellbook)
- ✅ Armor system (5 outfits that change player sprite + 3 shields, defense stat with damage reduction)
- ✅ Combat with arc-based attack hitbox (per-weapon-class arc width and reach)
- ✅ Weapon classes: sword, dagger, hammer, katana, staff, unarmed (arc width + knockback per class), spell (projectile)
- ✅ Dual weapon system: melee weapon (SPACE) + spell tome (ENTER), staffs required for matching elemental tomes
- ✅ Spell system (Fireball + Lightning + Frost tomes, projectile physics, INT scaling, staff element pairing, lightning chain AOE, frost freeze, mana cost)
- ✅ Mana system (50 max mana, per-spell costs, INT-scaled regen, mana potions, blue HUD bar)
- ✅ Knockback on hit (weapon-class-specific force, monsters stop at walls)
- ✅ Invincibility frames (500ms after damage, flashing visual)
- ✅ Dodge/roll (SHIFT key, afterimage trail, brief i-frames)
- ✅ Combo system (chain attacks within 500ms for up to 2.0x damage)
- ✅ Charged attacks (hold SPACE for up to 2.5x damage + extra knockback)
- ✅ Shop buy system
- ✅ HUD (health, mana, gold, weapon)
- ✅ Quest system (hardcoded + LLM-generated dynamic quests)
- ✅ Story-arc quests (multi-quest narrative arcs with LLM, boss finale, arc progress in quest log)
- ✅ NPC personality-driven quest generation (each NPC has distinct quest themes/tone)
- ✅ Dynamic quest variants (LLM-generated custom monsters/items with base sprite reuse)
- ✅ Boss monster colored names (red text above arc boss monsters)
- ✅ Monster tier system (3 tiers unlocked by arc completion, gating family availability)
- ✅ Boss-only monsters (necromancer, tentacle, ogre, demon, elemental_lord) with 32x32 sprite support
- ✅ Family-based room spawning (thematic consistency per room)
- ✅ Quest-aware monster respawns (bias toward active quest targets)
- ✅ Fog of war with Bresenham line-of-sight
- ✅ Save/load via backend API
- ✅ Game controller support (A=attack, B=dodge, X=interact, Y=inventory)
- ✅ Quest log overlay (Q key) with arc progress header
- ✅ Quest loot injection for LLM collect objectives
- ✅ Open door sprites (doors show open sprite instead of disappearing)
- ✅ NPC quest indicators (floating "!" and "?" above NPC heads, arc-aware)
- ✅ Loot chests (0-2 per room, wall-adjacent placement, quest-driven chest spawning)
- ✅ NPC extended quest intros (dramatic multi-line intro before quest offer)
- ✅ Narrator comments & boss dialog (LLM-generated cinematic overlay on quest complete, boss encounter, boss defeat)
- ✅ XP & leveling system (max level 20, XP from monsters + quests)
- ✅ Stat point allocation (5 stats: STR/DEX/CON/LCK/INT, 3 points per level)
- ✅ Stat-scaled combat (strength → melee damage, intelligence → spell damage, dexterity → crit chance, luck → gold bonus)
- ✅ Level-up VFX (golden flash, floating text, auto-open stat screen)
- ✅ XP bar + level display in HUD
- ✅ LevelUpScene (stat allocation overlay with keyboard/mouse/gamepad support)
- ✅ Tab navigation between player overlay screens (TAB key cycles Inventory → Quests → Map → Stats)
- ✅ Ranged enemy attacks (5 monsters: skeleton, orc shaman, imp, necromancer, elemental lord — projectile + retreat AI)
- ✅ Boss attack patterns (2-phase system: all 5 bosses gain abilities at 50% HP — slam, summon, charge, teleport, barrage)
- ✅ Monster spawner nests (destructible bone piles in ~30% of rooms, periodically spawn monsters until destroyed, family-tinted)
- ✅ Multi-floor dungeon (3 floors per run, stairs appear after boss defeat, one-way descent, player state carries between floors, monster HP/damage scale per floor)
- ✅ Arc-boss integration (story arc boss quests place the arc boss in the floor's boss room, thematic unlock message)
- ✅ LLM status indicator (HUD shows AI connection status: green sparkle when connected, gray when offline)
- ✅ Debug: `reveal` command in terminal to remove fog of war

## Planned Features (See PRD.md)
- Phase 3b: Skills, character classes
- Phase 4: Multiple areas, crafting
- Phase 5: Save system polish, audio, accessibility

## LLM Integration
The backend supports LLM-powered dynamic quest generation via any OpenAI-compatible API.

**Config** (`server/.env`):
```
LLM_ENABLED=true           # Master switch (must be "true" to activate)
LLM_API_KEY=your-key       # Required alongside LLM_ENABLED
LLM_BASE_URL=https://...   # OpenAI-compatible endpoint
LLM_MODEL=gpt-4.1-mini     # Model name (default; gpt-4.1-nano for lower cost)
STORY_ARC_DAILY_MAX=5      # Max story arcs generated per day (default: 5)
```

Both `LLM_ENABLED=true` AND `LLM_API_KEY` must be set. Missing either = LLM disabled (hardcoded quests only).
`STORY_ARC_DAILY_MAX` caps how many story arcs can be generated per calendar day (resets at midnight UTC). When the limit is reached, no new arcs are generated until the next day.

**Logging**: Uses pino with pretty console output + JSON file at `server/logs/server.log`.
```bash
# Watch all logs live
tail -f server/logs/server.log | npx pino-pretty

# Filter to LLM activity only
tail -f server/logs/server.log | npx pino-pretty | grep llm

# Raw JSON (for scripting/jq)
tail -f server/logs/server.log | jq 'select(.module == "llm")'
```

Log level configurable via `LOG_LEVEL` env var (default: `info`). Child loggers: `llm`, `api`, `db`.

See `ARCHITECTURE.md` for full system diagram and LLM flow.
See `GAME_DESIGN.md` for monster bestiary, item catalog, quest balance constraints, and variant system rules.

## Common Tasks

### Run Development Server
```bash
npm run dev                    # Both frontend + backend (via concurrently)
npm run dev:client             # Frontend only (port 4200)
npm run dev:server             # Backend only (port 4201)
```

### Type Check
```bash
npx tsc --noEmit
```

### Build for Production
```bash
npm run build              # Vite build + install server deps
npm start                  # Start production server (serves frontend + API)
```

### Deploy to Render
Push to GitHub and connect repo in Render dashboard, or use "New Blueprint Instance" with `render.yaml`. Set `LLM_API_KEY` in the Render dashboard. SQLite is persisted on a Render disk at `/data/game.db`.

## Debugging
Enable physics debug in `src/main.ts`:
```typescript
physics: {
  arcade: {
    debug: true  // Shows hitboxes
  }
}
```

## Notes
- Assets folder is gitignored (obtain 0x72 DungeonTileset separately)
- Game uses Arcade Physics (no rotation on bodies)
- All sprites are scaled 2x from 16px originals
- Dungeon generates 8-10 rooms via BSP, first room is safe (NPCs), last has boss (locked door unlocks after clearing 4 rooms)

## Working Conventions

### Auto-Document Changes
When implementing new features, architecture changes, or new requirements:
- **Always update PRD.md** with new/completed items
- **Always update ARCHITECTURE.md** if the system architecture changes (new services, integrations, data flows)
- **Always update CLAUDE.md** if project structure, conventions, or key patterns change
- **Always update GAME_DESIGN.md** if game mechanics, balance, monsters, items, or quest rules change
- Keep all documentation in sync with the actual codebase
