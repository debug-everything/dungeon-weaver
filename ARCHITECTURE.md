# Dungeon Crawler RPG - Architecture

## System Overview

```
┌─────────────────────────────────────────────────┐
│                  Browser Client                  │
│                                                  │
│  Phaser 3 Game Engine                            │
│  ├── Scenes (Boot, Menu, Game, UI, Inventory...) │
│  ├── Entities (Player, Monster, NPC)             │
│  ├── Systems (Combat, Inventory, Equipment,      │
│  │           Quest, FogOfWar, Shop)              │
│  └── ApiClient (REST calls to backend)           │
│                                                  │
│         │ HTTP via Vite proxy (/api → :4201)     │
└─────────┼───────────────────────────────────────┘
          │
┌─────────▼───────────────────────────────────────┐
│              Express Backend (server/)            │
│                                                  │
│  Routes                                          │
│  ├── /api/saves    - Save/load game state        │
│  ├── /api/quests   - LLM quest pool endpoints    │
│  └── /api/health   - Health check + LLM status   │
│                                                  │
│  Services                                        │
│  ├── gameStateService  - SQLite CRUD for saves   │
│  ├── llmService        - OpenAI API wrapper      │
│  ├── questPoolService  - Pre-gen quest pool      │
│  └── questValidator    - Schema validation       │
│                                                  │
│  Database: better-sqlite3 (./data/game.db)       │
└─────────────────────────────────────────────────┘
          │
          │ (only when LLM_ENABLED=true + LLM_API_KEY set)
          ▼
┌─────────────────────────────────────────────────┐
│         OpenAI-compatible LLM API                │
│  (configurable base URL + model)                 │
└─────────────────────────────────────────────────┘
```

## LLM Integration

### How It Works
The LLM generates dynamic quest definitions that supplement hardcoded quests.

**Activation:** Requires both `LLM_ENABLED=true` AND `LLM_API_KEY` to be set in `server/.env`. Either missing = LLM disabled.

**Flow:**
1. Server starts → checks if LLM is enabled
2. If enabled: `questPoolService.initialize()` pre-generates 2 quests via LLM
3. Frontend calls `GET /api/quests/available/:npcId` when player interacts with NPC
4. If LLM disabled: returns `[]`, game uses only hardcoded quests
5. If LLM enabled: returns quests from pool, pool auto-replenishes in background

**JSON Mode:** The LLM service uses `response_format: { type: 'json_object' }` when the provider supports it (auto-detected on first call). Falls back to prompt-based JSON otherwise.

### Configuration (`server/.env`)
```
LLM_ENABLED=true           # Master switch (default: false)
LLM_API_KEY=your-key       # Required for LLM to work
LLM_BASE_URL=https://...   # OpenAI-compatible endpoint (default: OpenAI)
LLM_MODEL=gpt-4.1-mini     # Model name (default: gpt-4.1-mini)
```

### Quest Validation
LLM-generated quests are validated against:
- Valid NPC IDs (`npc_merchant`, `npc_merchant_2`, `npc_sage`)
- Valid monster types (`zombie`, `skelet`, `orc`, `goblin`, `demon`)
- Valid item IDs (all weapons + potions)
- Dialog structure (required actions per phase, valid node references)
- Quest ID prefix (`quest_llm_*`)
- Variant definitions (valid base types/sprites/items, stat multiplier 0.5-2.0, unique variant IDs)
- Kill objective count capped at 5 (server-side guardrail)

Failed validation → retry up to 3 times with exponential backoff.

### Dynamic Quest Variants
LLM quests can define variant monsters and items — custom-named versions of existing types that reuse base sprites.

**Monster variants:** `{ variantId, baseType, baseSprite, name, statMultiplier }` → registered in the runtime `MONSTERS` registry with scaled stats, keeps `type` = baseType so `QuestSystem.onMonsterKilled()` matching works unchanged.

**Item variants:** `{ variantId, baseItem, name, description }` → registered in the runtime `ITEMS` registry, inherits sprite and stats from base item.

**Flow:**
1. LLM generates quest with optional `variants` field
2. Server validates variant definitions (base types, sprites, multipliers)
3. Frontend receives quest via `GET /api/quests/available/:npcId`
4. `NPCInteractionScene.handleQuest()` calls `VariantRegistry.registerMonsterVariant/registerItemVariant` before registering the quest
5. `VariantRegistry.injectQuestLoot()` adds collect-objective items to relevant monster loot tables (35% drop chance, matched to kill-objective monster types or all non-boss monsters)
6. `GameScene.respawnMonsters()` biases 50% of spawns toward active kill quest target types

## Client Architecture

### Scene Graph
```
BootScene → MenuScene → GameScene (parallel: UIScene)
                          ├── InventoryScene (overlay, I key)
                          ├── ShopScene (overlay)
                          ├── NPCInteractionScene (overlay)
                          ├── QuestDialogScene (overlay)
                          ├── QuestLogScene (overlay, Q key)
                          └── MapScene (overlay, M key)
```

### Data Flow
- **Scene ↔ Scene:** Phaser events (`EVENTS.*` in `config/constants.ts`)
- **Client → Server:** `ApiClient` REST calls via Vite proxy
- **Game State:** Managed in-memory by systems, persisted via save API

## Server Architecture

### Stack
- Express + TypeScript
- better-sqlite3 for persistence
- OpenAI SDK for LLM integration (OpenAI-compatible, works with any compatible provider)
- pino + pino-pretty for structured logging

### Logging
Uses **pino** with dual output:
- **Console:** Pretty-printed via `pino-pretty` (colored, human-readable)
- **File:** JSON lines at `server/logs/server.log` (machine-readable, persistent)

Child loggers by subsystem:
| Logger | Module tag | Used in |
|--------|-----------|---------|
| `logger` | (root) | Server startup |
| `llmLogger` | `llm` | LLM service, quest pool, quest routes |
| `apiLogger` | `api` | Game state routes |
| `dbLogger` | `db` | Database operations |

**Viewing logs independently** (even while `npm run dev` is running in another terminal):
```bash
# Pretty-print all logs
tail -f server/logs/server.log | npx pino-pretty

# LLM activity only
tail -f server/logs/server.log | jq 'select(.module == "llm")'

# Errors only
tail -f server/logs/server.log | jq 'select(.level >= 50)'
```

Set `LOG_LEVEL` env var to control verbosity (`debug`, `info`, `warn`, `error`). Default: `info`.

### Running
```bash
npm run dev            # Both frontend (4200) + backend (4201) via concurrently
npm run dev:client     # Frontend only
npm run dev:server     # Backend only
```
