import Phaser from 'phaser';
import { SCENE_KEYS, GAME_WIDTH, GAME_HEIGHT } from '../config/constants';
import { listSaves, loadGame, deleteGame, regenerateIntro, SaveListItem } from '../services/ApiClient';

export class MenuScene extends Phaser.Scene {
  private saveListContainer!: Phaser.GameObjects.Container;
  private showingSaves: boolean = false;

  constructor() {
    super({ key: SCENE_KEYS.MENU });
  }

  create(): void {
    this.showingSaves = false;

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
    const startButton = this.createMenuButton(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 40, '[ NEW GAME ]', () => this.startGame());

    // Load Game button
    const loadButton = this.createMenuButton(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 90, '[ LOAD GAME ]', () => this.showLoadMenu());

    // Controls info
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 100, 'Controls:', {
      fontSize: '14px',
      fontFamily: 'monospace',
      color: '#888888'
    }).setOrigin(0.5);

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 75, 'WASD / Arrows - Move | SPACE - Attack | I - Inventory | E - Interact | M - Map', {
      fontSize: '11px',
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

    // Save list container (hidden initially)
    this.saveListContainer = this.add.container(0, 0);
    this.saveListContainer.setVisible(false);
  }

  private createMenuButton(x: number, y: number, label: string, callback: () => void): Phaser.GameObjects.Text {
    const btn = this.add.text(x, y, label, {
      fontSize: '20px',
      fontFamily: 'monospace',
      color: '#ffffff',
      backgroundColor: '#4a4a6a',
      padding: { x: 20, y: 8 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    btn.on('pointerover', () => btn.setStyle({ color: '#c9a227' }));
    btn.on('pointerout', () => btn.setStyle({ color: '#ffffff' }));
    btn.on('pointerdown', callback);
    return btn;
  }

  private async showLoadMenu(): Promise<void> {
    if (this.showingSaves) return;
    this.showingSaves = true;
    this.saveListContainer.removeAll(true);
    this.saveListContainer.setVisible(true);

    // Overlay background
    const bg = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 500, 350, 0x1a1a2e, 0.95);
    bg.setStrokeStyle(2, 0x4a4a6a);
    this.saveListContainer.add(bg);

    const titleText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 150, 'SAVED GAMES', {
      fontSize: '18px',
      fontFamily: 'monospace',
      color: '#c9a227'
    }).setOrigin(0.5);
    this.saveListContainer.add(titleText);

    // Close button
    const closeBtn = this.add.text(GAME_WIDTH / 2 + 220, GAME_HEIGHT / 2 - 155, 'X', {
      fontSize: '18px',
      fontFamily: 'monospace',
      color: '#ff6666'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => this.hideLoadMenu());
    this.saveListContainer.add(closeBtn);

    try {
      const saves = await listSaves();
      if (saves.length === 0) {
        const noSaves = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'No saved games found', {
          fontSize: '14px',
          fontFamily: 'monospace',
          color: '#888888'
        }).setOrigin(0.5);
        this.saveListContainer.add(noSaves);
      } else {
        saves.slice(0, 5).forEach((save, index) => {
          this.createSaveEntry(save, index);
        });
      }
    } catch {
      const errText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'Could not connect to server', {
        fontSize: '14px',
        fontFamily: 'monospace',
        color: '#ff6666'
      }).setOrigin(0.5);
      this.saveListContainer.add(errText);
    }

    this.input.keyboard?.once('keydown-ESC', () => this.hideLoadMenu());
  }

  private createSaveEntry(save: SaveListItem, index: number): void {
    const y = GAME_HEIGHT / 2 - 100 + index * 50;
    const date = new Date(save.updatedAt).toLocaleString();

    const entryBg = this.add.rectangle(GAME_WIDTH / 2, y, 450, 40, 0x3a3a5a);
    entryBg.setInteractive({ useHandCursor: true });
    this.saveListContainer.add(entryBg);

    const nameText = this.add.text(GAME_WIDTH / 2 - 200, y, `${save.playerName}`, {
      fontSize: '13px',
      fontFamily: 'monospace',
      color: '#ffffff'
    }).setOrigin(0, 0.5);
    this.saveListContainer.add(nameText);

    const dateText = this.add.text(GAME_WIDTH / 2 + 50, y, date, {
      fontSize: '10px',
      fontFamily: 'monospace',
      color: '#888888'
    }).setOrigin(0, 0.5);
    this.saveListContainer.add(dateText);

    // Load on click
    entryBg.on('pointerover', () => entryBg.setFillStyle(0x5a5a7a));
    entryBg.on('pointerout', () => entryBg.setFillStyle(0x3a3a5a));
    entryBg.on('pointerdown', () => this.loadSave(save.id));

    // Delete button
    const delBtn = this.add.text(GAME_WIDTH / 2 + 200, y, 'X', {
      fontSize: '14px',
      fontFamily: 'monospace',
      color: '#ff6666'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    delBtn.on('pointerdown', async (pointer: Phaser.Input.Pointer) => {
      pointer.event.stopPropagation();
      await deleteGame(save.id);
      this.hideLoadMenu();
      this.showLoadMenu();
    });
    this.saveListContainer.add(delBtn);
  }

  private async loadSave(id: string): Promise<void> {
    try {
      const save = await loadGame(id);
      this.scene.start(SCENE_KEYS.GAME, { loadedSave: save });
      this.scene.start(SCENE_KEYS.UI);
    } catch (err) {
      console.error('Failed to load save:', err);
    }
  }

  private hideLoadMenu(): void {
    this.showingSaves = false;
    this.saveListContainer.removeAll(true);
    this.saveListContainer.setVisible(false);
  }

  private startGame(): void {
    this.showLoadingScreen();
    this.fetchIntroAndStart();
  }

  private showLoadingScreen(): void {
    // Hide menu elements
    this.children.each(child => {
      if ('setVisible' in child) (child as unknown as { setVisible(v: boolean): void }).setVisible(false);
    });
    this.saveListContainer.setVisible(false);

    // Loading background
    this.cameras.main.setBackgroundColor('#0d0d1a');

    // Loading text
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 20, 'Preparing your adventure...', {
      fontSize: '18px',
      fontFamily: 'monospace',
      color: '#cc88ff',
      fontStyle: 'italic'
    }).setOrigin(0.5);

    // Animated dots
    const dots = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 20, '.', {
      fontSize: '24px',
      fontFamily: 'monospace',
      color: '#888888'
    }).setOrigin(0.5);

    let dotCount = 1;
    this.time.addEvent({
      delay: 400,
      loop: true,
      callback: () => {
        dotCount = (dotCount % 3) + 1;
        dots.setText('.'.repeat(dotCount));
      }
    });
  }

  private fetchIntroAndStart(): void {
    console.log('[MenuScene] Requesting fresh intro narration...');

    regenerateIntro().then(intro => {
      if (intro && intro.length > 0) {
        console.log('[MenuScene] Intro received: %d lines', intro.length);
        this.scene.start(SCENE_KEYS.GAME, { introLines: intro });
      } else {
        console.log('[MenuScene] No intro returned, starting game without intro');
        this.scene.start(SCENE_KEYS.GAME);
      }
      this.scene.start(SCENE_KEYS.UI);
    }).catch(err => {
      console.log('[MenuScene] Intro fetch failed:', err);
      this.scene.start(SCENE_KEYS.GAME);
      this.scene.start(SCENE_KEYS.UI);
    });
  }
}
