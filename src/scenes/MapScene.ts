import Phaser from 'phaser';
import { SCENE_KEYS, GAME_WIDTH, GAME_HEIGHT, TILE_SIZE, SCALE, EVENTS } from '../config/constants';
import { FogOfWarSystem } from '../systems/FogOfWarSystem';
import { QuestSystem } from '../systems/QuestSystem';
import { QuestMapIndicator } from '../types';

interface MapNPC {
  x: number;
  y: number;
  name: string;
}

interface MapMonster {
  x: number;
  y: number;
  active: boolean;
}

interface MapSceneData {
  dungeon: number[][];
  rooms: { x: number; y: number; width: number; height: number; centerX: number; centerY: number }[];
  fogSystem: FogOfWarSystem;
  playerX: number;
  playerY: number;
  npcs: MapNPC[];
  monsters: MapMonster[];
  questSystem?: QuestSystem;
}

const MAP_TILE_SIZE = 12;

export class MapScene extends Phaser.Scene {
  private mapData!: MapSceneData;
  private playerDot!: Phaser.GameObjects.Arc;
  private prevGamepadButtons: boolean[] = [];

  constructor() {
    super({ key: SCENE_KEYS.MAP });
  }

  init(data: MapSceneData): void {
    this.mapData = data;
  }

  create(): void {
    // Semi-transparent dark background overlay
    const bg = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.85);
    bg.setInteractive();

    // Title
    this.add.text(GAME_WIDTH / 2, 25, 'DUNGEON MAP', {
      fontSize: '20px',
      fontFamily: 'monospace',
      color: '#c9a227'
    }).setOrigin(0.5);

    // Calculate map offset to center it
    const mapWidth = this.mapData.dungeon[0].length * MAP_TILE_SIZE;
    const mapHeight = this.mapData.dungeon.length * MAP_TILE_SIZE;
    const offsetX = (GAME_WIDTH - mapWidth) / 2;
    const offsetY = (GAME_HEIGHT - mapHeight) / 2 + 10;

    // Draw the map using Graphics
    const graphics = this.add.graphics();

    const { dungeon, fogSystem } = this.mapData;

    for (let y = 0; y < dungeon.length; y++) {
      for (let x = 0; x < dungeon[y].length; x++) {
        const visibility = fogSystem.getVisibility(x, y);
        if (visibility === 'hidden') continue;

        const drawX = offsetX + x * MAP_TILE_SIZE;
        const drawY = offsetY + y * MAP_TILE_SIZE;

        const tile = dungeon[y][x];
        if (tile === 0 || tile === 3) {
          // Floor or open door
          const color = visibility === 'visible' ? 0x555566 : 0x2a2a3a;
          graphics.fillStyle(color);
        } else if (tile === 2) {
          // Closed door — brown
          const color = visibility === 'visible' ? 0x8B4513 : 0x5a3010;
          graphics.fillStyle(color);
        } else if (tile === 4) {
          // Locked door — red-brown
          const color = visibility === 'visible' ? 0x8B0000 : 0x4a0000;
          graphics.fillStyle(color);
        } else {
          // Wall
          const color = visibility === 'visible' ? 0x777788 : 0x4a4a5a;
          graphics.fillStyle(color);
        }
        graphics.fillRect(drawX, drawY, MAP_TILE_SIZE - 1, MAP_TILE_SIZE - 1);
      }
    }

    // Draw NPCs - gold dots, only in explored/visible tiles
    const scaledTile = TILE_SIZE * SCALE;
    for (const npc of this.mapData.npcs) {
      const tileX = Math.floor(npc.x / scaledTile);
      const tileY = Math.floor(npc.y / scaledTile);
      const visibility = fogSystem.getVisibility(tileX, tileY);
      if (visibility === 'hidden') continue;

      const dotX = offsetX + tileX * MAP_TILE_SIZE + MAP_TILE_SIZE / 2;
      const dotY = offsetY + tileY * MAP_TILE_SIZE + MAP_TILE_SIZE / 2;
      graphics.fillStyle(0xc9a227);
      graphics.fillCircle(dotX, dotY, 3);
    }

    // Draw monsters - red dots, only in currently visible tiles
    for (const monster of this.mapData.monsters) {
      if (!monster.active) continue;
      const tileX = Math.floor(monster.x / scaledTile);
      const tileY = Math.floor(monster.y / scaledTile);
      const visibility = fogSystem.getVisibility(tileX, tileY);
      if (visibility !== 'visible') continue;

      const dotX = offsetX + tileX * MAP_TILE_SIZE + MAP_TILE_SIZE / 2;
      const dotY = offsetY + tileY * MAP_TILE_SIZE + MAP_TILE_SIZE / 2;
      graphics.fillStyle(0xff4444);
      graphics.fillCircle(dotX, dotY, 2.5);
    }

    // Draw quest indicators if quest system available
    if (this.mapData.questSystem) {
      this.drawQuestIndicators(graphics, offsetX, offsetY);
    }

    // Draw player position - green dot with pulsing tween
    const playerTileX = Math.floor(this.mapData.playerX / scaledTile);
    const playerTileY = Math.floor(this.mapData.playerY / scaledTile);
    const playerDotX = offsetX + playerTileX * MAP_TILE_SIZE + MAP_TILE_SIZE / 2;
    const playerDotY = offsetY + playerTileY * MAP_TILE_SIZE + MAP_TILE_SIZE / 2;

    this.playerDot = this.add.circle(playerDotX, playerDotY, 4, 0x00ff00);
    this.tweens.add({
      targets: this.playerDot,
      alpha: 0.3,
      duration: 600,
      yoyo: true,
      repeat: -1
    });

    // Legend
    const legendY = GAME_HEIGHT - 40;
    const legendItems = [
      { color: 0x00ff00, label: 'You' },
      { color: 0xc9a227, label: 'NPC' },
      { color: 0xff4444, label: 'Enemy' },
      { color: 0x8B4513, label: 'Door' },
      { color: 0x8B0000, label: 'Sealed' }
    ];
    const legendStartX = GAME_WIDTH / 2 - 175;

    legendItems.forEach((item, i) => {
      const lx = legendStartX + i * 80;
      graphics.fillStyle(item.color);
      graphics.fillCircle(lx, legendY, 4);
      this.add.text(lx + 10, legendY, item.label, {
        fontSize: '10px',
        fontFamily: 'monospace',
        color: '#aaaaaa'
      }).setOrigin(0, 0.5);
    });

    // Close hint
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 18, 'Press M or ESC to close', {
      fontSize: '10px',
      fontFamily: 'monospace',
      color: '#666666'
    }).setOrigin(0.5);

    // Close with M or ESC
    this.input.keyboard?.on('keydown-M', () => this.closeMap());
    this.input.keyboard?.on('keydown-ESC', () => this.closeMap());
  }

  update(): void {
    const pad = this.input.gamepad?.getPad(0);
    if (!pad) return;
    const prev = this.prevGamepadButtons;
    const justDown = (i: number) => (pad.buttons[i]?.pressed ?? false) && !(prev[i] ?? false);

    if (justDown(1) || justDown(8)) this.closeMap(); // B or Back/Select

    this.prevGamepadButtons = pad.buttons.map(b => b.pressed);
  }

  private drawQuestIndicators(graphics: Phaser.GameObjects.Graphics, offsetX: number, offsetY: number): void {
    const questSystem = this.mapData.questSystem!;
    const fogSystem = this.mapData.fogSystem;
    const activeQuests = questSystem.getActiveQuests();

    for (const { definition, state } of activeQuests) {
      if (state.status === 'turned_in') continue;

      const questState = state as { targetRoom?: { x: number; y: number; width: number; height: number } };
      if (!questState.targetRoom) continue;

      const room = questState.targetRoom;

      // Check if any tile in the room is explored or visible
      let roomVisible = false;
      let roomExplored = false;
      for (let ry = room.y; ry < room.y + room.height && !roomVisible; ry++) {
        for (let rx = room.x; rx < room.x + room.width && !roomVisible; rx++) {
          if (fogSystem.isVisible(rx, ry)) roomVisible = true;
          else if (fogSystem.isExplored(rx, ry)) roomExplored = true;
        }
      }

      if (roomVisible) {
        // Yellow dashed outline around target room
        graphics.lineStyle(2, 0xffff00, 0.8);
        const rx = offsetX + room.x * MAP_TILE_SIZE;
        const ry = offsetY + room.y * MAP_TILE_SIZE;
        const rw = room.width * MAP_TILE_SIZE;
        const rh = room.height * MAP_TILE_SIZE;
        graphics.strokeRect(rx, ry, rw, rh);
      } else if (roomExplored) {
        // Translucent circle at approximate room center
        const cx = offsetX + (room.x + room.width / 2) * MAP_TILE_SIZE;
        const cy = offsetY + (room.y + room.height / 2) * MAP_TILE_SIZE;
        graphics.fillStyle(0xffff00, 0.2);
        graphics.fillCircle(cx, cy, 15);
        graphics.lineStyle(1, 0xffff00, 0.5);
        graphics.strokeCircle(cx, cy, 15);
      }
      // hidden → no indicator shown
    }
  }

  private closeMap(): void {
    this.scene.get(SCENE_KEYS.GAME).events.emit(EVENTS.CLOSE_MAP);
    this.scene.stop();
  }
}
