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
│   └── ShopSystem.ts          # Buy/sell logic
└── scenes/
    ├── BootScene.ts           # Asset loading
    ├── MenuScene.ts           # Main menu
    ├── GameScene.ts           # Main gameplay loop
    ├── UIScene.ts             # HUD overlay
    ├── InventoryScene.ts      # Inventory modal
    └── ShopScene.ts           # Shop interface
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

## Planned Features (See PRD.md)
- Phase 2: Armor, more monsters, dungeon floors, dodge mechanic
- Phase 3: XP/leveling, skills, quests
- Phase 4: Multiple areas, crafting
- Phase 5: Save system, audio, polish

## Common Tasks

### Run Development Server
```bash
npm run dev
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
