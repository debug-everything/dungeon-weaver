import Phaser from 'phaser';
import { SCENE_KEYS, GAME_WIDTH, GAME_HEIGHT, EVENTS } from '../config/constants';
import { launchOverlayTab, getNextTab, createTabBar, bindTabShortcuts } from '../systems/TabNavigation';
import { QuestSystem } from '../systems/QuestSystem';
import { StoryArcInfo } from '../types';
import { NPCS } from '../data/npcs';
import { getArcStatus } from '../services/ApiClient';

interface QuestLogSceneData {
  questSystem: QuestSystem;
}

export class QuestLogScene extends Phaser.Scene {
  private questSystem!: QuestSystem;
  private scrollOffset: number = 0;
  private contentHeight: number = 0;
  private contentContainer!: Phaser.GameObjects.Container;
  private prevGamepadButtons: boolean[] = [];

  constructor() {
    super({ key: SCENE_KEYS.QUEST_LOG });
  }

  init(data: QuestLogSceneData): void {
    this.questSystem = data.questSystem;
    this.scrollOffset = 0;
  }

  create(): void {
    // Semi-transparent dark background overlay
    const bg = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.85);
    bg.setInteractive();

    // Tab bar
    this.createTabBar();

    // Title
    this.add.text(GAME_WIDTH / 2, 38, 'QUEST LOG', {
      fontSize: '20px',
      fontFamily: 'monospace',
      color: '#c9a227'
    }).setOrigin(0.5);

    // Content area bounds
    const contentTop = 60;
    const contentBottom = GAME_HEIGHT - 35;
    const contentAreaHeight = contentBottom - contentTop;

    // Create a mask for scrollable content
    const maskShape = this.add.graphics();
    maskShape.setVisible(false);
    maskShape.fillRect(0, contentTop, GAME_WIDTH, contentAreaHeight);
    const mask = maskShape.createGeometryMask();

    // Scrollable content container
    this.contentContainer = this.add.container(0, contentTop);
    this.contentContainer.setMask(mask);

    // Fetch arc status, then build quest list
    this.fetchAndBuild();

    // Close hint
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 18, 'Press Q or ESC to close | Up/Down to scroll', {
      fontSize: '10px',
      fontFamily: 'monospace',
      color: '#666666'
    }).setOrigin(0.5);

    // ESC to close, Q/I/M/L to switch tabs
    this.input.keyboard?.on('keydown-ESC', () => this.closeQuestLog());
    this.input.keyboard?.on('keydown-TAB', (e: KeyboardEvent) => {
      e.preventDefault();
      this.switchToNextTab();
    });

    bindTabShortcuts(this, 'QUEST_LOG', () => this.closeQuestLog());

    // Scroll with arrow keys
    this.input.keyboard?.on('keydown-UP', () => this.scroll(-30));
    this.input.keyboard?.on('keydown-DOWN', () => this.scroll(30));
  }

  private async fetchAndBuild(): Promise<void> {
    let arcInfo: StoryArcInfo | null = null;
    try {
      const raw = await getArcStatus();
      if (raw && typeof raw === 'object' && 'id' in (raw as Record<string, unknown>)) {
        arcInfo = raw as StoryArcInfo;
      }
    } catch {
      // Backend unavailable — no arc info
    }

    this.buildQuestList(arcInfo);
  }

  private buildQuestList(arcInfo: StoryArcInfo | null): void {
    const activeQuests = this.questSystem.getActiveQuests();
    let yOffset = 0;
    const leftPadding = 30;

    // Arc progress header
    if (arcInfo && arcInfo.status === 'active') {
      const arcHeader = this.add.text(GAME_WIDTH / 2, yOffset, `Chapter: ${arcInfo.title}`, {
        fontSize: '13px',
        fontFamily: 'monospace',
        color: '#cc88ff',
        fontStyle: 'bold'
      }).setOrigin(0.5, 0);
      this.contentContainer.add(arcHeader);
      yOffset += 18;

      // Progress bar
      const barWidth = 200;
      const barHeight = 6;
      const barX = GAME_WIDTH / 2 - barWidth / 2;

      const progressBg = this.add.graphics();
      progressBg.fillStyle(0x333333);
      progressBg.fillRect(barX, yOffset, barWidth, barHeight);
      this.contentContainer.add(progressBg);

      const progress = arcInfo.currentQuestIndex / arcInfo.totalQuests;
      const progressFill = this.add.graphics();
      progressFill.fillStyle(0xcc88ff);
      progressFill.fillRect(barX, yOffset, barWidth * progress, barHeight);
      this.contentContainer.add(progressFill);

      const progressLabel = this.add.text(GAME_WIDTH / 2, yOffset + barHeight + 4,
        `Quest ${Math.min(arcInfo.currentQuestIndex + 1, arcInfo.totalQuests)} of ${arcInfo.totalQuests}`, {
        fontSize: '9px',
        fontFamily: 'monospace',
        color: '#998899'
      }).setOrigin(0.5, 0);
      this.contentContainer.add(progressLabel);
      yOffset += barHeight + 20;

      // Separator
      const sep = this.add.graphics();
      sep.lineStyle(1, 0x444444, 0.5);
      sep.lineBetween(leftPadding, yOffset, GAME_WIDTH - leftPadding, yOffset);
      this.contentContainer.add(sep);
      yOffset += 10;
    }

    if (activeQuests.length === 0) {
      const emptyText = this.add.text(GAME_WIDTH / 2, yOffset + 30, 'No active quests.', {
        fontSize: '14px',
        fontFamily: 'monospace',
        color: '#888888'
      }).setOrigin(0.5, 0);
      this.contentContainer.add(emptyText);
      return;
    }

    // Separate quests by status: completed first (ready to turn in), then active
    const completedQuests = activeQuests.filter(q => q.state.status === 'completed');
    const inProgressQuests = activeQuests.filter(q => q.state.status === 'active');

    // Completed quests (ready to turn in)
    if (completedQuests.length > 0) {
      const sectionHeader = this.add.text(leftPadding, yOffset, '-- Ready to Turn In --', {
        fontSize: '12px',
        fontFamily: 'monospace',
        color: '#88ff88'
      });
      this.contentContainer.add(sectionHeader);
      yOffset += 20;

      for (const { definition, state } of completedQuests) {
        yOffset = this.renderQuest(definition, state, yOffset, leftPadding, true);
      }
    }

    // Active quests (in progress)
    if (inProgressQuests.length > 0) {
      if (completedQuests.length > 0) yOffset += 10;

      const sectionHeader = this.add.text(leftPadding, yOffset, '-- In Progress --', {
        fontSize: '12px',
        fontFamily: 'monospace',
        color: '#c9a227'
      });
      this.contentContainer.add(sectionHeader);
      yOffset += 20;

      for (const { definition, state } of inProgressQuests) {
        yOffset = this.renderQuest(definition, state, yOffset, leftPadding, false);
      }
    }

    this.contentHeight = yOffset;
  }

  private renderQuest(
    definition: { name: string; npcId: string; description: string; objectives: { id: string; description: string; requiredCount: number }[] },
    state: { status: string; objectiveProgress: { objectiveId: string; currentCount: number; completed: boolean }[] },
    yOffset: number,
    leftPadding: number,
    isCompleted: boolean
  ): number {
    // Quest name
    const nameColor = isCompleted ? '#88ff88' : '#c9a227';
    const nameText = this.add.text(leftPadding, yOffset, definition.name, {
      fontSize: '13px',
      fontFamily: 'monospace',
      color: nameColor,
      fontStyle: 'bold'
    });
    this.contentContainer.add(nameText);
    yOffset += 18;

    // NPC name
    const npcData = NPCS[definition.npcId];
    const npcName = npcData ? npcData.name : definition.npcId;

    if (isCompleted) {
      const turnInText = this.add.text(leftPadding + 10, yOffset, `Return to ${npcName} for reward!`, {
        fontSize: '11px',
        fontFamily: 'monospace',
        color: '#88ff88'
      });
      this.contentContainer.add(turnInText);
      yOffset += 16;
    } else {
      const npcText = this.add.text(leftPadding + 10, yOffset, `From: ${npcName}`, {
        fontSize: '10px',
        fontFamily: 'monospace',
        color: '#999999'
      });
      this.contentContainer.add(npcText);
      yOffset += 14;

      // Quest description
      if (definition.description) {
        const descText = this.add.text(leftPadding + 10, yOffset, definition.description, {
          fontSize: '10px',
          fontFamily: 'monospace',
          color: '#aaaaaa',
          fontStyle: 'italic',
          wordWrap: { width: GAME_WIDTH - leftPadding * 2 - 20 }
        });
        this.contentContainer.add(descText);
        yOffset += descText.height + 6;
      }

      // Objectives
      for (const objProgress of state.objectiveProgress) {
        const objective = definition.objectives.find(o => o.id === objProgress.objectiveId);
        if (!objective) continue;

        const checkmark = objProgress.completed ? '[x]' : '[ ]';
        const objColor = objProgress.completed ? '#88ff88' : '#cccccc';
        const objText = this.add.text(leftPadding + 10, yOffset,
          `${checkmark} ${objective.description}: ${objProgress.currentCount}/${objective.requiredCount}`, {
          fontSize: '10px',
          fontFamily: 'monospace',
          color: objColor
        });
        this.contentContainer.add(objText);
        yOffset += 14;
      }
    }

    // Separator line
    yOffset += 8;
    const separator = this.add.graphics();
    separator.lineStyle(1, 0x444444, 0.5);
    separator.lineBetween(leftPadding, yOffset, GAME_WIDTH - leftPadding, yOffset);
    this.contentContainer.add(separator);
    yOffset += 10;

    return yOffset;
  }

  private scroll(amount: number): void {
    const contentTop = 50;
    const contentBottom = GAME_HEIGHT - 35;
    const viewHeight = contentBottom - contentTop;
    const maxScroll = Math.max(0, this.contentHeight - viewHeight);

    this.scrollOffset = Phaser.Math.Clamp(this.scrollOffset + amount, 0, maxScroll);
    this.contentContainer.setY(contentTop - this.scrollOffset);
  }

  update(): void {
    const pad = this.input.gamepad?.getPad(0);
    if (!pad) return;
    const prev = this.prevGamepadButtons;
    const justDown = (i: number) => (pad.buttons[i]?.pressed ?? false) && !(prev[i] ?? false);

    if (justDown(1) || justDown(8)) this.closeQuestLog(); // B or Back/Select

    // D-pad scroll
    if (pad.buttons[12]?.pressed) this.scroll(-3); // D-pad up
    if (pad.buttons[13]?.pressed) this.scroll(3);  // D-pad down

    this.prevGamepadButtons = pad.buttons.map(b => b.pressed);
  }

  private createTabBar(): void {
    createTabBar(this, 'QUEST_LOG', (tabKey) => launchOverlayTab(this, tabKey));
  }

  private switchToNextTab(): void {
    launchOverlayTab(this, getNextTab('QUEST_LOG'));
  }

  private closeQuestLog(): void {
    this.scene.get(SCENE_KEYS.GAME).events.emit(EVENTS.CLOSE_QUEST_LOG);
    this.scene.stop();
  }
}
