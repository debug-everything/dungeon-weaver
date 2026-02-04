import Phaser from 'phaser';
import { InventorySystem } from './InventorySystem';

export interface DamageResult {
  damage: number;
  isCritical: boolean;
}

export class CombatSystem {
  private scene: Phaser.Scene;
  private inventory: InventorySystem;

  constructor(scene: Phaser.Scene, inventory: InventorySystem) {
    this.scene = scene;
    this.inventory = inventory;
  }

  calculatePlayerDamage(): DamageResult {
    const baseDamage = this.inventory.getWeaponDamage();
    const variance = Math.random() * 0.3 + 0.85; // 85% to 115% damage
    const isCritical = Math.random() < 0.1; // 10% crit chance

    let damage = Math.floor(baseDamage * variance);
    if (isCritical) {
      damage = Math.floor(damage * 1.5);
    }

    return { damage, isCritical };
  }

  calculateMonsterDamage(baseDamage: number, playerDefense: number): DamageResult {
    const variance = Math.random() * 0.3 + 0.85;
    const reduction = Math.max(0, playerDefense * 0.5);
    let damage = Math.max(1, Math.floor(baseDamage * variance - reduction));

    return { damage, isCritical: false };
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
