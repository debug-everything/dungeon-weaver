import Phaser from 'phaser';
import { MonsterData, MonsterState } from '../types';
import { SCALE, EVENTS } from '../config/constants';
import { getItem } from '../data/items';

export class Monster extends Phaser.Physics.Arcade.Sprite {
  public monsterData: MonsterData;
  public health: number;
  public maxHealth: number;

  private monsterState: MonsterState = 'idle';
  private target: Phaser.Physics.Arcade.Sprite | null = null;
  private lastAttackTime: number = 0;
  private healthBar: Phaser.GameObjects.Graphics | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number, data: MonsterData) {
    super(scene, x, y, data.sprite);

    this.monsterData = data;
    this.health = data.health;
    this.maxHealth = data.health;

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setScale(SCALE);
    this.setDepth(5);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(12, 12);
    body.setOffset(2, 4);

    this.createHealthBar();
  }

  private createHealthBar(): void {
    this.healthBar = this.scene.add.graphics();
    this.healthBar.setDepth(100);
    this.updateHealthBar();
  }

  private updateHealthBar(): void {
    if (!this.healthBar) return;

    this.healthBar.clear();

    const barWidth = 24;
    const barHeight = 4;
    const x = this.x - barWidth / 2;
    const y = this.y - 20;

    // Background
    this.healthBar.fillStyle(0x333333);
    this.healthBar.fillRect(x, y, barWidth, barHeight);

    // Health
    const healthPercent = this.health / this.maxHealth;
    const healthColor = healthPercent > 0.5 ? 0x00ff00 : healthPercent > 0.25 ? 0xffff00 : 0xff0000;
    this.healthBar.fillStyle(healthColor);
    this.healthBar.fillRect(x, y, barWidth * healthPercent, barHeight);
  }

  setTarget(target: Phaser.Physics.Arcade.Sprite): void {
    this.target = target;
  }

  update(time: number): void {
    if (!this.active || this.monsterState === 'dead') return;

    this.updateHealthBar();

    if (!this.target || !this.target.active) {
      this.setMonsterState('idle');
      return;
    }

    const distanceToTarget = Phaser.Math.Distance.Between(
      this.x, this.y,
      this.target.x, this.target.y
    );

    // State machine
    if (distanceToTarget <= this.monsterData.attackRange) {
      this.setMonsterState('attacking');
      this.performAttack(time);
    } else if (distanceToTarget <= this.monsterData.detectRange) {
      this.setMonsterState('chasing');
      this.chaseTarget();
    } else {
      this.setMonsterState('idle');
      this.idle();
    }
  }

  private setMonsterState(newState: MonsterState): void {
    this.monsterState = newState;
  }

  private idle(): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0);
  }

  private chaseTarget(): void {
    if (!this.target) return;

    const body = this.body as Phaser.Physics.Arcade.Body;
    const angle = Phaser.Math.Angle.Between(this.x, this.y, this.target.x, this.target.y);

    body.setVelocity(
      Math.cos(angle) * this.monsterData.speed,
      Math.sin(angle) * this.monsterData.speed
    );

    // Face direction of movement
    this.setFlipX(this.target.x < this.x);
  }

  private performAttack(time: number): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0);

    if (time - this.lastAttackTime >= this.monsterData.attackCooldown) {
      this.lastAttackTime = time;
      this.scene.events.emit('monster-attack', {
        monster: this,
        damage: this.monsterData.damage
      });

      // Visual attack feedback
      this.setTint(0xff6666);
      this.scene.time.delayedCall(100, () => this.clearTint());
    }
  }

  takeDamage(amount: number, isCritical: boolean = false): void {
    this.health -= amount;

    // Flash white on hit
    this.setTint(0xffffff);
    this.scene.time.delayedCall(50, () => this.clearTint());

    // Show damage number
    const color = isCritical ? '#ff4444' : '#ffffff';
    const damageText = this.scene.add.text(this.x, this.y - 15, `-${amount}`, {
      fontSize: isCritical ? '16px' : '12px',
      fontFamily: 'monospace',
      color,
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5).setDepth(1000);

    this.scene.tweens.add({
      targets: damageText,
      y: this.y - 40,
      alpha: 0,
      duration: 600,
      onComplete: () => damageText.destroy()
    });

    if (this.health <= 0) {
      this.die();
    }
  }

  private die(): void {
    this.monsterState = 'dead';
    this.setActive(false);

    // Death animation
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      scale: 0,
      duration: 300,
      onComplete: () => {
        this.dropLoot();
        this.healthBar?.destroy();
        this.destroy();
      }
    });

    this.scene.events.emit(EVENTS.MONSTER_KILLED, this.monsterData);
  }

  private dropLoot(): void {
    // Drop gold
    const goldAmount = Phaser.Math.Between(
      this.monsterData.goldDrop.min,
      this.monsterData.goldDrop.max
    );

    this.scene.events.emit('loot-dropped', {
      x: this.x,
      y: this.y,
      gold: goldAmount,
      items: this.rollLoot()
    });
  }

  private rollLoot(): string[] {
    const items: string[] = [];

    for (const entry of this.monsterData.lootTable) {
      if (Math.random() < entry.chance) {
        const item = getItem(entry.itemId);
        if (item) {
          items.push(entry.itemId);
        }
      }
    }

    return items;
  }

  getState(): MonsterState {
    return this.monsterState;
  }
}
