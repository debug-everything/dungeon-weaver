import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from './config/constants';
import { BootScene } from './scenes/BootScene';
import { MenuScene } from './scenes/MenuScene';
import { GameScene } from './scenes/GameScene';
import { UIScene } from './scenes/UIScene';
import { InventoryScene } from './scenes/InventoryScene';
import { ShopScene } from './scenes/ShopScene';
import { NPCInteractionScene } from './scenes/NPCInteractionScene';
import { QuestDialogScene } from './scenes/QuestDialogScene';
import { MapScene } from './scenes/MapScene';
import { QuestLogScene } from './scenes/QuestLogScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: 'game-container',
  pixelArt: true,
  input: {
    gamepad: true
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false
    }
  },
  scene: [BootScene, MenuScene, GameScene, UIScene, InventoryScene, ShopScene, NPCInteractionScene, QuestDialogScene, MapScene, QuestLogScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  }
};

new Phaser.Game(config);
