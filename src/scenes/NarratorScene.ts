import Phaser from 'phaser';
import { SCENE_KEYS, GAME_WIDTH, GAME_HEIGHT, EVENTS } from '../config/constants';

export type NarratorStyle = 'narrator' | 'boss';

interface NarratorData {
  lines: string[];
  style: NarratorStyle;
}

const TYPEWRITER_CHAR_DELAY = 28;
const MIN_DISPLAY_TIME = 2000;
const PER_CHAR_DISPLAY_TIME = 45;

export class NarratorScene extends Phaser.Scene {
  private lines: string[] = [];
  private style: NarratorStyle = 'narrator';
  private currentLineIndex: number = 0;

  // UI elements
  private backdrop!: Phaser.GameObjects.Rectangle;
  private topBorder!: Phaser.GameObjects.Rectangle;
  private dialogText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;

  // Typewriter
  private typewriterTimer: Phaser.Time.TimerEvent | null = null;
  private typewriterFullText: string = '';
  private typewriterCharIndex: number = 0;
  private typewriterDone: boolean = true;

  // Auto-advance
  private autoAdvanceTimer: Phaser.Time.TimerEvent | null = null;

  // Input
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private enterKey!: Phaser.Input.Keyboard.Key;
  private prevGamepadA: boolean = false;

  constructor() {
    super({ key: SCENE_KEYS.NARRATOR });
  }

  init(data: NarratorData): void {
    this.lines = data.lines || [];
    this.style = data.style || 'narrator';
  }

  create(): void {
    // Reset all state (Phaser reuses scene instances)
    this.currentLineIndex = 0;
    this.typewriterFullText = '';
    this.typewriterCharIndex = 0;
    this.typewriterDone = true;
    this.prevGamepadA = false;

    if (this.typewriterTimer) {
      this.typewriterTimer.destroy();
      this.typewriterTimer = null;
    }
    if (this.autoAdvanceTimer) {
      this.autoAdvanceTimer.destroy();
      this.autoAdvanceTimer = null;
    }

    if (this.lines.length === 0) {
      this.closeScene();
      return;
    }

    const stripHeight = Math.floor(GAME_HEIGHT * 0.22);
    const stripY = GAME_HEIGHT - stripHeight;
    const borderColor = this.style === 'boss' ? 0xcc3333 : 0xd4a853;
    const textColor = this.style === 'boss' ? '#cc3333' : '#d4a853';
    const fontStyle = this.style === 'boss' ? 'bold' : 'italic';

    // Dark strip backdrop
    this.backdrop = this.add.rectangle(0, stripY, GAME_WIDTH, stripHeight, 0x000000, 0.82)
      .setOrigin(0, 0)
      .setDepth(200);

    // Colored top border
    this.topBorder = this.add.rectangle(0, stripY, GAME_WIDTH, 2, borderColor, 1)
      .setOrigin(0, 0)
      .setDepth(201);

    // Dialog text
    this.dialogText = this.add.text(GAME_WIDTH / 2, stripY + stripHeight / 2 - 8, '', {
      fontSize: '14px',
      fontFamily: 'monospace',
      fontStyle,
      color: textColor,
      wordWrap: { width: GAME_WIDTH - 80 },
      align: 'center',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5).setDepth(202);

    // [SPACE] hint
    this.hintText = this.add.text(GAME_WIDTH - 20, stripY + stripHeight - 14, '[SPACE]', {
      fontSize: '10px',
      fontFamily: 'monospace',
      color: '#888888'
    }).setOrigin(1, 1).setDepth(202).setAlpha(0);

    // Input keys
    this.spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.enterKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);

    // Start first line
    this.showLine(0);
  }

  private showLine(index: number): void {
    if (index >= this.lines.length) {
      this.closeScene();
      return;
    }

    this.currentLineIndex = index;
    this.hintText.setAlpha(0);

    // Clear any existing auto-advance
    if (this.autoAdvanceTimer) {
      this.autoAdvanceTimer.destroy();
      this.autoAdvanceTimer = null;
    }

    this.startTypewriter(this.lines[index]);
  }

  private startTypewriter(text: string): void {
    if (this.typewriterTimer) {
      this.typewriterTimer.destroy();
      this.typewriterTimer = null;
    }

    this.typewriterFullText = text;
    this.typewriterCharIndex = 0;
    this.typewriterDone = false;
    this.dialogText.setText('');

    this.typewriterTimer = this.time.addEvent({
      delay: TYPEWRITER_CHAR_DELAY,
      callback: () => {
        this.typewriterCharIndex++;
        this.dialogText.setText(this.typewriterFullText.substring(0, this.typewriterCharIndex));
        if (this.typewriterCharIndex >= this.typewriterFullText.length) {
          this.onTypewriterComplete();
        }
      },
      repeat: this.typewriterFullText.length - 1
    });
  }

  private onTypewriterComplete(): void {
    this.typewriterDone = true;
    if (this.typewriterTimer) {
      this.typewriterTimer.destroy();
      this.typewriterTimer = null;
    }

    // Show hint
    this.hintText.setAlpha(1);

    // Auto-advance timer
    const displayTime = Math.max(MIN_DISPLAY_TIME, this.typewriterFullText.length * PER_CHAR_DISPLAY_TIME);
    this.autoAdvanceTimer = this.time.delayedCall(displayTime, () => {
      this.advance();
    });
  }

  private completeTypewriter(): void {
    if (this.typewriterTimer) {
      this.typewriterTimer.destroy();
      this.typewriterTimer = null;
    }
    this.typewriterCharIndex = this.typewriterFullText.length;
    this.dialogText.setText(this.typewriterFullText);
    this.onTypewriterComplete();
  }

  private advance(): void {
    if (this.autoAdvanceTimer) {
      this.autoAdvanceTimer.destroy();
      this.autoAdvanceTimer = null;
    }
    this.showLine(this.currentLineIndex + 1);
  }

  private closeScene(): void {
    if (this.typewriterTimer) {
      this.typewriterTimer.destroy();
      this.typewriterTimer = null;
    }
    if (this.autoAdvanceTimer) {
      this.autoAdvanceTimer.destroy();
      this.autoAdvanceTimer = null;
    }

    // Notify GameScene
    const gameScene = this.scene.get(SCENE_KEYS.GAME);
    gameScene?.events.emit(EVENTS.CLOSE_NARRATOR);

    this.scene.stop();
  }

  update(): void {
    // Keyboard: SPACE or ENTER
    const spacePressed = Phaser.Input.Keyboard.JustDown(this.spaceKey);
    const enterPressed = Phaser.Input.Keyboard.JustDown(this.enterKey);

    // Gamepad: A button
    let gamepadAPressed = false;
    const pad = this.input.gamepad?.getPad(0);
    if (pad) {
      const aDown = pad.buttons[0]?.pressed ?? false;
      if (aDown && !this.prevGamepadA) gamepadAPressed = true;
      this.prevGamepadA = aDown;
    }

    if (spacePressed || enterPressed || gamepadAPressed) {
      if (!this.typewriterDone) {
        this.completeTypewriter();
      } else {
        this.advance();
      }
    }
  }
}
