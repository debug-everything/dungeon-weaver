import Phaser from 'phaser';
import { SCENE_KEYS, TILE_SIZE, SCALE, DUNGEON_WIDTH, DUNGEON_HEIGHT, EVENTS, INTERACTION_DISTANCE, VISIBILITY_RADIUS } from '../config/constants';
import { Player } from '../entities/Player';
import { Monster } from '../entities/Monster';
import { NPC } from '../entities/NPC';
import { DungeonRoom, NPCData } from '../types';
import { MONSTERS } from '../data/monsters';
import { NPCS } from '../data/npcs';
import { QUESTS } from '../data/quests';
import { QuestSystem } from '../systems/QuestSystem';
import { FogOfWarSystem } from '../systems/FogOfWarSystem';
import { saveGame, SaveGamePayload, SaveData } from '../services/ApiClient';

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

  constructor() {
    super({ key: SCENE_KEYS.GAME });
  }

  create(): void {
    this.isPaused = false;

    // Initialize groups
    this.walls = this.physics.add.staticGroup();
    this.doors = this.physics.add.staticGroup();
    this.doorSprites = new Map();
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

    // Spawn NPCs in safe room (first room)
    this.spawnNPCs();

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
    for (const quest of Object.values(QUESTS)) {
      this.questSystem.registerQuest(quest);
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
  }

  private generateDungeon(): void {
    // Initialize dungeon with walls
    this.dungeon = [];
    for (let y = 0; y < DUNGEON_HEIGHT; y++) {
      this.dungeon[y] = [];
      for (let x = 0; x < DUNGEON_WIDTH; x++) {
        this.dungeon[y][x] = 1; // 1 = wall
      }
    }

    // Generate rooms
    this.rooms = [];
    const maxAttempts = 50;

    for (let i = 0; i < maxAttempts && this.rooms.length < 8; i++) {
      const roomWidth = Phaser.Math.Between(5, 10);
      const roomHeight = Phaser.Math.Between(5, 8);
      const roomX = Phaser.Math.Between(1, DUNGEON_WIDTH - roomWidth - 1);
      const roomY = Phaser.Math.Between(1, DUNGEON_HEIGHT - roomHeight - 1);

      const newRoom: DungeonRoom = {
        x: roomX,
        y: roomY,
        width: roomWidth,
        height: roomHeight,
        centerX: Math.floor(roomX + roomWidth / 2),
        centerY: Math.floor(roomY + roomHeight / 2)
      };

      // Check for overlap with existing rooms
      let overlaps = false;
      for (const room of this.rooms) {
        if (this.roomsOverlap(newRoom, room)) {
          overlaps = true;
          break;
        }
      }

      if (!overlaps) {
        this.carveRoom(newRoom);
        this.rooms.push(newRoom);
      }
    }

    // Connect rooms with corridors
    for (let i = 1; i < this.rooms.length; i++) {
      this.connectRooms(this.rooms[i - 1], this.rooms[i]);
    }

    // Place doors at some room entrances
    this.placeDoors();
  }

  private roomsOverlap(a: DungeonRoom, b: DungeonRoom): boolean {
    return !(a.x + a.width + 1 < b.x ||
             b.x + b.width + 1 < a.x ||
             a.y + a.height + 1 < b.y ||
             b.y + b.height + 1 < a.y);
  }

  private carveRoom(room: DungeonRoom): void {
    for (let y = room.y; y < room.y + room.height; y++) {
      for (let x = room.x; x < room.x + room.width; x++) {
        if (y >= 0 && y < DUNGEON_HEIGHT && x >= 0 && x < DUNGEON_WIDTH) {
          this.dungeon[y][x] = 0; // 0 = floor
        }
      }
    }
  }

  private connectRooms(roomA: DungeonRoom, roomB: DungeonRoom): void {
    let x = roomA.centerX;
    let y = roomA.centerY;

    // Horizontal corridor (3 tiles tall for clearance)
    while (x !== roomB.centerX) {
      for (let dy = -1; dy <= 1; dy++) {
        const cy = y + dy;
        if (cy >= 0 && cy < DUNGEON_HEIGHT && x >= 0 && x < DUNGEON_WIDTH) {
          this.dungeon[cy][x] = 0;
        }
      }
      x += x < roomB.centerX ? 1 : -1;
    }

    // Vertical corridor (3 tiles wide for clearance)
    while (y !== roomB.centerY) {
      for (let dx = -1; dx <= 1; dx++) {
        const cx = x + dx;
        if (y >= 0 && y < DUNGEON_HEIGHT && cx >= 0 && cx < DUNGEON_WIDTH) {
          this.dungeon[y][cx] = 0;
        }
      }
      y += y < roomB.centerY ? 1 : -1;
    }
  }

  private placeDoors(): void {
    // Skip room 0 (safe room with NPCs)
    for (let i = 1; i < this.rooms.length; i++) {
      const room = this.rooms[i];
      const isBossRoom = i === this.rooms.length - 1;
      const doorChance = isBossRoom ? 1.0 : 0.6;

      // Scan one tile OUTSIDE the room boundary to find corridor entries.
      // Group consecutive floor tiles into runs. Each run is a corridor
      // connecting to this room.
      const findEntryRuns = (
        length: number,
        outsideFn: (idx: number) => { x: number; y: number },
        insideFn: (idx: number) => { x: number; y: number }
      ): { x: number; y: number }[][] => {
        const runs: { x: number; y: number }[][] = [];
        let run: { x: number; y: number }[] = [];

        for (let idx = 0; idx < length; idx++) {
          const out = outsideFn(idx);
          const inn = insideFn(idx);
          if (out.x >= 0 && out.x < DUNGEON_WIDTH && out.y >= 0 && out.y < DUNGEON_HEIGHT &&
              this.dungeon[out.y][out.x] === 0 && this.dungeon[inn.y][inn.x] === 0) {
            run.push(out);
          } else {
            if (run.length > 0) { runs.push(run); run = []; }
          }
        }
        if (run.length > 0) runs.push(run);
        return runs;
      };

      const allRuns: { x: number; y: number }[][] = [];

      // Top edge — outside is y = room.y - 1
      allRuns.push(...findEntryRuns(room.width,
        (dx) => ({ x: room.x + dx, y: room.y - 1 }),
        (dx) => ({ x: room.x + dx, y: room.y })
      ));
      // Bottom edge — outside is y = room.y + room.height
      allRuns.push(...findEntryRuns(room.width,
        (dx) => ({ x: room.x + dx, y: room.y + room.height }),
        (dx) => ({ x: room.x + dx, y: room.y + room.height - 1 })
      ));
      // Left edge — outside is x = room.x - 1
      allRuns.push(...findEntryRuns(room.height,
        (dy) => ({ x: room.x - 1, y: room.y + dy }),
        (dy) => ({ x: room.x, y: room.y + dy })
      ));
      // Right edge — outside is x = room.x + room.width
      allRuns.push(...findEntryRuns(room.height,
        (dy) => ({ x: room.x + room.width, y: room.y + dy }),
        (dy) => ({ x: room.x + room.width - 1, y: room.y + dy })
      ));

      for (const run of allRuns) {
        // Only handle normal corridor widths (1-3 tiles).
        // Wider openings are room overlaps or merged corridors — skip.
        if (run.length === 0 || run.length > 3) continue;
        if (Math.random() > doorChance) continue;

        const midIdx = Math.floor(run.length / 2);
        const doorPos = run[midIdx];

        // Don't place a door if there's already one nearby (prevents clusters)
        let nearbyDoor = false;
        for (let dy = -3; dy <= 3 && !nearbyDoor; dy++) {
          for (let dx = -3; dx <= 3 && !nearbyDoor; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = doorPos.x + dx;
            const ny = doorPos.y + dy;
            if (nx >= 0 && nx < DUNGEON_WIDTH && ny >= 0 && ny < DUNGEON_HEIGHT &&
                this.dungeon[ny][nx] === 2) {
              nearbyDoor = true;
            }
          }
        }
        if (nearbyDoor) continue;

        // Place door at center of the run (in the corridor, outside the room)
        this.dungeon[doorPos.y][doorPos.x] = 2;

        // Convert flanking tiles to walls to create a doorframe
        // (narrows the corridor to 1 tile at this point)
        for (let j = 0; j < run.length; j++) {
          if (j === midIdx) continue;
          this.dungeon[run[j].y][run[j].x] = 1;
        }
      }
    }
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
        } else if (tile === 2) {
          // Closed door — floor underneath + door sprite
          const floor = this.add.image(worldX, worldY, 'floor_plain');
          floor.setScale(SCALE);
          floor.setOrigin(0);
          floor.setDepth(0);
          this.floors.add(floor);

          // Door sprite is 32x32 (already matches scaled tile size) — no setScale needed
          const door = this.physics.add.staticImage(worldX + scaledTile / 2, worldY + scaledTile / 2, 'door_closed');
          door.setDepth(1);
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
    const spacing = 40;

    npcIds.forEach((npcId, index) => {
      const npcData = NPCS[npcId];
      const offsetX = (index - 1) * spacing;
      const npc = new NPC(
        this,
        safeRoom.centerX * TILE_SIZE * SCALE + offsetX,
        (safeRoom.centerY - 1) * TILE_SIZE * SCALE,
        npcData
      );
      this.npcs.add(npc);
    });
  }

  private spawnMonsters(): void {
    const monsterTypes = Object.keys(MONSTERS);

    // Skip first room (safe room with NPCs)
    for (let i = 1; i < this.rooms.length; i++) {
      const room = this.rooms[i];
      const monsterCount = Phaser.Math.Between(2, 4);

      for (let j = 0; j < monsterCount; j++) {
        const monsterType = i === this.rooms.length - 1 && j === 0
          ? 'monster_demon' // Boss in last room
          : Phaser.Utils.Array.GetRandom(monsterTypes.filter(t => t !== 'monster_demon'));

        const monsterData = MONSTERS[monsterType];
        const spawnX = Phaser.Math.Between(room.x + 1, room.x + room.width - 2) * TILE_SIZE * SCALE;
        const spawnY = Phaser.Math.Between(room.y + 1, room.y + room.height - 2) * TILE_SIZE * SCALE;

        const monster = new Monster(this, spawnX, spawnY, monsterData);
        monster.setTarget(this.player);
        this.monsters.add(monster);
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
      this.monsters.add(monster);
    }
  }

  private setupEventListeners(): void {
    // Player attack
    this.events.on('player-attack', (attackData: { x: number; y: number; width: number; height: number; damage: { damage: number; isCritical: boolean } }) => {
      const attackRect = new Phaser.Geom.Rectangle(
        attackData.x - attackData.width / 2,
        attackData.y - attackData.height / 2,
        attackData.width,
        attackData.height
      );

      this.monsters.getChildren().forEach((monster) => {
        const m = monster as Monster;
        if (!m.active) return;

        const monsterRect = m.getBounds();
        if (Phaser.Geom.Rectangle.Overlaps(attackRect, monsterRect)) {
          m.takeDamage(attackData.damage.damage, attackData.damage.isCritical);
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
        const result = this.player.combat.calculateMonsterDamage(
          data.damage,
          this.player.inventory.getTotalDefense()
        );
        this.player.takeDamage(result.damage);
      }
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

      // Check door interaction
      const scaledTile = TILE_SIZE * SCALE;
      for (const [key, door] of this.doorSprites) {
        const dist = Phaser.Math.Distance.Between(interactPoint.x, interactPoint.y, door.x, door.y);
        if (dist <= INTERACTION_DISTANCE) {
          const [tx, ty] = key.split(',').map(Number);
          this.openDoor(tx, ty);
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
    this.events.on(EVENTS.OPEN_SHOP, (npcData: NPCData) => {
      this.pauseGame();
      this.scene.launch(SCENE_KEYS.SHOP, {
        npcData,
        inventory: this.player.inventory,
        playerGold: { current: this.player.gold },
        player: this.player
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

  getDungeon(): number[][] { return this.dungeon; }
  getRooms(): DungeonRoom[] { return this.rooms; }
  getPlayer(): Player { return this.player; }
  getNPCs(): Phaser.GameObjects.Group { return this.npcs; }
  getMonsters(): Phaser.GameObjects.Group { return this.monsters; }

  private openDoor(tileX: number, tileY: number): void {
    const key = `${tileX},${tileY}`;
    const door = this.doorSprites.get(key);
    if (!door) return;

    // Update dungeon grid
    this.dungeon[tileY][tileX] = 3; // 3 = open door

    // Remove door sprite and physics body
    this.doors.remove(door, true, true);
    this.doorSprites.delete(key);

    // Force fog of war recalculation to reveal behind the door
    this.fogSystem.forceRecalculate();
    const scaledTile = TILE_SIZE * SCALE;
    const playerTileX = Math.floor(this.player.x / scaledTile);
    const playerTileY = Math.floor(this.player.y / scaledTile);
    this.fogSystem.update(playerTileX, playerTileY);
    this.updateFogRendering();
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
