import Phaser from 'phaser';
import { SCENE_KEYS, GAME_WIDTH, GAME_HEIGHT, INVENTORY_SLOTS, INVENTORY_COLS, EVENTS } from '../config/constants';
import { launchOverlayTab, getNextTab, createTabBar, bindTabShortcuts } from '../systems/TabNavigation';
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
  private slotBgs: Phaser.GameObjects.Rectangle[] = [];
  private equipmentSlots: Map<EquipmentSlot, Phaser.GameObjects.Container> = new Map();
  private _selectedSlot: number = 0;
  private tooltipContainer: Phaser.GameObjects.Container | null = null;
  private statsText!: Phaser.GameObjects.Text;
  private flashText: Phaser.GameObjects.Text | null = null;
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
    this.slotBgs = [];
    this.equipmentSlots.clear();
    this._selectedSlot = 0;
    this.tooltipContainer = null;
    this.flashText = null;
    this.prevGamepadButtons = [];

    // Semi-transparent background
    const bg = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.7);
    bg.setInteractive();

    // Tab bar
    this.createTabBar();

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

    // Hint text
    this.add.text(panelX, panelY + panelHeight / 2 - 12, '[D] Drop  [ENTER] Use/Equip  [ESC] Close', {
      fontSize: '10px',
      fontFamily: 'monospace',
      color: '#666666'
    }).setOrigin(0.5);

    // ESC to close, I/Q/M/L to switch tabs
    this.input.keyboard?.on('keydown-ESC', () => this.closeInventory());
    this.input.keyboard?.on('keydown-TAB', (e: KeyboardEvent) => {
      e.preventDefault();
      this.switchToNextTab();
    });
    bindTabShortcuts(this, 'INVENTORY', () => this.closeInventory());

    // Arrow key / WASD grid navigation
    this.input.keyboard?.on('keydown-LEFT', () => this.moveSelection(-1, 0));
    this.input.keyboard?.on('keydown-RIGHT', () => this.moveSelection(1, 0));
    this.input.keyboard?.on('keydown-UP', () => this.moveSelection(0, -1));
    this.input.keyboard?.on('keydown-DOWN', () => this.moveSelection(0, 1));
    this.input.keyboard?.on('keydown-A', () => this.moveSelection(-1, 0));
    this.input.keyboard?.on('keydown-D', () => this.handleDKey());
    this.input.keyboard?.on('keydown-W', () => this.moveSelection(0, -1));
    this.input.keyboard?.on('keydown-S', () => this.moveSelection(0, 1));

    // Use/equip selected item
    this.input.keyboard?.on('keydown-ENTER', () => this.activateSelected());
    this.input.keyboard?.on('keydown-SPACE', () => this.activateSelected());

    // Update display
    this.updateInventoryDisplay();
    this.updateEquipmentDisplay();
    this.updateStats();
    this.updateSelectionHighlight();
  }

  update(): void {
    const pad = this.input.gamepad?.getPad(0);
    if (!pad) return;
    const prev = this.prevGamepadButtons;
    const justDown = (i: number) => (pad.buttons[i]?.pressed ?? false) && !(prev[i] ?? false);

    if (justDown(1) || justDown(3)) this.closeInventory(); // B or Y button
    if (justDown(14)) this.moveSelection(-1, 0);  // D-pad left
    if (justDown(15)) this.moveSelection(1, 0);   // D-pad right
    if (justDown(12)) this.moveSelection(0, -1);  // D-pad up
    if (justDown(13)) this.moveSelection(0, 1);   // D-pad down
    if (justDown(0)) this.activateSelected();      // A button
    if (justDown(2)) this.dropSelected();          // X button

    this.prevGamepadButtons = pad.buttons.map(b => b.pressed);
  }

  private handleDKey(): void {
    // D key is both "move right" in some layouts, but primarily "drop" here
    this.dropSelected();
  }

  private moveSelection(dx: number, dy: number): void {
    const cols = INVENTORY_COLS;
    const col = this._selectedSlot % cols;
    const row = Math.floor(this._selectedSlot / cols);
    const rows = Math.ceil(INVENTORY_SLOTS / cols);

    let newCol = col + dx;
    let newRow = row + dy;

    // Wrap
    if (newCol < 0) newCol = cols - 1;
    if (newCol >= cols) newCol = 0;
    if (newRow < 0) newRow = rows - 1;
    if (newRow >= rows) newRow = 0;

    let newIndex = newRow * cols + newCol;
    if (newIndex >= INVENTORY_SLOTS) newIndex = INVENTORY_SLOTS - 1;

    this._selectedSlot = newIndex;
    this.updateSelectionHighlight();
  }

  private updateSelectionHighlight(): void {
    this.slotBgs.forEach((bg, i) => {
      if (i === this._selectedSlot) {
        bg.setStrokeStyle(2, 0xffdd55);
        bg.setFillStyle(0x5a5a7a);
      } else {
        bg.setStrokeStyle(1, 0x5a5a7a);
        bg.setFillStyle(0x3a3a5a);
      }
    });

    // Update tooltip for keyboard nav
    this.hideTooltip();
    const invItem = this.inventory.getItem(this._selectedSlot);
    if (invItem) {
      const container = this.slotContainers[this._selectedSlot];
      if (container) {
        this.showTooltip(container.x, container.y, invItem.item);
      }
    }
  }

  private activateSelected(): void {
    this.onInventorySlotClick(this._selectedSlot);
  }

  private dropSelected(): void {
    const invItem = this.inventory.getItem(this._selectedSlot);
    if (!invItem) return;

    const itemName = invItem.item.name;
    this.inventory.removeItem(this._selectedSlot);
    this.updateInventoryDisplay();
    this.updateSelectionHighlight();
    this.showFlash(`Dropped ${itemName}`, '#ff8888');
  }

  private showFlash(message: string, color: string): void {
    if (this.flashText) this.flashText.destroy();

    this.flashText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 140, message, {
      fontSize: '14px',
      fontFamily: 'monospace',
      color,
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5).setDepth(2000);

    this.tweens.add({
      targets: this.flashText,
      alpha: 0,
      y: this.flashText.y - 25,
      duration: 1200,
      ease: 'Power2',
      onComplete: () => {
        this.flashText?.destroy();
        this.flashText = null;
      }
    });
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
      { slot: 'weapon', label: 'Weapon', x: -90, y: 30 },
      { slot: 'armor', label: 'Armor', x: -30, y: 30 },
      { slot: 'shield', label: 'Shield', x: 30, y: 30 },
      { slot: 'spellbook', label: 'Tome', x: 90, y: 30 }
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

    if (type === 'inventory') {
      this.slotBgs.push(slotBg);
    }

    // Interaction handlers
    slotBg.on('pointerover', () => {
      if (type === 'inventory') {
        this._selectedSlot = index;
        this.updateSelectionHighlight();
      } else {
        slotBg.setFillStyle(0x5a5a7a);
        if (equipSlot) {
          const item = this.inventory.getEquipment()[equipSlot];
          if (item) {
            this.showTooltip(x, y, item);
          }
        }
      }
    });

    slotBg.on('pointerout', () => {
      if (type !== 'inventory') {
        slotBg.setFillStyle(0x3a3a5a);
        this.hideTooltip();
      }
    });

    slotBg.on('pointerdown', () => {
      if (type === 'inventory') {
        this._selectedSlot = index;
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
      return;
    }

    // If item is equippable, equip it
    if (invItem.item.slot) {
      this.inventory.equipItem(index);
      this.updateInventoryDisplay();
      this.updateEquipmentDisplay();
      this.updateStats();
      this.updateSelectionHighlight();

      // Emit event to update UI
      this.scene.get(SCENE_KEYS.GAME).events.emit(EVENTS.PLAYER_EQUIPMENT_CHANGED, this.inventory.getEquipment());
    }
    // If item is consumable, use it
    else if (invItem.item.type === 'consumable') {
      this.player.useConsumable(index);
      this.updateInventoryDisplay();
      this.updateSelectionHighlight();
    }
  }

  private onEquipmentSlotClick(slot: EquipmentSlot): void {
    const equipped = this.inventory.getEquipment()[slot];

    if (equipped) {
      this.inventory.unequipItem(slot);
      this.updateInventoryDisplay();
      this.updateEquipmentDisplay();
      this.updateStats();
      this.updateSelectionHighlight();

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
    const typeLabel = item.slot === 'spellbook' ? 'SPELLBOOK'
      : item.type === 'armor'
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

  private createTabBar(): void {
    createTabBar(this, 'INVENTORY', (tabKey) => launchOverlayTab(this, tabKey));
  }

  private switchToNextTab(): void {
    launchOverlayTab(this, getNextTab('INVENTORY'));
  }

  private closeInventory(): void {
    this.scene.get(SCENE_KEYS.GAME).events.emit(EVENTS.CLOSE_INVENTORY);
    this.scene.stop();
  }
}
