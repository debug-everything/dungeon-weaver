import Phaser from 'phaser';
import { SCENE_KEYS, TILE_SIZE, SCALE, DUNGEON_WIDTH, DUNGEON_HEIGHT, EVENTS, INTERACTION_DISTANCE, VISIBILITY_RADIUS, CHESTS_PER_ROOM, CHEST_GOLD, CHEST_LOOT_TABLE, ROOMS_TO_CLEAR_FOR_BOSS, MONSTER_TIER_FAMILIES, BOSS_LABEL_COLORS, MonsterTier, SPELL_COLORS, SPAWNER_HP, SPAWNER_SPAWN_COOLDOWN, SPAWNER_MAX_SPAWNED, SPAWNER_CHANCE, SPAWNER_XP, SPAWNER_FAMILY_TINTS, TOTAL_FLOORS, FLOOR_SCALING } from '../config/constants';
import type { SpellType, FloorTransitionData } from '../types';
import { Player } from '../entities/Player';
import { Monster } from '../entities/Monster';
import { NPC } from '../entities/NPC';
import { DungeonRoom, NPCData, ChestData, MonsterFamily, MonsterData, SpawnerData } from '../types';
import type { NarratorStyle } from './NarratorScene';
import { MONSTERS, getNonBossMonstersByFamily, getBossMonsters } from '../data/monsters';
import { NPCS } from '../data/npcs';
import { QUESTS } from '../data/quests';
import { QuestSystem } from '../systems/QuestSystem';
import { FogOfWarSystem } from '../systems/FogOfWarSystem';
import { clearShopSubsets, rotateShopSubset } from '../systems/ShopSystem';
import { generateDungeon as generateBSPDungeon } from '../systems/DungeonGenerator';
import { saveGame, checkLLMEnabled, getArcStatus, SaveGamePayload, SaveData } from '../services/ApiClient';
import { StoryArcInfo } from '../types';

import type { MonsterProjectileStyle } from '../types';
import { MONSTER_PROJECTILE_COLORS } from '../config/constants';

interface SpellProjectile {
  graphics: Phaser.GameObjects.Graphics;
  x: number;
  y: number;
  vx: number;
  vy: number;
  directionRad: number;
  originX: number;
  originY: number;
  range: number;
  spellType: SpellType;
  damage: { damage: number; isCritical: boolean };
  aoe: number;
  trailTimer: Phaser.Time.TimerEvent;
}

interface MonsterProjectile {
  graphics: Phaser.GameObjects.Graphics;
  x: number;
  y: number;
  vx: number;
  vy: number;
  directionRad: number;
  originX: number;
  originY: number;
  range: number;
  damage: number;
  style: MonsterProjectileStyle;
}

export class GameScene extends Phaser.Scene {
  private player!: Player;
  private monsters!: Phaser.GameObjects.Group;
  private npcs!: Phaser.GameObjects.Group;
  private walls!: Phaser.Physics.Arcade.StaticGroup;
  private floors!: Phaser.GameObjects.Group;

  private dungeon: number[][] = [];
  private rooms: DungeonRoom[] = [];
  private isPaused: boolean = false;
  public questSystem!: QuestSystem;
  public fogSystem!: FogOfWarSystem;
  private fogTiles: Phaser.GameObjects.Rectangle[][] = [];
  private respawnTimer!: Phaser.Time.TimerEvent;
  private readonly maxMonsters = 20;
  private currentSaveId: string | null = null;
  private doors!: Phaser.Physics.Arcade.StaticGroup;
  private doorSprites: Map<string, Phaser.Physics.Arcade.Image> = new Map();
  private chests!: Phaser.Physics.Arcade.StaticGroup;
  private chestData: Map<string, ChestData> = new Map();
  private chestSprites: Map<string, Phaser.Physics.Arcade.Image> = new Map();
  private lastIndicatorUpdate: number = 0;
  private lastArcPoll: number = 0;
  private arcNextQuestNpcId: string | null = null;
  private roomClearState: Map<number, { total: number; killed: number }> = new Map();
  private bossUnlocked: boolean = false;
  private currentTier: MonsterTier = 1;
  private bossRoomEntered: boolean = false;
  private narratorActive: boolean = false;
  private spellProjectiles: SpellProjectile[] = [];
  private monsterProjectiles: MonsterProjectile[] = [];

  // Multi-floor system
  private currentFloor: number = 1;
  private floorTransitionData: FloorTransitionData | null = null;
  private stairsSprite: Phaser.GameObjects.Image | null = null;
  private transitioning: boolean = false;

  // LLM status
  private llmEnabled: boolean = false;

  // Spawner/nest system
  private spawnerSprites: Map<string, Phaser.Physics.Arcade.Image> = new Map();
  private spawnerData: Map<string, SpawnerData> = new Map();
  private spawnerHealthBars: Map<string, Phaser.GameObjects.Graphics> = new Map();
  private spawnerMonsterMap: Map<Monster, string> = new Map();
  // Room family assignments (for spawner family consistency)
  private roomFamilies: Map<number, MonsterFamily> = new Map();

  constructor() {
    super({ key: SCENE_KEYS.GAME });
  }

  init(data?: { floorTransition?: FloorTransitionData }): void {
    console.log('[GameScene] init called, data:', data ? JSON.stringify({ hasFloorTransition: !!data.floorTransition, targetFloor: data.floorTransition?.targetFloor }) : 'none');
    if (data?.floorTransition) {
      this.floorTransitionData = data.floorTransition;
      this.currentFloor = data.floorTransition.targetFloor;
    } else {
      this.floorTransitionData = null;
      this.currentFloor = 1;
    }
    this.stairsSprite = null;
    this.transitioning = false;
    console.log('[GameScene] init done, currentFloor:', this.currentFloor);
  }

  create(): void {
    console.log('[GameScene] create called, currentFloor:', this.currentFloor, 'hasTransitionData:', !!this.floorTransitionData);
    try {
    this.isPaused = false;

    // Initialize groups
    this.walls = this.physics.add.staticGroup();
    this.doors = this.physics.add.staticGroup();
    this.doorSprites = new Map();
    this.chests = this.physics.add.staticGroup();
    this.chestData = new Map();
    this.chestSprites = new Map();
    this.arcNextQuestNpcId = null;
    this.lastArcPoll = 0;
    this.roomClearState = new Map();
    this.bossUnlocked = false;
    this.currentTier = 1;
    this.bossRoomEntered = false;
    this.narratorActive = false;
    this.spellProjectiles = [];
    this.monsterProjectiles = [];
    this.spawnerSprites = new Map();
    this.spawnerData = new Map();
    this.spawnerHealthBars = new Map();
    this.spawnerMonsterMap = new Map();
    this.roomFamilies = new Map();
    this.floors = this.add.group();
    this.monsters = this.add.group();
    this.npcs = this.add.group();

    // Generate dungeon
    this.generateDungeon();
    this.renderDungeon();

    // Initialize fog of war
    this.fogSystem = new FogOfWarSystem(DUNGEON_WIDTH, DUNGEON_HEIGHT, VISIBILITY_RADIUS, this.dungeon);
    this.createFogTiles();

    // Create player in first room
    const startRoom = this.rooms[0];
    this.player = new Player(
      this,
      startRoom.centerX * TILE_SIZE * SCALE,
      startRoom.centerY * TILE_SIZE * SCALE
    );

    // Restore player state from floor transition
    if (this.floorTransitionData) {
      this.player.restoreFromTransition(this.floorTransitionData);
      this.currentTier = this.floorTransitionData.currentTier;
    }

    // Setup camera
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.setZoom(1.5);
    this.cameras.main.setBackgroundColor('#1a1a2e');

    // Setup collisions
    this.physics.add.collider(this.player, this.walls);
    this.physics.add.collider(this.player, this.doors);
    this.physics.add.collider(this.monsters, this.walls);
    this.physics.add.collider(this.monsters, this.doors);
    this.physics.add.collider(this.monsters, this.monsters);
    this.physics.add.collider(this.player, this.chests);
    this.physics.add.collider(this.monsters, this.chests);
    // Spawner colliders added after spawnSpawners()

    // Spawn NPCs in safe room (first room)
    this.spawnNPCs();

    // Spawn chests in dungeon rooms
    this.spawnChests();

    // Spawn monsters in other rooms
    this.spawnMonsters();

    // Spawn monster nests/spawners
    this.spawnSpawners();

    // Respawn timer - replenish monsters every 15 seconds
    this.respawnTimer = this.time.addEvent({
      delay: 15000,
      callback: this.respawnMonsters,
      callbackScope: this,
      loop: true
    });

    // Initialize quest system
    this.questSystem = new QuestSystem(this);

    // Only register hardcoded quests if LLM is unavailable (fallback)
    checkLLMEnabled().then(llmEnabled => {
      this.llmEnabled = llmEnabled;
      this.events.emit(EVENTS.LLM_STATUS_CHANGED, llmEnabled);
      if (!llmEnabled) {
        for (const quest of Object.values(QUESTS)) {
          this.questSystem.registerQuest(quest);
        }
      }
    }).catch(() => {
      this.llmEnabled = false;
      this.events.emit(EVENTS.LLM_STATUS_CHANGED, false);
      // Backend unreachable — use hardcoded quests
      for (const quest of Object.values(QUESTS)) {
        this.questSystem.registerQuest(quest);
      }
    });

    // Restore quest state from floor transition
    if (this.floorTransitionData) {
      this.questSystem.importState(
        this.floorTransitionData.questData.definitions,
        this.floorTransitionData.questData.states
      );
      this.floorTransitionData = null;
    }

    // Fetch tier from arc status (only on floor 1, otherwise tier comes from transition data)
    if (this.currentFloor === 1) {
      getArcStatus().then(raw => {
        if (raw && typeof raw === 'object' && 'tier' in (raw as Record<string, unknown>)) {
          const tier = (raw as Record<string, unknown>).tier as number;
          if (tier >= 1 && tier <= 3) {
            this.currentTier = tier as MonsterTier;
          }
        }
      }).catch(() => {});
    }

    // Setup event listeners
    this.setupEventListeners();

    // Emit initial player state
    this.events.emit(EVENTS.PLAYER_HEALTH_CHANGED, this.player.health, this.player.maxHealth);
    this.events.emit(EVENTS.PLAYER_GOLD_CHANGED, this.player.gold);

    // Initial fog of war reveal around player
    const scaledTile = TILE_SIZE * SCALE;
    const initTileX = Math.floor(this.player.x / scaledTile);
    const initTileY = Math.floor(this.player.y / scaledTile);
    this.fogSystem.update(initTileX, initTileY);
    this.updateFogRendering();

    // On floor transitions, relaunch UI and re-emit player state
    if (this.currentFloor > 1) {
      this.scene.launch(SCENE_KEYS.UI);
      // Re-enable keyboard input in case it was left disabled
      if (this.input.keyboard) this.input.keyboard.enabled = true;

      // Re-emit all player state events so UIScene picks up restored values
      // (restoreFromTransition fired before UIScene was listening)
      this.time.delayedCall(100, () => {
        this.player.emitAllState();
      });
    }

    // Emit floor change event (deferred so UI has time to set up listeners)
    this.time.delayedCall(0, () => {
      this.events.emit(EVENTS.FLOOR_CHANGED, this.currentFloor);
    });

    console.log('[GameScene] create completed successfully for floor', this.currentFloor);
    } catch (err) {
      console.error('[GameScene] FATAL: create() threw an error:', err);
    }
  }

  private generateDungeon(): void {
    // Clear shop display subsets on new dungeon
    clearShopSubsets();

    // Use BSP dungeon generator
    const result = generateBSPDungeon(DUNGEON_WIDTH, DUNGEON_HEIGHT);
    this.dungeon = result.dungeon;
    this.rooms = result.rooms;
    this.roomClearState = new Map();
    this.bossUnlocked = false;
  }

  private renderDungeon(): void {
    const scaledTile = TILE_SIZE * SCALE;

    for (let y = 0; y < DUNGEON_HEIGHT; y++) {
      for (let x = 0; x < DUNGEON_WIDTH; x++) {
        const worldX = x * scaledTile;
        const worldY = y * scaledTile;

        const tile = this.dungeon[y][x];
        if (tile === 0 || tile === 3) {
          // Floor tile (0) or open door (3) — both walkable
          const floorType = Math.random() < 0.9 ? 'floor_plain' :
                           Math.random() < 0.5 ? 'floor_stain_1' : 'floor_stain_2';
          const floor = this.add.image(worldX, worldY, floorType);
          floor.setScale(SCALE);
          floor.setOrigin(0);
          floor.setDepth(0);
          this.floors.add(floor);
        } else if (tile === 2 || tile === 4) {
          // Closed door (2) or locked door (4) — floor underneath + door sprite
          const floor = this.add.image(worldX, worldY, 'floor_plain');
          floor.setScale(SCALE);
          floor.setOrigin(0);
          floor.setDepth(0);
          this.floors.add(floor);

          // Door sprite is 32x32 (already matches scaled tile size) — no setScale needed
          const door = this.physics.add.staticImage(worldX + scaledTile / 2, worldY + scaledTile / 2, 'door_closed');
          door.setDepth(1);
          if (tile === 4) {
            door.setTint(0xff4444); // Red tint for locked doors
          }
          door.refreshBody();
          this.doors.add(door);
          this.doorSprites.set(`${x},${y}`, door);
        } else {
          // Wall tile
          const wall = this.physics.add.staticImage(worldX + scaledTile / 2, worldY + scaledTile / 2, 'wall_center');
          wall.setScale(SCALE);
          wall.setDepth(1);
          wall.refreshBody();
          this.walls.add(wall);
        }
      }
    }

    // Set world bounds
    this.physics.world.setBounds(0, 0, DUNGEON_WIDTH * scaledTile, DUNGEON_HEIGHT * scaledTile);
    this.cameras.main.setBounds(0, 0, DUNGEON_WIDTH * scaledTile, DUNGEON_HEIGHT * scaledTile);
  }

  private spawnNPCs(): void {
    if (this.rooms.length === 0) return;

    const safeRoom = this.rooms[0];
    const npcIds = Object.keys(NPCS);
    const scaledTile = TILE_SIZE * SCALE;

    // Place NPCs in separate corners of the room (1 tile inset from walls)
    const positions = [
      { x: safeRoom.x + 1, y: safeRoom.y + 1 },                                    // top-left
      { x: safeRoom.x + safeRoom.width - 2, y: safeRoom.y + 1 },                   // top-right
      { x: safeRoom.x + Math.floor(safeRoom.width / 2), y: safeRoom.y + safeRoom.height - 2 } // bottom-center
    ];

    npcIds.forEach((npcId, index) => {
      const npcData = NPCS[npcId];
      const pos = positions[index % positions.length];
      const npc = new NPC(
        this,
        pos.x * scaledTile + scaledTile / 2,
        pos.y * scaledTile + scaledTile / 2,
        npcData
      );
      this.npcs.add(npc);
    });
  }

  private spawnMonsters(): void {
    const allowedFamilies = MONSTER_TIER_FAMILIES[this.currentTier];

    for (let i = 0; i < this.rooms.length; i++) {
      const room = this.rooms[i];
      // Skip start room
      if (room.roomType === 'start' || i === 0) continue;

      const isBoss = room.isBossRoom || i === this.rooms.length - 1;
      const monsterCount = Phaser.Math.Between(2, 4);

      // Pick one family for this room (thematic consistency)
      const roomFamily = Phaser.Utils.Array.GetRandom(allowedFamilies) as MonsterFamily;
      this.roomFamilies.set(i, roomFamily);
      const roomPool = getNonBossMonstersByFamily(roomFamily);

      for (let j = 0; j < monsterCount; j++) {
        let monsterData;

        if (isBoss && j === 0) {
          // Spawn a boss from unlocked families
          const allowedBosses = getBossMonsters().filter(b => allowedFamilies.includes(b.family));
          monsterData = allowedBosses.length > 0
            ? { ...Phaser.Utils.Array.GetRandom(allowedBosses), nameColor: BOSS_LABEL_COLORS.miniBoss }
            : MONSTERS['monster_demon'];
        } else if (roomPool.length > 0) {
          monsterData = Phaser.Utils.Array.GetRandom(roomPool);
        } else {
          // Fallback: random non-boss from any allowed family
          const fallback = allowedFamilies.flatMap(f => getNonBossMonstersByFamily(f));
          monsterData = fallback.length > 0 ? Phaser.Utils.Array.GetRandom(fallback) : MONSTERS['monster_zombie'];
        }

        const spawnX = Phaser.Math.Between(room.x + 1, room.x + room.width - 2) * TILE_SIZE * SCALE;
        const spawnY = Phaser.Math.Between(room.y + 1, room.y + room.height - 2) * TILE_SIZE * SCALE;

        const scaledData = this.scaleMonsterForFloor(monsterData);
        const monster = new Monster(this, spawnX, spawnY, scaledData);
        monster.setTarget(this.player);
        monster.setFogSystem(this.fogSystem);
        this.monsters.add(monster);
      }

      // Track room clear state
      this.roomClearState.set(i, { total: monsterCount, killed: 0 });
    }
  }

  private spawnChests(): void {
    const scaledTile = TILE_SIZE * SCALE;

    // Skip room 0 (safe room)
    for (let i = 1; i < this.rooms.length; i++) {
      const room = this.rooms[i];
      const count = Phaser.Math.Between(CHESTS_PER_ROOM.min, CHESTS_PER_ROOM.max);

      // Collect wall-adjacent floor tiles (corners preferred)
      const candidates = this.getWallAdjacentTiles(room);
      if (candidates.length === 0) continue;

      for (let j = 0; j < count; j++) {
        if (candidates.length === 0) break;
        const pickIdx = Math.floor(Math.random() * candidates.length);
        const { tx, ty } = candidates[pickIdx];
        candidates.splice(pickIdx, 1); // Don't pick same spot twice

        // Roll random loot
        const gold = Phaser.Math.Between(CHEST_GOLD.min, CHEST_GOLD.max);
        const items: { itemId: string; quantity: number }[] = [];
        for (const entry of CHEST_LOOT_TABLE) {
          if (Math.random() < entry.chance) {
            items.push({ itemId: entry.itemId, quantity: 1 });
          }
        }

        const key = `${tx},${ty}`;
        const data: ChestData = { x: tx, y: ty, opened: false, gold, items };
        this.chestData.set(key, data);

        const worldX = tx * scaledTile + scaledTile / 2;
        const worldY = ty * scaledTile + scaledTile / 2;
        const chest = this.physics.add.staticImage(worldX, worldY, 'chest_closed');
        chest.setDepth(1);
        chest.refreshBody();
        this.chests.add(chest);
        this.chestSprites.set(key, chest);
      }
    }
  }

  /** Returns floor tiles adjacent to walls, weighted toward corners. Avoids door-adjacent tiles. */
  private getWallAdjacentTiles(room: DungeonRoom): { tx: number; ty: number }[] {
    const results: { tx: number; ty: number; wallCount: number }[] = [];

    for (let ty = room.y; ty < room.y + room.height; ty++) {
      for (let tx = room.x; tx < room.x + room.width; tx++) {
        if (this.dungeon[ty]?.[tx] !== 0) continue;
        const key = `${tx},${ty}`;
        if (this.chestSprites.has(key) || this.doorSprites.has(key)) continue;

        // Count adjacent walls
        let wallCount = 0;
        if (this.dungeon[ty - 1]?.[tx] === 1) wallCount++;
        if (this.dungeon[ty + 1]?.[tx] === 1) wallCount++;
        if (this.dungeon[ty]?.[tx - 1] === 1) wallCount++;
        if (this.dungeon[ty]?.[tx + 1] === 1) wallCount++;

        if (wallCount === 0) continue; // Must be adjacent to at least 1 wall

        // Skip tiles adjacent to doors (would block entrances)
        let nearDoor = false;
        for (const [dy, dx] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
          const tile = this.dungeon[ty + dy]?.[tx + dx];
          if (tile === 2 || tile === 3 || tile === 4) { nearDoor = true; break; }
        }
        if (nearDoor) continue;

        results.push({ tx, ty, wallCount });
      }
    }

    // Weight corners (2+ walls) higher by duplicating them
    const weighted: { tx: number; ty: number }[] = [];
    for (const t of results) {
      weighted.push({ tx: t.tx, ty: t.ty });
      if (t.wallCount >= 2) weighted.push({ tx: t.tx, ty: t.ty }); // double weight
    }
    return weighted;
  }

  private openChest(key: string): void {
    const data = this.chestData.get(key);
    const sprite = this.chestSprites.get(key);
    if (!data || !sprite || data.opened) return;

    data.opened = true;

    // Show full chest briefly, then empty
    sprite.setTexture('chest_open_full');
    this.time.delayedCall(500, () => {
      sprite.setTexture('chest_open_empty');
    });

    // Disable physics body
    const body = sprite.body as Phaser.Physics.Arcade.StaticBody;
    body.enable = false;

    // Give gold
    if (data.gold > 0) {
      this.player.addGold(data.gold);
      const goldText = this.add.text(sprite.x, sprite.y, `+${data.gold} gold`, {
        fontSize: '12px',
        fontFamily: 'monospace',
        color: '#ffd700',
        stroke: '#000000',
        strokeThickness: 2
      }).setOrigin(0.5).setDepth(1000);
      this.tweens.add({
        targets: goldText,
        y: sprite.y - 30,
        alpha: 0,
        duration: 1000,
        onComplete: () => goldText.destroy()
      });
    }

    // Give items
    let yOffset = 0;
    for (const loot of data.items) {
      for (let i = 0; i < loot.quantity; i++) {
        const added = this.player.inventory.addItem(loot.itemId);
        if (added) {
          this.events.emit(EVENTS.ITEM_PICKED_UP, loot.itemId);
          yOffset -= 16;
          const itemName = loot.itemId.replace(/_/g, ' ');
          const itemText = this.add.text(sprite.x, sprite.y + yOffset, `+${itemName}`, {
            fontSize: '10px',
            fontFamily: 'monospace',
            color: '#88ff88',
            stroke: '#000000',
            strokeThickness: 2
          }).setOrigin(0.5).setDepth(1000);
          this.tweens.add({
            targets: itemText,
            y: sprite.y + yOffset - 30,
            alpha: 0,
            duration: 1200,
            onComplete: () => itemText.destroy()
          });
        }
      }
    }
  }

  spawnQuestChest(roomIndex: number, itemId: string): void {
    if (roomIndex < 1 || roomIndex >= this.rooms.length) return;
    const room = this.rooms[roomIndex];
    const scaledTile = TILE_SIZE * SCALE;

    // Prefer wall-adjacent tiles
    const candidates = this.getWallAdjacentTiles(room);
    const pick = candidates.length > 0
      ? candidates[Math.floor(Math.random() * candidates.length)]
      : null;

    // Fallback to any free floor tile
    let tx: number, ty: number;
    if (pick) {
      tx = pick.tx;
      ty = pick.ty;
    } else {
      for (let attempt = 0; attempt < 20; attempt++) {
        const cx = Phaser.Math.Between(room.x + 1, room.x + room.width - 2);
        const cy = Phaser.Math.Between(room.y + 1, room.y + room.height - 2);
        if (this.dungeon[cy][cx] !== 0) continue;
        const k = `${cx},${cy}`;
        if (this.chestSprites.has(k) || this.doorSprites.has(k)) continue;
        tx = cx;
        ty = cy;
        break;
      }
      if (tx! === undefined) return;
    }

    const key = `${tx!},${ty!}`;
    const data: ChestData = {
      x: tx!, y: ty!, opened: false,
      gold: Phaser.Math.Between(CHEST_GOLD.min, CHEST_GOLD.max),
      items: [{ itemId, quantity: 1 }],
      questItemId: itemId
    };
    this.chestData.set(key, data);

    const worldX = tx! * scaledTile + scaledTile / 2;
    const worldY = ty! * scaledTile + scaledTile / 2;
    const chest = this.physics.add.staticImage(worldX, worldY, 'chest_closed');
    chest.setDepth(1);
    chest.refreshBody();
    this.chests.add(chest);
    this.chestSprites.set(key, chest);
  }

  /**
   * Spawn guaranteed monsters and chests for a newly accepted quest.
   * Ensures kill targets and collect items exist in the dungeon immediately.
   * Boss-only kill targets are placed in the boss room as the arc boss.
   */
  private spawnQuestTargets(questId: string): void {
    const def = this.questSystem.getQuestDefinition(questId);
    const state = this.questSystem.getQuestState(questId);
    if (!def || !state) return;

    // Determine target room (assigned by acceptQuest) or pick a random non-safe room
    let targetRoom: DungeonRoom | null = null;
    if (state.targetRoom) {
      targetRoom = this.rooms.find(r =>
        r.x === state.targetRoom!.x && r.y === state.targetRoom!.y
      ) || null;
    }
    if (!targetRoom && this.rooms.length > 1) {
      const nonSafeRooms = this.rooms.slice(1);
      targetRoom = nonSafeRooms[Math.floor(Math.random() * nonSafeRooms.length)];
    }
    if (!targetRoom) return;

    const bossRoom = this.rooms[this.rooms.length - 1];

    for (const obj of def.objectives) {
      if (obj.type === 'kill') {
        // Spawn required number of target monsters
        const monsterKey = `monster_${obj.target}`;
        const monsterData = MONSTERS[monsterKey];
        if (!monsterData) continue;

        // Boss-only monsters go in the boss room as the arc boss
        const isBossTarget = monsterData.bossOnly === true;
        const spawnRoom = isBossTarget && bossRoom ? bossRoom : targetRoom;

        if (isBossTarget && bossRoom) {
          // Override quest target room to boss room for map indicator
          state.targetRoom = { x: bossRoom.x, y: bossRoom.y, width: bossRoom.width, height: bossRoom.height };
          this.questSystem.getQuestState(questId)!.targetRoom = state.targetRoom;
        }

        for (let i = 0; i < obj.requiredCount; i++) {
          const spawnX = Phaser.Math.Between(spawnRoom.x + 1, spawnRoom.x + spawnRoom.width - 2) * TILE_SIZE * SCALE;
          const spawnY = Phaser.Math.Between(spawnRoom.y + 1, spawnRoom.y + spawnRoom.height - 2) * TILE_SIZE * SCALE;
          const scaledData = this.scaleMonsterForFloor(monsterData);
          const monster = new Monster(this, spawnX, spawnY, scaledData);
          monster.setTarget(this.player);
          monster.setFogSystem(this.fogSystem);
          this.monsters.add(monster);
        }
      } else if (obj.type === 'collect') {
        // Spawn chests containing the required items in the target room
        const roomIndex = this.rooms.indexOf(targetRoom);
        for (let i = 0; i < obj.requiredCount; i++) {
          this.spawnQuestChest(roomIndex, obj.target);
        }
      }
    }
  }

  private respawnMonsters(): void {
    // Count living monsters
    const livingMonsters = this.monsters.getChildren().filter(m => m.active).length;
    if (livingMonsters >= this.maxMonsters) return;

    // Only respawn if below half the max
    if (livingMonsters >= this.maxMonsters / 2) return;

    // Pick a random non-safe room (skip room 0)
    if (this.rooms.length <= 1) return;

    // Build pool of non-boss monsters from allowed families
    const allowedFamilies = MONSTER_TIER_FAMILIES[this.currentTier];
    const nonBossPool = allowedFamilies.flatMap(f => getNonBossMonstersByFamily(f));
    if (nonBossPool.length === 0) return;
    const nonBossIds = nonBossPool.map(m => m.id);

    // Build quest-target monster types from active kill objectives
    const questTargetTypes: string[] = [];
    if (this.questSystem) {
      for (const { definition, state } of this.questSystem.getActiveQuests()) {
        if (state.status !== 'active') continue;
        for (let i = 0; i < definition.objectives.length; i++) {
          const obj = definition.objectives[i];
          const progress = state.objectiveProgress[i];
          if (obj.type === 'kill' && !progress?.completed) {
            const spriteKey = `monster_${obj.target}`;
            if (nonBossIds.includes(spriteKey)) {
              questTargetTypes.push(spriteKey);
            }
          }
        }
      }
    }

    // Try to find a room far enough from the player
    const candidateRooms = this.rooms.slice(1).filter(room => {
      const roomWorldX = room.centerX * TILE_SIZE * SCALE;
      const roomWorldY = room.centerY * TILE_SIZE * SCALE;
      const distToPlayer = Phaser.Math.Distance.Between(
        this.player.x, this.player.y, roomWorldX, roomWorldY
      );
      // Only spawn if player is at least 3 tiles away from room center
      return distToPlayer > TILE_SIZE * SCALE * 3;
    });

    if (candidateRooms.length === 0) return;

    const room = Phaser.Utils.Array.GetRandom(candidateRooms);
    const spawnCount = Phaser.Math.Between(1, 2);

    for (let i = 0; i < spawnCount && livingMonsters + i < this.maxMonsters; i++) {
      // 50% chance to bias toward a quest target type (if any active)
      let monsterData;
      if (questTargetTypes.length > 0 && Math.random() < 0.5) {
        const monsterType = Phaser.Utils.Array.GetRandom(questTargetTypes);
        monsterData = MONSTERS[monsterType];
      } else {
        monsterData = Phaser.Utils.Array.GetRandom(nonBossPool);
      }
      const spawnX = Phaser.Math.Between(room.x + 1, room.x + room.width - 2) * TILE_SIZE * SCALE;
      const spawnY = Phaser.Math.Between(room.y + 1, room.y + room.height - 2) * TILE_SIZE * SCALE;

      const scaledData = this.scaleMonsterForFloor(monsterData);
      const monster = new Monster(this, spawnX, spawnY, scaledData);
      monster.setTarget(this.player);
      monster.setFogSystem(this.fogSystem);
      this.monsters.add(monster);
    }
  }

  private setupEventListeners(): void {
    // Player attack (arc-based hitbox)
    const scaledTileForLOS = TILE_SIZE * SCALE;
    this.events.on('player-attack', (attackData: {
      originX: number; originY: number;
      direction: number; radius: number; arcWidth: number;
      damage: { damage: number; isCritical: boolean };
      knockback: number;
    }) => {
      this.monsters.getChildren().forEach((monster) => {
        const m = monster as Monster;
        if (!m.active) return;

        // Use actual monster display size for hit radius
        const targetRadius = Math.max(m.displayWidth, m.displayHeight) / 2;
        if (this.player.combat.isInAttackArc(
          attackData.originX, attackData.originY,
          m.x, m.y,
          attackData.direction, attackData.radius, attackData.arcWidth,
          targetRadius
        )) {
          // Block attacks through walls/doors
          if (!this.fogSystem.hasLineOfSightWorld(
            attackData.originX, attackData.originY, m.x, m.y, scaledTileForLOS
          )) return;

          m.takeDamage(attackData.damage.damage, attackData.damage.isCritical);
          m.applyKnockback(attackData.originX, attackData.originY, attackData.knockback);
          this.player.combat.createHitEffect(m.x, m.y);
        }
      });

      // Check spawner hits (melee)
      for (const [key, sprite] of this.spawnerSprites) {
        if (!sprite.active) continue;
        const dist = Phaser.Math.Distance.Between(attackData.originX, attackData.originY, sprite.x, sprite.y);
        if (dist <= attackData.radius + 12) {
          if (!this.fogSystem.hasLineOfSightWorld(
            attackData.originX, attackData.originY, sprite.x, sprite.y, scaledTileForLOS
          )) continue;
          this.damageSpawner(key, attackData.damage.damage);
          this.player.combat.createHitEffect(sprite.x, sprite.y);
        }
      }
    });

    // Player spell attack (projectile-based)
    this.events.on(EVENTS.PLAYER_SPELL, (data: {
      originX: number; originY: number;
      directionRad: number; range: number; speed: number;
      spellType: SpellType;
      damage: { damage: number; isCritical: boolean };
      aoe: number;
    }) => {
      this.createSpellProjectile(data);
    });

    // Monster attack
    this.events.on('monster-attack', (data: { monster: Monster; damage: number }) => {
      const distance = Phaser.Math.Distance.Between(
        data.monster.x, data.monster.y,
        this.player.x, this.player.y
      );

      if (distance <= data.monster.monsterData.attackRange + 10) {
        // Block attacks through walls/doors
        if (!this.fogSystem.hasLineOfSightWorld(
          data.monster.x, data.monster.y, this.player.x, this.player.y, scaledTileForLOS
        )) return;

        const result = this.player.combat.calculateMonsterDamage(
          data.damage,
          this.player.inventory.getTotalDefense()
        );
        this.player.takeDamage(result.damage);
      }
    });

    // Monster ranged attack — spawn projectile
    this.events.on('monster-ranged-attack', (data: {
      originX: number; originY: number; directionRad: number;
      speed: number; range: number; damage: number; style: MonsterProjectileStyle;
    }) => {
      this.createMonsterProjectile(data);
    });

    // Boss ability: slam (AOE damage around boss)
    this.events.on('boss-slam', (data: { x: number; y: number; radius: number; damage: number; monster: Monster }) => {
      this.handleBossSlam(data);
    });

    // Boss ability: summon minions
    this.events.on('boss-summon', (data: { x: number; y: number; summonType: string; count: number; monster: Monster }) => {
      this.handleBossSummon(data);
    });

    // Boss ability: charge (afterimage trail)
    this.events.on('boss-charge', (data: { monster: Monster }) => {
      this.createChargeAfterimage(data.monster);
    });

    // Boss ability: teleport (purple flash VFX)
    this.events.on('boss-teleport', (data: { oldX: number; oldY: number; newX: number; newY: number; monster: Monster }) => {
      this.createTeleportEffect(data.oldX, data.oldY, data.newX, data.newY);
    });

    // Track monster kills for room clearing + boss defeated + XP award + spawner tracking
    this.events.on(EVENTS.MONSTER_KILLED, (monsterData: MonsterData, worldX: number, worldY: number, monsterInstance?: Monster) => {
      this.onMonsterKilled(worldX, worldY);
      if (monsterData?.xpReward) {
        this.player.addXP(monsterData.xpReward);
      }
      if (monsterData?.bossOnly) {
        this.events.emit(EVENTS.BOSS_DEFEATED);
      }
      // Track spawner monster deaths
      if (monsterInstance) {
        const spawnerKey = this.spawnerMonsterMap.get(monsterInstance);
        if (spawnerKey) {
          const sd = this.spawnerData.get(spawnerKey);
          if (sd) sd.livingCount--;
          this.spawnerMonsterMap.delete(monsterInstance);
        }
      }
    });

    // Loot dropped (luck bonus on gold)
    this.events.on('loot-dropped', (data: { x: number; y: number; gold: number; items: string[] }) => {
      const luckBonus = 1 + (this.player.stats.luck - 1) * 0.02;
      const adjustedGold = Math.floor(data.gold * luckBonus);
      this.player.addGold(adjustedGold);

      // Show gold pickup text
      const goldText = this.add.text(data.x, data.y, `+${adjustedGold} gold`, {
        fontSize: '12px',
        fontFamily: 'monospace',
        color: '#ffd700',
        stroke: '#000000',
        strokeThickness: 2
      }).setOrigin(0.5).setDepth(1000);

      this.tweens.add({
        targets: goldText,
        y: data.y - 30,
        alpha: 0,
        duration: 1000,
        onComplete: () => goldText.destroy()
      });

      // Add items to inventory
      data.items.forEach(itemId => {
        const added = this.player.inventory.addItem(itemId);
        if (added) {
          this.events.emit(EVENTS.ITEM_PICKED_UP, itemId);
        }
      });
    });

    // Player interact
    this.events.on('player-interact', () => {
      const interactPoint = this.player.getInteractionPoint();

      // Check NPC interaction
      this.npcs.getChildren().forEach((npc) => {
        const n = npc as NPC;
        if (n.isInRange(interactPoint.x, interactPoint.y)) {
          n.interact();
        }
      });

      // Check door interaction (skip already-opened doors)
      for (const [key, door] of this.doorSprites) {
        const doorBody = door.body as Phaser.Physics.Arcade.StaticBody;
        if (!doorBody.enable) continue;
        const dist = Phaser.Math.Distance.Between(interactPoint.x, interactPoint.y, door.x, door.y);
        if (dist <= INTERACTION_DISTANCE) {
          const [tx, ty] = key.split(',').map(Number);
          this.openDoor(tx, ty);
          break;
        }
      }

      // Check chest interaction
      for (const [key, chest] of this.chestSprites) {
        const data = this.chestData.get(key);
        if (!data || data.opened) continue;
        const dist = Phaser.Math.Distance.Between(interactPoint.x, interactPoint.y, chest.x, chest.y);
        if (dist <= INTERACTION_DISTANCE) {
          this.openChest(key);
          break;
        }
      }

      // Check stairs interaction
      if (this.stairsSprite) {
        const dist = Phaser.Math.Distance.Between(interactPoint.x, interactPoint.y, this.stairsSprite.x, this.stairsSprite.y);
        if (dist <= INTERACTION_DISTANCE) {
          this.transitionToNextFloor();
        }
      }
    });

    // Open inventory
    this.events.on(EVENTS.OPEN_INVENTORY, () => {
      this.pauseGame();
      this.scene.launch(SCENE_KEYS.INVENTORY, {
        inventory: this.player.inventory,
        player: this.player
      });
    });

    // Close inventory
    this.events.on(EVENTS.CLOSE_INVENTORY, () => {
      this.resumeGame();
    });

    // Open NPC interaction menu
    this.events.on(EVENTS.OPEN_NPC_INTERACTION, (npcData: NPCData) => {
      this.pauseGame();
      this.scene.launch(SCENE_KEYS.NPC_INTERACTION, {
        npcData,
        questSystem: this.questSystem
      });
    });

    // Close NPC interaction menu
    this.events.on(EVENTS.CLOSE_NPC_INTERACTION, () => {
      this.resumeGame();
    });

    // Open shop (can come from NPC interaction menu)
    this.events.on(EVENTS.OPEN_SHOP, (npcData: NPCData, mode: 'buy' | 'sell') => {
      this.pauseGame();
      this.scene.launch(SCENE_KEYS.SHOP, {
        npcData,
        inventory: this.player.inventory,
        playerGold: { current: this.player.gold },
        player: this.player,
        mode: mode || 'buy'
      });
    });

    // Close shop
    this.events.on(EVENTS.CLOSE_SHOP, () => {
      this.resumeGame();
    });

    // Open quest dialog
    this.events.on(EVENTS.OPEN_QUEST_DIALOG, (data: { npcData: NPCData; questId: string }) => {
      this.pauseGame();
      this.scene.launch(SCENE_KEYS.QUEST_DIALOG, {
        npcData: data.npcData,
        questId: data.questId,
        questSystem: this.questSystem,
        player: this.player,
        rooms: this.rooms
      });
    });

    // Close quest dialog
    this.events.on(EVENTS.CLOSE_QUEST_DIALOG, () => {
      this.resumeGame();
    });

    // Rotate shop inventory when a quest is turned in
    this.events.on(EVENTS.QUEST_TURNED_IN, () => {
      // Rotate items for all NPCs
      for (const npcGO of this.npcs.getChildren()) {
        const npc = npcGO as NPC;
        rotateShopSubset(npc.npcData.id);
      }
    });

    // Open map
    this.events.on(EVENTS.OPEN_MAP, () => {
      this.pauseGame();
      this.scene.launch(SCENE_KEYS.MAP, {
        dungeon: this.dungeon,
        rooms: this.rooms,
        fogSystem: this.fogSystem,
        playerX: this.player.x,
        playerY: this.player.y,
        currentFloor: this.currentFloor,
        npcs: this.npcs.getChildren().map((n: Phaser.GameObjects.GameObject) => {
          const npc = n as NPC;
          return { x: npc.x, y: npc.y, name: npc.npcData.name };
        }),
        monsters: this.monsters.getChildren().map((m: Phaser.GameObjects.GameObject) => {
          const monster = m as Monster;
          return { x: monster.x, y: monster.y, active: monster.active };
        }),
        questSystem: this.questSystem
      });
    });

    // Close map
    this.events.on(EVENTS.CLOSE_MAP, () => {
      this.resumeGame();
    });

    // Open quest log
    this.events.on(EVENTS.OPEN_QUEST_LOG, () => {
      this.pauseGame();
      this.scene.launch(SCENE_KEYS.QUEST_LOG, {
        questSystem: this.questSystem
      });
    });

    // Close quest log
    this.events.on(EVENTS.CLOSE_QUEST_LOG, () => {
      this.resumeGame();
    });

    // Arc next quest NPC indicator
    this.events.on(EVENTS.ARC_NEXT_QUEST_NPC, (npcId: string) => {
      this.arcNextQuestNpcId = npcId;
    });

    // Clear arc indicator and spawn quest targets when any quest is accepted
    this.events.on(EVENTS.QUEST_ACCEPTED, (questId: string) => {
      this.arcNextQuestNpcId = null;
      this.spawnQuestTargets(questId);

      // Lore narration on first arc quest accept
      getArcStatus().then(raw => {
        if (!raw || typeof raw !== 'object') return;
        const info = raw as StoryArcInfo;
        if (info.currentQuestIndex === 0 && info.lore) {
          const lore = info.lore;
          const lines: string[] = [];
          if (lore.faction) {
            lines.push(`Whispers tell of the ${lore.faction.name} — ${lore.faction.description}`);
          }
          if (lore.artifact) {
            lines.push(`Legends speak of the ${lore.artifact.name} — ${lore.artifact.description}`);
          }
          if (lore.history) {
            lines.push(lore.history);
          }
          if (lines.length > 0) {
            this.launchNarrator(lines, 'lore');
          }
        }
      }).catch(() => {});
    });

    // Quick save (F5)
    this.input.keyboard?.on('keydown-F5', () => {
      this.saveCurrentGame();
    });

    // Narrator: quest objectives completed
    this.events.on(EVENTS.QUEST_READY_TO_TURN_IN, (questId: string) => {
      const def = this.questSystem.getQuestDefinition(questId);
      const lines = def?.narration?.onComplete;
      if (lines?.length) {
        this.launchNarrator(lines, 'narrator');
      }
    });

    // Narrator: boss room entered
    this.events.on(EVENTS.BOSS_ROOM_ENTERED, () => {
      const lines = this.findActiveNarrationLines('onBossEncounter');
      if (lines) this.launchNarrator(lines, 'boss');
    });

    // Narrator: boss defeated + stairs spawning
    this.events.on(EVENTS.BOSS_DEFEATED, () => {
      const lines = this.findActiveNarrationLines('onBossDefeat');
      if (lines) this.launchNarrator(lines, 'boss');

      // Spawn stairs to next floor
      if (this.currentFloor < TOTAL_FLOORS) {
        this.time.delayedCall(1500, () => {
          this.spawnStairs();
        });
      }
    });

    // Narrator closed
    this.events.on(EVENTS.CLOSE_NARRATOR, () => {
      this.narratorActive = false;
      this.resumeGame();
    });

    // Level up VFX + auto-open stat allocation
    this.events.on(EVENTS.LEVEL_UP, (_newLevel: number) => {
      // Golden flash
      this.cameras.main.flash(300, 255, 215, 0, false);

      // Floating "LEVEL UP!" text
      const text = this.add.text(this.player.x, this.player.y - 40, 'LEVEL UP!', {
        fontSize: '20px',
        fontFamily: 'monospace',
        color: '#ffd700',
        stroke: '#000000',
        strokeThickness: 4
      }).setOrigin(0.5).setDepth(1001);

      this.tweens.add({
        targets: text,
        y: this.player.y - 80,
        alpha: 0,
        scale: 1.5,
        duration: 1500,
        ease: 'Power2',
        onComplete: () => text.destroy()
      });

      // Auto-open level up scene after a short delay
      this.time.delayedCall(500, () => {
        if (!this.isPaused) {
          this.openLevelUpScene();
        }
      });
    });

    // Open/close level up scene
    this.events.on(EVENTS.OPEN_LEVEL_UP, () => {
      if (!this.isPaused) {
        this.openLevelUpScene();
      }
    });

    this.events.on(EVENTS.CLOSE_LEVEL_UP, () => {
      this.resumeGame();
    });

    // Debug terminal (no pause, but disable game keyboard so typing doesn't trigger shortcuts)
    this.events.on(EVENTS.OPEN_TERMINAL, () => {
      if (!this.scene.isActive(SCENE_KEYS.TERMINAL)) {
        this.scene.launch(SCENE_KEYS.TERMINAL, { player: this.player, rooms: this.rooms });
        if (this.input.keyboard) this.input.keyboard.enabled = false;
      }
    });

    this.events.on(EVENTS.CLOSE_TERMINAL, () => {
      this.scene.stop(SCENE_KEYS.TERMINAL);
      if (this.input.keyboard) this.input.keyboard.enabled = true;
    });

    // Debug: spawn monster in player's current room
    this.events.on('debug-spawn-monster', (data: { monsterData: MonsterData; count: number }) => {
      const scaledTile = TILE_SIZE * SCALE;
      const pTileX = Math.floor(this.player.x / scaledTile);
      const pTileY = Math.floor(this.player.y / scaledTile);

      // Find the room the player is in
      const room = this.rooms.find(r =>
        pTileX >= r.x && pTileX < r.x + r.width &&
        pTileY >= r.y && pTileY < r.y + r.height
      );

      for (let i = 0; i < data.count; i++) {
        let spawnX: number, spawnY: number;
        if (room) {
          // Pick a random floor tile inside the room
          let attempts = 0;
          let tx: number, ty: number;
          do {
            tx = Phaser.Math.Between(room.x + 1, room.x + room.width - 2);
            ty = Phaser.Math.Between(room.y + 1, room.y + room.height - 2);
            attempts++;
          } while (this.dungeon[ty]?.[tx] !== 0 && attempts < 20);
          spawnX = tx * scaledTile + scaledTile / 2;
          spawnY = ty * scaledTile + scaledTile / 2;
        } else {
          // Fallback: spawn near player
          spawnX = this.player.x + 40 + (Math.random() - 0.5) * 40;
          spawnY = this.player.y + 40 + (Math.random() - 0.5) * 40;
        }

        const scaledData = this.scaleMonsterForFloor(data.monsterData);
        const monster = new Monster(this, spawnX, spawnY, scaledData);
        monster.setTarget(this.player);
        monster.setFogSystem(this.fogSystem);
        this.monsters.add(monster);
      }
    });

    // Debug: reveal entire map
    this.events.on('debug-reveal-map', () => {
      this.fogSystem.revealAll();
      this.updateFogRendering();
    });

    // Debug: spawn stairs and teleport player to them
    this.events.on('debug-descend', () => {
      if (!this.stairsSprite) {
        this.spawnStairs();
      }
      if (this.stairsSprite) {
        this.player.setPosition(this.stairsSprite.x, this.stairsSprite.y - 20);
      }
    });

    // Player died
    this.events.on('player-died', () => {
      this.cameras.main.fade(1000, 0, 0, 0);
      this.time.delayedCall(1500, () => {
        this.scene.stop(SCENE_KEYS.UI);
        this.scene.start(SCENE_KEYS.MENU);
      });
    });
  }

  private updateNPCIndicators(): void {
    this.npcs.getChildren().forEach((npc) => {
      const n = npc as NPC;
      let status = this.questSystem.getNPCQuestStatus(n.npcData.id);
      // Show "!" for NPC with pending arc quest (not yet registered locally)
      if (!status && this.arcNextQuestNpcId === n.npcData.id) {
        status = 'available';
      }
      if (status === 'turn_in') {
        n.showQuestIndicator('turn_in');
      } else if (status === 'available') {
        n.showQuestIndicator('available');
      } else {
        n.hideQuestIndicator();
      }
    });
  }

  private pollArcStatus(): void {
    getArcStatus().then(raw => {
      if (!raw || typeof raw !== 'object') return;
      const info = raw as StoryArcInfo & { tier?: number };
      if (info.status === 'active' && info.nextQuestReady && info.nextQuestNpcId) {
        // Only set if no quest is locally registered for this NPC yet
        if (!this.questSystem.hasAnyQuest(info.nextQuestNpcId)) {
          this.arcNextQuestNpcId = info.nextQuestNpcId;
        }
      }
      // Update tier from server
      if (info.tier && info.tier >= 1 && info.tier <= 3) {
        this.currentTier = info.tier as MonsterTier;
      }
    }).catch(() => {});
  }

  private launchNarrator(lines: string[], style: NarratorStyle): void {
    if (this.isPaused || this.narratorActive) return;
    this.narratorActive = true;
    this.pauseGame();
    this.scene.launch(SCENE_KEYS.NARRATOR, { lines, style });
  }

  private findActiveNarrationLines(field: 'onBossEncounter' | 'onBossDefeat'): string[] | null {
    for (const { definition } of this.questSystem.getActiveQuests()) {
      const lines = definition.narration?.[field];
      if (lines?.length) return lines;
    }
    return null;
  }

  getDungeon(): number[][] { return this.dungeon; }
  getRooms(): DungeonRoom[] { return this.rooms; }
  getPlayer(): Player { return this.player; }
  getNPCs(): Phaser.GameObjects.Group { return this.npcs; }
  getMonsters(): Phaser.GameObjects.Group { return this.monsters; }
  getCurrentFloor(): number { return this.currentFloor; }

  private scaleMonsterForFloor(data: MonsterData): MonsterData {
    const scaling = FLOOR_SCALING[this.currentFloor] || FLOOR_SCALING[1];
    if (scaling.hp === 1.0 && scaling.damage === 1.0) return data;
    return {
      ...data,
      health: Math.round(data.health * scaling.hp),
      damage: Math.round(data.damage * scaling.damage),
      xpReward: Math.round(data.xpReward * scaling.hp),
      goldDrop: {
        min: Math.round(data.goldDrop.min * scaling.hp),
        max: Math.round(data.goldDrop.max * scaling.hp)
      }
    };
  }

  private spawnStairs(): void {
    const bossRoom = this.rooms[this.rooms.length - 1];
    if (!bossRoom) return;

    const scaledTile = TILE_SIZE * SCALE;
    const stairsX = bossRoom.centerX * scaledTile;
    const stairsY = bossRoom.centerY * scaledTile;

    // Glowing ground circle beneath stairs
    const glow = this.add.graphics();
    glow.setDepth(1);
    glow.fillStyle(0x4488ff, 0.3);
    glow.fillCircle(stairsX, stairsY, 24);
    glow.lineStyle(2, 0x88bbff, 0.6);
    glow.strokeCircle(stairsX, stairsY, 24);
    this.tweens.add({
      targets: glow,
      alpha: 0.4,
      duration: 1000,
      yoyo: true,
      repeat: -1
    });

    this.stairsSprite = this.add.image(stairsX, stairsY, 'stairs_down');
    this.stairsSprite.setScale(SCALE);
    this.stairsSprite.setDepth(2);

    // Pulsing glow effect on stairs sprite
    this.tweens.add({
      targets: this.stairsSprite,
      alpha: 0.6,
      duration: 800,
      yoyo: true,
      repeat: -1
    });

    // Floating label above stairs
    const label = this.add.text(stairsX, stairsY - 24, `Floor ${this.currentFloor + 1}`, {
      fontSize: '10px',
      fontFamily: 'monospace',
      color: '#88bbff',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5).setDepth(3);
    this.tweens.add({
      targets: label,
      y: stairsY - 28,
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    this.showNotification('Stairs have appeared! Press E to descend.');
  }

  transitionToNextFloor(targetFloor?: number): void {
    if (this.transitioning) return;
    this.transitioning = true;
    const floor = targetFloor || this.currentFloor + 1;

    // Capture all player state
    const inventoryState = this.player.inventory.exportState();
    const questData = this.questSystem.exportState();

    const transitionData: FloorTransitionData = {
      targetFloor: floor,
      playerState: {
        health: this.player.health,
        maxHealth: this.player.maxHealth,
        mana: this.player.mana,
        maxMana: this.player.maxMana,
        gold: this.player.gold,
        level: this.player.level,
        xp: this.player.xp,
        stats: { ...this.player.stats },
        statPoints: this.player.statPoints
      },
      inventoryState,
      questData,
      currentTier: this.currentTier as 1 | 2 | 3
    };

    console.log('[GameScene] transitionToNextFloor: floor', floor, 'health:', transitionData.playerState.health, 'gold:', transitionData.playerState.gold);

    // Stop all overlay scenes that might be running
    const overlays = [SCENE_KEYS.UI, SCENE_KEYS.INVENTORY, SCENE_KEYS.QUEST_LOG, SCENE_KEYS.MAP, SCENE_KEYS.LEVEL_UP, SCENE_KEYS.TERMINAL];
    for (const key of overlays) {
      if (this.scene.isActive(key)) {
        console.log('[GameScene] stopping overlay:', key);
        this.scene.stop(key);
      }
    }

    console.log('[GameScene] calling scene.restart()');
    this.scene.restart({ floorTransition: transitionData });
  }

  private openDoor(tileX: number, tileY: number): void {
    const key = `${tileX},${tileY}`;
    const door = this.doorSprites.get(key);
    if (!door) return;

    // Skip already-opened doors
    const body = door.body as Phaser.Physics.Arcade.StaticBody;
    if (!body.enable) return;

    // Check for locked door (tile 4)
    if (this.dungeon[tileY][tileX] === 4) {
      this.showNotification('This door is sealed. Clear more rooms to unlock it.');
      return;
    }

    // Update dungeon grid
    this.dungeon[tileY][tileX] = 3; // 3 = open door

    // Swap to open sprite and disable physics (keep visible)
    door.setTexture('door_open');
    door.clearTint();
    body.enable = false;

    // Force fog of war recalculation to reveal behind the door
    this.fogSystem.forceRecalculate();
    const scaledTile = TILE_SIZE * SCALE;
    const playerTileX = Math.floor(this.player.x / scaledTile);
    const playerTileY = Math.floor(this.player.y / scaledTile);
    this.fogSystem.update(playerTileX, playerTileY);
    this.updateFogRendering();
  }

  private showNotification(message: string): void {
    const text = this.add.text(this.cameras.main.scrollX + 400, this.cameras.main.scrollY + 80, message, {
      fontSize: '13px',
      fontFamily: 'monospace',
      color: '#ff8888',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5).setDepth(1000);

    this.tweens.add({
      targets: text,
      alpha: 0,
      y: text.y - 20,
      duration: 2500,
      onComplete: () => text.destroy()
    });
  }

  private unlockBossDoors(): void {
    if (this.bossUnlocked) return;
    this.bossUnlocked = true;

    // Convert all tile-4 (locked) doors to tile-2 (closed) and clear red tint
    for (let y = 0; y < DUNGEON_HEIGHT; y++) {
      for (let x = 0; x < DUNGEON_WIDTH; x++) {
        if (this.dungeon[y][x] === 4) {
          this.dungeon[y][x] = 2;
          const door = this.doorSprites.get(`${x},${y}`);
          if (door) {
            door.clearTint();
          }
        }
      }
    }

    // Check if an arc boss quest is active for a more thematic message
    const arcBossName = this.getArcBossName();
    if (arcBossName) {
      this.showNotification(`The sealed doors have been unlocked! ${arcBossName} awaits...`);
    } else {
      this.showNotification('The sealed doors have been unlocked!');
    }
  }

  /** Returns the name of the arc boss monster if an active quest targets a bossOnly monster. */
  private getArcBossName(): string | null {
    for (const { definition, state } of this.questSystem.getActiveQuests()) {
      if (state.status !== 'active') continue;
      for (const obj of definition.objectives) {
        if (obj.type !== 'kill') continue;
        const monsterData = MONSTERS[`monster_${obj.target}`];
        if (monsterData?.bossOnly) return monsterData.name;
      }
    }
    return null;
  }

  /** Find which room a world-space position is in, returns room index or -1 */
  private findRoomAtWorldPos(worldX: number, worldY: number): number {
    const scaledTile = TILE_SIZE * SCALE;
    const tileX = Math.floor(worldX / scaledTile);
    const tileY = Math.floor(worldY / scaledTile);

    for (let i = 0; i < this.rooms.length; i++) {
      const r = this.rooms[i];
      if (tileX >= r.x && tileX < r.x + r.width &&
          tileY >= r.y && tileY < r.y + r.height) {
        return i;
      }
    }
    return -1;
  }

  private onMonsterKilled(worldX: number, worldY: number): void {
    const roomIdx = this.findRoomAtWorldPos(worldX, worldY);
    if (roomIdx < 0) return;

    const state = this.roomClearState.get(roomIdx);
    if (!state) return;

    state.killed++;
    if (state.killed >= state.total) {
      this.rooms[roomIdx].isCleared = true;

      // Count cleared challenge rooms
      const clearedCount = this.rooms.filter(r =>
        r.roomType === 'challenge' && r.isCleared
      ).length;

      if (clearedCount >= ROOMS_TO_CLEAR_FOR_BOSS && !this.bossUnlocked) {
        this.unlockBossDoors();
      }
    }
  }

  private openLevelUpScene(): void {
    this.pauseGame();
    this.scene.launch(SCENE_KEYS.LEVEL_UP, { player: this.player });
  }

  serializeGameState(): SaveGamePayload {
    return {
      playerName: 'Hero',
      playerState: {
        health: this.player.health,
        maxHealth: this.player.maxHealth,
        mana: this.player.mana,
        maxMana: this.player.maxMana,
        gold: this.player.gold,
        position: { x: this.player.x, y: this.player.y },
        level: this.player.level,
        xp: this.player.xp,
        stats: { ...this.player.stats },
        statPoints: this.player.statPoints
      },
      inventoryState: this.player.inventory.getAllItems(),
      equipmentState: this.player.inventory.getEquipment(),
      dungeonLayout: this.dungeon,
      rooms: this.rooms,
      questStates: this.questSystem.getActiveQuests().map(q => q.state),
      fogState: this.fogSystem.getVisibilityGrid()
    };
  }

  async saveCurrentGame(): Promise<void> {
    try {
      const data = this.serializeGameState();
      const result = await saveGame(data);
      this.currentSaveId = result.id;
      this.showSaveNotification('Game saved!');
    } catch {
      this.showSaveNotification('Save failed - is server running?');
    }
  }

  private showSaveNotification(message: string): void {
    const text = this.add.text(this.cameras.main.scrollX + 400, this.cameras.main.scrollY + 50, message, {
      fontSize: '14px',
      fontFamily: 'monospace',
      color: message.includes('failed') ? '#ff6666' : '#88ff88',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5).setDepth(1000);

    this.tweens.add({
      targets: text,
      alpha: 0,
      y: text.y - 20,
      duration: 2000,
      onComplete: () => text.destroy()
    });
  }

  private createFogTiles(): void {
    const scaledTile = TILE_SIZE * SCALE;
    this.fogTiles = [];
    for (let y = 0; y < DUNGEON_HEIGHT; y++) {
      this.fogTiles[y] = [];
      for (let x = 0; x < DUNGEON_WIDTH; x++) {
        const rect = this.add.rectangle(
          x * scaledTile, y * scaledTile,
          scaledTile, scaledTile,
          0x000000, 1.0
        );
        rect.setOrigin(0);
        rect.setDepth(50);
        this.fogTiles[y][x] = rect;
      }
    }
  }

  private updateFogRendering(): void {
    for (let y = 0; y < DUNGEON_HEIGHT; y++) {
      for (let x = 0; x < DUNGEON_WIDTH; x++) {
        const visibility = this.fogSystem.getVisibility(x, y);
        const rect = this.fogTiles[y][x];
        switch (visibility) {
          case 'hidden':
            rect.setAlpha(1.0);
            break;
          case 'explored':
            rect.setAlpha(0.65);
            break;
          case 'visible':
            rect.setAlpha(0);
            break;
        }
      }
    }
  }

  private pauseGame(): void {
    this.isPaused = true;
    this.physics.pause();
  }

  private resumeGame(): void {
    this.isPaused = false;
    this.physics.resume();
  }

  update(time: number): void {
    if (this.isPaused) return;

    this.player.update(time);

    // Update fog of war
    const scaledTile = TILE_SIZE * SCALE;
    const playerTileX = Math.floor(this.player.x / scaledTile);
    const playerTileY = Math.floor(this.player.y / scaledTile);
    if (this.fogSystem.update(playerTileX, playerTileY)) {
      this.updateFogRendering();
    }

    // Update monsters
    this.monsters.getChildren().forEach((monster) => {
      (monster as Monster).update(time);
    });

    // Update spell projectiles
    this.updateSpellProjectiles();
    this.updateMonsterProjectiles();

    // Update spawners
    this.updateSpawners(time);

    // Update NPC quest indicators (throttled to every 500ms)
    if (time - this.lastIndicatorUpdate > 500) {
      this.lastIndicatorUpdate = time;
      this.updateNPCIndicators();
    }

    // Boss room detection
    if (!this.bossRoomEntered) {
      const bossRoom = this.rooms[this.rooms.length - 1];
      if (bossRoom && (bossRoom.isBossRoom || bossRoom.roomType === 'boss')) {
        const pTileX = Math.floor(this.player.x / scaledTile);
        const pTileY = Math.floor(this.player.y / scaledTile);
        if (pTileX >= bossRoom.x && pTileX < bossRoom.x + bossRoom.width &&
            pTileY >= bossRoom.y && pTileY < bossRoom.y + bossRoom.height) {
          this.bossRoomEntered = true;
          this.events.emit(EVENTS.BOSS_ROOM_ENTERED);
        }
      }
    }

    // Poll arc status to discover when quests become ready (every 5s, only when no indicator is showing)
    if (!this.arcNextQuestNpcId && time - this.lastArcPoll > 5000) {
      this.lastArcPoll = time;
      this.pollArcStatus();
    }

    // Update NPCs and check for interaction prompts
    this.npcs.getChildren().forEach((npc) => {
      const n = npc as NPC;
      n.update();

      const distance = Phaser.Math.Distance.Between(
        this.player.x, this.player.y,
        n.x, n.y
      );

      if (distance <= INTERACTION_DISTANCE) {
        n.showInteractionPrompt();
      } else {
        n.hideInteractionPrompt();
      }
    });
  }

  // --- Spell Projectile System ---

  private createSpellProjectile(data: {
    originX: number; originY: number;
    directionRad: number; range: number; speed: number;
    spellType: SpellType;
    damage: { damage: number; isCritical: boolean };
    aoe: number;
  }): void {
    const colors = SPELL_COLORS[data.spellType];
    const graphics = this.add.graphics();
    graphics.setDepth(15);

    // Draw initial projectile
    this.drawProjectileGraphics(graphics, 0, 0, colors, data.spellType, data.directionRad);

    const vx = Math.cos(data.directionRad) * data.speed;
    const vy = Math.sin(data.directionRad) * data.speed;

    // Trail particle timer
    const trailTimer = this.time.addEvent({
      delay: 50,
      loop: true,
      callback: () => {
        const proj = this.spellProjectiles.find(p => p.trailTimer === trailTimer);
        const px = proj ? proj.x : data.originX;
        const py = proj ? proj.y : data.originY;

        if (data.spellType === 'lightning') {
          // Spark trail — tiny bright white flashes that scatter sideways
          const spark = this.add.graphics();
          spark.setDepth(14);
          const sparkX = px + (Math.random() - 0.5) * 8;
          const sparkY = py + (Math.random() - 0.5) * 8;
          spark.lineStyle(1, 0xffffff, 0.9);
          spark.beginPath();
          spark.moveTo(sparkX, sparkY);
          spark.lineTo(sparkX + (Math.random() - 0.5) * 6, sparkY + (Math.random() - 0.5) * 6);
          spark.strokePath();
          this.tweens.add({
            targets: spark,
            alpha: 0,
            duration: 120,
            onComplete: () => spark.destroy()
          });
        } else if (data.spellType === 'frost') {
          // Snowflake/ice particle trail
          const flake = this.add.graphics();
          flake.setDepth(14);
          const fx = px + (Math.random() - 0.5) * 10;
          const fy = py + (Math.random() - 0.5) * 10;
          const size = 1 + Math.random() * 2;
          const color = Math.random() > 0.5 ? 0x88ddff : 0xffffff;
          flake.fillStyle(color, 0.7);
          flake.fillCircle(fx, fy, size);
          // Small cross for snowflake look
          flake.lineStyle(1, 0xffffff, 0.5);
          flake.beginPath();
          flake.moveTo(fx - 2, fy);
          flake.lineTo(fx + 2, fy);
          flake.moveTo(fx, fy - 2);
          flake.lineTo(fx, fy + 2);
          flake.strokePath();
          this.tweens.add({
            targets: flake,
            alpha: 0,
            duration: 250,
            onComplete: () => flake.destroy()
          });
        } else {
          // Fireball: ember trail
          const trail = this.add.circle(px, py, 3, colors.trail, 0.6);
          trail.setDepth(14);
          this.tweens.add({
            targets: trail,
            alpha: 0,
            scale: 0,
            duration: 200,
            onComplete: () => trail.destroy()
          });
        }
      }
    });

    this.spellProjectiles.push({
      graphics,
      x: data.originX,
      y: data.originY,
      vx,
      vy,
      directionRad: data.directionRad,
      originX: data.originX,
      originY: data.originY,
      range: data.range,
      spellType: data.spellType,
      damage: data.damage,
      aoe: data.aoe,
      trailTimer
    });
  }

  private drawProjectileGraphics(graphics: Phaser.GameObjects.Graphics, x: number, y: number, colors: { primary: number; secondary: number; trail: number }, spellType: SpellType, dirRad?: number): void {
    graphics.clear();
    if (spellType === 'fireball') {
      // Outer glow
      graphics.fillStyle(colors.trail, 0.3);
      graphics.fillCircle(x, y, 10);
      // Core
      graphics.fillStyle(colors.primary, 0.9);
      graphics.fillCircle(x, y, 6);
      // Hot center
      graphics.fillStyle(colors.secondary, 1);
      graphics.fillCircle(x, y, 3);
    } else if (spellType === 'frost') {
      // Crystalline ice shard
      const angle = dirRad ?? 0;
      const dirX = Math.cos(angle);
      const dirY = Math.sin(angle);
      const perpX = -Math.sin(angle);
      const perpY = Math.cos(angle);

      // Outer frost glow
      graphics.fillStyle(colors.trail, 0.25);
      graphics.fillCircle(x, y, 9);

      // Diamond/shard shape along travel direction
      graphics.fillStyle(colors.primary, 0.9);
      graphics.beginPath();
      graphics.moveTo(x + dirX * 8, y + dirY * 8);           // tip
      graphics.lineTo(x + perpX * 4, y + perpY * 4);          // left
      graphics.lineTo(x - dirX * 6, y - dirY * 6);            // tail
      graphics.lineTo(x - perpX * 4, y - perpY * 4);          // right
      graphics.closePath();
      graphics.fillPath();

      // Bright core line
      graphics.lineStyle(2, colors.secondary, 0.9);
      graphics.beginPath();
      graphics.moveTo(x - dirX * 4, y - dirY * 4);
      graphics.lineTo(x + dirX * 6, y + dirY * 6);
      graphics.strokePath();

      // Shimmer sparkle at tip
      graphics.fillStyle(colors.secondary, 0.8 + Math.random() * 0.2);
      graphics.fillCircle(x + dirX * 6, y + dirY * 6, 2);
    } else {
      // Lightning bolt — jagged zigzag line along travel direction
      const angle = dirRad ?? 0;
      const boltLength = 24;
      const halfLen = boltLength / 2;
      // Perpendicular direction for zigzag offsets
      const perpX = -Math.sin(angle);
      const perpY = Math.cos(angle);
      const dirX = Math.cos(angle);
      const dirY = Math.sin(angle);

      // Generate jagged bolt points (re-randomized each frame for crackle)
      const segments = 5;
      const points: { px: number; py: number }[] = [];
      for (let s = 0; s <= segments; s++) {
        const t = s / segments;
        const baseX = x + dirX * (t * boltLength - halfLen);
        const baseY = y + dirY * (t * boltLength - halfLen);
        // Random perpendicular jitter (none at endpoints)
        const jitter = (s === 0 || s === segments) ? 0 : (Math.random() - 0.5) * 12;
        points.push({ px: baseX + perpX * jitter, py: baseY + perpY * jitter });
      }

      // Outer glow bolt (thicker, dimmer)
      graphics.lineStyle(5, colors.trail, 0.4);
      graphics.beginPath();
      graphics.moveTo(points[0].px, points[0].py);
      for (let s = 1; s < points.length; s++) {
        graphics.lineTo(points[s].px, points[s].py);
      }
      graphics.strokePath();

      // Main bolt (blue)
      graphics.lineStyle(3, colors.primary, 0.9);
      graphics.beginPath();
      graphics.moveTo(points[0].px, points[0].py);
      for (let s = 1; s < points.length; s++) {
        graphics.lineTo(points[s].px, points[s].py);
      }
      graphics.strokePath();

      // Bright core (white, thin)
      graphics.lineStyle(1, colors.secondary, 1);
      graphics.beginPath();
      graphics.moveTo(points[0].px, points[0].py);
      for (let s = 1; s < points.length; s++) {
        graphics.lineTo(points[s].px, points[s].py);
      }
      graphics.strokePath();

      // Small bright point at tip
      graphics.fillStyle(colors.secondary, 0.9);
      graphics.fillCircle(points[points.length - 1].px, points[points.length - 1].py, 3);
    }
  }

  private updateSpellProjectiles(): void {
    const dt = this.game.loop.delta / 1000; // seconds
    const scaledTile = TILE_SIZE * SCALE;

    for (let i = this.spellProjectiles.length - 1; i >= 0; i--) {
      const proj = this.spellProjectiles[i];

      // Move
      proj.x += proj.vx * dt;
      proj.y += proj.vy * dt;
      proj.graphics.setPosition(proj.x, proj.y);

      // Redraw lightning bolt / frost shard each frame for animated effect
      if (proj.spellType === 'lightning' || proj.spellType === 'frost') {
        const colors = SPELL_COLORS[proj.spellType];
        this.drawProjectileGraphics(proj.graphics, 0, 0, colors, proj.spellType, proj.directionRad);
      }

      // Check max range
      const traveled = Phaser.Math.Distance.Between(proj.originX, proj.originY, proj.x, proj.y);
      if (traveled >= proj.range) {
        this.destroySpellProjectile(i);
        continue;
      }

      // Check wall collision (tile lookup)
      const tileX = Math.floor(proj.x / scaledTile);
      const tileY = Math.floor(proj.y / scaledTile);
      if (tileX < 0 || tileX >= DUNGEON_WIDTH || tileY < 0 || tileY >= DUNGEON_HEIGHT ||
          this.dungeon[tileY]?.[tileX] === 1 || this.dungeon[tileY]?.[tileX] === 2 || this.dungeon[tileY]?.[tileX] === 4) {
        this.createSpellImpactEffect(proj.x, proj.y, proj.spellType);
        this.destroySpellProjectile(i);
        continue;
      }

      // Check monster collision (distance-based)
      let hitMonster: Monster | null = null;
      this.monsters.getChildren().forEach((monster) => {
        if (hitMonster) return;
        const m = monster as Monster;
        if (!m.active) return;
        const dist = Phaser.Math.Distance.Between(proj.x, proj.y, m.x, m.y);
        const hitRadius = Math.max(m.displayWidth, m.displayHeight) / 2 + 6;
        if (dist <= hitRadius) {
          hitMonster = m;
        }
      });

      if (hitMonster) {
        this.onSpellHitMonster(proj, hitMonster);
        this.destroySpellProjectile(i);
        continue;
      }

      // Check spawner collision (spell projectiles)
      let hitSpawner = false;
      for (const [key, sprite] of this.spawnerSprites) {
        if (!sprite.active) continue;
        const dist = Phaser.Math.Distance.Between(proj.x, proj.y, sprite.x, sprite.y);
        if (dist <= 12) {
          this.damageSpawner(key, proj.damage.damage);
          this.createSpellImpactEffect(sprite.x, sprite.y, proj.spellType);
          this.destroySpellProjectile(i);
          hitSpawner = true;
          break;
        }
      }
      if (hitSpawner) continue;
    }
  }

  private onSpellHitMonster(proj: SpellProjectile, target: Monster): void {
    // Primary target
    target.takeDamage(proj.damage.damage, proj.damage.isCritical);
    this.player.combat.createHitEffect(target.x, target.y);
    this.createSpellImpactEffect(target.x, target.y, proj.spellType);

    // Frost freeze effect
    if (proj.spellType === 'frost' && target.active) {
      const freezeDuration = Math.max(1000, Math.min(2000, 2000 - (target.maxHealth / 200) * 1000));
      target.applyFreeze(freezeDuration);
    }

    // AOE chaining (lightning)
    if (proj.aoe > 1) {
      const chainRange = 60;
      const hitTargets: Monster[] = [target];
      const damageDecay = [1.0, 0.6, 0.35];

      // Find nearby monsters to chain to
      const candidates: { monster: Monster; dist: number }[] = [];
      this.monsters.getChildren().forEach((monster) => {
        const m = monster as Monster;
        if (!m.active || m === target) return;
        const dist = Phaser.Math.Distance.Between(target.x, target.y, m.x, m.y);
        if (dist <= chainRange) {
          candidates.push({ monster: m, dist });
        }
      });

      // Sort by distance and take up to (aoe - 1) additional targets
      candidates.sort((a, b) => a.dist - b.dist);
      const chainCount = Math.min(candidates.length, proj.aoe - 1);

      for (let c = 0; c < chainCount; c++) {
        const chainTarget = candidates[c].monster;
        const chainDamage = Math.floor(proj.damage.damage * (damageDecay[c + 1] ?? 0.35));
        const chainCrit = proj.damage.isCritical;

        chainTarget.takeDamage(chainDamage, chainCrit);
        this.player.combat.createHitEffect(chainTarget.x, chainTarget.y);
        hitTargets.push(chainTarget);
      }

      // Draw lightning chain arcs between hit targets
      if (hitTargets.length > 1) {
        this.createLightningChain(hitTargets);
      }
    }
  }

  private createLightningChain(targets: Monster[]): void {
    const chainGraphics = this.add.graphics();
    chainGraphics.setDepth(16);

    for (let i = 0; i < targets.length - 1; i++) {
      const from = targets[i];
      const to = targets[i + 1];

      // Draw jagged lightning line
      chainGraphics.lineStyle(3, 0x4488ff, 0.9);
      chainGraphics.beginPath();
      chainGraphics.moveTo(from.x, from.y);

      // Add 2-3 intermediate jagged points
      const segments = 3;
      for (let s = 1; s < segments; s++) {
        const t = s / segments;
        const midX = from.x + (to.x - from.x) * t + (Math.random() - 0.5) * 20;
        const midY = from.y + (to.y - from.y) * t + (Math.random() - 0.5) * 20;
        chainGraphics.lineTo(midX, midY);
      }

      chainGraphics.lineTo(to.x, to.y);
      chainGraphics.strokePath();

      // Inner bright line
      chainGraphics.lineStyle(1, 0xffffff, 0.8);
      chainGraphics.beginPath();
      chainGraphics.moveTo(from.x, from.y);
      chainGraphics.lineTo(to.x, to.y);
      chainGraphics.strokePath();
    }

    // Fade out and destroy
    this.tweens.add({
      targets: chainGraphics,
      alpha: 0,
      duration: 200,
      onComplete: () => chainGraphics.destroy()
    });
  }

  private createSpellImpactEffect(x: number, y: number, spellType: SpellType): void {
    const colors = SPELL_COLORS[spellType];

    if (spellType === 'frost') {
      // Frost burst: snowflake particles radiating outward + falling
      const flakeCount = 12;
      for (let i = 0; i < flakeCount; i++) {
        const flake = this.add.graphics();
        flake.setDepth(16);

        const angle = (Math.PI * 2 / flakeCount) * i + (Math.random() - 0.5) * 0.4;
        const size = 1.5 + Math.random() * 2;
        const color = Math.random() > 0.4 ? 0x88ddff : 0xffffff;

        // Draw snowflake at origin
        flake.fillStyle(color, 0.8);
        flake.fillCircle(0, 0, size);
        // Cross pattern for snowflake look
        flake.lineStyle(1, 0xffffff, 0.6);
        flake.beginPath();
        flake.moveTo(-3, 0);
        flake.lineTo(3, 0);
        flake.moveTo(0, -3);
        flake.lineTo(0, 3);
        // Diagonal arms
        flake.moveTo(-2, -2);
        flake.lineTo(2, 2);
        flake.moveTo(2, -2);
        flake.lineTo(-2, 2);
        flake.strokePath();

        flake.setPosition(x, y);

        const distance = 16 + Math.random() * 14;
        const targetX = x + Math.cos(angle) * distance;
        const targetY = y + Math.sin(angle) * distance;

        // Burst outward then drift down
        this.tweens.add({
          targets: flake,
          x: targetX,
          y: targetY + 8 + Math.random() * 6,
          alpha: 0,
          scale: 0.3 + Math.random() * 0.3,
          duration: 500 + Math.random() * 300,
          ease: 'Power2',
          onComplete: () => flake.destroy()
        });
      }

      // Central ice flash
      const flash = this.add.graphics();
      flash.setDepth(15);
      flash.fillStyle(0xaaddff, 0.5);
      flash.fillCircle(x, y, 14);
      flash.fillStyle(0xffffff, 0.4);
      flash.fillCircle(x, y, 8);
      this.tweens.add({
        targets: flash,
        alpha: 0,
        scale: 1.5,
        duration: 250,
        ease: 'Power1',
        onComplete: () => flash.destroy()
      });
      return;
    }

    // Default impact (fireball, lightning)
    const particleCount = 8;
    for (let i = 0; i < particleCount; i++) {
      const particle = this.add.circle(x, y, 3, colors.primary, 0.8);
      particle.setDepth(16);

      const angle = (Math.PI * 2 / particleCount) * i + Math.random() * 0.5;
      const distance = 12 + Math.random() * 8;

      this.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance,
        alpha: 0,
        scale: 0,
        duration: 300,
        ease: 'Power2',
        onComplete: () => particle.destroy()
      });
    }
  }

  private destroySpellProjectile(index: number): void {
    const proj = this.spellProjectiles[index];
    proj.trailTimer.destroy();
    proj.graphics.destroy();
    this.spellProjectiles.splice(index, 1);
  }

  // --- Monster Projectile System ---

  private createMonsterProjectile(data: {
    originX: number; originY: number; directionRad: number;
    speed: number; range: number; damage: number; style: MonsterProjectileStyle;
  }): void {
    const graphics = this.add.graphics();
    graphics.setDepth(15);

    this.drawMonsterProjectileGraphics(graphics, 0, 0, data.style, data.directionRad);

    const vx = Math.cos(data.directionRad) * data.speed;
    const vy = Math.sin(data.directionRad) * data.speed;

    this.monsterProjectiles.push({
      graphics,
      x: data.originX,
      y: data.originY,
      vx,
      vy,
      directionRad: data.directionRad,
      originX: data.originX,
      originY: data.originY,
      range: data.range,
      damage: data.damage,
      style: data.style
    });
  }

  private drawMonsterProjectileGraphics(
    graphics: Phaser.GameObjects.Graphics, x: number, y: number,
    style: MonsterProjectileStyle, dirRad: number
  ): void {
    graphics.clear();
    const colors = MONSTER_PROJECTILE_COLORS[style];
    const dirX = Math.cos(dirRad);
    const dirY = Math.sin(dirRad);
    const perpX = -Math.sin(dirRad);
    const perpY = Math.cos(dirRad);

    switch (style) {
      case 'bone_arrow':
        // Narrow pointed arrow shape
        graphics.fillStyle(colors.primary, 0.9);
        graphics.beginPath();
        graphics.moveTo(x + dirX * 6, y + dirY * 6);
        graphics.lineTo(x + perpX * 2, y + perpY * 2);
        graphics.lineTo(x - dirX * 4, y - dirY * 4);
        graphics.lineTo(x - perpX * 2, y - perpY * 2);
        graphics.closePath();
        graphics.fillPath();
        graphics.fillStyle(colors.secondary, 0.8);
        graphics.fillCircle(x + dirX * 5, y + dirY * 5, 1.5);
        break;

      case 'poison_bolt':
        // Glowing green blob
        graphics.fillStyle(colors.trail, 0.3);
        graphics.fillCircle(x, y, 7);
        graphics.fillStyle(colors.primary, 0.8);
        graphics.fillCircle(x, y, 4);
        graphics.fillStyle(colors.secondary, 0.9);
        graphics.fillCircle(x + dirX * 2, y + dirY * 2, 2);
        break;

      case 'fire_bolt':
        // Small fireball
        graphics.fillStyle(colors.trail, 0.3);
        graphics.fillCircle(x, y, 6);
        graphics.fillStyle(colors.primary, 0.9);
        graphics.fillCircle(x, y, 4);
        graphics.fillStyle(colors.secondary, 1);
        graphics.fillCircle(x + dirX * 2, y + dirY * 2, 2);
        break;

      case 'skull_bolt':
        // Purple skull-like orb
        graphics.fillStyle(colors.trail, 0.3);
        graphics.fillCircle(x, y, 8);
        graphics.fillStyle(colors.primary, 0.85);
        graphics.fillCircle(x, y, 5);
        // "Eye" dots
        graphics.fillStyle(colors.secondary, 0.9);
        graphics.fillCircle(x + perpX * 2, y + perpY * 2, 1.5);
        graphics.fillCircle(x - perpX * 2, y - perpY * 2, 1.5);
        break;

      case 'energy_orb':
        // Pulsing cyan orb with ring
        const pulse = 0.8 + Math.random() * 0.2;
        graphics.fillStyle(colors.trail, 0.25);
        graphics.fillCircle(x, y, 9 * pulse);
        graphics.lineStyle(1, colors.secondary, 0.6);
        graphics.strokeCircle(x, y, 7 * pulse);
        graphics.fillStyle(colors.primary, 0.9);
        graphics.fillCircle(x, y, 4);
        graphics.fillStyle(colors.secondary, 1);
        graphics.fillCircle(x, y, 2);
        break;
    }
  }

  private updateMonsterProjectiles(): void {
    const dt = this.game.loop.delta / 1000;
    const scaledTile = TILE_SIZE * SCALE;

    for (let i = this.monsterProjectiles.length - 1; i >= 0; i--) {
      const proj = this.monsterProjectiles[i];

      // Move
      proj.x += proj.vx * dt;
      proj.y += proj.vy * dt;
      proj.graphics.setPosition(proj.x, proj.y);

      // Redraw for animated styles
      if (proj.style === 'energy_orb' || proj.style === 'skull_bolt') {
        this.drawMonsterProjectileGraphics(proj.graphics, 0, 0, proj.style, proj.directionRad);
      }

      // Check max range
      const traveled = Phaser.Math.Distance.Between(proj.originX, proj.originY, proj.x, proj.y);
      if (traveled >= proj.range) {
        this.destroyMonsterProjectile(i);
        continue;
      }

      // Check wall collision
      const tileX = Math.floor(proj.x / scaledTile);
      const tileY = Math.floor(proj.y / scaledTile);
      if (tileX < 0 || tileX >= DUNGEON_WIDTH || tileY < 0 || tileY >= DUNGEON_HEIGHT ||
          this.dungeon[tileY]?.[tileX] === 1 || this.dungeon[tileY]?.[tileX] === 2 || this.dungeon[tileY]?.[tileX] === 4) {
        this.createMonsterProjectileImpact(proj.x, proj.y, proj.style);
        this.destroyMonsterProjectile(i);
        continue;
      }

      // Check player collision (distance-based, radius ~12px)
      const distToPlayer = Phaser.Math.Distance.Between(proj.x, proj.y, this.player.x, this.player.y);
      if (distToPlayer <= 12) {
        this.onMonsterProjectileHitPlayer(proj);
        this.createMonsterProjectileImpact(proj.x, proj.y, proj.style);
        this.destroyMonsterProjectile(i);
      }
    }
  }

  private onMonsterProjectileHitPlayer(proj: MonsterProjectile): void {
    const result = this.player.combat.calculateMonsterDamage(
      proj.damage,
      this.player.inventory.getTotalDefense()
    );
    this.player.takeDamage(result.damage);
  }

  private createMonsterProjectileImpact(x: number, y: number, style: MonsterProjectileStyle): void {
    const colors = MONSTER_PROJECTILE_COLORS[style];
    const particleCount = 6;
    for (let i = 0; i < particleCount; i++) {
      const particle = this.add.circle(x, y, 2, colors.primary, 0.7);
      particle.setDepth(16);

      const angle = (Math.PI * 2 / particleCount) * i + Math.random() * 0.5;
      const distance = 8 + Math.random() * 6;

      this.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance,
        alpha: 0,
        scale: 0,
        duration: 200,
        ease: 'Power2',
        onComplete: () => particle.destroy()
      });
    }
  }

  private destroyMonsterProjectile(index: number): void {
    const proj = this.monsterProjectiles[index];
    proj.graphics.destroy();
    this.monsterProjectiles.splice(index, 1);
  }

  // --- Boss Ability Handlers ---

  private handleBossSlam(data: { x: number; y: number; radius: number; damage: number; monster: Monster }): void {
    const { x, y, radius, damage } = data;

    // Wind-up: pulsing ring (300ms)
    const windUp = this.add.graphics();
    windUp.setDepth(15);
    let pulseScale = 0;
    const pulseTimer = this.time.addEvent({
      delay: 30,
      repeat: 9,
      callback: () => {
        windUp.clear();
        pulseScale += 0.1;
        windUp.lineStyle(2, 0xff4444, 0.6 * pulseScale);
        windUp.strokeCircle(x, y, radius * pulseScale);
      }
    });

    // After wind-up, burst and deal damage
    this.time.delayedCall(300, () => {
      pulseTimer.destroy();
      windUp.destroy();

      // Burst effect
      const burst = this.add.graphics();
      burst.setDepth(15);
      burst.fillStyle(0xff2222, 0.4);
      burst.fillCircle(x, y, radius);
      burst.lineStyle(3, 0xff0000, 0.8);
      burst.strokeCircle(x, y, radius);

      this.tweens.add({
        targets: burst,
        alpha: 0,
        duration: 400,
        onComplete: () => burst.destroy()
      });

      // Camera shake
      this.cameras.main.shake(200, 0.008);

      // Check player hit
      const distToPlayer = Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y);
      if (distToPlayer <= radius) {
        const result = this.player.combat.calculateMonsterDamage(
          damage,
          this.player.inventory.getTotalDefense()
        );
        this.player.takeDamage(result.damage);
        // Knockback away from slam center
        const angle = Math.atan2(this.player.y - y, this.player.x - x);
        const body = this.player.body as Phaser.Physics.Arcade.Body;
        body.setVelocity(Math.cos(angle) * 200, Math.sin(angle) * 200);
      }
    });
  }

  private handleBossSummon(data: { x: number; y: number; summonType: string; count: number; monster: Monster }): void {
    const livingMonsters = this.monsters.getChildren().filter(m => m.active).length;
    if (livingMonsters >= this.maxMonsters) return;

    const monsterData = MONSTERS[data.summonType];
    if (!monsterData) return;

    const scaledTile = TILE_SIZE * SCALE;

    // Summon VFX at boss position
    const summonFlash = this.add.graphics();
    summonFlash.setDepth(15);
    summonFlash.fillStyle(0xaa44ff, 0.5);
    summonFlash.fillCircle(data.x, data.y, 30);
    this.tweens.add({
      targets: summonFlash,
      alpha: 0,
      duration: 500,
      onComplete: () => summonFlash.destroy()
    });

    for (let i = 0; i < data.count && livingMonsters + i < this.maxMonsters; i++) {
      // Find floor tile near boss
      const angle = (Math.PI * 2 / data.count) * i;
      const spawnX = data.x + Math.cos(angle) * 40;
      const spawnY = data.y + Math.sin(angle) * 40;

      // Verify spawn position is on floor
      const tileX = Math.floor(spawnX / scaledTile);
      const tileY = Math.floor(spawnY / scaledTile);
      if (this.dungeon[tileY]?.[tileX] !== 0 && this.dungeon[tileY]?.[tileX] !== 3) continue;

      const scaledData = this.scaleMonsterForFloor(monsterData);
      const monster = new Monster(this, spawnX, spawnY, scaledData);
      monster.setTarget(this.player);
      monster.setFogSystem(this.fogSystem);
      this.monsters.add(monster);

      // Spawn-in VFX
      monster.setAlpha(0);
      this.tweens.add({
        targets: monster,
        alpha: 1,
        duration: 300
      });
    }
  }

  private createChargeAfterimage(monster: Monster): void {
    // Create afterimage trail for 400ms
    const trailTimer = this.time.addEvent({
      delay: 60,
      repeat: 6,
      callback: () => {
        if (!monster.active) return;
        const ghost = this.add.image(monster.x, monster.y, monster.monsterData.sprite);
        ghost.setScale(monster.scaleX);
        ghost.setAlpha(0.4);
        ghost.setTint(0xff4444);
        ghost.setDepth(4);
        this.tweens.add({
          targets: ghost,
          alpha: 0,
          duration: 200,
          onComplete: () => ghost.destroy()
        });
      }
    });
  }

  private createTeleportEffect(oldX: number, oldY: number, newX: number, newY: number): void {
    // Purple flash at old position
    const flashOld = this.add.graphics();
    flashOld.setDepth(15);
    flashOld.fillStyle(0xaa44ff, 0.6);
    flashOld.fillCircle(oldX, oldY, 20);
    this.tweens.add({
      targets: flashOld,
      alpha: 0,
      scale: 2,
      duration: 300,
      onComplete: () => flashOld.destroy()
    });

    // Purple flash at new position
    const flashNew = this.add.graphics();
    flashNew.setDepth(15);
    flashNew.fillStyle(0xaa44ff, 0.8);
    flashNew.fillCircle(newX, newY, 20);
    this.tweens.add({
      targets: flashNew,
      alpha: 0,
      duration: 400,
      onComplete: () => flashNew.destroy()
    });
  }

  // --- Spawner/Nest System ---

  private spawnSpawners(): void {
    const scaledTile = TILE_SIZE * SCALE;

    for (let i = 1; i < this.rooms.length; i++) {
      const room = this.rooms[i];
      // Skip safe room and boss room
      if (room.roomType === 'start' || room.isBossRoom || i === this.rooms.length - 1) continue;

      // 30% chance per eligible room
      if (Math.random() > SPAWNER_CHANCE) continue;

      // Get wall-adjacent tiles for placement
      const candidates = this.getWallAdjacentTiles(room);
      if (candidates.length === 0) continue;

      const pick = candidates[Math.floor(Math.random() * candidates.length)];
      const { tx, ty } = pick;
      const key = `${tx},${ty}`;

      // Skip if already occupied by chest
      if (this.chestSprites.has(key)) continue;

      const family = this.roomFamilies.get(i) ?? 'undead';
      const hp = SPAWNER_HP[this.currentTier];

      const worldX = tx * scaledTile + scaledTile / 2;
      const worldY = ty * scaledTile + scaledTile / 2;

      const sprite = this.physics.add.staticImage(worldX, worldY, 'spawner_nest');
      sprite.setScale(SCALE);
      sprite.setDepth(1);
      sprite.setTint(SPAWNER_FAMILY_TINTS[family] ?? 0xffffff);
      sprite.refreshBody();

      this.spawnerSprites.set(key, sprite);

      const data: SpawnerData = {
        x: tx,
        y: ty,
        roomIndex: i,
        health: hp,
        maxHealth: hp,
        monsterFamily: family,
        spawnCooldown: SPAWNER_SPAWN_COOLDOWN,
        lastSpawnTime: 0,
        maxSpawned: SPAWNER_MAX_SPAWNED,
        livingCount: 0
      };
      this.spawnerData.set(key, data);

      // Health bar
      const healthBar = this.add.graphics();
      healthBar.setDepth(100);
      this.spawnerHealthBars.set(key, healthBar);
      this.updateSpawnerHealthBar(key);
    }
  }

  private updateSpawnerHealthBar(key: string): void {
    const data = this.spawnerData.get(key);
    const sprite = this.spawnerSprites.get(key);
    const bar = this.spawnerHealthBars.get(key);
    if (!data || !sprite || !bar) return;

    bar.clear();
    const barWidth = 24;
    const barHeight = 3;
    const x = sprite.x - barWidth / 2;
    const y = sprite.y - 18;

    bar.fillStyle(0x333333);
    bar.fillRect(x, y, barWidth, barHeight);

    const percent = data.health / data.maxHealth;
    const color = percent > 0.5 ? 0x00ff00 : percent > 0.25 ? 0xffff00 : 0xff0000;
    bar.fillStyle(color);
    bar.fillRect(x, y, barWidth * percent, barHeight);
  }

  private damageSpawner(key: string, amount: number): void {
    const data = this.spawnerData.get(key);
    const sprite = this.spawnerSprites.get(key);
    if (!data || !sprite) return;

    data.health -= amount;

    // Flash white
    sprite.setTint(0xffffff);
    this.time.delayedCall(80, () => {
      if (sprite.active) {
        sprite.setTint(SPAWNER_FAMILY_TINTS[data.monsterFamily] ?? 0xffffff);
      }
    });

    // Damage number
    const damageText = this.add.text(sprite.x, sprite.y - 15, `-${amount}`, {
      fontSize: '12px',
      fontFamily: 'monospace',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5).setDepth(1000);

    this.tweens.add({
      targets: damageText,
      y: sprite.y - 35,
      alpha: 0,
      duration: 600,
      onComplete: () => damageText.destroy()
    });

    this.updateSpawnerHealthBar(key);

    if (data.health <= 0) {
      this.destroySpawner(key);
    }
  }

  private destroySpawner(key: string): void {
    const data = this.spawnerData.get(key);
    const sprite = this.spawnerSprites.get(key);
    const bar = this.spawnerHealthBars.get(key);

    if (sprite) {
      // Bone scatter particles
      for (let i = 0; i < 8; i++) {
        const particle = this.add.circle(sprite.x, sprite.y, 2, 0xccccaa, 0.8);
        particle.setDepth(16);
        const angle = (Math.PI * 2 / 8) * i + Math.random() * 0.5;
        const distance = 10 + Math.random() * 12;
        this.tweens.add({
          targets: particle,
          x: sprite.x + Math.cos(angle) * distance,
          y: sprite.y + Math.sin(angle) * distance,
          alpha: 0,
          duration: 400,
          ease: 'Power2',
          onComplete: () => particle.destroy()
        });
      }

      // XP reward
      const xp = SPAWNER_XP[this.currentTier];
      this.player.addXP(xp);

      // Floating XP text
      const xpText = this.add.text(sprite.x, sprite.y, `+${xp} XP`, {
        fontSize: '11px',
        fontFamily: 'monospace',
        color: '#aaddff',
        stroke: '#000000',
        strokeThickness: 2
      }).setOrigin(0.5).setDepth(1000);

      this.tweens.add({
        targets: xpText,
        y: sprite.y - 30,
        alpha: 0,
        duration: 1000,
        onComplete: () => xpText.destroy()
      });

      sprite.destroy();
    }

    bar?.destroy();

    this.spawnerSprites.delete(key);
    this.spawnerData.delete(key);
    this.spawnerHealthBars.delete(key);

    // Don't clean up spawnerMonsterMap — existing monsters persist
  }

  private updateSpawners(time: number): void {
    const scaledTile = TILE_SIZE * SCALE;
    const playerTileX = Math.floor(this.player.x / scaledTile);
    const playerTileY = Math.floor(this.player.y / scaledTile);

    // Find player's current room
    let playerRoomIdx = -1;
    for (let i = 0; i < this.rooms.length; i++) {
      const r = this.rooms[i];
      if (playerTileX >= r.x && playerTileX < r.x + r.width &&
          playerTileY >= r.y && playerTileY < r.y + r.height) {
        playerRoomIdx = i;
        break;
      }
    }

    for (const [key, data] of this.spawnerData) {
      const sprite = this.spawnerSprites.get(key);
      if (!sprite || !sprite.active) continue;

      // Spawner visibility (fog of war)
      if (this.fogSystem) {
        const visible = this.fogSystem.isVisible(data.x, data.y);
        sprite.setVisible(visible);
        const bar = this.spawnerHealthBars.get(key);
        if (bar) bar.setVisible(visible);
      }

      // Only spawn monsters when player is in the same room
      if (data.roomIndex !== playerRoomIdx) continue;

      // Check if can spawn
      if (data.livingCount >= data.maxSpawned) continue;
      if (time - data.lastSpawnTime < data.spawnCooldown) continue;

      // Check total monster count
      const livingMonsters = this.monsters.getChildren().filter(m => m.active).length;
      if (livingMonsters >= this.maxMonsters) continue;

      data.lastSpawnTime = time;

      // Pick a non-boss monster from this spawner's family
      const pool = getNonBossMonstersByFamily(data.monsterFamily);
      if (pool.length === 0) continue;
      const monsterData = Phaser.Utils.Array.GetRandom(pool);

      // Spawn near the spawner
      const spawnX = sprite.x + (Math.random() - 0.5) * 40;
      const spawnY = sprite.y + (Math.random() - 0.5) * 40;

      const scaledData = this.scaleMonsterForFloor(monsterData);
      const monster = new Monster(this, spawnX, spawnY, scaledData);
      monster.setTarget(this.player);
      monster.setFogSystem(this.fogSystem);
      this.monsters.add(monster);

      // Track for death counting
      this.spawnerMonsterMap.set(monster, key);
      data.livingCount++;

      // Visual pulse on spawner
      if (sprite.active) {
        sprite.setTint(0xffffff);
        this.time.delayedCall(150, () => {
          if (sprite.active) {
            sprite.setTint(SPAWNER_FAMILY_TINTS[data.monsterFamily] ?? 0xffffff);
          }
        });
      }

      // Spawn-in effect on monster
      monster.setAlpha(0);
      this.tweens.add({
        targets: monster,
        alpha: 1,
        duration: 300
      });
    }
  }
}
