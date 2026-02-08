import Phaser from 'phaser';
import { PLAYER_SPEED, PLAYER_MAX_HEALTH, PLAYER_START_GOLD, SCALE, EVENTS } from '../config/constants';
import { InventorySystem } from '../systems/InventorySystem';
import { CombatSystem } from '../systems/CombatSystem';

type Direction = 'up' | 'down' | 'left' | 'right';

export class Player extends Phaser.Physics.Arcade.Sprite {
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key };
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private inventoryKey!: Phaser.Input.Keyboard.Key;
  private interactKey!: Phaser.Input.Keyboard.Key;

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
  }

  update(time: number): void {
    if (!this.active) return;

    this.handleMovement();
    this.handleAttack(time);
    this.handleInventoryKey();
    this.handleInteractKey();
  }

  private handleMovement(): void {
    if (this.isAttacking) {
      this.setVelocity(0);
      return;
    }

    const body = this.body as Phaser.Physics.Arcade.Body;
    let velocityX = 0;
    let velocityY = 0;

    // Check horizontal movement
    if (this.cursors.left.isDown || this.wasd.A.isDown) {
      velocityX = -PLAYER_SPEED;
      this.facingDirection = 'left';
      this.setFlipX(true);
    } else if (this.cursors.right.isDown || this.wasd.D.isDown) {
      velocityX = PLAYER_SPEED;
      this.facingDirection = 'right';
      this.setFlipX(false);
    }

    // Check vertical movement
    if (this.cursors.up.isDown || this.wasd.W.isDown) {
      velocityY = -PLAYER_SPEED;
      this.facingDirection = 'up';
    } else if (this.cursors.down.isDown || this.wasd.S.isDown) {
      velocityY = PLAYER_SPEED;
      this.facingDirection = 'down';
    }

    // Normalize diagonal movement
    if (velocityX !== 0 && velocityY !== 0) {
      velocityX *= 0.707;
      velocityY *= 0.707;
    }

    body.setVelocity(velocityX, velocityY);
  }

  private handleAttack(time: number): void {
    const cooldown = this.combat.getAttackCooldown();

    if (Phaser.Input.Keyboard.JustDown(this.spaceKey) && time - this.lastAttackTime > cooldown) {
      this.performAttack();
      this.lastAttackTime = time;
    }
  }

  private performAttack(): void {
    this.isAttacking = true;
    this.setVelocity(0);

    // Create attack hitbox based on facing direction
    const range = this.inventory.getWeaponRange();
    let hitboxX = this.x;
    let hitboxY = this.y;
    const hitboxWidth = range;
    const hitboxHeight = range;

    switch (this.facingDirection) {
      case 'up':
        hitboxY -= range / 2 + 8;
        break;
      case 'down':
        hitboxY += range / 2 + 8;
        break;
      case 'left':
        hitboxX -= range / 2 + 8;
        break;
      case 'right':
        hitboxX += range / 2 + 8;
        break;
    }

    // Create sword swing animation
    this.createSwordSwing();

    // Store hitbox info for collision checking
    this.scene.events.emit('player-attack', {
      x: hitboxX,
      y: hitboxY,
      width: hitboxWidth,
      height: hitboxHeight,
      damage: this.combat.calculatePlayerDamage()
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

  private createSwordSwing(): void {
    const weapon = this.inventory.getEquippedWeapon();
    const weaponTexture = weapon?.sprite || 'weapon_sword_wooden';

    // Position and rotation settings based on facing direction
    let startAngle: number;
    let endAngle: number;
    let offsetX: number;
    let offsetY: number;
    const swingDistance = 20;

    switch (this.facingDirection) {
      case 'right':
        startAngle = -90;
        endAngle = 90;
        offsetX = 8;
        offsetY = 0;
        break;
      case 'left':
        startAngle = 90;
        endAngle = -90;
        offsetX = -8;
        offsetY = 0;
        break;
      case 'up':
        startAngle = 180;
        endAngle = 0;
        offsetX = 0;
        offsetY = -8;
        break;
      case 'down':
      default:
        startAngle = 0;
        endAngle = 180;
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
    this.createSlashEffect(offsetX, offsetY, startAngle, endAngle);
  }

  private createSlashEffect(offsetX: number, offsetY: number, startAngle: number, endAngle: number): void {
    const slashGraphics = this.scene.add.graphics();
    slashGraphics.setDepth(this.depth + 2);

    const centerX = this.x + offsetX;
    const centerY = this.y + offsetY;
    const radius = 24;

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

  private handleInventoryKey(): void {
    if (Phaser.Input.Keyboard.JustDown(this.inventoryKey)) {
      this.scene.events.emit(EVENTS.OPEN_INVENTORY);
    }
  }

  private handleInteractKey(): void {
    if (Phaser.Input.Keyboard.JustDown(this.interactKey)) {
      this.scene.events.emit('player-interact', { x: this.x, y: this.y, direction: this.facingDirection });
    }
  }

  takeDamage(amount: number): void {
    this.health = Math.max(0, this.health - amount);
    this.scene.events.emit(EVENTS.PLAYER_HEALTH_CHANGED, this.health, this.maxHealth);

    // Flash red on damage
    this.setTint(0xff0000);
    this.scene.time.delayedCall(100, () => this.clearTint());

    // Show damage number
    this.combat.showDamageNumber(this.x, this.y - 20, amount);

    if (this.health <= 0) {
      this.die();
    }
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
    this.setActive(false);
    this.setVisible(false);
    this.scene.events.emit('player-died');
  }

  getFacingDirection(): Direction {
    return this.facingDirection;
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
