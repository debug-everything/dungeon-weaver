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
│  ├── storyArcService   - Story arc lifecycle     │
│  ├── questPoolService  - Arc + fallback pools    │
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
The LLM generates dynamic quest definitions organized into coherent **story arcs** — multi-quest narrative sequences with a theme, escalating stakes, and a boss fight finale.

**Activation:** Requires both `LLM_ENABLED=true` AND `LLM_API_KEY` to be set in `server/.env`. Either missing = LLM disabled.

**Story Arc Flow:**
1. Server starts → `questPoolService.initialize()` → `storyArcService.initialize()`
2. If LLM enabled: generates a story arc outline (title, theme, N quest summaries, NPC assignments)
3. First quest in the arc is generated immediately for the assigned NPC
4. Frontend calls `GET /api/quests/available/:npcId` when player interacts with NPC
5. If NPC matches the current arc quest's assigned NPC, the arc quest is returned
6. On quest completion (`POST /api/quests/complete`), next arc quest is generated in background
7. When all arc quests complete, a new arc auto-generates
8. If LLM disabled: returns `[]`, game uses only hardcoded quests

**Fallback:** If arc generation fails, per-NPC random quest pools (legacy behavior) are used as a safety net.

**Arc Configuration** (`server/game.config.json`):
```json
{ "storyArc": { "questsPerArc": 3, "bossQuestEnabled": true } }
```

**Boss Quests:** The final quest in each arc is a boss quest with demon-type enemies, stat multiplier of 2.5+, colored name text (red `#ff4444`), and higher rewards.

**NPC Personality Profiles:** Quest generation includes NPC personality context (`NPC_PROFILES` in `llmService.ts`) that shapes quest themes, dialog tone, and reward types:
- **Marcus** — practical, commerce-focused quests (protect trade, recover goods). Favors destroy/recover types.
- **Elena** — adventurous, artifact-hunting quests (ancient relics, rare finds). Favors investigate/recover types.
- **Aldric** — scholarly, arcane quests (supernatural research, alchemical ingredients). Favors investigate/destroy types.

**JSON Mode:** The LLM service uses `response_format: { type: 'json_object' }` when the provider supports it (auto-detected on first call). Falls back to prompt-based JSON otherwise.

### Configuration (`server/.env`)
```
LLM_ENABLED=true           # Master switch (default: false)
LLM_API_KEY=your-key       # Required for LLM to work
LLM_BASE_URL=https://...   # OpenAI-compatible endpoint (default: OpenAI)
LLM_MODEL=gpt-4.1-mini     # Model name (default: gpt-4.1-mini)
```

### API Endpoints
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/quests/available` | GET | All available quests (all NPCs) |
| `/api/quests/available/:npcId` | GET | Available quests for specific NPC |
| `/api/quests/accept` | POST | Accept a quest (body: `{ questId }`) |
| `/api/quests/complete` | POST | Notify quest completion, returns `{ nextQuestNpcId }` for arc progression |
| `/api/quests/arc-status` | GET | Current story arc info (title, progress, next NPC) |
| `/api/quests/pool-status` | GET | Debug: pool sizes + arc status |

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
5. `VariantRegistry.injectQuestLoot()` adds collect-objective items to relevant monster loot tables (50% drop chance, matched to kill-objective monster types or all non-boss monsters)
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

## Deployment (Render)

Deployed as a single Render web service via Blueprint (`render.yaml`).

### How It Works
- **Build:** `npm install && npm run build` → Vite builds frontend to `dist/`, then installs server dependencies
- **Start:** Express serves both `/api/*` routes and the Vite static build (`dist/`) from a single process
- **Database:** SQLite persisted on a Render disk mounted at `/data` (1 GB), path set via `DATABASE_PATH=/data/game.db`
- **Host binding:** Server binds to `0.0.0.0` (Render requirement)

### Static File Serving
In production (`NODE_ENV=production`), `server/src/index.ts` adds:
1. `express.static()` serving `../dist` (the Vite build output)
2. Catch-all `*` route returning `index.html` for SPA client-side routing

### Environment Variables
Set in Render dashboard (or `render.yaml` defaults):
| Variable | Default | Notes |
|----------|---------|-------|
| `NODE_ENV` | `production` | Enables static serving |
| `PORT` | `4201` | Server listen port |
| `DATABASE_PATH` | `/data/game.db` | Points to persistent disk |
| `LLM_ENABLED` | `true` | Master switch |
| `LLM_API_KEY` | — | Set in dashboard |
| `LLM_BASE_URL` | `https://api.openai.com/v1` | OpenAI-compatible endpoint |
| `LLM_MODEL` | `gpt-4.1-mini` | Model name |
| `STORY_ARC_DAILY_MAX` | `5` | Daily arc generation cap |
