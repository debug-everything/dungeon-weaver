import Phaser from 'phaser';
import { InventorySystem } from './InventorySystem';
import { COMBO_WINDOW, COMBO_DAMAGE_MULTIPLIERS } from '../config/constants';
import type { PlayerStats } from '../types';

export interface DamageResult {
  damage: number;
  isCritical: boolean;
}

export class CombatSystem {
  private scene: Phaser.Scene;
  private inventory: InventorySystem;
  private statsGetter: (() => PlayerStats) | null = null;

  // Combo state
  private comboCount: number = 0;
  private lastHitTime: number = 0;

  constructor(scene: Phaser.Scene, inventory: InventorySystem) {
    this.scene = scene;
    this.inventory = inventory;
  }

  setStatsGetter(getter: () => PlayerStats): void {
    this.statsGetter = getter;
  }

  isInAttackArc(
    originX: number, originY: number,
    targetX: number, targetY: number,
    directionDeg: number, radius: number, arcWidthDeg: number,
    targetBodyRadius: number = 16
  ): boolean {
    const dx = targetX - originX;
    const dy = targetY - originY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    // Check if arc reaches the target's body edge, not just its center
    if (dist > radius + targetBodyRadius) return false;

    // atan2 gives angle in radians; convert to degrees (0=right, 90=down)
    let angleDeg = Phaser.Math.RadToDeg(Math.atan2(dy, dx));
    if (angleDeg < 0) angleDeg += 360;

    // Normalize direction to 0-360
    let dir = directionDeg % 360;
    if (dir < 0) dir += 360;

    // Angular difference (shortest arc)
    let diff = Math.abs(angleDeg - dir);
    if (diff > 180) diff = 360 - diff;

    return diff <= arcWidthDeg / 2;
  }

  calculatePlayerDamage(comboMultiplier: number = 1.0, chargeMultiplier: number = 1.0): DamageResult {
    const baseDamage = this.inventory.getWeaponDamage();
    const stats = this.statsGetter?.();
    const strengthBonus = stats ? (stats.strength - 1) * 0.5 : 0;
    const critChance = stats ? 0.10 + (stats.dexterity - 1) * 0.005 : 0.10;

    const variance = Math.random() * 0.3 + 0.85; // 85% to 115% damage
    const isCritical = Math.random() < critChance;

    let damage = Math.floor((baseDamage + strengthBonus) * variance * comboMultiplier * chargeMultiplier);
    if (isCritical) {
      damage = Math.floor(damage * 1.5);
    }

    return { damage, isCritical };
  }

  calculateMonsterDamage(baseDamage: number, playerDefense: number): DamageResult {
    const variance = Math.random() * 0.3 + 0.85;
    const reduction = Math.max(0, playerDefense * 0.5);
    const damage = Math.max(1, Math.floor(baseDamage * variance - reduction));

    return { damage, isCritical: false };
  }

  advanceCombo(time: number): void {
    if (time - this.lastHitTime <= COMBO_WINDOW) {
      this.comboCount = Math.min(this.comboCount + 1, COMBO_DAMAGE_MULTIPLIERS.length - 1);
    } else {
      this.comboCount = 0;
    }
    this.lastHitTime = time;
  }

  getComboMultiplier(): number {
    return COMBO_DAMAGE_MULTIPLIERS[this.comboCount] ?? 1.0;
  }

  getComboCount(): number {
    return this.comboCount;
  }

  resetCombo(): void {
    this.comboCount = 0;
  }

  showComboText(x: number, y: number, count: number): void {
    if (count < 1) return;

    const comboText = this.scene.add.text(x, y - 30, `x${count + 1}!`, {
      fontSize: '16px',
      fontFamily: 'monospace',
      color: '#ffaa00',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5).setDepth(1001);

    this.scene.tweens.add({
      targets: comboText,
      y: y - 55,
      alpha: 0,
      scale: 1.5,
      duration: 600,
      ease: 'Power2',
      onComplete: () => comboText.destroy()
    });
  }

  showDamageNumber(x: number, y: number, damage: number, isCritical: boolean = false, isHeal: boolean = false): void {
    const color = isHeal ? '#00ff00' : (isCritical ? '#ff4444' : '#ffffff');
    const fontSize = isCritical ? '18px' : '14px';
    const text = isHeal ? `+${damage}` : `-${damage}`;

    const damageText = this.scene.add.text(x, y, text, {
      fontSize,
      fontFamily: 'monospace',
      color,
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5).setDepth(1000);

    this.scene.tweens.add({
      targets: damageText,
      y: y - 30,
      alpha: 0,
      duration: 800,
      ease: 'Power2',
      onComplete: () => damageText.destroy()
    });
  }

  createHitEffect(x: number, y: number): void {
    const particles: Phaser.GameObjects.Arc[] = [];

    for (let i = 0; i < 5; i++) {
      const particle = this.scene.add.circle(x, y, 3, 0xffaa00);
      particle.setDepth(999);
      particles.push(particle);

      const angle = (Math.PI * 2 / 5) * i + Math.random() * 0.5;
      const distance = 15 + Math.random() * 10;

      this.scene.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance,
        alpha: 0,
        scale: 0,
        duration: 300,
        ease: 'Power2',
        onComplete: () => particle.destroy()
      });
    }
  }

  getAttackCooldown(): number {
    const speed = this.inventory.getWeaponSpeed();
    return Math.floor(400 / speed);
  }
}
