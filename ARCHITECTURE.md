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
│  ├── promptTemplates   - All LLM prompt text     │
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
2b. If `aiPatterns.chainingEnabled`: generates a lore fragment (locations, faction, history, artifact) grounded in the arc theme
3. First quest + initial intro narration generated in parallel (gated by `aiPatterns.introNarrationEnabled`)
3b. On each "New Game" click, MenuScene calls `POST /api/quests/regenerate-intro` to get a fresh intro (3-5 atmospheric lines, fast model). Loading screen shown while awaiting LLM response.
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

**NPC Personality Profiles:** Quest generation includes NPC personality context (`NPC_PROFILES` in `promptTemplates.ts`) that shapes quest themes, dialog tone, and reward types:
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
LLM_MODEL_FAST=gpt-4.1-nano # Fast/cheap model for low-importance calls (routing pattern)
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

## AI Workflow Design Patterns

This project showcases five agentic AI design patterns applied to dynamic game content generation. Each pattern is implemented in the quest/story arc pipeline where it provides the most natural value.

### Current State (Baseline)
The existing system uses single-shot LLM calls with rule-based validation:
- `generateStoryArc()` → produces arc outline (single call)
- `generateArcQuest()` → produces individual quest (single call, receives arc context)
- `questValidator.ts` → rule-based schema validation (no LLM)

The patterns below extend this baseline.

---

### Pattern 1: Prompt Chaining ✅ IMPLEMENTED
**Concept:** Sequential LLM calls where each step's output enriches the next step's input.

**Implementation — Arc Lore Chain:**
```
Step 1: Generate story arc outline          ✅ implemented
        → { title, theme, questSummaries }
            ↓ feeds into
Step 2: Generate world lore fragment        ✅ implemented
        → { locations[], faction, history, artifact }
            ↓ feeds into
Step 3: Generate individual quest           ✅ implemented
        (with lore context for grounded names/places)
        → { quest definition with lore-referenced dialog }
```
Narration (onComplete, onBossEncounter, onBossDefeat) is generated inline as part of Step 3 — the lore context enriches narration fields automatically.

**Why it matters:** Each step's output makes the next step's output higher quality. Without lore context, quest names feel random. With it, a quest about retrieving the "Shard of Valdris" references the lore's fallen kingdom of Valdris — creating coherence that single-shot generation can't achieve.

**Where in code:**
- `server/src/services/promptTemplates.ts` — `LORE_SYSTEM_PROMPT`, `buildLoreUserPrompt()`, `LoreFragment` interface
- `server/src/services/llmService.ts` — `generateLoreFragment()` method
- `server/src/services/storyArcService.ts` — chain lore generation between arc outline and first quest
- Lore context stored on `StoryArc.lore`, passed to all subsequent `generateArcQuest()` calls via `ArcQuestContext.lore`

**Data flow:**
```
storyArcService.generateNewArc()
  → llmService.generateStoryArc()           // Step 1: arc outline
  → llmService.generateLoreFragment(arc)     // Step 2: lore fragment (if chainingEnabled)
  → arc.lore = loreResult                    // Store on arc
  → Promise.all([                            // Step 3: parallel generation
      llmService.generateIntroNarration()    //   intro narration (if introNarrationEnabled)
      llmService.generateArcQuest(arc+lore)  //   first quest with lore context
    ])
```

**Feature flag:** `server/game.config.json` → `aiPatterns.chainingEnabled` (default: `false`). When disabled, quests generate without lore context (existing behavior). Lore generation failure is non-fatal — quests proceed without lore.

---

### Pattern 2: Parallelization
**Concept:** Multiple independent LLM calls execute simultaneously, results merged.

**Implementation — Quest Enrichment Fan-Out:**
```
                    ┌─ Worker A: Generate item flavor text
                    │   (custom descriptions for variant items)
Quest definition ───┼─ Worker B: Generate environmental hints
  (after Step 3)    │   (room descriptions referencing quest theme)
                    └─ Worker C: Generate NPC banter lines
                        (idle dialog about the quest for other NPCs)
                              ↓ merge
                    Enriched quest + room flavor + NPC banter
```

**Implementation — Pool Warmup:**
```
Floor loads → Promise.all([
  generateFallbackQuest(npc_merchant),
  generateFallbackQuest(npc_merchant_2),
  generateFallbackQuest(npc_sage)
])
```

**Why it matters:** Three 2-second LLM calls take 2s in parallel vs 6s sequential. The fan-out pattern is especially useful when enrichment tasks are independent of each other.

**Where in code:**
- `server/src/services/questPoolService.ts` — parallel pool warmup in `initialize()`
- `server/src/services/storyArcService.ts` — fan-out enrichment after quest generation

---

### Pattern 3: Routing ✅ IMPLEMENTED (Model Routing)
**Concept:** Classify input to select the best prompt template, model, or processing strategy.

**Implementation — Model Routing by Quest Importance:**
```
Quest request arrives
       ↓
 ┌─────────────────┐
 │   Route by tier  │
 └──┬──────────┬───┘
    │          │
    ▼          ▼
 Filler     Boss/Finale
 quest       quest
    │          │
    ▼          ▼
 Fast/cheap   Capable model
 model        (higher temp,
 (gpt-4.1-    more tokens,
  nano)        gpt-4.1-mini)
```

**Implementation — Prompt Template Routing by Quest Type:**
```
Arc outline says quest type = "investigate"
       ↓
 ┌─────────────────────┐
 │ Select prompt style  │
 └──┬───┬───┬───┬──────┘
    │   │   │   │
    ▼   ▼   ▼   ▼
 Combat  Mystery  Explore  Trade
 template template template template
 (action  (clues,  (hidden  (escort,
  dialog,  tension, rooms,   barter,
  battle   reveal)  mapping) negotiate)
  cries)
```

**Why it matters:** Not all quests need the same generation budget. A routine kill quest for pool filler doesn't need the same model/tokens as a climactic arc boss finale. Routing saves cost and improves quality where it counts.

**Routing table:**
| LLM Call | Importance | Model | Rationale |
|----------|-----------|-------|-----------|
| `generateQuestDefinition` (standalone pool filler) | Low | Fast | Disposable fallback quests |
| `evaluateQuestQuality` | Low | Fast | Small output (~500 tokens), scoring task |
| `generateStoryArc` (arc outline) | High | Capable | Sets narrative direction for entire arc |
| `generateArcQuest` (arc quest) | High | Capable | Player-facing content with coherence requirements |
| `generateLoreFragment` | High | Capable | Enriches all subsequent quests |

**Where in code:**
- `server/src/services/llmService.ts` — `resolveModel()` helper selects model based on importance, `callLLM()` accepts optional `model` parameter
- `server/src/config.ts` — `config.llm.modelFast` reads `LLM_MODEL_FAST` env var
- `server/game.config.json` — `aiPatterns.routingEnabled` feature flag

**Graceful fallback:** If `LLM_MODEL_FAST` not set, falls back to `LLM_MODEL`. If `routingEnabled` is `false`, all calls use `LLM_MODEL`.

---

### Pattern 4: Orchestrator-Workers
**Concept:** A central LLM plans the high-level structure, then dispatches specialized worker LLM calls to fill in details.

**Implementation — Floor Content Orchestrator:**
```
Orchestrator LLM: "Plan floor N content"
  Input: player tier, arc theme, floor number, completed arcs, NPC roster
  Output: floor content plan
    {
      thematicRooms: [{ roomIndex, theme, flavorText }],
      sideQuestHooks: [{ npcId, hookSummary, questType }],
      monsterDistribution: { primary: "undead", secondary: "beast" },
      environmentalStory: "collapsed mine with signs of necromancy"
    }
         │
    ┌────┼────────────┬──────────────┐
    ▼    ▼            ▼              ▼
 Worker 1          Worker 2       Worker 3
 Generate          Generate       Generate
 main arc          side quest A   room flavor
 quest (using      (using hook    text batch
 floor plan)       from plan)     (all themed
                                  rooms)
         │              │              │
         └──────────────┴──────────────┘
                        ↓
              Orchestrator merges into
              coherent floor content
```

**Why it matters:** Currently, dungeon rooms and quests are disconnected — rooms are procedurally random, quests reference generic locations. The orchestrator creates thematic coherence: a "corrupted mine" floor has mine-themed room descriptions, undead miners as enemies, and quests about clearing the corruption. The player feels like they're exploring a designed world, not random rooms.

**Where in code:**
- `server/src/services/floorOrchestratorService.ts` — new service
- `server/src/services/llmService.ts` — new `generateFloorPlan()` and `generateRoomFlavor()` methods
- `server/src/routes/quests.ts` — new `GET /api/floor/plan/:floorNumber` endpoint
- Frontend: `GameScene.ts` receives floor plan, applies room themes and flavor text

---

### Pattern 5: Evaluator-Optimizer ✅ IMPLEMENTED
**Concept:** One LLM generates content, another evaluates quality and provides feedback. Loop until quality threshold is met.

**Implementation — Arc Quest Quality Gate:**
```
┌─────────────────────────────────────────────────┐
│                                                  │
│  Generator LLM                                   │
│  "Generate arc quest with coherence rules"       │
│       ↓                                          │
│  Generated quest definition                      │
│       ↓                                          │
│  Evaluator LLM                                   │
│  "Score this quest on 5 dimensions"              │
│       ↓                                          │
│  Evaluation:                                     │
│    arc_coherence: 8/10                            │
│    lore_integration: 6/10  ← "Lore faction name  │
│                              never referenced"    │
│    continuity: 9/10                               │
│    npc_voice: 5/10 ← "Aldric sounds like Marcus, │
│                       needs more scholarly tone"  │
│    dialog_specificity: 7/10                       │
│       ↓                                          │
│  Average: 7.0 < threshold (7.0)                  │
│       ↓                                          │
│  Feed critique back to Generator                 │
│  "Reference the faction by name. Make Aldric     │
│   sound more scholarly. Specific issues: ..."    │
│       ↓                                          │
│  Generator produces improved version             │
│       ↓                                          │
│  Evaluator re-scores: avg 8.2 ≥ 7.0 ✓           │
│                                                  │
│  Max retries: 1 (configurable, then accept)      │
└─────────────────────────────────────────────────┘
```

**Why it matters:** Quests often fail to reference the arc's lore, theme, or previous quest events. The evaluator scores 5 narrative dimensions (arc_coherence, lore_integration, continuity, npc_voice, dialog_specificity) and feeds actionable critique back for retry.

**Applied to all arc quests** (not just boss quests), since incoherence affects the whole arc. Threshold and retry count are configurable.

**Scoring dimensions:**
1. `arc_coherence` — does dialog reference the arc title/theme?
2. `lore_integration` — are named locations, faction, artifact mentioned? (10 if no lore provided)
3. `continuity` — does the NPC acknowledge prior quest events? (8+ for first quest)
4. `npc_voice` — does dialog match NPC personality?
5. `dialog_specificity` — is dialog specific to this quest, not generic filler?

**Where in code:**
- `server/src/services/promptTemplates.ts` — `EVALUATOR_SYSTEM_PROMPT`, `buildEvaluatorUserPrompt()`, coherence rules in `buildArcQuestUserPrompt()`
- `server/src/services/llmService.ts` — `evaluateQuestQuality()`, `QuestEvaluation` interface
- `server/src/services/storyArcService.ts` — evaluate-optimize loop in `generateNextQuest()`, critique injection via `ArcQuestContext.critique`
- Enriched `completedQuestDetails` on `StoryArc` captures variant names, NPC names for richer context
- Logs evaluation scores and critique for observability

**Cost:** +1 small LLM call per quest (~500 tokens). If retry needed: +1 generation + +1 evaluation. Worst case: 3 generations + 2 evaluations. Evaluation failure is non-fatal — quest accepted as-is.

**Feature flag:** `server/game.config.json` → `aiPatterns.evaluatorEnabled` (default: `true`), `evaluatorThreshold` (default: `7.0`), `evaluatorMaxRetries` (default: `1`).

---

### Pattern Integration — Full Pipeline

When all five patterns work together on a boss quest:

```
1. CHAINING:     Arc outline → Lore fragment → Quest generation → Narration
2. ROUTING:      Boss quest detected → use capable model + boss prompt template
3. ORCHESTRATOR: Floor plan provides thematic context to quest generation
4. GENERATION:   Generator LLM produces boss quest definition
5. EVALUATION:   Evaluator LLM scores quality, feeds critique back
6. PARALLEL:     Meanwhile, item flavor + room descriptions generated in parallel
7. MERGE:        All results assembled into final enriched quest
```

### Implementation Priority

| Phase | Pattern | Key Files | Status |
|-------|---------|-----------|--------|
| 1 | Evaluator-Optimizer | `llmService.ts`, `promptTemplates.ts`, `storyArcService.ts` | ✅ Implemented |
| 2 | Prompt Chaining | `promptTemplates.ts`, `llmService.ts`, `storyArcService.ts` | ✅ Implemented |
| 3 | Routing | `llmService.ts`, `config.ts` | ✅ Implemented (model routing by quest importance) |
| 4 | Parallelization | `questPoolService.ts`, `storyArcService.ts` | Chaining (enrichment fan-out uses chain outputs) |
| 5 | Orchestrator-Workers | New `floorOrchestratorService.ts` | All above (uses routing, chaining, parallelization) |

### Configuration

All pattern behavior is configurable via `server/game.config.json` and environment variables:
```json
{
  "storyArc": { "questsPerArc": 3, "bossQuestEnabled": true },
  "aiPatterns": {
    "chainingEnabled": true,
    "routingEnabled": true,
    "parallelEnrichment": true,
    "evaluatorEnabled": true,
    "evaluatorThreshold": 7.0,
    "evaluatorMaxRetries": 1,
    "orchestratorEnabled": false
  }
}
```
```env
LLM_MODEL=gpt-4.1-mini         # Default / capable model
LLM_MODEL_FAST=gpt-4.1-nano    # Fast model for filler quests (routing pattern)
```

Each pattern can be toggled independently. When disabled, the system falls back to the existing single-shot generation behavior.

---

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
| `LLM_MODEL` | `gpt-4.1-mini` | Capable model name |
| `LLM_MODEL_FAST` | `gpt-4.1-nano` | Fast model for low-importance calls |
| `STORY_ARC_DAILY_MAX` | `5` | Daily arc generation cap |
