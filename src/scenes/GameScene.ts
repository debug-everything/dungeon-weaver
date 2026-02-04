import Phaser from 'phaser';
import { SCENE_KEYS, TILE_SIZE, SCALE, DUNGEON_WIDTH, DUNGEON_HEIGHT, EVENTS, INTERACTION_DISTANCE } from '../config/constants';
import { Player } from '../entities/Player';
import { Monster } from '../entities/Monster';
import { NPC } from '../entities/NPC';
import { DungeonRoom } from '../types';
import { MONSTERS } from '../data/monsters';
import { NPCS } from '../data/npcs';

export class GameScene extends Phaser.Scene {
  private player!: Player;
  private monsters!: Phaser.GameObjects.Group;
  private npcs!: Phaser.GameObjects.Group;
  private walls!: Phaser.Physics.Arcade.StaticGroup;
  private floors!: Phaser.GameObjects.Group;

  private dungeon: number[][] = [];
  private rooms: DungeonRoom[] = [];
  private isPaused: boolean = false;

  constructor() {
    super({ key: SCENE_KEYS.GAME });
  }

  create(): void {
    this.isPaused = false;

    // Initialize groups
    this.walls = this.physics.add.staticGroup();
    this.floors = this.add.group();
    this.monsters = this.add.group();
    this.npcs = this.add.group();

    // Generate dungeon
    this.generateDungeon();
    this.renderDungeon();

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
    this.physics.add.collider(this.monsters, this.walls);
    this.physics.add.collider(this.monsters, this.monsters);

    // Spawn NPCs in safe room (first room)
    this.spawnNPCs();

    // Spawn monsters in other rooms
    this.spawnMonsters();

    // Setup event listeners
    this.setupEventListeners();

    // Emit initial player state
    this.events.emit(EVENTS.PLAYER_HEALTH_CHANGED, this.player.health, this.player.maxHealth);
    this.events.emit(EVENTS.PLAYER_GOLD_CHANGED, this.player.gold);
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

    // Horizontal corridor
    while (x !== roomB.centerX) {
      if (y >= 0 && y < DUNGEON_HEIGHT && x >= 0 && x < DUNGEON_WIDTH) {
        this.dungeon[y][x] = 0;
      }
      x += x < roomB.centerX ? 1 : -1;
    }

    // Vertical corridor
    while (y !== roomB.centerY) {
      if (y >= 0 && y < DUNGEON_HEIGHT && x >= 0 && x < DUNGEON_WIDTH) {
        this.dungeon[y][x] = 0;
      }
      y += y < roomB.centerY ? 1 : -1;
    }
  }

  private renderDungeon(): void {
    const scaledTile = TILE_SIZE * SCALE;

    for (let y = 0; y < DUNGEON_HEIGHT; y++) {
      for (let x = 0; x < DUNGEON_WIDTH; x++) {
        const worldX = x * scaledTile;
        const worldY = y * scaledTile;

        if (this.dungeon[y][x] === 0) {
          // Floor tile with occasional variation
          const floorType = Math.random() < 0.9 ? 'floor_plain' :
                           Math.random() < 0.5 ? 'floor_stain_1' : 'floor_stain_2';
          const floor = this.add.image(worldX, worldY, floorType);
          floor.setScale(SCALE);
          floor.setOrigin(0);
          floor.setDepth(0);
          this.floors.add(floor);
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

      this.npcs.getChildren().forEach((npc) => {
        const n = npc as NPC;
        if (n.isInRange(interactPoint.x, interactPoint.y)) {
          n.interact();
        }
      });
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

    // Open shop
    this.events.on(EVENTS.OPEN_SHOP, (npcData: typeof NPCS[keyof typeof NPCS]) => {
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

    // Player died
    this.events.on('player-died', () => {
      this.cameras.main.fade(1000, 0, 0, 0);
      this.time.delayedCall(1500, () => {
        this.scene.stop(SCENE_KEYS.UI);
        this.scene.start(SCENE_KEYS.MENU);
      });
    });
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
