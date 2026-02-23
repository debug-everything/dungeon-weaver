import Phaser from 'phaser';
import { SCENE_KEYS, TILE_SIZE, SCALE, DUNGEON_WIDTH, DUNGEON_HEIGHT, EVENTS, INTERACTION_DISTANCE, VISIBILITY_RADIUS, CHESTS_PER_ROOM, CHEST_GOLD, CHEST_LOOT_TABLE, ROOMS_TO_CLEAR_FOR_BOSS } from '../config/constants';
import { Player } from '../entities/Player';
import { Monster } from '../entities/Monster';
import { NPC } from '../entities/NPC';
import { DungeonRoom, NPCData, ChestData } from '../types';
import { MONSTERS } from '../data/monsters';
import { NPCS } from '../data/npcs';
import { QUESTS } from '../data/quests';
import { QuestSystem } from '../systems/QuestSystem';
import { FogOfWarSystem } from '../systems/FogOfWarSystem';
import { clearShopSubsets, rotateShopSubset } from '../systems/ShopSystem';
import { generateDungeon as generateBSPDungeon } from '../systems/DungeonGenerator';
import { saveGame, checkLLMEnabled, getArcStatus, SaveGamePayload, SaveData } from '../services/ApiClient';
import { StoryArcInfo } from '../types';

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

  constructor() {
    super({ key: SCENE_KEYS.GAME });
  }

  create(): void {
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

    // Spawn NPCs in safe room (first room)
    this.spawnNPCs();

    // Spawn chests in dungeon rooms
    this.spawnChests();

    // Spawn monsters in other rooms
    this.spawnMonsters();

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
      if (!llmEnabled) {
        for (const quest of Object.values(QUESTS)) {
          this.questSystem.registerQuest(quest);
        }
      }
    }).catch(() => {
      // Backend unreachable — use hardcoded quests
      for (const quest of Object.values(QUESTS)) {
        this.questSystem.registerQuest(quest);
      }
    });

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
    const monsterTypes = Object.keys(MONSTERS);

    for (let i = 0; i < this.rooms.length; i++) {
      const room = this.rooms[i];
      // Skip start room
      if (room.roomType === 'start' || i === 0) continue;

      const isBoss = room.isBossRoom || i === this.rooms.length - 1;
      const monsterCount = Phaser.Math.Between(2, 4);

      for (let j = 0; j < monsterCount; j++) {
        const monsterType = isBoss && j === 0
          ? 'monster_demon' // Boss in boss room
          : Phaser.Utils.Array.GetRandom(monsterTypes.filter(t => t !== 'monster_demon'));

        const monsterData = MONSTERS[monsterType];
        const spawnX = Phaser.Math.Between(room.x + 1, room.x + room.width - 2) * TILE_SIZE * SCALE;
        const spawnY = Phaser.Math.Between(room.y + 1, room.y + room.height - 2) * TILE_SIZE * SCALE;

        const monster = new Monster(this, spawnX, spawnY, monsterData);
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

    for (const obj of def.objectives) {
      if (obj.type === 'kill') {
        // Spawn required number of target monsters in the target room
        const monsterKey = `monster_${obj.target}`;
        const monsterData = MONSTERS[monsterKey];
        if (!monsterData) continue;

        for (let i = 0; i < obj.requiredCount; i++) {
          const spawnX = Phaser.Math.Between(targetRoom.x + 1, targetRoom.x + targetRoom.width - 2) * TILE_SIZE * SCALE;
          const spawnY = Phaser.Math.Between(targetRoom.y + 1, targetRoom.y + targetRoom.height - 2) * TILE_SIZE * SCALE;
          const monster = new Monster(this, spawnX, spawnY, monsterData);
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

    const nonBossTypes = Object.keys(MONSTERS).filter(t => t !== 'monster_demon');
    if (nonBossTypes.length === 0) return;

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
            if (nonBossTypes.includes(spriteKey)) {
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
      let monsterType: string;
      if (questTargetTypes.length > 0 && Math.random() < 0.5) {
        monsterType = Phaser.Utils.Array.GetRandom(questTargetTypes);
      } else {
        monsterType = Phaser.Utils.Array.GetRandom(nonBossTypes);
      }
      const monsterData = MONSTERS[monsterType];
      const spawnX = Phaser.Math.Between(room.x + 1, room.x + room.width - 2) * TILE_SIZE * SCALE;
      const spawnY = Phaser.Math.Between(room.y + 1, room.y + room.height - 2) * TILE_SIZE * SCALE;

      const monster = new Monster(this, spawnX, spawnY, monsterData);
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

    // Track monster kills for room clearing
    this.events.on(EVENTS.MONSTER_KILLED, (_monsterData: unknown, worldX: number, worldY: number) => {
      this.onMonsterKilled(worldX, worldY);
    });

    // Loot dropped
    this.events.on('loot-dropped', (data: { x: number; y: number; gold: number; items: string[] }) => {
      this.player.addGold(data.gold);

      // Show gold pickup text
      const goldText = this.add.text(data.x, data.y, `+${data.gold} gold`, {
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
    });

    // Quick save (F5)
    this.input.keyboard?.on('keydown-F5', () => {
      this.saveCurrentGame();
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
      const info = raw as StoryArcInfo;
      if (info.status === 'active' && info.nextQuestReady && info.nextQuestNpcId) {
        // Only set if no quest is locally registered for this NPC yet
        if (!this.questSystem.hasAnyQuest(info.nextQuestNpcId)) {
          this.arcNextQuestNpcId = info.nextQuestNpcId;
        }
      }
    }).catch(() => {});
  }

  getDungeon(): number[][] { return this.dungeon; }
  getRooms(): DungeonRoom[] { return this.rooms; }
  getPlayer(): Player { return this.player; }
  getNPCs(): Phaser.GameObjects.Group { return this.npcs; }
  getMonsters(): Phaser.GameObjects.Group { return this.monsters; }

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

    this.showNotification('The sealed doors have been unlocked!');
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

  serializeGameState(): SaveGamePayload {
    return {
      playerName: 'Hero',
      playerState: {
        health: this.player.health,
        maxHealth: this.player.maxHealth,
        gold: this.player.gold,
        position: { x: this.player.x, y: this.player.y }
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

    // Update NPC quest indicators (throttled to every 500ms)
    if (time - this.lastIndicatorUpdate > 500) {
      this.lastIndicatorUpdate = time;
      this.updateNPCIndicators();
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
}
