import Phaser from 'phaser';
import { SCENE_KEYS, GAME_WIDTH, GAME_HEIGHT } from '../config/constants';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: SCENE_KEYS.MENU });
  }

  create(): void {
    // Background
    this.cameras.main.setBackgroundColor('#1a1a2e');

    // Title
    const title = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 3, 'DUNGEON RPG', {
      fontSize: '48px',
      fontFamily: 'monospace',
      color: '#c9a227',
      stroke: '#000000',
      strokeThickness: 6
    }).setOrigin(0.5);

    // Subtitle
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 3 + 50, 'A Top-Down Adventure', {
      fontSize: '16px',
      fontFamily: 'monospace',
      color: '#888888'
    }).setOrigin(0.5);

    // Start button
    const startButton = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 50, '[ START GAME ]', {
      fontSize: '24px',
      fontFamily: 'monospace',
      color: '#ffffff',
      backgroundColor: '#4a4a6a',
      padding: { x: 20, y: 10 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    startButton.on('pointerover', () => {
      startButton.setStyle({ color: '#c9a227' });
    });

    startButton.on('pointerout', () => {
      startButton.setStyle({ color: '#ffffff' });
    });

    startButton.on('pointerdown', () => {
      this.startGame();
    });

    // Controls info
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 100, 'Controls:', {
      fontSize: '14px',
      fontFamily: 'monospace',
      color: '#888888'
    }).setOrigin(0.5);

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 75, 'WASD / Arrows - Move | SPACE - Attack | I - Inventory | E - Interact', {
      fontSize: '12px',
      fontFamily: 'monospace',
      color: '#666666'
    }).setOrigin(0.5);

    // Animated title effect
    this.tweens.add({
      targets: title,
      y: title.y - 5,
      duration: 1500,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1
    });
  }

  private startGame(): void {
    this.scene.start(SCENE_KEYS.GAME);
    this.scene.start(SCENE_KEYS.UI);
  }
}
