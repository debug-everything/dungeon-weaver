import Phaser from 'phaser';
import { MonsterData, MonsterState, BossPhase } from '../types';
import { SCALE, TILE_SIZE, EVENTS, BOSS_ABILITY_BASE_COOLDOWN } from '../config/constants';
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

  // Boss phase system
  public bossPhase: BossPhase = 1;
  private lastAbilityTime: number = 0;
  private phase2Applied: boolean = false;
  private isCharging: boolean = false;
  private currentSpeed: number;

  constructor(scene: Phaser.Scene, x: number, y: number, data: MonsterData) {
    super(scene, x, y, data.sprite);

    this.monsterData = data;
    this.health = data.health;
    this.maxHealth = data.health;
    this.currentSpeed = data.speed;

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
    if (this.isCharging) return; // Don't override charge velocity

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

    // Boss ability system
    if (this.monsterData.bossPattern && this.target && hasLOS && this.monsterState !== 'idle') {
      this.updateBossAbilities(time);
    }
  }

  private getAbilityCooldown(): number {
    const pattern = this.monsterData.bossPattern!;
    const baseCooldown = BOSS_ABILITY_BASE_COOLDOWN;
    return this.bossPhase === 2 ? baseCooldown * pattern.phase2CooldownMultiplier : baseCooldown;
  }

  private updateBossAbilities(time: number): void {
    const pattern = this.monsterData.bossPattern!;
    if (!this.target) return;

    const cooldown = this.getAbilityCooldown();
    if (time - this.lastAbilityTime < cooldown) return;

    // Pick a random ability
    const ability = Phaser.Utils.Array.GetRandom(pattern.abilities);
    this.lastAbilityTime = time;

    switch (ability) {
      case 'slam':
        this.performSlam(pattern.slamRadius ?? 40);
        break;
      case 'summon':
        this.performSummon(pattern.summonType ?? 'monster_zombie_small', pattern.summonCount ?? 2);
        break;
      case 'charge':
        this.performCharge(pattern.chargeSpeed ?? 200);
        break;
      case 'teleport':
        this.performTeleport();
        break;
      case 'barrage':
        this.performBarrage(pattern.barrageCount ?? 3, pattern.barrageStyle ?? 'fire_bolt');
        break;
    }
  }

  private performSlam(radius: number): void {
    // Brief wind-up pause
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);

    this.scene.events.emit('boss-slam', {
      x: this.x,
      y: this.y,
      radius,
      damage: this.monsterData.damage * 1.5,
      monster: this
    });
  }

  private performSummon(summonType: string, count: number): void {
    this.scene.events.emit('boss-summon', {
      x: this.x,
      y: this.y,
      summonType,
      count,
      monster: this
    });
  }

  private performCharge(chargeSpeed: number): void {
    if (!this.target || this.isCharging) return;
    this.isCharging = true;

    const body = this.body as Phaser.Physics.Arcade.Body;
    const angle = Phaser.Math.Angle.Between(this.x, this.y, this.target.x, this.target.y);

    body.setVelocity(
      Math.cos(angle) * chargeSpeed,
      Math.sin(angle) * chargeSpeed
    );

    this.scene.events.emit('boss-charge', { monster: this });

    // End charge after 400ms
    this.scene.time.delayedCall(400, () => {
      this.isCharging = false;
      // Emit melee attack on arrival
      if (this.active && this.target) {
        this.scene.events.emit('monster-attack', {
          monster: this,
          damage: Math.floor(this.monsterData.damage * 1.5)
        });
      }
    });
  }

  private performTeleport(): void {
    if (!this.target) return;

    const oldX = this.x;
    const oldY = this.y;

    // Teleport 60px behind the player (opposite of player's facing)
    const angle = Phaser.Math.Angle.Between(this.target.x, this.target.y, this.x, this.y);
    // Reverse angle to go behind player
    const behindAngle = angle + Math.PI;
    const newX = this.target.x + Math.cos(behindAngle) * 60;
    const newY = this.target.y + Math.sin(behindAngle) * 60;

    this.setPosition(newX, newY);

    this.scene.events.emit('boss-teleport', {
      oldX, oldY,
      newX, newY,
      monster: this
    });
  }

  private performBarrage(count: number, style: string): void {
    if (!this.target) return;

    const baseAngle = Phaser.Math.Angle.Between(this.x, this.y, this.target.x, this.target.y);
    const spreadAngle = count <= 3 ? Math.PI / 6 : Math.PI * 2 / 9; // ±30° for 3, ±40° for 5
    const ranged = this.monsterData.ranged;

    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0 : (i / (count - 1)) * 2 - 1; // -1 to 1
      const angle = baseAngle + t * spreadAngle;

      this.scene.events.emit('monster-ranged-attack', {
        originX: this.x,
        originY: this.y,
        directionRad: angle,
        speed: ranged?.projectileSpeed ?? 180,
        range: ranged?.projectileRange ?? 180,
        damage: ranged?.projectileDamage ?? this.monsterData.damage,
        style
      });
    }

    // Visual feedback
    this.setTint(0xff66ff);
    this.scene.time.delayedCall(200, () => this.clearTint());
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
      Math.cos(angle) * this.currentSpeed,
      Math.sin(angle) * this.currentSpeed
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
      Math.cos(angle) * this.currentSpeed * 0.7,
      Math.sin(angle) * this.currentSpeed * 0.7
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

    // Boss phase 2 transition
    const pattern = this.monsterData.bossPattern;
    if (pattern && !this.phase2Applied && this.health > 0 &&
        this.health / this.maxHealth <= pattern.phase2Threshold) {
      this.enterPhase2();
    }

    if (this.health <= 0) {
      this.die();
    }
  }

  private enterPhase2(): void {
    const pattern = this.monsterData.bossPattern!;
    this.bossPhase = 2;
    this.phase2Applied = true;
    this.currentSpeed = this.monsterData.speed * pattern.phase2SpeedMultiplier;

    // Red flash
    this.setTint(0xff0000);
    this.scene.time.delayedCall(300, () => this.clearTint());

    // Camera shake
    this.scene.cameras.main.shake(300, 0.01);

    // Floating "ENRAGED!" text
    const enrageText = this.scene.add.text(this.x, this.y - 40, 'ENRAGED!', {
      fontSize: '16px',
      fontFamily: 'monospace',
      color: '#ff2222',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5).setDepth(1001);

    this.scene.tweens.add({
      targets: enrageText,
      y: this.y - 70,
      alpha: 0,
      scale: 1.5,
      duration: 1200,
      ease: 'Power2',
      onComplete: () => enrageText.destroy()
    });
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

    this.scene.events.emit(EVENTS.MONSTER_KILLED, this.monsterData, this.x, this.y, this);
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
