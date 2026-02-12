import Phaser from 'phaser';
import { SCENE_KEYS, GAME_WIDTH, GAME_HEIGHT, EVENTS } from '../config/constants';
import { NPCData, DialogNode, QuestDefinition, QuestState, DungeonRoom } from '../types';
import { QuestSystem } from '../systems/QuestSystem';
import { Player } from '../entities/Player';

interface QuestDialogData {
  npcData: NPCData;
  questId: string;
  questSystem: QuestSystem;
  player: Player;
  rooms?: DungeonRoom[];
}

interface ResponseOption {
  text: Phaser.GameObjects.Text;
  callback: () => void;
}

export class QuestDialogScene extends Phaser.Scene {
  private npcData!: NPCData;
  private questId!: string;
  private questSystem!: QuestSystem;
  private player!: Player;
  private questDef!: QuestDefinition;
  private questState!: QuestState;
  private rooms?: DungeonRoom[];

  private dialogNodes!: DialogNode[];
  private currentNode!: DialogNode;
  private contentContainer!: Phaser.GameObjects.Container;
  private turnedIn: boolean = false;

  private responseOptions: ResponseOption[] = [];
  private selectedIndex: number = 0;
  private isTerminalNode: boolean = false;
  private prevGamepadButtons: boolean[] = [];

  // Intro phase
  private introLines: string[] = [];
  private introIndex: number = 0;
  private inIntroMode: boolean = false;

  constructor() {
    super({ key: SCENE_KEYS.QUEST_DIALOG });
  }

  init(data: QuestDialogData): void {
    this.npcData = data.npcData;
    this.questId = data.questId;
    this.questSystem = data.questSystem;
    this.player = data.player;
    this.rooms = data.rooms;
    this.turnedIn = false;
  }

  create(): void {
    const def = this.questSystem.getQuestDefinition(this.questId);
    const state = this.questSystem.getQuestState(this.questId);
    if (!def || !state) {
      this.closeDialog();
      return;
    }
    this.questDef = def;
    this.questState = state;

    // Select dialog phase based on quest status
    switch (state.status) {
      case 'available':
        this.dialogNodes = def.dialog.offer;
        break;
      case 'active':
        this.dialogNodes = def.dialog.inProgress;
        break;
      case 'completed':
        this.dialogNodes = def.dialog.readyToTurnIn;
        break;
      case 'turned_in':
        this.dialogNodes = def.dialog.completed;
        break;
      default:
        this.dialogNodes = def.dialog.offer;
    }

    // Semi-transparent background
    const bg = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.7);
    bg.setInteractive();

    // Dialog panel
    const panelWidth = 500;
    const panelHeight = 320;
    const panelX = GAME_WIDTH / 2;
    const panelY = GAME_HEIGHT / 2;

    const panel = this.add.rectangle(panelX, panelY, panelWidth, panelHeight, 0x2a2a4a, 0.95);
    panel.setStrokeStyle(2, 0x4a4a6a);

    // Title bar with NPC name + quest name
    this.add.text(panelX - panelWidth / 2 + 20, panelY - panelHeight / 2 + 18, this.npcData.name, {
      fontSize: '16px',
      fontFamily: 'monospace',
      color: '#c9a227'
    }).setOrigin(0, 0.5);

    this.add.text(panelX + panelWidth / 2 - 50, panelY - panelHeight / 2 + 18, `[${def.name}]`, {
      fontSize: '10px',
      fontFamily: 'monospace',
      color: '#888888'
    }).setOrigin(1, 0.5);

    // Close button
    const closeBtn = this.add.text(panelX + panelWidth / 2 - 20, panelY - panelHeight / 2 + 18, 'X', {
      fontSize: '18px',
      fontFamily: 'monospace',
      color: '#ff6666'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    closeBtn.on('pointerover', () => closeBtn.setColor('#ff0000'));
    closeBtn.on('pointerout', () => closeBtn.setColor('#ff6666'));
    closeBtn.on('pointerdown', () => this.closeDialog());

    // Separator
    const sepY = panelY - panelHeight / 2 + 36;
    const sepLine = this.add.graphics();
    sepLine.lineStyle(1, 0x4a4a6a);
    sepLine.lineBetween(panelX - panelWidth / 2 + 10, sepY, panelX + panelWidth / 2 - 10, sepY);

    // Content container (will be rebuilt when navigating dialog nodes)
    this.contentContainer = this.add.container(0, 0);

    // If quest is available and has intro lines, show intro first
    if (state.status === 'available' && def.intro && def.intro.length > 0) {
      this.introLines = [...def.intro];
      this.introIndex = 0;
      this.inIntroMode = true;
      this.showIntroLine();
    } else {
      this.inIntroMode = false;
      this.showNode(this.dialogNodes[0].id);
    }

    // Keyboard navigation
    this.input.keyboard?.on('keydown-UP', () => this.moveSelection(-1));
    this.input.keyboard?.on('keydown-W', () => this.moveSelection(-1));
    this.input.keyboard?.on('keydown-DOWN', () => this.moveSelection(1));
    this.input.keyboard?.on('keydown-S', () => this.moveSelection(1));
    this.input.keyboard?.on('keydown-ENTER', () => this.activateSelection());
    this.input.keyboard?.on('keydown-SPACE', () => this.activateSelection());
    this.input.keyboard?.on('keydown-ESC', () => this.closeDialog());
  }

  update(): void {
    const pad = this.input.gamepad?.getPad(0);
    if (!pad) return;
    const prev = this.prevGamepadButtons;
    const justDown = (i: number) => (pad.buttons[i]?.pressed ?? false) && !(prev[i] ?? false);

    if (justDown(12)) this.moveSelection(-1);  // D-pad up
    if (justDown(13)) this.moveSelection(1);   // D-pad down
    if (justDown(0)) this.activateSelection(); // A button
    if (justDown(1)) this.closeDialog();       // B button

    this.prevGamepadButtons = pad.buttons.map(b => b.pressed);
  }

  private moveSelection(delta: number): void {
    if (this.responseOptions.length === 0) return;
    this.selectedIndex = (this.selectedIndex + delta + this.responseOptions.length) % this.responseOptions.length;
    this.updateSelection();
  }

  private activateSelection(): void {
    if (this.isTerminalNode) {
      this.closeDialog();
      return;
    }
    if (this.responseOptions.length === 0) return;
    this.responseOptions[this.selectedIndex].callback();
  }

  private updateSelection(): void {
    this.responseOptions.forEach((opt, i) => {
      if (i === this.selectedIndex) {
        opt.text.setColor('#ffdd55');
      } else {
        opt.text.setColor('#aaaaff');
      }
    });
  }

  private showIntroLine(): void {
    this.contentContainer.removeAll(true);
    this.responseOptions = [];
    this.selectedIndex = 0;
    this.isTerminalNode = false;

    const panelWidth = 500;
    const panelHeight = 320;
    const panelX = GAME_WIDTH / 2;
    const panelY = GAME_HEIGHT / 2;
    const contentX = panelX - panelWidth / 2 + 20;
    const contentTop = panelY - panelHeight / 2 + 50;

    const line = this.introLines[this.introIndex];
    const dialogText = this.add.text(contentX, contentTop, `"${line}"`, {
      fontSize: '12px',
      fontFamily: 'monospace',
      color: '#dddddd',
      wordWrap: { width: panelWidth - 40 },
      lineSpacing: 4
    });
    this.contentContainer.add(dialogText);

    const textHeight = dialogText.height;
    let responseY = contentTop + textHeight + 24;
    const isLastLine = this.introIndex >= this.introLines.length - 1;

    // "Continue listening..." option
    const continueLabel = isLastLine ? 'Hear the offer...' : 'Continue listening...';
    const continueText = this.add.text(contentX + 10, responseY, `> ${continueLabel}`, {
      fontSize: '11px',
      fontFamily: 'monospace',
      color: '#aaaaff',
      wordWrap: { width: panelWidth - 60 },
      lineSpacing: 2
    }).setInteractive({ useHandCursor: true });

    const continueCallback = () => {
      if (isLastLine) {
        // Transition to normal quest dialog
        this.inIntroMode = false;
        this.showNode(this.dialogNodes[0].id);
      } else {
        this.introIndex++;
        this.showIntroLine();
      }
    };
    this.responseOptions.push({ text: continueText, callback: continueCallback });
    continueText.on('pointerover', () => { this.selectedIndex = 0; this.updateSelection(); });
    continueText.on('pointerout', () => continueText.setColor('#aaaaff'));
    continueText.on('pointerdown', continueCallback);
    this.contentContainer.add(continueText);
    responseY += continueText.height + 10;

    // "Leave conversation" option
    const leaveText = this.add.text(contentX + 10, responseY, '> Leave conversation', {
      fontSize: '11px',
      fontFamily: 'monospace',
      color: '#aaaaff',
      wordWrap: { width: panelWidth - 60 },
      lineSpacing: 2
    }).setInteractive({ useHandCursor: true });

    const leaveCallback = () => this.closeDialog();
    this.responseOptions.push({ text: leaveText, callback: leaveCallback });
    leaveText.on('pointerover', () => { this.selectedIndex = 1; this.updateSelection(); });
    leaveText.on('pointerout', () => leaveText.setColor('#aaaaff'));
    leaveText.on('pointerdown', leaveCallback);
    this.contentContainer.add(leaveText);

    this.updateSelection();
  }

  private showNode(nodeId: string): void {
    this.contentContainer.removeAll(true);
    this.responseOptions = [];
    this.selectedIndex = 0;
    this.isTerminalNode = false;

    const node = this.dialogNodes.find(n => n.id === nodeId);
    if (!node) {
      this.closeDialog();
      return;
    }
    this.currentNode = node;

    const panelWidth = 500;
    const panelHeight = 320;
    const panelX = GAME_WIDTH / 2;
    const panelY = GAME_HEIGHT / 2;
    const contentX = panelX - panelWidth / 2 + 20;
    const contentTop = panelY - panelHeight / 2 + 50;

    // NPC dialog text
    const dialogText = this.add.text(contentX, contentTop, `"${node.text}"`, {
      fontSize: '12px',
      fontFamily: 'monospace',
      color: '#dddddd',
      wordWrap: { width: panelWidth - 40 },
      lineSpacing: 4
    });
    this.contentContainer.add(dialogText);

    // Measure text height for response positioning
    const textHeight = dialogText.height;
    let responseY = contentTop + textHeight + 24;

    if (node.responses && node.responses.length > 0) {
      // Show player response options
      node.responses.forEach((response, index) => {
        const respText = this.add.text(contentX + 10, responseY, `> ${response.text}`, {
          fontSize: '11px',
          fontFamily: 'monospace',
          color: '#aaaaff',
          wordWrap: { width: panelWidth - 60 },
          lineSpacing: 2
        }).setInteractive({ useHandCursor: true });

        const callback = () => this.handleResponse(response.nextNodeId, response.action);
        this.responseOptions.push({ text: respText, callback });

        respText.on('pointerover', () => {
          this.selectedIndex = index;
          this.updateSelection();
        });
        respText.on('pointerout', () => respText.setColor('#aaaaff'));
        respText.on('pointerdown', callback);

        this.contentContainer.add(respText);
        responseY += respText.height + 10;
      });

      // Highlight initial selection
      this.updateSelection();
    } else {
      // Terminal node - show [Continue] button
      this.isTerminalNode = true;
      const continueBtn = this.add.text(panelX, panelY + panelHeight / 2 - 30, '[ Continue ]', {
        fontSize: '14px',
        fontFamily: 'monospace',
        color: '#88ff88',
        backgroundColor: '#2a2a4a',
        padding: { x: 12, y: 6 }
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });

      continueBtn.on('pointerover', () => continueBtn.setColor('#ccffcc'));
      continueBtn.on('pointerout', () => continueBtn.setColor('#88ff88'));
      continueBtn.on('pointerdown', () => this.closeDialog());

      this.contentContainer.add(continueBtn);
    }
  }

  private handleResponse(nextNodeId: string, action?: { type: string }): void {
    // Execute action before navigating
    if (action) {
      switch (action.type) {
        case 'accept_quest':
          this.questSystem.acceptQuest(this.questId, this.rooms);
          break;

        case 'decline_quest':
          // Just close after showing the response node
          break;

        case 'turn_in_quest':
          if (!this.turnedIn) {
            this.turnedIn = true;
            const rewards = this.questSystem.turnInQuest(this.questId, this.player.inventory);
            if (rewards) {
              this.applyRewards(rewards);
            }
          }
          break;

        case 'end_dialog':
          this.showNode(nextNodeId);
          return;
      }
    }

    this.showNode(nextNodeId);
  }

  private applyRewards(rewards: { xp: number; gold?: number; items?: { itemId: string; quantity: number }[] }): void {
    // Apply gold
    if (rewards.gold) {
      this.player.addGold(rewards.gold);
    }

    // Apply items
    if (rewards.items) {
      for (const item of rewards.items) {
        this.player.inventory.addItem(item.itemId, item.quantity);
      }
    }

    // XP stored for future leveling system (emit event for tracking)
    // For now, show a notification via the UI scene
    this.scene.get(SCENE_KEYS.GAME).events.emit(EVENTS.QUEST_TURNED_IN, this.questId, rewards);
  }

  private closeDialog(): void {
    this.scene.get(SCENE_KEYS.GAME).events.emit(EVENTS.CLOSE_QUEST_DIALOG);
    this.scene.stop();
  }
}
