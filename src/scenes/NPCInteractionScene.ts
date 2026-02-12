import Phaser from 'phaser';
import { SCENE_KEYS, GAME_WIDTH, GAME_HEIGHT, EVENTS } from '../config/constants';
import { NPCData, QuestDefinition } from '../types';
import { QuestSystem } from '../systems/QuestSystem';
import { getAvailableQuests } from '../services/ApiClient';
import { registerMonsterVariant, registerItemVariant, injectQuestLoot } from '../systems/VariantRegistry';

interface NPCInteractionData {
  npcData: NPCData;
  questSystem: QuestSystem;
}

interface MenuOption {
  label: string;
  indicator?: string;
  callback: () => void;
  bg: Phaser.GameObjects.Rectangle;
  text: Phaser.GameObjects.Text;
}

export class NPCInteractionScene extends Phaser.Scene {
  private npcData!: NPCData;
  private questSystem!: QuestSystem;
  private menuItems: Phaser.GameObjects.Container[] = [];
  private options: MenuOption[] = [];
  private selectedIndex: number = 0;
  private prevGamepadButtons: boolean[] = [];

  constructor() {
    super({ key: SCENE_KEYS.NPC_INTERACTION });
  }

  init(data: NPCInteractionData): void {
    this.npcData = data.npcData;
    this.questSystem = data.questSystem;
  }

  create(): void {
    this.menuItems = [];
    this.options = [];
    this.selectedIndex = 0;
    this.prevGamepadButtons = [];

    // Semi-transparent background
    const bg = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.5);
    bg.setInteractive();
    bg.on('pointerdown', () => this.closeMenu());

    // Build menu options
    const optionDefs: { label: string; indicator?: string; callback: () => void }[] = [];

    // Talk option - always visible
    optionDefs.push({
      label: 'Talk',
      callback: () => this.handleTalk()
    });

    // Shop option - visible if NPC has shop inventory
    if (this.npcData.shopInventory && this.npcData.shopInventory.length > 0) {
      optionDefs.push({
        label: 'Shop',
        callback: () => this.handleShop()
      });
    }

    // Quest option - always visible so LLM quests can be discovered
    {
      let indicator: string | undefined;
      if (this.questSystem.hasQuestReadyToTurnIn(this.npcData.id)) {
        indicator = '?';
      } else if (this.questSystem.hasQuestAvailable(this.npcData.id)) {
        indicator = '!';
      }
      optionDefs.push({
        label: 'Quest',
        indicator,
        callback: () => this.handleQuest()
      });
    }

    // Panel dimensions
    const panelWidth = 200;
    const optionHeight = 40;
    const panelPadding = 16;
    const titleHeight = 40;
    const panelHeight = titleHeight + optionDefs.length * optionHeight + panelPadding;
    const panelX = GAME_WIDTH / 2;
    const panelY = GAME_HEIGHT / 2;

    // Panel background
    const panel = this.add.rectangle(panelX, panelY, panelWidth, panelHeight, 0x2a2a4a, 0.95);
    panel.setStrokeStyle(2, 0x4a4a6a);
    panel.setInteractive(); // Prevent click-through

    // NPC name title
    this.add.text(panelX, panelY - panelHeight / 2 + titleHeight / 2 + 4, this.npcData.name, {
      fontSize: '14px',
      fontFamily: 'monospace',
      color: '#c9a227'
    }).setOrigin(0.5);

    // Separator line
    const sepY = panelY - panelHeight / 2 + titleHeight;
    const sep = this.add.graphics();
    sep.lineStyle(1, 0x4a4a6a);
    sep.lineBetween(panelX - panelWidth / 2 + 10, sepY, panelX + panelWidth / 2 - 10, sepY);

    // Menu options
    optionDefs.forEach((option, index) => {
      const optY = panelY - panelHeight / 2 + titleHeight + optionHeight / 2 + index * optionHeight + 4;
      const container = this.add.container(panelX, optY);

      // Option background (for hover)
      const optBg = this.add.rectangle(0, 0, panelWidth - 16, optionHeight - 4, 0x3a3a5a, 0);
      optBg.setInteractive({ useHandCursor: true });

      // Arrow + label
      let labelText = `> ${option.label}`;
      if (option.indicator) {
        labelText += ` [${option.indicator}]`;
      }

      const label = this.add.text(-(panelWidth / 2) + 24, 0, labelText, {
        fontSize: '14px',
        fontFamily: 'monospace',
        color: '#ffffff'
      }).setOrigin(0, 0.5);

      // Color the indicator
      if (option.indicator) {
        if (option.indicator === '?') {
          label.setColor('#88ff88');
        }
      }

      container.add([optBg, label]);
      this.menuItems.push(container);
      this.options.push({ label: option.label, indicator: option.indicator, callback: option.callback, bg: optBg, text: label });

      optBg.on('pointerover', () => {
        this.selectedIndex = index;
        this.updateSelection();
      });
      optBg.on('pointerout', () => {
        optBg.setFillStyle(0x3a3a5a, 0);
        label.setColor(option.indicator === '?' ? '#88ff88' : '#ffffff');
      });
      optBg.on('pointerdown', () => option.callback());
    });

    // Highlight initial selection
    this.updateSelection();

    // Keyboard navigation
    this.input.keyboard?.on('keydown-UP', () => this.moveSelection(-1));
    this.input.keyboard?.on('keydown-W', () => this.moveSelection(-1));
    this.input.keyboard?.on('keydown-DOWN', () => this.moveSelection(1));
    this.input.keyboard?.on('keydown-S', () => this.moveSelection(1));
    this.input.keyboard?.on('keydown-ENTER', () => this.activateSelection());
    this.input.keyboard?.on('keydown-SPACE', () => this.activateSelection());
    this.input.keyboard?.on('keydown-ESC', () => this.closeMenu());
  }

  update(): void {
    const pad = this.input.gamepad?.getPad(0);
    if (!pad) return;
    const prev = this.prevGamepadButtons;
    const justDown = (i: number) => (pad.buttons[i]?.pressed ?? false) && !(prev[i] ?? false);

    if (justDown(12)) this.moveSelection(-1);  // D-pad up
    if (justDown(13)) this.moveSelection(1);   // D-pad down
    if (justDown(0)) this.activateSelection(); // A button
    if (justDown(1)) this.closeMenu();         // B button

    this.prevGamepadButtons = pad.buttons.map(b => b.pressed);
  }

  private moveSelection(delta: number): void {
    if (this.options.length === 0) return;
    this.selectedIndex = (this.selectedIndex + delta + this.options.length) % this.options.length;
    this.updateSelection();
  }

  private activateSelection(): void {
    if (this.options.length === 0) return;
    this.options[this.selectedIndex].callback();
  }

  private updateSelection(): void {
    this.options.forEach((opt, i) => {
      if (i === this.selectedIndex) {
        opt.bg.setFillStyle(0x5a5a7a, 1);
        opt.text.setColor('#ffdd55');
      } else {
        opt.bg.setFillStyle(0x3a3a5a, 0);
        opt.text.setColor(opt.indicator === '?' ? '#88ff88' : '#ffffff');
      }
    });
  }

  private handleTalk(): void {
    // Show random dialogue in a temporary text, then close
    const dialogue = Phaser.Utils.Array.GetRandom(this.npcData.dialogue);

    // Clear menu items
    this.menuItems.forEach(c => c.setVisible(false));

    const talkText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, `"${dialogue}"`, {
      fontSize: '12px',
      fontFamily: 'monospace',
      color: '#ffffff',
      backgroundColor: '#2a2a4a',
      padding: { x: 16, y: 12 },
      wordWrap: { width: 280 },
      align: 'center'
    }).setOrigin(0.5);

    // Auto-close after a delay
    this.time.delayedCall(2500, () => {
      this.closeMenu();
    });

    // Or click/key to close immediately
    talkText.setInteractive({ useHandCursor: true });
    talkText.on('pointerdown', () => this.closeMenu());
  }

  private handleShop(): void {
    this.scene.stop();
    this.scene.get(SCENE_KEYS.GAME).events.emit(EVENTS.OPEN_SHOP, this.npcData);
  }

  private async handleQuest(): Promise<void> {
    // Only fetch new LLM quests if the NPC has no active quest in progress
    if (!this.questSystem.hasActiveQuest(this.npcData.id)) try {
      const llmQuests = await getAvailableQuests(this.npcData.id) as QuestDefinition[];
      if (llmQuests.length > 0) {
        // Clear stale unaccepted LLM quests so fresh ones take priority
        this.questSystem.clearAvailableDynamicQuests(this.npcData.id);
      }
      for (const quest of llmQuests) {
        if (!this.questSystem.getQuestDefinition(quest.id)) {
          // Register any variant monsters/items before the quest itself
          if (quest.variants?.monsters) {
            for (const mv of quest.variants.monsters) {
              registerMonsterVariant(mv);
            }
          }
          if (quest.variants?.items) {
            for (const iv of quest.variants.items) {
              registerItemVariant(iv);
            }
          }
          this.questSystem.registerDynamicQuest(quest);
          injectQuestLoot(quest);
        }
      }
    } catch {
      // Backend unavailable — fall back to static quests only
    }

    const quest = this.questSystem.getMostActionableQuest(this.npcData.id);
    if (!quest) {
      this.showNoQuestsMessage();
      return;
    }

    this.scene.stop();
    this.scene.get(SCENE_KEYS.GAME).events.emit(EVENTS.OPEN_QUEST_DIALOG, {
      npcData: this.npcData,
      questId: quest.definition.id
    });
  }

  private showNoQuestsMessage(): void {
    this.menuItems.forEach(c => c.setVisible(false));

    const msg = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, '"I have no tasks for you right now. Check back later."', {
      fontSize: '12px',
      fontFamily: 'monospace',
      color: '#ffffff',
      backgroundColor: '#2a2a4a',
      padding: { x: 16, y: 12 },
      wordWrap: { width: 280 },
      align: 'center'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    msg.on('pointerdown', () => this.closeMenu());
    this.time.delayedCall(2500, () => this.closeMenu());
  }

  private closeMenu(): void {
    this.scene.get(SCENE_KEYS.GAME).events.emit(EVENTS.CLOSE_NPC_INTERACTION);
    this.scene.stop();
  }
}
