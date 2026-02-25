import Phaser from 'phaser';
import { SCENE_KEYS, GAME_WIDTH, GAME_HEIGHT, EVENTS } from '../config/constants';
import { Player } from '../entities/Player';
import { launchOverlayTab, getNextTab, createTabBar, bindTabShortcuts } from '../systems/TabNavigation';
import type { PlayerStats } from '../types';

interface LevelUpSceneData {
  player: Player;
}

interface StatRowDef {
  key: keyof PlayerStats;
  name: string;
  effectText: (val: number) => string;
}

const STAT_ROWS: StatRowDef[] = [
  { key: 'strength', name: 'STR', effectText: (v) => `+${((v - 1) * 0.5).toFixed(1)} dmg` },
  { key: 'dexterity', name: 'DEX', effectText: (v) => `+${((v - 1) * 0.5).toFixed(1)}% crit` },
  { key: 'constitution', name: 'CON', effectText: (v) => `+${(v - 1) * 5} HP` },
  { key: 'luck', name: 'LCK', effectText: (v) => `+${((v - 1) * 2).toFixed(0)}% gold` },
  { key: 'intelligence', name: 'INT', effectText: () => `(future: mana)` },
];

export class LevelUpScene extends Phaser.Scene {
  private player!: Player;
  private selectedRow: number = 0;
  private statValueTexts: Phaser.GameObjects.Text[] = [];
  private statEffectTexts: Phaser.GameObjects.Text[] = [];
  private plusButtons: Phaser.GameObjects.Text[] = [];
  private rowHighlights: Phaser.GameObjects.Rectangle[] = [];
  private pointsText!: Phaser.GameObjects.Text;
  private prevGamepadButtons: boolean[] = [];

  constructor() {
    super({ key: SCENE_KEYS.LEVEL_UP });
  }

  init(data: LevelUpSceneData): void {
    this.player = data.player;
  }

  create(): void {
    // Reset state
    this.selectedRow = 0;
    this.statValueTexts = [];
    this.statEffectTexts = [];
    this.plusButtons = [];
    this.rowHighlights = [];
    this.prevGamepadButtons = [];

    // Full-screen dark overlay
    const bg = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.7);
    bg.setInteractive();

    // --- Tab bar at top ---
    this.createTabBar();

    // Panel dimensions
    const panelW = 420;
    const panelH = 340;
    const panelX = GAME_WIDTH / 2;
    const panelY = GAME_HEIGHT / 2 + 10;

    // Panel background
    const panel = this.add.rectangle(panelX, panelY, panelW, panelH, 0x111111, 0.95);
    panel.setStrokeStyle(2, 0xc9a227);

    // Header
    this.add.text(panelX, panelY - panelH / 2 + 25, `Level ${this.player.level}`, {
      fontSize: '22px',
      fontFamily: 'monospace',
      color: '#ffd700',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5);

    // Stat points counter
    this.pointsText = this.add.text(panelX, panelY - panelH / 2 + 50, '', {
      fontSize: '14px',
      fontFamily: 'monospace',
      color: '#00ff88',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5);
    this.updatePointsText();

    // Stat rows
    const rowStartY = panelY - panelH / 2 + 85;
    const rowHeight = 36;
    const leftX = panelX - panelW / 2 + 30;

    for (let i = 0; i < STAT_ROWS.length; i++) {
      const row = STAT_ROWS[i];
      const rowY = rowStartY + i * rowHeight;

      // Row highlight (for keyboard/gamepad navigation)
      const highlight = this.add.rectangle(panelX, rowY, panelW - 20, rowHeight - 4, 0x334455, 0);
      highlight.setStrokeStyle(1, 0x6688aa, 0);
      this.rowHighlights.push(highlight);

      // Stat name
      this.add.text(leftX, rowY, row.name, {
        fontSize: '14px',
        fontFamily: 'monospace',
        color: '#c9a227'
      }).setOrigin(0, 0.5);

      // Stat value
      const valueText = this.add.text(leftX + 80, rowY, `${this.player.stats[row.key]}`, {
        fontSize: '16px',
        fontFamily: 'monospace',
        color: '#ffffff'
      }).setOrigin(0, 0.5);
      this.statValueTexts.push(valueText);

      // Plus button
      const plusBtn = this.add.text(leftX + 120, rowY, '[+]', {
        fontSize: '14px',
        fontFamily: 'monospace',
        color: this.player.statPoints > 0 ? '#00ff88' : '#555555'
      }).setOrigin(0, 0.5);
      plusBtn.setInteractive({ useHandCursor: true });
      plusBtn.on('pointerover', () => {
        this.selectedRow = i;
        this.updateRowHighlights();
        if (this.player.statPoints > 0) plusBtn.setColor('#88ffaa');
      });
      plusBtn.on('pointerout', () => {
        plusBtn.setColor(this.player.statPoints > 0 ? '#00ff88' : '#555555');
      });
      plusBtn.on('pointerdown', () => {
        this.allocateToRow(i);
      });
      this.plusButtons.push(plusBtn);

      // Effect text
      const effectText = this.add.text(leftX + 170, rowY, row.effectText(this.player.stats[row.key]), {
        fontSize: '10px',
        fontFamily: 'monospace',
        color: '#888888'
      }).setOrigin(0, 0.5);
      this.statEffectTexts.push(effectText);
    }

    this.updateRowHighlights();

    // Done button
    const doneBtn = this.add.text(panelX, panelY + panelH / 2 - 30, '[ Done ]', {
      fontSize: '16px',
      fontFamily: 'monospace',
      color: '#aaaaaa',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5);
    doneBtn.setInteractive({ useHandCursor: true });
    doneBtn.on('pointerover', () => doneBtn.setColor('#ffffff'));
    doneBtn.on('pointerout', () => doneBtn.setColor('#aaaaaa'));
    doneBtn.on('pointerdown', () => this.closeScene());

    // Keyboard hint
    this.add.text(panelX, panelY + panelH / 2 - 10, '1-5: allocate  |  ESC/L: close  |  TAB: switch', {
      fontSize: '8px',
      fontFamily: 'monospace',
      color: '#555555'
    }).setOrigin(0.5);

    // Keyboard input
    if (this.input.keyboard) {
      this.input.keyboard.on('keydown-ONE', () => this.allocateToRow(0));
      this.input.keyboard.on('keydown-TWO', () => this.allocateToRow(1));
      this.input.keyboard.on('keydown-THREE', () => this.allocateToRow(2));
      this.input.keyboard.on('keydown-FOUR', () => this.allocateToRow(3));
      this.input.keyboard.on('keydown-FIVE', () => this.allocateToRow(4));
      this.input.keyboard.on('keydown-ESC', () => this.closeScene());
      bindTabShortcuts(this, 'LEVEL_UP', () => this.closeScene());
      this.input.keyboard.on('keydown-UP', () => this.moveSelection(-1));
      this.input.keyboard.on('keydown-DOWN', () => this.moveSelection(1));
      this.input.keyboard.on('keydown-ENTER', () => this.allocateToRow(this.selectedRow));
      this.input.keyboard.on('keydown-SPACE', () => this.allocateToRow(this.selectedRow));
      this.input.keyboard.on('keydown-TAB', (e: KeyboardEvent) => {
        e.preventDefault();
        this.switchToNextTab();
      });
    }
  }

  update(): void {
    // Gamepad support
    const pad = this.input.gamepad?.getPad(0);
    if (!pad) return;

    const aJustDown = pad.buttons[0]?.pressed && !(this.prevGamepadButtons[0] ?? false);
    const bJustDown = pad.buttons[1]?.pressed && !(this.prevGamepadButtons[1] ?? false);
    const upJustDown = pad.buttons[12]?.pressed && !(this.prevGamepadButtons[12] ?? false);
    const downJustDown = pad.buttons[13]?.pressed && !(this.prevGamepadButtons[13] ?? false);

    if (upJustDown) this.moveSelection(-1);
    if (downJustDown) this.moveSelection(1);
    if (aJustDown) this.allocateToRow(this.selectedRow);
    if (bJustDown) this.closeScene();

    this.prevGamepadButtons = pad.buttons.map(b => b.pressed);
  }

  private createTabBar(): void {
    createTabBar(this, 'LEVEL_UP', (tabKey) => launchOverlayTab(this, tabKey));
  }

  private switchToNextTab(): void {
    launchOverlayTab(this, getNextTab('LEVEL_UP'));
  }

  private allocateToRow(rowIndex: number): void {
    if (this.player.statPoints <= 0) return;
    const stat = STAT_ROWS[rowIndex].key;
    if (this.player.allocateStat(stat)) {
      this.statValueTexts[rowIndex].setText(`${this.player.stats[stat]}`);
      this.statEffectTexts[rowIndex].setText(STAT_ROWS[rowIndex].effectText(this.player.stats[stat]));
      this.updatePointsText();
      this.updatePlusButtonColors();

      // Flash the value
      this.tweens.add({
        targets: this.statValueTexts[rowIndex],
        scale: 1.4,
        duration: 100,
        yoyo: true
      });
    }
  }

  private moveSelection(delta: number): void {
    this.selectedRow = (this.selectedRow + delta + STAT_ROWS.length) % STAT_ROWS.length;
    this.updateRowHighlights();
  }

  private updateRowHighlights(): void {
    for (let i = 0; i < this.rowHighlights.length; i++) {
      const isSelected = i === this.selectedRow;
      this.rowHighlights[i].setFillStyle(0x334455, isSelected ? 0.5 : 0);
      this.rowHighlights[i].setStrokeStyle(1, 0x6688aa, isSelected ? 1 : 0);
    }
  }

  private updatePointsText(): void {
    if (this.player.statPoints > 0) {
      this.pointsText.setText(`Stat Points: ${this.player.statPoints}`);
      this.pointsText.setColor('#00ff88');
    } else {
      this.pointsText.setText('No points to allocate');
      this.pointsText.setColor('#666666');
    }
  }

  private updatePlusButtonColors(): void {
    const color = this.player.statPoints > 0 ? '#00ff88' : '#555555';
    for (const btn of this.plusButtons) {
      btn.setColor(color);
    }
  }

  private closeScene(): void {
    this.scene.get(SCENE_KEYS.GAME).events.emit(EVENTS.CLOSE_LEVEL_UP);
    this.scene.stop();
  }
}
