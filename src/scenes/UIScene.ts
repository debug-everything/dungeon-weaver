import Phaser from 'phaser';
import { SCENE_KEYS, GAME_WIDTH, GAME_HEIGHT, EVENTS, MAX_LEVEL, XP_PER_LEVEL } from '../config/constants';
import { Equipment, QuestReward } from '../types';
import { GameScene } from './GameScene';

export class UIScene extends Phaser.Scene {
  private healthBar!: Phaser.GameObjects.Graphics;
  private healthText!: Phaser.GameObjects.Text;
  private manaBar!: Phaser.GameObjects.Graphics;
  private manaText!: Phaser.GameObjects.Text;
  private goldText!: Phaser.GameObjects.Text;
  private weaponIcon!: Phaser.GameObjects.Image;
  private weaponText!: Phaser.GameObjects.Text;
  private spellbookIcon!: Phaser.GameObjects.Image;
  private spellbookText!: Phaser.GameObjects.Text;
  private _controlsText!: Phaser.GameObjects.Text;
  private questTrackerContainer!: Phaser.GameObjects.Container;

  // XP / Level HUD elements
  private levelText!: Phaser.GameObjects.Text;
  private xpBar!: Phaser.GameObjects.Graphics;
  private xpText!: Phaser.GameObjects.Text;
  private statPointsBadge!: Phaser.GameObjects.Text;
  private floorText!: Phaser.GameObjects.Text;
  private llmStatusText!: Phaser.GameObjects.Text;

  private currentHealth: number = 100;
  private maxHealth: number = 100;
  private currentMana: number = 50;
  private maxMana: number = 50;
  private currentLevel: number = 1;
  private currentXP: number = 0;
  private currentXPToNext: number = XP_PER_LEVEL[1];
  private gamepadConnected: boolean = false;

  constructor() {
    super({ key: SCENE_KEYS.UI });
  }

  create(): void {
    // Health bar background
    const healthBg = this.add.rectangle(20, 20, 204, 24, 0x333333);
    healthBg.setOrigin(0);
    healthBg.setStrokeStyle(2, 0x555555);

    // Health bar
    this.healthBar = this.add.graphics();
    this.updateHealthBar();

    // Health text
    this.healthText = this.add.text(122, 32, `${this.currentHealth}/${this.maxHealth}`, {
      fontSize: '12px',
      fontFamily: 'monospace',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5);

    // Heart icon
    this.add.text(8, 20, '❤', {
      fontSize: '20px'
    }).setOrigin(0, 0);

    // --- Mana bar (below health bar) ---
    const manaBg = this.add.rectangle(20, 48, 204, 16, 0x333333);
    manaBg.setOrigin(0);
    manaBg.setStrokeStyle(1, 0x555555);

    this.manaBar = this.add.graphics();
    this.updateManaBar();

    this.manaText = this.add.text(122, 56, `${Math.floor(this.currentMana)}/${this.maxMana}`, {
      fontSize: '10px',
      fontFamily: 'monospace',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5);

    // Mana icon
    this.add.text(8, 47, '💧', {
      fontSize: '14px'
    }).setOrigin(0, 0);

    // --- Level & XP bar (below mana bar) ---
    // Level badge
    this.levelText = this.add.text(20, 68, 'Lv.1', {
      fontSize: '11px',
      fontFamily: 'monospace',
      color: '#ffd700',
      stroke: '#000000',
      strokeThickness: 2
    });

    // Stat points badge (next to level, hidden when 0)
    this.statPointsBadge = this.add.text(60, 68, '', {
      fontSize: '10px',
      fontFamily: 'monospace',
      color: '#00ff88',
      stroke: '#000000',
      strokeThickness: 2
    });

    // XP bar background
    const xpBg = this.add.rectangle(20, 82, 204, 8, 0x222222);
    xpBg.setOrigin(0);
    xpBg.setStrokeStyle(1, 0x444444);

    // XP bar fill
    this.xpBar = this.add.graphics();
    this.updateXPBar();

    // XP text (right-aligned)
    this.xpText = this.add.text(224, 86, `0 / ${this.currentXPToNext}`, {
      fontSize: '8px',
      fontFamily: 'monospace',
      color: '#aaaaaa',
      stroke: '#000000',
      strokeThickness: 1
    }).setOrigin(1, 0.5);

    // Gold display
    const goldBg = this.add.rectangle(GAME_WIDTH - 20, 20, 120, 28, 0x333333, 0.8);
    goldBg.setOrigin(1, 0);
    goldBg.setStrokeStyle(1, 0x555555);

    this.goldText = this.add.text(GAME_WIDTH - 30, 34, '50', {
      fontSize: '16px',
      fontFamily: 'monospace',
      color: '#ffd700'
    }).setOrigin(1, 0.5);

    this.add.text(GAME_WIDTH - 115, 34, '💰', {
      fontSize: '16px'
    }).setOrigin(0, 0.5);

    // Floor indicator
    this.floorText = this.add.text(GAME_WIDTH - 30, 54, 'Floor 1', {
      fontSize: '12px',
      fontFamily: 'monospace',
      color: '#88bbff',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(1, 0);

    // LLM status indicator (bottom-right, near controls)
    this.llmStatusText = this.add.text(GAME_WIDTH - 10, GAME_HEIGHT - 30, '◆ AI', {
      fontSize: '9px',
      fontFamily: 'monospace',
      color: '#444444',
      stroke: '#000000',
      strokeThickness: 1
    }).setOrigin(1, 0.5);

    // Equipped weapon display
    const weaponBg = this.add.rectangle(20, GAME_HEIGHT - 60, 140, 50, 0x333333, 0.8);
    weaponBg.setOrigin(0);
    weaponBg.setStrokeStyle(1, 0x555555);

    this.weaponIcon = this.add.image(50, GAME_HEIGHT - 35, 'weapon_sword_wooden');
    this.weaponIcon.setScale(2);

    this.weaponText = this.add.text(80, GAME_HEIGHT - 35, 'Wooden Sword', {
      fontSize: '10px',
      fontFamily: 'monospace',
      color: '#c9a227'
    }).setOrigin(0, 0.5);

    // Equipped spellbook display (below weapon)
    const spellbookBg = this.add.rectangle(170, GAME_HEIGHT - 60, 120, 50, 0x333333, 0.8);
    spellbookBg.setOrigin(0);
    spellbookBg.setStrokeStyle(1, 0x4a4a6a);

    this.spellbookIcon = this.add.image(200, GAME_HEIGHT - 35, 'spell_fireball');
    this.spellbookIcon.setScale(2);
    this.spellbookIcon.setVisible(false);

    this.spellbookText = this.add.text(230, GAME_HEIGHT - 35, 'No Tome', {
      fontSize: '10px',
      fontFamily: 'monospace',
      color: '#6688cc'
    }).setOrigin(0, 0.5);

    // Quest tracker (below XP bar, shifted down)
    this.questTrackerContainer = this.add.container(20, 98);

    // Controls reminder
    this._controlsText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 15, 'WASD: Move | SPACE: Melee | ENTER: Cast Spell | SHIFT: Dodge | TAB: Menu | E: Interact', {
      fontSize: '9px',
      fontFamily: 'monospace',
      color: '#666666'
    }).setOrigin(0.5);

    // Listen for events from GameScene
    const gameScene = this.scene.get(SCENE_KEYS.GAME);

    gameScene.events.on(EVENTS.PLAYER_HEALTH_CHANGED, this.onHealthChanged, this);
    gameScene.events.on(EVENTS.PLAYER_MANA_CHANGED, this.onManaChanged, this);
    gameScene.events.on(EVENTS.PLAYER_GOLD_CHANGED, this.onGoldChanged, this);
    gameScene.events.on(EVENTS.PLAYER_EQUIPMENT_CHANGED, this.onEquipmentChanged, this);
    gameScene.events.on(EVENTS.MONSTER_KILLED, this.onMonsterKilled, this);
    gameScene.events.on(EVENTS.ITEM_PICKED_UP, this.onItemPickedUp, this);
    gameScene.events.on(EVENTS.QUEST_ACCEPTED, this.updateQuestTracker, this);
    gameScene.events.on(EVENTS.QUEST_PROGRESS_UPDATED, this.updateQuestTracker, this);
    gameScene.events.on(EVENTS.QUEST_TURNED_IN, this.onQuestTurnedIn, this);
    gameScene.events.on(EVENTS.XP_GAINED, this.onXPGained, this);
    gameScene.events.on(EVENTS.LEVEL_UP, this.onLevelUp, this);
    gameScene.events.on(EVENTS.STATS_CHANGED, this.onStatsChanged, this);
    gameScene.events.on(EVENTS.FLOOR_CHANGED, this.onFloorChanged, this);
    gameScene.events.on(EVENTS.LLM_STATUS_CHANGED, this.onLLMStatusChanged, this);

    // Clean up on scene shutdown
    this.events.on('shutdown', () => {
      gameScene.events.off(EVENTS.PLAYER_HEALTH_CHANGED, this.onHealthChanged, this);
      gameScene.events.off(EVENTS.PLAYER_MANA_CHANGED, this.onManaChanged, this);
      gameScene.events.off(EVENTS.PLAYER_GOLD_CHANGED, this.onGoldChanged, this);
      gameScene.events.off(EVENTS.PLAYER_EQUIPMENT_CHANGED, this.onEquipmentChanged, this);
      gameScene.events.off(EVENTS.MONSTER_KILLED, this.onMonsterKilled, this);
      gameScene.events.off(EVENTS.ITEM_PICKED_UP, this.onItemPickedUp, this);
      gameScene.events.off(EVENTS.QUEST_ACCEPTED, this.updateQuestTracker, this);
      gameScene.events.off(EVENTS.QUEST_PROGRESS_UPDATED, this.updateQuestTracker, this);
      gameScene.events.off(EVENTS.QUEST_TURNED_IN, this.onQuestTurnedIn, this);
      gameScene.events.off(EVENTS.XP_GAINED, this.onXPGained, this);
      gameScene.events.off(EVENTS.LEVEL_UP, this.onLevelUp, this);
      gameScene.events.off(EVENTS.STATS_CHANGED, this.onStatsChanged, this);
      gameScene.events.off(EVENTS.FLOOR_CHANGED, this.onFloorChanged, this);
      gameScene.events.off(EVENTS.LLM_STATUS_CHANGED, this.onLLMStatusChanged, this);
    });
  }

  update(): void {
    const hasGamepad = (this.input.gamepad?.total ?? 0) > 0;
    if (hasGamepad !== this.gamepadConnected) {
      this.gamepadConnected = hasGamepad;
      if (hasGamepad) {
        this._controlsText.setText('LS: Move | A: Melee (hold charge) | B: Dodge | X: Interact | Y: Inventory | Select: Map');
      } else {
        this._controlsText.setText('WASD: Move | SPACE: Melee | ENTER: Cast Spell | SHIFT: Dodge | TAB: Menu | E: Interact');
      }
    }
  }

  private updateHealthBar(): void {
    this.healthBar.clear();

    const healthPercent = this.currentHealth / this.maxHealth;
    const barWidth = 200 * healthPercent;

    // Choose color based on health percentage
    let color: number;
    if (healthPercent > 0.6) {
      color = 0x00ff00;
    } else if (healthPercent > 0.3) {
      color = 0xffff00;
    } else {
      color = 0xff0000;
    }

    this.healthBar.fillStyle(color);
    this.healthBar.fillRect(22, 22, barWidth, 20);
  }

  private updateManaBar(): void {
    this.manaBar.clear();
    const manaPercent = this.currentMana / this.maxMana;
    const barWidth = 200 * manaPercent;
    this.manaBar.fillStyle(0x4488ff);
    this.manaBar.fillRect(22, 50, barWidth, 12);
  }

  private updateXPBar(): void {
    this.xpBar.clear();

    if (this.currentLevel >= MAX_LEVEL) {
      // Full gold bar at max level
      this.xpBar.fillStyle(0xffd700);
      this.xpBar.fillRect(22, 83, 200, 6);
      return;
    }

    const prevThreshold = this.currentLevel > 1 ? XP_PER_LEVEL[this.currentLevel - 1] : 0;
    const nextThreshold = XP_PER_LEVEL[this.currentLevel];
    const range = nextThreshold - prevThreshold;
    const progress = range > 0 ? (this.currentXP - prevThreshold) / range : 0;
    const barWidth = 200 * Math.min(progress, 1);

    this.xpBar.fillStyle(0x6688ff);
    this.xpBar.fillRect(22, 83, barWidth, 6);
  }

  private onHealthChanged(health: number, maxHealth: number): void {
    this.currentHealth = health;
    this.maxHealth = maxHealth;
    this.updateHealthBar();
    this.healthText.setText(`${health}/${maxHealth}`);

    // Flash effect when taking damage
    if (health < this.currentHealth) {
      this.cameras.main.flash(100, 255, 0, 0, false);
    }
  }

  private onManaChanged(mana: number, maxMana: number): void {
    this.currentMana = mana;
    this.maxMana = maxMana;
    this.updateManaBar();
    this.manaText.setText(`${Math.floor(mana)}/${maxMana}`);
  }

  private onGoldChanged(gold: number): void {
    this.goldText.setText(`${gold}`);

    // Pop animation
    this.tweens.add({
      targets: this.goldText,
      scale: 1.3,
      duration: 100,
      yoyo: true
    });
  }

  private onEquipmentChanged(equipment: Equipment): void {
    if (equipment.weapon) {
      this.weaponIcon.setTexture(equipment.weapon.sprite);
      this.weaponIcon.setVisible(true);
      this.weaponText.setText(equipment.weapon.name);
    } else {
      this.weaponIcon.setVisible(false);
      this.weaponText.setText('No Weapon');
    }

    if (equipment.spellbook) {
      this.spellbookIcon.setTexture(equipment.spellbook.sprite);
      this.spellbookIcon.setVisible(true);
      this.spellbookText.setText(equipment.spellbook.name);
    } else {
      this.spellbookIcon.setVisible(false);
      this.spellbookText.setText('No Tome');
    }
  }

  private onMonsterKilled(): void {
    // Could show kill notification or update kill counter
  }

  private onItemPickedUp(itemId: string): void {
    // Show item pickup notification
    const notification = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 50, `Picked up: ${itemId.replace('_', ' ')}`, {
      fontSize: '14px',
      fontFamily: 'monospace',
      color: '#00ff00',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5);

    this.tweens.add({
      targets: notification,
      y: notification.y - 30,
      alpha: 0,
      duration: 1500,
      onComplete: () => notification.destroy()
    });
  }

  private onXPGained(xp: number, xpToNext: number, level: number): void {
    this.currentXP = xp;
    this.currentXPToNext = xpToNext;
    this.currentLevel = level;
    this.levelText.setText(`Lv.${level}`);

    this.updateXPBar();

    if (level >= MAX_LEVEL) {
      this.xpText.setText('MAX');
    } else {
      const prevThreshold = level > 1 ? XP_PER_LEVEL[level - 1] : 0;
      this.xpText.setText(`${xp - prevThreshold} / ${xpToNext - prevThreshold}`);
    }
  }

  private onLevelUp(newLevel: number, statPoints: number): void {
    this.currentLevel = newLevel;
    this.levelText.setText(`Lv.${newLevel}`);

    // Flash the level text gold
    this.tweens.add({
      targets: this.levelText,
      scale: 1.5,
      duration: 200,
      yoyo: true,
      ease: 'Bounce'
    });

    this.updateStatPointsBadge(statPoints);
  }

  private onStatsChanged(_stats: unknown, statPoints: number): void {
    this.updateStatPointsBadge(statPoints);
  }

  private updateStatPointsBadge(statPoints: number): void {
    if (statPoints > 0) {
      this.statPointsBadge.setText(`+${statPoints} ▲`);
      this.statPointsBadge.setVisible(true);
    } else {
      this.statPointsBadge.setVisible(false);
    }
  }

  private onFloorChanged(floor: number): void {
    this.floorText.setText(`Floor ${floor}`);
  }

  private onLLMStatusChanged(enabled: boolean): void {
    if (enabled) {
      this.llmStatusText.setText('✦ AI');
      this.llmStatusText.setColor('#44ddaa');
    } else {
      this.llmStatusText.setText('◇ AI');
      this.llmStatusText.setColor('#444444');
    }
  }

  private updateQuestTracker(): void {
    this.questTrackerContainer.removeAll(true);

    const gameScene = this.scene.get(SCENE_KEYS.GAME) as GameScene;
    const activeQuests = gameScene.questSystem.getActiveQuests();

    if (activeQuests.length === 0) return;

    let yOffset = 0;

    const arcQuestIds = gameScene.getArcQuestIds();

    for (const { definition, state } of activeQuests) {
      // Quest name — arc quests get purple + diamond prefix, side quests stay amber
      const isArc = arcQuestIds.has(definition.id);
      const statusColor = state.status === 'completed' ? '#88ff88' : isArc ? '#cc88ff' : '#c9a227';
      const displayName = isArc ? `◆ ${definition.name}` : definition.name;
      const nameText = this.add.text(0, yOffset, displayName, {
        fontSize: '10px',
        fontFamily: 'monospace',
        color: statusColor,
        stroke: '#000000',
        strokeThickness: 2
      });
      this.questTrackerContainer.add(nameText);
      yOffset += 14;

      // Objectives
      for (const objProgress of state.objectiveProgress) {
        const objective = definition.objectives.find(o => o.id === objProgress.objectiveId);
        if (!objective) continue;

        const checkmark = objProgress.completed ? '[x]' : '[ ]';
        const objColor = objProgress.completed ? '#88ff88' : '#aaaaaa';
        const objText = this.add.text(8, yOffset, `${checkmark} ${objective.description}: ${objProgress.currentCount}/${objective.requiredCount}`, {
          fontSize: '9px',
          fontFamily: 'monospace',
          color: objColor,
          stroke: '#000000',
          strokeThickness: 1
        });
        this.questTrackerContainer.add(objText);
        yOffset += 12;
      }

      yOffset += 4;
    }
  }

  private onQuestTurnedIn(_questId: string, rewards: QuestReward): void {
    this.updateQuestTracker();

    // Show reward notification
    let rewardText = 'Quest Complete!';
    if (rewards.gold) rewardText += ` +${rewards.gold}g`;
    if (rewards.xp) rewardText += ` +${rewards.xp}xp`;

    const notification = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 80, rewardText, {
      fontSize: '16px',
      fontFamily: 'monospace',
      color: '#ffd700',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5);

    this.tweens.add({
      targets: notification,
      y: notification.y - 40,
      alpha: 0,
      duration: 2500,
      onComplete: () => notification.destroy()
    });
  }
}
