import Phaser from 'phaser';
import { SCENE_KEYS, GAME_WIDTH, GAME_HEIGHT, INVENTORY_SLOTS, INVENTORY_COLS, EVENTS } from '../config/constants';
import { InventorySystem } from '../systems/InventorySystem';
import { EquipmentSlot, Item } from '../types';
import { Player } from '../entities/Player';

interface InventorySceneData {
  inventory: InventorySystem;
  player: Player;
}

export class InventoryScene extends Phaser.Scene {
  private inventory!: InventorySystem;
  private player!: Player;

  private slotContainers: Phaser.GameObjects.Container[] = [];
  private equipmentSlots: Map<EquipmentSlot, Phaser.GameObjects.Container> = new Map();
  private _selectedSlot: number = -1;
  private tooltipContainer: Phaser.GameObjects.Container | null = null;
  private statsText!: Phaser.GameObjects.Text;
  private prevGamepadButtons: boolean[] = [];

  private readonly SLOT_SIZE = 48;
  private readonly SLOT_PADDING = 4;

  constructor() {
    super({ key: SCENE_KEYS.INVENTORY });
  }

  init(data: InventorySceneData): void {
    this.inventory = data.inventory;
    this.player = data.player;
  }

  create(): void {
    // Reset state from previous launches (scene instance is reused)
    this.slotContainers = [];
    this.equipmentSlots.clear();
    this._selectedSlot = -1;
    this.tooltipContainer = null;
    this.prevGamepadButtons = [];

    // Semi-transparent background
    const bg = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.7);
    bg.setInteractive();

    // Main panel
    const panelWidth = 550;
    const panelHeight = 400;
    const panelX = GAME_WIDTH / 2;
    const panelY = GAME_HEIGHT / 2;

    const panel = this.add.rectangle(panelX, panelY, panelWidth, panelHeight, 0x2a2a4a, 0.95);
    panel.setStrokeStyle(2, 0x4a4a6a);

    // Title
    this.add.text(panelX, panelY - panelHeight / 2 + 25, 'INVENTORY', {
      fontSize: '24px',
      fontFamily: 'monospace',
      color: '#c9a227'
    }).setOrigin(0.5);

    // Close button
    const closeBtn = this.add.text(panelX + panelWidth / 2 - 30, panelY - panelHeight / 2 + 15, 'X', {
      fontSize: '20px',
      fontFamily: 'monospace',
      color: '#ff6666'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    closeBtn.on('pointerover', () => closeBtn.setColor('#ff0000'));
    closeBtn.on('pointerout', () => closeBtn.setColor('#ff6666'));
    closeBtn.on('pointerdown', () => this.closeInventory());

    // Create inventory grid
    this.createInventoryGrid(panelX - 100, panelY - 80);

    // Create equipment slots
    this.createEquipmentSlots(panelX + 150, panelY - 100);

    // Create stats display
    this.createStatsDisplay(panelX + 150, panelY + 80);

    // ESC or I to close
    this.input.keyboard?.on('keydown-ESC', () => this.closeInventory());
    this.input.keyboard?.on('keydown-I', () => this.closeInventory());

    // Update display
    this.updateInventoryDisplay();
    this.updateEquipmentDisplay();
    this.updateStats();
  }

  update(): void {
    const pad = this.input.gamepad?.getPad(0);
    if (!pad) return;
    const prev = this.prevGamepadButtons;
    const justDown = (i: number) => (pad.buttons[i]?.pressed ?? false) && !(prev[i] ?? false);

    if (justDown(1) || justDown(3)) this.closeInventory(); // B or Y button

    this.prevGamepadButtons = pad.buttons.map(b => b.pressed);
  }

  private createInventoryGrid(startX: number, startY: number): void {
    const totalWidth = INVENTORY_COLS * (this.SLOT_SIZE + this.SLOT_PADDING);
    const offsetX = startX - totalWidth / 2;

    for (let i = 0; i < INVENTORY_SLOTS; i++) {
      const col = i % INVENTORY_COLS;
      const row = Math.floor(i / INVENTORY_COLS);
      const x = offsetX + col * (this.SLOT_SIZE + this.SLOT_PADDING);
      const y = startY + row * (this.SLOT_SIZE + this.SLOT_PADDING);

      const container = this.createSlot(x, y, i, 'inventory');
      this.slotContainers.push(container);
    }
  }

  private createEquipmentSlots(startX: number, startY: number): void {
    const slots: { slot: EquipmentSlot; label: string; x: number; y: number }[] = [
      { slot: 'weapon', label: 'Weapon', x: -60, y: 30 },
      { slot: 'armor', label: 'Armor', x: 0, y: 30 },
      { slot: 'shield', label: 'Shield', x: 60, y: 30 }
    ];

    // Label
    this.add.text(startX, startY - 30, 'Equipment', {
      fontSize: '14px',
      fontFamily: 'monospace',
      color: '#888888'
    }).setOrigin(0.5);

    slots.forEach(({ slot, label, x, y }) => {
      const slotX = startX + x;
      const slotY = startY + y;

      const container = this.createSlot(slotX, slotY, -1, 'equipment', slot);
      this.equipmentSlots.set(slot, container);

      // Slot label
      this.add.text(slotX, slotY + this.SLOT_SIZE / 2 + 8, label, {
        fontSize: '8px',
        fontFamily: 'monospace',
        color: '#666666'
      }).setOrigin(0.5);
    });
  }

  private createSlot(x: number, y: number, index: number, type: 'inventory' | 'equipment', equipSlot?: EquipmentSlot): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);

    // Slot background
    const slotBg = this.add.rectangle(0, 0, this.SLOT_SIZE, this.SLOT_SIZE, 0x3a3a5a);
    slotBg.setStrokeStyle(1, 0x5a5a7a);
    slotBg.setInteractive({ useHandCursor: true });

    container.add(slotBg);

    // Interaction handlers
    slotBg.on('pointerover', () => {
      slotBg.setFillStyle(0x5a5a7a);

      if (type === 'inventory') {
        const invItem = this.inventory.getItem(index);
        if (invItem) {
          this.showTooltip(x, y, invItem.item);
        }
      } else if (equipSlot) {
        const item = this.inventory.getEquipment()[equipSlot];
        if (item) {
          this.showTooltip(x, y, item);
        }
      }
    });

    slotBg.on('pointerout', () => {
      slotBg.setFillStyle(0x3a3a5a);
      this.hideTooltip();
    });

    slotBg.on('pointerdown', () => {
      if (type === 'inventory') {
        this.onInventorySlotClick(index);
      } else if (equipSlot) {
        this.onEquipmentSlotClick(equipSlot);
      }
    });

    return container;
  }

  private createStatsDisplay(x: number, y: number): void {
    this.add.text(x, y - 15, 'Stats', {
      fontSize: '14px',
      fontFamily: 'monospace',
      color: '#888888'
    }).setOrigin(0.5);

    this.statsText = this.add.text(x, y + 10, '', {
      fontSize: '12px',
      fontFamily: 'monospace',
      color: '#ffffff',
      lineSpacing: 5
    }).setOrigin(0.5, 0);
  }

  private updateStats(): void {
    const weapon = this.inventory.getEquippedWeapon();
    const damage = this.inventory.getWeaponDamage();
    const speed = this.inventory.getWeaponSpeed();
    const defense = this.inventory.getTotalDefense();

    this.statsText.setText([
      `Damage: ${damage}`,
      `Speed: ${speed.toFixed(1)}x`,
      `Defense: ${defense}`,
      '',
      weapon ? `Weapon: ${weapon.name}` : 'Weapon: None'
    ].join('\n'));
  }

  private onInventorySlotClick(index: number): void {
    const invItem = this.inventory.getItem(index);

    if (!invItem) {
      this._selectedSlot = -1;
      return;
    }

    // If item is equippable, equip it
    if (invItem.item.slot) {
      this.inventory.equipItem(index);
      this.updateInventoryDisplay();
      this.updateEquipmentDisplay();
      this.updateStats();

      // Emit event to update UI
      this.scene.get(SCENE_KEYS.GAME).events.emit(EVENTS.PLAYER_EQUIPMENT_CHANGED, this.inventory.getEquipment());
    }
    // If item is consumable, use it
    else if (invItem.item.type === 'consumable') {
      this.player.useConsumable(index);
      this.updateInventoryDisplay();
    }
  }

  private onEquipmentSlotClick(slot: EquipmentSlot): void {
    const equipped = this.inventory.getEquipment()[slot];

    if (equipped) {
      this.inventory.unequipItem(slot);
      this.updateInventoryDisplay();
      this.updateEquipmentDisplay();
      this.updateStats();

      // Emit event to update UI
      this.scene.get(SCENE_KEYS.GAME).events.emit(EVENTS.PLAYER_EQUIPMENT_CHANGED, this.inventory.getEquipment());
    }
  }

  private updateInventoryDisplay(): void {
    const items = this.inventory.getAllItems();

    this.slotContainers.forEach((container, index) => {
      // Remove old item icon and quantity if present
      while (container.length > 1) {
        container.removeAt(1, true);
      }

      const invItem = items[index];
      if (invItem) {
        // Add item icon
        const icon = this.add.image(0, 0, invItem.item.sprite).setScale(2);
        container.add(icon);

        // Add quantity if stackable
        if (invItem.quantity > 1) {
          const qty = this.add.text(this.SLOT_SIZE / 2 - 8, this.SLOT_SIZE / 2 - 8, `${invItem.quantity}`, {
            fontSize: '10px',
            fontFamily: 'monospace',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 2
          }).setOrigin(0.5);
          container.add(qty);
        }
      }
    });
  }

  private updateEquipmentDisplay(): void {
    const equipment = this.inventory.getEquipment();

    this.equipmentSlots.forEach((container, slot) => {
      // Remove old item icon if present
      while (container.length > 1) {
        container.removeAt(1, true);
      }

      const item = equipment[slot];
      if (item) {
        const icon = this.add.image(0, 0, item.sprite).setScale(2);
        container.add(icon);
      }
    });
  }

  private showTooltip(x: number, y: number, item: Item): void {
    this.hideTooltip();

    const tooltipWidth = 180;
    const tooltipX = x + this.SLOT_SIZE + 10;
    const tooltipY = y;

    this.tooltipContainer = this.add.container(tooltipX, tooltipY);

    // Background
    const bg = this.add.rectangle(0, 0, tooltipWidth, 120, 0x1a1a2e, 0.95);
    bg.setStrokeStyle(1, 0x4a4a6a);
    bg.setOrigin(0, 0.5);
    this.tooltipContainer.add(bg);

    // Item name
    const name = this.add.text(10, -45, item.name, {
      fontSize: '12px',
      fontFamily: 'monospace',
      color: '#c9a227'
    });
    this.tooltipContainer.add(name);

    // Item type
    const typeLabel = item.type === 'armor'
      ? (item.slot === 'shield' ? 'SHIELD' : 'ARMOR')
      : item.type.toUpperCase();
    const type = this.add.text(10, -28, typeLabel, {
      fontSize: '8px',
      fontFamily: 'monospace',
      color: '#888888'
    });
    this.tooltipContainer.add(type);

    // Stats
    let yOffset = -10;
    if (item.stats.damage) {
      const dmg = this.add.text(10, yOffset, `Damage: ${item.stats.damage}`, {
        fontSize: '10px',
        fontFamily: 'monospace',
        color: '#ff6666'
      });
      this.tooltipContainer.add(dmg);
      yOffset += 14;
    }
    if (item.stats.speed) {
      const spd = this.add.text(10, yOffset, `Speed: ${item.stats.speed}x`, {
        fontSize: '10px',
        fontFamily: 'monospace',
        color: '#66ff66'
      });
      this.tooltipContainer.add(spd);
      yOffset += 14;
    }
    if (item.stats.defense) {
      const def = this.add.text(10, yOffset, `Defense: ${item.stats.defense}`, {
        fontSize: '10px',
        fontFamily: 'monospace',
        color: '#6688ff'
      });
      this.tooltipContainer.add(def);
      yOffset += 14;
    }
    if (item.stats.healAmount) {
      const heal = this.add.text(10, yOffset, `Heals: ${item.stats.healAmount} HP`, {
        fontSize: '10px',
        fontFamily: 'monospace',
        color: '#66ff66'
      });
      this.tooltipContainer.add(heal);
      yOffset += 14;
    }

    // Value
    const value = this.add.text(10, yOffset + 5, `Value: ${item.value}g`, {
      fontSize: '10px',
      fontFamily: 'monospace',
      color: '#ffd700'
    });
    this.tooltipContainer.add(value);

    this.tooltipContainer.setDepth(1000);
  }

  private hideTooltip(): void {
    if (this.tooltipContainer) {
      this.tooltipContainer.destroy();
      this.tooltipContainer = null;
    }
  }

  private closeInventory(): void {
    this.scene.get(SCENE_KEYS.GAME).events.emit(EVENTS.CLOSE_INVENTORY);
    this.scene.stop();
  }
}
