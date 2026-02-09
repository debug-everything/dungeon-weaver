import Phaser from 'phaser';
import { SCENE_KEYS, GAME_WIDTH, GAME_HEIGHT, EVENTS } from '../config/constants';
import { Equipment, QuestReward } from '../types';
import { GameScene } from './GameScene';

export class UIScene extends Phaser.Scene {
  private healthBar!: Phaser.GameObjects.Graphics;
  private healthText!: Phaser.GameObjects.Text;
  private goldText!: Phaser.GameObjects.Text;
  private weaponIcon!: Phaser.GameObjects.Image;
  private weaponText!: Phaser.GameObjects.Text;
  private _controlsText!: Phaser.GameObjects.Text;
  private questTrackerContainer!: Phaser.GameObjects.Container;

  private currentHealth: number = 100;
  private maxHealth: number = 100;
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

    // Quest tracker (below health bar)
    this.questTrackerContainer = this.add.container(20, 56);

    // Controls reminder
    this._controlsText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 15, 'WASD: Move | SPACE: Attack | I: Inventory | E: Interact | M: Map', {
      fontSize: '10px',
      fontFamily: 'monospace',
      color: '#666666'
    }).setOrigin(0.5);

    // Listen for events from GameScene
    const gameScene = this.scene.get(SCENE_KEYS.GAME);

    gameScene.events.on(EVENTS.PLAYER_HEALTH_CHANGED, this.onHealthChanged, this);
    gameScene.events.on(EVENTS.PLAYER_GOLD_CHANGED, this.onGoldChanged, this);
    gameScene.events.on(EVENTS.PLAYER_EQUIPMENT_CHANGED, this.onEquipmentChanged, this);
    gameScene.events.on(EVENTS.MONSTER_KILLED, this.onMonsterKilled, this);
    gameScene.events.on(EVENTS.ITEM_PICKED_UP, this.onItemPickedUp, this);
    gameScene.events.on(EVENTS.QUEST_ACCEPTED, this.updateQuestTracker, this);
    gameScene.events.on(EVENTS.QUEST_PROGRESS_UPDATED, this.updateQuestTracker, this);
    gameScene.events.on(EVENTS.QUEST_TURNED_IN, this.onQuestTurnedIn, this);

    // Clean up on scene shutdown
    this.events.on('shutdown', () => {
      gameScene.events.off(EVENTS.PLAYER_HEALTH_CHANGED, this.onHealthChanged, this);
      gameScene.events.off(EVENTS.PLAYER_GOLD_CHANGED, this.onGoldChanged, this);
      gameScene.events.off(EVENTS.PLAYER_EQUIPMENT_CHANGED, this.onEquipmentChanged, this);
      gameScene.events.off(EVENTS.MONSTER_KILLED, this.onMonsterKilled, this);
      gameScene.events.off(EVENTS.ITEM_PICKED_UP, this.onItemPickedUp, this);
      gameScene.events.off(EVENTS.QUEST_ACCEPTED, this.updateQuestTracker, this);
      gameScene.events.off(EVENTS.QUEST_PROGRESS_UPDATED, this.updateQuestTracker, this);
      gameScene.events.off(EVENTS.QUEST_TURNED_IN, this.onQuestTurnedIn, this);
    });
  }

  update(): void {
    const hasGamepad = (this.input.gamepad?.total ?? 0) > 0;
    if (hasGamepad !== this.gamepadConnected) {
      this.gamepadConnected = hasGamepad;
      if (hasGamepad) {
        this._controlsText.setText('LS: Move | A: Attack | X: Interact | Y: Inventory | Select: Map');
      } else {
        this._controlsText.setText('WASD: Move | SPACE: Attack | I: Inventory | E: Interact | M: Map');
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
      this.weaponText.setText(equipment.weapon.name);
    } else {
      this.weaponIcon.setTexture('weapon_sword_wooden');
      this.weaponText.setText('No Weapon');
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

  private updateQuestTracker(): void {
    this.questTrackerContainer.removeAll(true);

    const gameScene = this.scene.get(SCENE_KEYS.GAME) as GameScene;
    const activeQuests = gameScene.questSystem.getActiveQuests();

    if (activeQuests.length === 0) return;

    let yOffset = 0;

    // Show up to 3 active quests
    const displayQuests = activeQuests.slice(0, 3);
    for (const { definition, state } of displayQuests) {
      // Quest name
      const statusColor = state.status === 'completed' ? '#88ff88' : '#c9a227';
      const nameText = this.add.text(0, yOffset, definition.name, {
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
