import Phaser from 'phaser';
import { MonsterData, MonsterState } from '../types';
import { SCALE, TILE_SIZE, EVENTS } from '../config/constants';
import { FogOfWarSystem } from '../systems/FogOfWarSystem';
import { getItem } from '../data/items';

export class Monster extends Phaser.Physics.Arcade.Sprite {
  public monsterData: MonsterData;
  public health: number;
  public maxHealth: number;

  private monsterState: MonsterState = 'idle';
  private target: Phaser.Physics.Arcade.Sprite | null = null;
  private lastAttackTime: number = 0;
  private lastRangedAttackTime: number = 0;
  private healthBar: Phaser.GameObjects.Graphics | null = null;
  private isKnockedBack: boolean = false;
  private isFrozen: boolean = false;
  private frozenTimer: Phaser.Time.TimerEvent | null = null;
  private freezeOverlay: Phaser.GameObjects.Graphics | null = null;
  private nameText: Phaser.GameObjects.Text | null = null;
  private fogSystem: FogOfWarSystem | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number, data: MonsterData) {
    super(scene, x, y, data.sprite);

    this.monsterData = data;
    this.health = data.health;
    this.maxHealth = data.health;

    scene.add.existing(this);
    scene.physics.add.existing(this);

    const isLarge = data.spriteSize && data.spriteSize.width === 32;
    if (isLarge) {
      // 32x32 sprites: scale 1 so they appear same size as 16x16 at SCALE=2
      this.setScale(1);
      this.setDepth(5);
      const body = this.body as Phaser.Physics.Arcade.Body;
      body.setSize(24, 24);
      body.setOffset(4, 8);
    } else {
      this.setScale(SCALE);
      this.setDepth(5);
      const body = this.body as Phaser.Physics.Arcade.Body;
      body.setSize(12, 12);
      body.setOffset(2, 4);
    }

    this.createHealthBar();

    // Show colored name for boss monsters
    if (data.nameColor) {
      const nameY = isLarge ? y - 36 : y - 28;
      this.nameText = scene.add.text(x, nameY, data.name, {
        fontSize: '9px',
        fontFamily: 'monospace',
        color: data.nameColor,
        stroke: '#000000',
        strokeThickness: 2
      }).setOrigin(0.5).setDepth(101);
    }
  }

  private createHealthBar(): void {
    this.healthBar = this.scene.add.graphics();
    this.healthBar.setDepth(100);
    this.updateHealthBar();
  }

  private updateHealthBar(): void {
    if (!this.healthBar) return;

    this.healthBar.clear();

    const isLarge = this.monsterData.spriteSize && this.monsterData.spriteSize.width === 32;
    const barWidth = isLarge ? 36 : 24;
    const barHeight = 4;
    const x = this.x - barWidth / 2;
    const y = this.y - (isLarge ? 28 : 20);

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

  setFogSystem(fog: FogOfWarSystem): void {
    this.fogSystem = fog;
  }

  private hasLOSToTarget(): boolean {
    if (!this.target || !this.fogSystem) return true; // fallback: no fog = always visible
    const scaledTile = TILE_SIZE * SCALE;
    return this.fogSystem.hasLineOfSightWorld(this.x, this.y, this.target.x, this.target.y, scaledTile);
  }

  applyFreeze(duration: number): void {
    if (this.isFrozen) {
      // Refresh existing freeze timer
      this.frozenTimer?.destroy();
      // Keep existing overlay
    } else {
      // Create freeze overlay
      this.freezeOverlay = this.scene.add.graphics();
      this.freezeOverlay.setDepth(this.depth + 1);
    }

    this.isFrozen = true;
    this.setTint(0x88ccff);
    (this.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);

    // Draw the ice overlay
    this.drawFreezeOverlay();

    this.frozenTimer = this.scene.time.delayedCall(duration, () => {
      this.isFrozen = false;
      this.clearTint();
      this.frozenTimer = null;
      if (this.freezeOverlay) {
        this.freezeOverlay.destroy();
        this.freezeOverlay = null;
      }
    });
  }

  private drawFreezeOverlay(): void {
    if (!this.freezeOverlay) return;
    this.freezeOverlay.clear();
    const isLarge = this.monsterData.spriteSize && this.monsterData.spriteSize.width === 32;
    const size = isLarge ? 16 : 12;
    this.freezeOverlay.fillStyle(0xaaddff, 0.3);
    this.freezeOverlay.fillRect(this.x - size, this.y - size, size * 2, size * 2);
    this.freezeOverlay.lineStyle(1, 0xcceeFF, 0.5);
    this.freezeOverlay.strokeRect(this.x - size, this.y - size, size * 2, size * 2);
  }

  applyKnockback(fromX: number, fromY: number, force: number): void {
    if (this.isKnockedBack) return;

    const angle = Math.atan2(this.y - fromY, this.x - fromX);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(Math.cos(angle) * force, Math.sin(angle) * force);

    this.isKnockedBack = true;
    this.scene.time.delayedCall(150, () => {
      this.isKnockedBack = false;
    });
  }

  update(time: number): void {
    if (!this.active || this.monsterState === 'dead') return;

    // Hide sprite, health bar, and name when on a non-visible tile
    if (this.fogSystem) {
      const scaledTile = TILE_SIZE * SCALE;
      const tileX = Math.floor(this.x / scaledTile);
      const tileY = Math.floor(this.y / scaledTile);
      const onVisibleTile = this.fogSystem.isVisible(tileX, tileY);
      this.setVisible(onVisibleTile);
      if (this.healthBar) this.healthBar.setVisible(onVisibleTile);
      if (this.nameText) this.nameText.setVisible(onVisibleTile);
      if (this.freezeOverlay) this.freezeOverlay.setVisible(onVisibleTile);
    }

    this.updateHealthBar();

    // Update boss name position
    if (this.nameText) {
      const isLarge = this.monsterData.spriteSize && this.monsterData.spriteSize.width === 32;
      this.nameText.setPosition(this.x, this.y - (isLarge ? 36 : 28));
    }

    // Skip AI during freeze or knockback
    if (this.isFrozen) {
      (this.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
      // Update freeze overlay position
      if (this.freezeOverlay) this.drawFreezeOverlay();
      return;
    }
    if (this.isKnockedBack) return;

    if (!this.target || !this.target.active) {
      this.setMonsterState('idle');
      return;
    }

    const distanceToTarget = Phaser.Math.Distance.Between(
      this.x, this.y,
      this.target.x, this.target.y
    );

    // Require line-of-sight for detection — monsters can't see through walls/doors
    const hasLOS = this.hasLOSToTarget();
    const ranged = this.monsterData.ranged;

    // State machine — ranged-aware if monster has ranged config
    if (ranged && hasLOS) {
      if (distanceToTarget <= ranged.meleeRange) {
        // Too close — melee attack
        this.setMonsterState('attacking');
        this.performAttack(time);
      } else if (distanceToTarget <= ranged.meleeRange * 1.5) {
        // Uncomfortably close — retreat
        this.setMonsterState('retreating');
        this.retreat();
      } else if (distanceToTarget <= this.monsterData.attackRange) {
        // In ranged attack zone — fire projectile
        this.performRangedAttack(time);
      } else if (distanceToTarget <= this.monsterData.detectRange) {
        // Detected but out of range — close to preferred range
        this.setMonsterState('chasing');
        this.chaseTarget();
      } else {
        this.setMonsterState('idle');
        this.idle();
      }
    } else if (hasLOS && distanceToTarget <= this.monsterData.attackRange) {
      this.setMonsterState('attacking');
      this.performAttack(time);
    } else if (hasLOS && distanceToTarget <= this.monsterData.detectRange) {
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

  private retreat(): void {
    if (!this.target) return;

    const body = this.body as Phaser.Physics.Arcade.Body;
    const angle = Phaser.Math.Angle.Between(this.target.x, this.target.y, this.x, this.y);

    // Move away from player at 70% speed
    body.setVelocity(
      Math.cos(angle) * this.monsterData.speed * 0.7,
      Math.sin(angle) * this.monsterData.speed * 0.7
    );

    // Face the player while retreating
    this.setFlipX(this.target.x < this.x);
  }

  private performRangedAttack(time: number): void {
    if (!this.target) return;
    const ranged = this.monsterData.ranged!;

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0);

    // Face the player
    this.setFlipX(this.target.x < this.x);

    if (time - this.lastRangedAttackTime >= ranged.rangedCooldown) {
      this.lastRangedAttackTime = time;
      this.setMonsterState('attacking');

      const angle = Phaser.Math.Angle.Between(this.x, this.y, this.target.x, this.target.y);

      this.scene.events.emit('monster-ranged-attack', {
        originX: this.x,
        originY: this.y,
        directionRad: angle,
        speed: ranged.projectileSpeed,
        range: ranged.projectileRange,
        damage: ranged.projectileDamage,
        style: ranged.projectileStyle
      });

      // Visual attack feedback
      this.setTint(0xff66ff);
      this.scene.time.delayedCall(100, () => this.clearTint());
    } else {
      this.setMonsterState('chasing');
      // Strafe slightly while waiting for cooldown
    }
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
    if (this.frozenTimer) {
      this.frozenTimer.destroy();
      this.frozenTimer = null;
    }
    if (this.freezeOverlay) {
      this.freezeOverlay.destroy();
      this.freezeOverlay = null;
    }

    // Death animation
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      scale: 0,
      duration: 300,
      onComplete: () => {
        this.dropLoot();
        this.healthBar?.destroy();
        this.nameText?.destroy();
        this.destroy();
      }
    });

    this.scene.events.emit(EVENTS.MONSTER_KILLED, this.monsterData, this.x, this.y);
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
