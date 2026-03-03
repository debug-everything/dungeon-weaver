import Phaser from 'phaser';
import { SCENE_KEYS, EVENTS, GAME_WIDTH, GAME_HEIGHT, TILE_SIZE, SCALE } from '../config/constants';
import type { Player } from '../entities/Player';
import type { DungeonRoom } from '../types';
import { MONSTERS } from '../data/monsters';

type CommandHandler = (args: string[]) => string;

export class TerminalScene extends Phaser.Scene {
  private inputText = '';
  private promptLabel!: Phaser.GameObjects.Text;
  private inputLabel!: Phaser.GameObjects.Text;
  private feedbackLabel!: Phaser.GameObjects.Text;
  private bg!: Phaser.GameObjects.Rectangle;
  private player!: Player;
  private rooms!: DungeonRoom[];
  private commands!: Record<string, CommandHandler>;

  constructor() {
    super({ key: SCENE_KEYS.TERMINAL });
  }

  init(data: { player: Player; rooms: DungeonRoom[] }): void {
    this.player = data.player;
    this.rooms = data.rooms;
    this.inputText = '';
  }

  create(): void {
    this.commands = {
      gold: (args) => {
        const amount = args.length > 0 ? parseInt(args[0], 10) : 100;
        if (isNaN(amount)) return 'Invalid amount';
        this.player.addGold(amount);
        return `+${amount} gold`;
      },
      home: () => {
        if (!this.rooms || this.rooms.length === 0) return 'No rooms';
        const room = this.rooms[0];
        const worldX = room.centerX * TILE_SIZE * SCALE;
        const worldY = room.centerY * TILE_SIZE * SCALE;
        this.player.setPosition(worldX, worldY);
        return 'Teleported home';
      },
      spawn: (args) => {
        const monsterId = args[0] ? `monster_${args[0]}` : '';
        const monsterData = MONSTERS[monsterId];
        if (!monsterData) {
          const ids = Object.keys(MONSTERS).map(k => k.replace('monster_', '')).join(', ');
          return `Unknown monster. Available: ${ids}`;
        }
        const count = args.length > 1 ? Math.min(parseInt(args[1], 10) || 1, 5) : 1;
        const gameScene = this.scene.get(SCENE_KEYS.GAME);
        gameScene.events.emit('debug-spawn-monster', { monsterData, count });
        return `Spawned ${count}x ${monsterData.name}`;
      },
      heal: () => {
        this.player.heal(this.player.maxHealth);
        return 'Fully healed';
      },
      xp: (args) => {
        const amount = args.length > 0 ? parseInt(args[0], 10) : 100;
        if (isNaN(amount)) return 'Invalid amount';
        this.player.addXP(amount);
        return `+${amount} XP`;
      },
      help: () => {
        return 'gold [n], home, spawn <id> [n], heal, xp [n]';
      }
    };

    const barHeight = 32;
    const y = GAME_HEIGHT - barHeight;

    this.bg = this.add.rectangle(GAME_WIDTH / 2, y + barHeight / 2, GAME_WIDTH, barHeight, 0x000000, 0.85);

    this.promptLabel = this.add.text(8, y + 8, '> ', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#aaaaaa'
    });

    this.inputLabel = this.add.text(24, y + 8, '', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#ffffff'
    });

    this.feedbackLabel = this.add.text(GAME_WIDTH - 8, y + 8, '', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#44ff44',
      align: 'right'
    }).setOrigin(1, 0);

    // Capture keyboard so game scene doesn't react
    this.input.keyboard!.on('keydown', this.onKeyDown, this);
  }

  private onKeyDown(event: KeyboardEvent): void {
    // Prevent game scene from getting these keys
    event.stopPropagation();

    if (event.key === 'Escape' || event.key === '`') {
      this.closeTerminal();
      return;
    }

    if (event.key === 'Enter') {
      this.executeCommand();
      return;
    }

    if (event.key === 'Backspace') {
      this.inputText = this.inputText.slice(0, -1);
      this.inputLabel.setText(this.inputText);
      return;
    }

    // Only accept printable single characters
    if (event.key.length === 1) {
      this.inputText += event.key;
      this.inputLabel.setText(this.inputText);
    }
  }

  private executeCommand(): void {
    const raw = this.inputText.trim();
    // Strip leading slash if present
    const cleaned = raw.startsWith('/') ? raw.slice(1) : raw;
    const parts = cleaned.split(/\s+/);
    const cmd = parts[0]?.toLowerCase();
    const args = parts.slice(1);

    if (!cmd || !this.commands[cmd]) {
      this.showFeedback(`Unknown: ${cmd || '(empty)'}`, '#ff4444');
      return;
    }

    const result = this.commands[cmd](args);
    this.showFeedback(result, '#44ff44');
  }

  private showFeedback(text: string, color: string): void {
    this.feedbackLabel.setText(text).setColor(color);
    this.inputLabel.setText('');
    this.inputText = '';

    this.time.delayedCall(600, () => {
      this.closeTerminal();
    });
  }

  private closeTerminal(): void {
    this.scene.get(SCENE_KEYS.GAME).events.emit(EVENTS.CLOSE_TERMINAL);
  }
}
