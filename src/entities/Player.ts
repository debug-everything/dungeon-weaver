import Phaser from 'phaser';
import {
  PLAYER_SPEED, PLAYER_MAX_HEALTH, PLAYER_START_GOLD, SCALE, EVENTS,
  WEAPON_CLASS_DEFAULTS, PLAYER_IFRAMES_DURATION, PLAYER_IFRAMES_FLASH_RATE,
  DODGE_SPEED, DODGE_DURATION, DODGE_COOLDOWN, DODGE_IFRAMES,
  CHARGE_TIME, CHARGE_MIN_TIME
} from '../config/constants';
import { InventorySystem } from '../systems/InventorySystem';
import { CombatSystem } from '../systems/CombatSystem';

type Direction = 'up' | 'down' | 'left' | 'right';

export class Player extends Phaser.Physics.Arcade.Sprite {
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key };
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private inventoryKey!: Phaser.Input.Keyboard.Key;
  private interactKey!: Phaser.Input.Keyboard.Key;
  private mapKey!: Phaser.Input.Keyboard.Key;
  private questLogKey!: Phaser.Input.Keyboard.Key;
  private dodgeKey!: Phaser.Input.Keyboard.Key;

  public health: number;
  public maxHealth: number;
  public gold: number;
  public inventory: InventorySystem;
  public combat: CombatSystem;

  private isAttacking: boolean = false;
  private lastAttackTime: number = 0;
  private facingDirection: Direction = 'down';
  private attackHitbox: Phaser.GameObjects.Rectangle | null = null;
  private weaponSprite: Phaser.GameObjects.Image | null = null;

  // I-frames
  private isInvulnerable: boolean = false;
  private iframeTimer: Phaser.Time.TimerEvent | null = null;
  private flashTimer: Phaser.Time.TimerEvent | null = null;

  // Dodge/roll
  private isDodging: boolean = false;
  private lastDodgeTime: number = 0;

  // Charged attacks
  private isCharging: boolean = false;
  private chargeStartTime: number = 0;
  private chargeEffect: Phaser.GameObjects.Graphics | null = null;

  // Gamepad button tracking (for justDown detection)
  private prevGamepadButtons: boolean[] = [];

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'hero_basic');

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setScale(SCALE);
    this.setCollideWorldBounds(true);
    this.setDepth(10);

    // Setup body
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(12, 12);
    body.setOffset(2, 4);

    // Initialize stats
    this.health = PLAYER_MAX_HEALTH;
    this.maxHealth = PLAYER_MAX_HEALTH;
    this.gold = PLAYER_START_GOLD;

    // Initialize systems
    this.inventory = new InventorySystem(scene);
    this.combat = new CombatSystem(scene, this.inventory);

    // Give starting weapon
    this.inventory.addItem('weapon_sword_wooden');
    this.inventory.equipItem(0);

    // Give some starting potions
    this.inventory.addItem('flask_red', 3);

    // Setup input
    this.setupInput();
  }

  private setupInput(): void {
    if (!this.scene.input.keyboard) return;

    this.cursors = this.scene.input.keyboard.createCursorKeys();
    this.wasd = {
      W: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D)
    };
    this.spaceKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.inventoryKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.I);
    this.interactKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    this.mapKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.M);
    this.questLogKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Q);
    this.dodgeKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
  }

  update(time: number): void {
    if (!this.active) return;

    // Skip all input during dodge
    if (this.isDodging) {
      this.updateGamepadState();
      return;
    }

    this.handleMovement();
    this.handleAttack(time);
    this.handleDodge(time);
    this.handleInventoryKey();
    this.handleInteractKey();
    this.handleMapKey();
    this.handleQuestLogKey();
    this.updateGamepadState();
  }

  private handleMovement(): void {
    if (this.isAttacking || this.isCharging) {
      this.setVelocity(0);
      return;
    }

    const body = this.body as Phaser.Physics.Arcade.Body;
    let velocityX = 0;
    let velocityY = 0;

    // Check horizontal movement (keyboard)
    if (this.cursors.left.isDown || this.wasd.A.isDown) {
      velocityX = -PLAYER_SPEED;
      this.facingDirection = 'left';
      this.setFlipX(true);
    } else if (this.cursors.right.isDown || this.wasd.D.isDown) {
      velocityX = PLAYER_SPEED;
      this.facingDirection = 'right';
      this.setFlipX(false);
    }

    // Check vertical movement (keyboard)
    if (this.cursors.up.isDown || this.wasd.W.isDown) {
      velocityY = -PLAYER_SPEED;
      this.facingDirection = 'up';
    } else if (this.cursors.down.isDown || this.wasd.S.isDown) {
      velocityY = PLAYER_SPEED;
      this.facingDirection = 'down';
    }

    // Gamepad left stick overrides
    const pad = this.getGamepad();
    if (pad && velocityX === 0 && velocityY === 0) {
      const deadzone = 0.2;
      if (pad.leftStick.x < -deadzone) {
        velocityX = -PLAYER_SPEED;
        this.facingDirection = 'left';
        this.setFlipX(true);
      } else if (pad.leftStick.x > deadzone) {
        velocityX = PLAYER_SPEED;
        this.facingDirection = 'right';
        this.setFlipX(false);
      }
      if (pad.leftStick.y < -deadzone) {
        velocityY = -PLAYER_SPEED;
        this.facingDirection = 'up';
      } else if (pad.leftStick.y > deadzone) {
        velocityY = PLAYER_SPEED;
        this.facingDirection = 'down';
      }
    }

    // Normalize diagonal movement
    if (velocityX !== 0 && velocityY !== 0) {
      velocityX *= 0.707;
      velocityY *= 0.707;
    }

    body.setVelocity(velocityX, velocityY);
  }

  private getDirectionDeg(): number {
    switch (this.facingDirection) {
      case 'right': return 0;
      case 'down': return 90;
      case 'left': return 180;
      case 'up': return 270;
    }
  }

  private handleAttack(time: number): void {
    const cooldown = this.combat.getAttackCooldown();
    const keyboardDown = this.spaceKey.isDown;
    const gamepadDown = this.isGamepadButtonDown(0); // A button
    const keyboardJustDown = Phaser.Input.Keyboard.JustDown(this.spaceKey);
    const gamepadJustDown = this.isGamepadButtonJustDown(0);
    const keyboardJustUp = Phaser.Input.Keyboard.JustUp(this.spaceKey);
    const gamepadJustUp = this.isGamepadButtonJustUp(0);

    // Start charging on press
    if ((keyboardJustDown || gamepadJustDown) && !this.isCharging && !this.isAttacking && time - this.lastAttackTime > cooldown) {
      this.isCharging = true;
      this.chargeStartTime = time;
      this.setVelocity(0);
      this.createChargeEffect();
    }

    // Update charge visual while held
    if (this.isCharging && (keyboardDown || gamepadDown)) {
      this.updateChargeEffect(time);

      // Auto-release at max charge
      if (time - this.chargeStartTime >= CHARGE_TIME) {
        this.releaseAttack(time);
      }
      return;
    }

    // Release attack
    if (this.isCharging && (keyboardJustUp || gamepadJustUp || (!keyboardDown && !gamepadDown))) {
      this.releaseAttack(time);
    }
  }

  private releaseAttack(time: number): void {
    const chargeTime = time - this.chargeStartTime;
    this.destroyChargeEffect();
    this.isCharging = false;

    // Calculate charge multiplier
    let chargeMultiplier = 1.0;
    let chargeKnockbackBonus = 1.0;
    let chargeArcBonus = 0;
    if (chargeTime >= CHARGE_MIN_TIME) {
      const chargePercent = Math.min((chargeTime - CHARGE_MIN_TIME) / (CHARGE_TIME - CHARGE_MIN_TIME), 1.0);
      chargeMultiplier = 1.0 + chargePercent * 1.5; // Up to 2.5x damage
      chargeKnockbackBonus = 1.0 + chargePercent * 1.0; // Up to 2x knockback
      chargeArcBonus = chargePercent * 30; // Up to +30 degrees arc
    }

    this.performAttack(time, chargeMultiplier, chargeKnockbackBonus, chargeArcBonus);
    this.lastAttackTime = time;
  }

  private performAttack(time: number, chargeMultiplier: number = 1.0, chargeKnockbackBonus: number = 1.0, chargeArcBonus: number = 0): void {
    this.isAttacking = true;
    this.setVelocity(0);

    const weaponClass = this.inventory.getWeaponClass();
    const classDefaults = WEAPON_CLASS_DEFAULTS[weaponClass];
    const range = this.inventory.getWeaponRange();
    const radius = range * classDefaults.reachMultiplier;
    const arcWidth = classDefaults.arcWidth + chargeArcBonus;
    const directionDeg = this.getDirectionDeg();

    // Advance combo (charged attacks don't advance combo)
    let comboMultiplier = 1.0;
    if (chargeMultiplier <= 1.0) {
      this.combat.advanceCombo(time);
      comboMultiplier = this.combat.getComboMultiplier();
      if (this.combat.getComboCount() > 0) {
        this.combat.showComboText(this.x, this.y, this.combat.getComboCount());
      }
    }

    const damageResult = this.combat.calculatePlayerDamage(comboMultiplier, chargeMultiplier);
    const knockback = classDefaults.knockback * chargeKnockbackBonus;

    // Create sword swing animation
    this.createSwordSwing(arcWidth, radius);

    // Emit arc-based attack data
    this.scene.events.emit('player-attack', {
      originX: this.x,
      originY: this.y,
      direction: directionDeg,
      radius,
      arcWidth,
      damage: damageResult,
      knockback
    });

    // Clean up after attack
    const attackDuration = 150;
    this.scene.time.delayedCall(attackDuration, () => {
      if (this.attackHitbox) {
        this.attackHitbox.destroy();
        this.attackHitbox = null;
      }
      this.isAttacking = false;
    });
  }

  private createSwordSwing(arcWidth: number, reachRadius: number): void {
    const weapon = this.inventory.getEquippedWeapon();
    const weaponTexture = weapon?.sprite || 'weapon_sword_wooden';

    // Position and rotation settings based on facing direction
    let startAngle: number;
    let endAngle: number;
    let offsetX: number;
    let offsetY: number;
    const swingDistance = Math.min(reachRadius * 0.6, 30);
    const halfArc = arcWidth / 2;

    switch (this.facingDirection) {
      case 'right':
        startAngle = -halfArc;
        endAngle = halfArc;
        offsetX = 8;
        offsetY = 0;
        break;
      case 'left':
        startAngle = 180 + halfArc;
        endAngle = 180 - halfArc;
        offsetX = -8;
        offsetY = 0;
        break;
      case 'up':
        startAngle = -90 - halfArc;
        endAngle = -90 + halfArc;
        offsetX = 0;
        offsetY = -8;
        break;
      case 'down':
      default:
        startAngle = 90 - halfArc;
        endAngle = 90 + halfArc;
        offsetX = 0;
        offsetY = 8;
        break;
    }

    // Create weapon sprite
    this.weaponSprite = this.scene.add.image(this.x + offsetX, this.y + offsetY, weaponTexture);
    this.weaponSprite.setScale(SCALE * 1.2);
    this.weaponSprite.setDepth(this.depth + 1);
    this.weaponSprite.setAngle(startAngle);
    this.weaponSprite.setOrigin(0.5, 1); // Pivot from handle

    // Swing animation
    this.scene.tweens.add({
      targets: this.weaponSprite,
      angle: endAngle,
      duration: 120,
      ease: 'Power2',
      onUpdate: () => {
        // Keep weapon attached to player during swing
        if (this.weaponSprite) {
          const progress = (this.weaponSprite.angle - startAngle) / (endAngle - startAngle);
          const swingOffset = Math.sin(progress * Math.PI) * swingDistance;

          switch (this.facingDirection) {
            case 'right':
              this.weaponSprite.setPosition(this.x + offsetX + swingOffset, this.y + offsetY);
              break;
            case 'left':
              this.weaponSprite.setPosition(this.x + offsetX - swingOffset, this.y + offsetY);
              break;
            case 'up':
              this.weaponSprite.setPosition(this.x + offsetX, this.y + offsetY - swingOffset);
              break;
            case 'down':
              this.weaponSprite.setPosition(this.x + offsetX, this.y + offsetY + swingOffset);
              break;
          }
        }
      },
      onComplete: () => {
        if (this.weaponSprite) {
          // Quick fade out
          this.scene.tweens.add({
            targets: this.weaponSprite,
            alpha: 0,
            duration: 50,
            onComplete: () => {
              this.weaponSprite?.destroy();
              this.weaponSprite = null;
            }
          });
        }
      }
    });

    // Add slash trail effect
    this.createSlashEffect(offsetX, offsetY, startAngle, endAngle, reachRadius);
  }

  private createSlashEffect(offsetX: number, offsetY: number, startAngle: number, endAngle: number, radius: number): void {
    const slashGraphics = this.scene.add.graphics();
    slashGraphics.setDepth(this.depth + 2);

    const centerX = this.x + offsetX;
    const centerY = this.y + offsetY;

    // Convert angles to radians
    const startRad = Phaser.Math.DegToRad(startAngle - 90);
    const endRad = Phaser.Math.DegToRad(endAngle - 90);

    // Animate the slash arc
    this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 100,
      ease: 'Power1',
      onUpdate: (tween) => {
        const progress = tween.getValue();
        slashGraphics.clear();

        // Draw arc with gradient alpha
        const currentAngle = startRad + (endRad - startRad) * progress;

        slashGraphics.lineStyle(3, 0xffffff, 0.8 * (1 - progress * 0.5));
        slashGraphics.beginPath();
        slashGraphics.arc(centerX, centerY, radius, startRad, currentAngle, startAngle > endAngle);
        slashGraphics.strokePath();

        // Inner glow
        slashGraphics.lineStyle(6, 0xffff88, 0.3 * (1 - progress));
        slashGraphics.beginPath();
        slashGraphics.arc(centerX, centerY, radius - 2, startRad, currentAngle, startAngle > endAngle);
        slashGraphics.strokePath();
      },
      onComplete: () => {
        slashGraphics.destroy();
      }
    });
  }

  private createChargeEffect(): void {
    this.chargeEffect = this.scene.add.graphics();
    this.chargeEffect.setDepth(this.depth - 1);
  }

  private updateChargeEffect(time: number): void {
    if (!this.chargeEffect) return;

    const elapsed = time - this.chargeStartTime;
    const percent = Math.min(elapsed / CHARGE_TIME, 1.0);

    this.chargeEffect.clear();

    // Growing circle
    const maxRadius = 20;
    const currentRadius = 4 + maxRadius * percent;
    const alpha = 0.2 + percent * 0.4;

    // Outer glow
    this.chargeEffect.fillStyle(0xffaa00, alpha * 0.3);
    this.chargeEffect.fillCircle(this.x, this.y, currentRadius + 4);

    // Inner circle
    this.chargeEffect.fillStyle(0xffdd44, alpha);
    this.chargeEffect.fillCircle(this.x, this.y, currentRadius);

    // Core
    this.chargeEffect.fillStyle(0xffffff, alpha * 1.5);
    this.chargeEffect.fillCircle(this.x, this.y, currentRadius * 0.3);

    // Tint player based on charge level
    if (percent > 0.7) {
      this.setTint(0xffaa00);
    } else if (percent > 0.3) {
      this.setTint(0xffdd88);
    }
  }

  private destroyChargeEffect(): void {
    if (this.chargeEffect) {
      this.chargeEffect.destroy();
      this.chargeEffect = null;
    }
    this.clearTint();
  }

  private handleDodge(time: number): void {
    const keyboardDodge = Phaser.Input.Keyboard.JustDown(this.dodgeKey);
    const gamepadDodge = this.isGamepadButtonJustDown(1); // B button

    if ((keyboardDodge || gamepadDodge) && !this.isAttacking && !this.isCharging && time - this.lastDodgeTime > DODGE_COOLDOWN) {
      this.performDodge(time);
    }
  }

  private performDodge(time: number): void {
    this.isDodging = true;
    this.lastDodgeTime = time;

    // Cancel charge if active
    if (this.isCharging) {
      this.destroyChargeEffect();
      this.isCharging = false;
    }

    // Set velocity in facing direction
    let vx = 0;
    let vy = 0;
    switch (this.facingDirection) {
      case 'right': vx = DODGE_SPEED; break;
      case 'left': vx = -DODGE_SPEED; break;
      case 'down': vy = DODGE_SPEED; break;
      case 'up': vy = -DODGE_SPEED; break;
    }
    (this.body as Phaser.Physics.Arcade.Body).setVelocity(vx, vy);

    // Grant i-frames during dodge
    this.startIFrames(DODGE_IFRAMES);

    // Afterimage trail
    this.createAfterimage();
    const trailTimer = this.scene.time.addEvent({
      delay: 50,
      repeat: 3,
      callback: () => this.createAfterimage()
    });

    // End dodge after duration
    this.scene.time.delayedCall(DODGE_DURATION, () => {
      this.isDodging = false;
      (this.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
      trailTimer.destroy();
    });
  }

  private createAfterimage(): void {
    const ghost = this.scene.add.image(this.x, this.y, this.texture.key);
    ghost.setScale(this.scaleX, this.scaleY);
    ghost.setFlipX(this.flipX);
    ghost.setAlpha(0.4);
    ghost.setTint(0x4488ff);
    ghost.setDepth(this.depth - 1);

    this.scene.tweens.add({
      targets: ghost,
      alpha: 0,
      duration: 200,
      onComplete: () => ghost.destroy()
    });
  }

  private handleInventoryKey(): void {
    if (Phaser.Input.Keyboard.JustDown(this.inventoryKey) || this.isGamepadButtonJustDown(3)) { // Y button
      this.scene.events.emit(EVENTS.OPEN_INVENTORY);
    }
  }

  private handleInteractKey(): void {
    if (Phaser.Input.Keyboard.JustDown(this.interactKey) || this.isGamepadButtonJustDown(2)) { // X button
      this.scene.events.emit('player-interact', { x: this.x, y: this.y, direction: this.facingDirection });
    }
  }

  private handleMapKey(): void {
    if (Phaser.Input.Keyboard.JustDown(this.mapKey) || this.isGamepadButtonJustDown(8)) { // Back/Select button
      this.scene.events.emit(EVENTS.OPEN_MAP);
    }
  }

  private handleQuestLogKey(): void {
    if (Phaser.Input.Keyboard.JustDown(this.questLogKey)) {
      this.scene.events.emit(EVENTS.OPEN_QUEST_LOG);
    }
  }

  takeDamage(amount: number): void {
    if (this.isInvulnerable) return;

    this.health = Math.max(0, this.health - amount);
    this.scene.events.emit(EVENTS.PLAYER_HEALTH_CHANGED, this.health, this.maxHealth);

    // Reset combo on taking damage
    this.combat.resetCombo();

    // Cancel charge on taking damage
    if (this.isCharging) {
      this.destroyChargeEffect();
      this.isCharging = false;
    }

    // Show damage number
    this.combat.showDamageNumber(this.x, this.y - 20, amount);

    // Start i-frames
    this.startIFrames(PLAYER_IFRAMES_DURATION);

    if (this.health <= 0) {
      this.die();
    }
  }

  private startIFrames(duration: number): void {
    // Clear any existing i-frame timers
    this.clearIFrameTimers();

    this.isInvulnerable = true;

    // Flash alpha
    let flashState = false;
    this.flashTimer = this.scene.time.addEvent({
      delay: PLAYER_IFRAMES_FLASH_RATE,
      loop: true,
      callback: () => {
        flashState = !flashState;
        this.setAlpha(flashState ? 0.3 : 1.0);
      }
    });

    // End i-frames
    this.iframeTimer = this.scene.time.delayedCall(duration, () => {
      this.isInvulnerable = false;
      this.setAlpha(1.0);
      this.clearIFrameTimers();
    });
  }

  private clearIFrameTimers(): void {
    if (this.flashTimer) {
      this.flashTimer.destroy();
      this.flashTimer = null;
    }
    if (this.iframeTimer) {
      this.iframeTimer.destroy();
      this.iframeTimer = null;
    }
  }

  isInvincible(): boolean {
    return this.isInvulnerable;
  }

  heal(amount: number): void {
    const actualHeal = Math.min(amount, this.maxHealth - this.health);
    this.health += actualHeal;
    this.scene.events.emit(EVENTS.PLAYER_HEALTH_CHANGED, this.health, this.maxHealth);

    if (actualHeal > 0) {
      this.combat.showDamageNumber(this.x, this.y - 20, actualHeal, false, true);
    }
  }

  addGold(amount: number): void {
    this.gold += amount;
    this.scene.events.emit(EVENTS.PLAYER_GOLD_CHANGED, this.gold);
  }

  removeGold(amount: number): boolean {
    if (this.gold < amount) return false;
    this.gold -= amount;
    this.scene.events.emit(EVENTS.PLAYER_GOLD_CHANGED, this.gold);
    return true;
  }

  useConsumable(slotIndex: number): boolean {
    const invItem = this.inventory.getItem(slotIndex);
    if (!invItem || invItem.item.type !== 'consumable') return false;

    const item = invItem.item;

    // Apply item effects
    if (item.stats.healAmount) {
      this.heal(item.stats.healAmount);
    }

    // Remove item from inventory
    this.inventory.removeItem(slotIndex);
    return true;
  }

  private die(): void {
    this.clearIFrameTimers();
    this.destroyChargeEffect();
    this.setActive(false);
    this.setVisible(false);
    this.scene.events.emit('player-died');
  }

  getFacingDirection(): Direction {
    return this.facingDirection;
  }

  private getGamepad(): Phaser.Input.Gamepad.Gamepad | null {
    if (!this.scene.input.gamepad || this.scene.input.gamepad.total === 0) return null;
    return this.scene.input.gamepad.getPad(0);
  }

  private isGamepadButtonDown(buttonIndex: number): boolean {
    const pad = this.getGamepad();
    if (!pad) return false;
    return pad.buttons[buttonIndex]?.pressed ?? false;
  }

  private isGamepadButtonJustDown(buttonIndex: number): boolean {
    const pad = this.getGamepad();
    if (!pad) return false;
    const isDown = pad.buttons[buttonIndex]?.pressed ?? false;
    const wasDown = this.prevGamepadButtons[buttonIndex] ?? false;
    return isDown && !wasDown;
  }

  private isGamepadButtonJustUp(buttonIndex: number): boolean {
    const pad = this.getGamepad();
    if (!pad) return false;
    const isDown = pad.buttons[buttonIndex]?.pressed ?? false;
    const wasDown = this.prevGamepadButtons[buttonIndex] ?? false;
    return !isDown && wasDown;
  }

  private updateGamepadState(): void {
    const pad = this.getGamepad();
    if (!pad) return;
    this.prevGamepadButtons = pad.buttons.map(b => b.pressed);
  }

  getInteractionPoint(): { x: number; y: number } {
    const offset = 24;
    let x = this.x;
    let y = this.y;

    switch (this.facingDirection) {
      case 'up': y -= offset; break;
      case 'down': y += offset; break;
      case 'left': x -= offset; break;
      case 'right': x += offset; break;
    }

    return { x, y };
  }
}
