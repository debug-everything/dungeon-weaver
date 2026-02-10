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
│   └── VariantRegistry.ts    # Runtime registration of LLM variant monsters/items
└── scenes/
    ├── BootScene.ts           # Asset loading
    ├── MenuScene.ts           # Main menu
    ├── GameScene.ts           # Main gameplay loop
    ├── UIScene.ts             # HUD overlay
    ├── InventoryScene.ts      # Inventory modal
    ├── NPCInteractionScene.ts # NPC dialog & quest UI
    └── ShopScene.ts           # Shop interface

server/
├── src/
│   ├── index.ts               # Express app entry point
│   ├── config.ts              # Environment config (port, DB, LLM)
│   ├── db/database.ts         # SQLite setup
│   ├── routes/
│   │   ├── gameState.ts       # /api/saves CRUD
│   │   └── quests.ts          # /api/quests LLM quest endpoints
│   ├── services/
│   │   ├── gameStateService.ts
│   │   ├── llmService.ts      # OpenAI-compatible LLM wrapper
│   │   ├── questPoolService.ts # Pre-gen quest pool
│   │   └── questValidator.ts  # Quest schema validation
│   └── types/api.ts
├── .env.example
└── package.json
```

## Game Controls
- **WASD / Arrow Keys**: Move player
- **SPACE**: Attack (sword swing animation)
- **I**: Open/close inventory
- **E**: Interact with NPCs
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
- `DUNGEON_WIDTH/HEIGHT`: 40x30 tiles
- `INVENTORY_SLOTS`: 20
- `INTERACTION_DISTANCE`: 32

## Current Features (Phase 1)
- ✅ Procedural dungeon generation
- ✅ 5 monster types with AI
- ✅ 3 NPC merchants
- ✅ 14 weapons, 5 consumables
- ✅ Inventory & equipment system
- ✅ Combat with sword swing animation
- ✅ Shop buy system
- ✅ HUD (health, gold, weapon)
- ✅ Quest system (hardcoded + LLM-generated dynamic quests)
- ✅ Dynamic quest variants (LLM-generated custom monsters/items with base sprite reuse)
- ✅ Quest-aware monster respawns (bias toward active quest targets)
- ✅ Fog of war with Bresenham line-of-sight
- ✅ Save/load via backend API
- ✅ Game controller support

## Planned Features (See PRD.md)
- Phase 2: Armor, more monsters, dungeon floors, dodge mechanic
- Phase 3: XP/leveling, skills, character classes
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
```

Both `LLM_ENABLED=true` AND `LLM_API_KEY` must be set. Missing either = LLM disabled (hardcoded quests only).

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
npm run build
```

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
- Dungeon generates 8 rooms max, first room is safe (NPCs), last has boss

## Working Conventions

### Auto-Document Changes
When implementing new features, architecture changes, or new requirements:
- **Always update PRD.md** with new/completed items
- **Always update ARCHITECTURE.md** if the system architecture changes (new services, integrations, data flows)
- **Always update CLAUDE.md** if project structure, conventions, or key patterns change
- **Always update GAME_DESIGN.md** if game mechanics, balance, monsters, items, or quest rules change
- Keep all documentation in sync with the actual codebase
