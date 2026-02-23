import Phaser from 'phaser';
import { SCENE_KEYS, GAME_WIDTH, GAME_HEIGHT, EVENTS, INVENTORY_SLOTS, INVENTORY_COLS } from '../config/constants';
import { NPCData, ShopItem, Item } from '../types';
import { InventorySystem } from '../systems/InventorySystem';
import { ShopSystem, getDisplayedShopItems } from '../systems/ShopSystem';
import { getItem } from '../data/items';
import { Player } from '../entities/Player';

interface ShopSceneData {
  npcData: NPCData;
  inventory: InventorySystem;
  playerGold: { current: number };
  player: Player;
  mode: 'buy' | 'sell';
}

export class ShopScene extends Phaser.Scene {
  private npcData!: NPCData;
  private inventory!: InventorySystem;
  private shopSystem!: ShopSystem;
  private player!: Player;
  private playerGold!: { current: number };
  private mode!: 'buy' | 'sell';

  private displayedItems: ShopItem[] = [];
  private selectedIndex: number = 0;
  private goldText!: Phaser.GameObjects.Text;
  private modeText!: Phaser.GameObjects.Text;
  private gridContainer!: Phaser.GameObjects.Container;
  private detailsContainer!: Phaser.GameObjects.Container;
  private slotBgs: Phaser.GameObjects.Rectangle[] = [];
  private flashText: Phaser.GameObjects.Text | null = null;
  private prevGamepadButtons: boolean[] = [];

  private readonly SLOT_SIZE = 48;
  private readonly SLOT_PADDING = 4;
  private readonly GRID_COLS = 5;

  constructor() {
    super({ key: SCENE_KEYS.SHOP });
  }

  init(data: ShopSceneData): void {
    this.npcData = data.npcData;
    this.inventory = data.inventory;
    this.player = data.player;
    this.playerGold = { current: data.player.gold };
    this.shopSystem = new ShopSystem(this.inventory, this.playerGold);
    this.mode = data.mode;
  }

  create(): void {
    this.slotBgs = [];
    this.selectedIndex = 0;
    this.flashText = null;
    this.prevGamepadButtons = [];

    if (this.mode === 'buy') {
      this.displayedItems = getDisplayedShopItems(this.npcData);
    }

    // Semi-transparent background
    const bg = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.7);
    bg.setInteractive();

    // Shop panel
    const panelWidth = 580;
    const panelHeight = 380;
    const panelX = GAME_WIDTH / 2;
    const panelY = GAME_HEIGHT / 2;

    const panel = this.add.rectangle(panelX, panelY, panelWidth, panelHeight, 0x2a2a4a, 0.95);
    panel.setStrokeStyle(2, 0x4a4a6a);

    // Title
    this.add.text(panelX - panelWidth / 2 + 20, panelY - panelHeight / 2 + 15, this.npcData.name, {
      fontSize: '18px',
      fontFamily: 'monospace',
      color: '#c9a227'
    }).setOrigin(0, 0.5);

    // Mode indicator
    this.modeText = this.add.text(panelX, panelY - panelHeight / 2 + 15, '', {
      fontSize: '14px',
      fontFamily: 'monospace',
      color: '#ffffff'
    }).setOrigin(0.5, 0.5);
    this.updateModeText();

    // Gold display
    this.goldText = this.add.text(panelX + panelWidth / 2 - 20, panelY - panelHeight / 2 + 15, `Gold: ${this.playerGold.current}`, {
      fontSize: '14px',
      fontFamily: 'monospace',
      color: '#ffd700'
    }).setOrigin(1, 0.5);

    // Separator
    const sepY = panelY - panelHeight / 2 + 32;
    const sep = this.add.graphics();
    sep.lineStyle(1, 0x4a4a6a);
    sep.lineBetween(panelX - panelWidth / 2 + 10, sepY, panelX + panelWidth / 2 - 10, sepY);

    // Grid area (left side)
    const gridX = panelX - panelWidth / 2 + 30;
    const gridY = panelY - panelHeight / 2 + 50;
    this.gridContainer = this.add.container(gridX, gridY);

    // Details panel (right side)
    const detailsX = panelX + 60;
    const detailsY = panelY - panelHeight / 2 + 50;
    this.detailsContainer = this.add.container(detailsX, detailsY);

    // Build the grid
    this.buildGrid();

    // Details placeholder
    this.buildDetailsPanel();

    // Close button
    const closeBtn = this.add.text(panelX + panelWidth / 2 - 30, panelY - panelHeight / 2 + 12, 'X', {
      fontSize: '18px',
      fontFamily: 'monospace',
      color: '#ff6666'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerover', () => closeBtn.setColor('#ff0000'));
    closeBtn.on('pointerout', () => closeBtn.setColor('#ff6666'));
    closeBtn.on('pointerdown', () => this.closeShop());

    // Keyboard controls
    this.input.keyboard?.on('keydown-ESC', () => this.closeShop());
    this.input.keyboard?.on('keydown-LEFT', () => this.moveGrid(-1, 0));
    this.input.keyboard?.on('keydown-RIGHT', () => this.moveGrid(1, 0));
    this.input.keyboard?.on('keydown-UP', () => this.moveGrid(0, -1));
    this.input.keyboard?.on('keydown-DOWN', () => this.moveGrid(0, 1));
    this.input.keyboard?.on('keydown-A', () => this.moveGrid(-1, 0));
    this.input.keyboard?.on('keydown-D', () => this.moveGrid(1, 0));
    this.input.keyboard?.on('keydown-W', () => this.moveGrid(0, -1));
    this.input.keyboard?.on('keydown-S', () => this.moveGrid(0, 1));
    this.input.keyboard?.on('keydown-ENTER', () => this.activateSelected());
    this.input.keyboard?.on('keydown-SPACE', () => this.activateSelected());
    this.input.keyboard?.on('keydown-B', () => this.switchMode('buy'));
    this.input.keyboard?.on('keydown-T', () => this.switchMode('sell'));

    // Hint text at bottom
    const hintY = panelY + panelHeight / 2 - 12;
    this.add.text(panelX, hintY, '[B] Buy  [T] Sell  [ESC] Close', {
      fontSize: '10px',
      fontFamily: 'monospace',
      color: '#666666'
    }).setOrigin(0.5);

    // Select first item
    this.updateSelection();
  }

  update(): void {
    const pad = this.input.gamepad?.getPad(0);
    if (!pad) return;
    const prev = this.prevGamepadButtons;
    const justDown = (i: number) => (pad.buttons[i]?.pressed ?? false) && !(prev[i] ?? false);

    if (justDown(14)) this.moveGrid(-1, 0);  // D-pad left
    if (justDown(15)) this.moveGrid(1, 0);   // D-pad right
    if (justDown(12)) this.moveGrid(0, -1);  // D-pad up
    if (justDown(13)) this.moveGrid(0, 1);   // D-pad down
    if (justDown(0)) this.activateSelected(); // A button
    if (justDown(1)) this.closeShop();        // B button

    this.prevGamepadButtons = pad.buttons.map(b => b.pressed);
  }

  private switchMode(newMode: 'buy' | 'sell'): void {
    if (this.mode === newMode) return;
    this.mode = newMode;
    this.selectedIndex = 0;
    if (this.mode === 'buy') {
      this.displayedItems = getDisplayedShopItems(this.npcData);
    }
    this.updateModeText();
    this.rebuildGrid();
    this.updateSelection();
  }

  private updateModeText(): void {
    const buyStyle = this.mode === 'buy' ? '#ffdd55' : '#666666';
    const sellStyle = this.mode === 'sell' ? '#ffdd55' : '#666666';
    this.modeText.setText(`[B]uy  [T]o Sell`);
    // Use a simple highlight approach
    this.modeText.setText(this.mode === 'buy' ? '[ BUY ]  sell' : 'buy  [ SELL ]');
    this.modeText.setColor(this.mode === 'buy' ? '#88ff88' : '#ff8888');
  }

  private getSlotCount(): number {
    if (this.mode === 'sell') return INVENTORY_SLOTS;
    return this.displayedItems.length;
  }

  private buildGrid(): void {
    this.slotBgs = [];
    const count = this.getSlotCount();
    const cols = this.GRID_COLS;

    for (let i = 0; i < count; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = col * (this.SLOT_SIZE + this.SLOT_PADDING);
      const y = row * (this.SLOT_SIZE + this.SLOT_PADDING);

      // Slot background
      const slotBg = this.add.rectangle(x, y, this.SLOT_SIZE, this.SLOT_SIZE, 0x3a3a5a);
      slotBg.setStrokeStyle(1, 0x5a5a7a);
      slotBg.setOrigin(0, 0);
      slotBg.setInteractive({ useHandCursor: true });

      slotBg.on('pointerover', () => {
        this.selectedIndex = i;
        this.updateSelection();
      });
      slotBg.on('pointerdown', () => {
        this.selectedIndex = i;
        this.activateSelected();
      });

      this.gridContainer.add(slotBg);
      this.slotBgs.push(slotBg);

      // Item icon
      const item = this.getItemAt(i);
      if (item) {
        const icon = this.add.image(x + this.SLOT_SIZE / 2, y + this.SLOT_SIZE / 2, item.sprite).setScale(2);
        this.gridContainer.add(icon);

        // Quantity for sell mode
        if (this.mode === 'sell') {
          const invItem = this.inventory.getItem(i);
          if (invItem && invItem.quantity > 1) {
            const qty = this.add.text(x + this.SLOT_SIZE - 6, y + this.SLOT_SIZE - 6, `${invItem.quantity}`, {
              fontSize: '10px',
              fontFamily: 'monospace',
              color: '#ffffff',
              stroke: '#000000',
              strokeThickness: 2
            }).setOrigin(0.5);
            this.gridContainer.add(qty);
          }
        }

        // Out of stock overlay for buy mode
        if (this.mode === 'buy') {
          const shopItem = this.displayedItems[i];
          if (shopItem && shopItem.stock <= 0) {
            const overlay = this.add.rectangle(x, y, this.SLOT_SIZE, this.SLOT_SIZE, 0x000000, 0.5);
            overlay.setOrigin(0, 0);
            this.gridContainer.add(overlay);
          }
        }
      }
    }
  }

  private rebuildGrid(): void {
    this.gridContainer.removeAll(true);
    this.buildGrid();
    this.detailsContainer.removeAll(true);
    this.buildDetailsPanel();
  }

  private getItemAt(index: number): Item | null {
    if (this.mode === 'buy') {
      if (index >= this.displayedItems.length) return null;
      return getItem(this.displayedItems[index].itemId) || null;
    } else {
      const invItem = this.inventory.getItem(index);
      return invItem?.item || null;
    }
  }

  private buildDetailsPanel(): void {
    // Background
    const bgW = 230;
    const bgH = 290;
    const bg = this.add.rectangle(0, 0, bgW, bgH, 0x3a3a5a, 0.5);
    bg.setOrigin(0, 0);
    this.detailsContainer.add(bg);

    // Placeholder
    const ph = this.add.text(bgW / 2, bgH / 2, 'Select an item', {
      fontSize: '12px',
      fontFamily: 'monospace',
      color: '#888888',
      align: 'center'
    }).setOrigin(0.5);
    this.detailsContainer.add(ph);
  }

  private updateDetailsPanel(): void {
    this.detailsContainer.removeAll(true);

    const bgW = 230;
    const bgH = 290;
    const bg = this.add.rectangle(0, 0, bgW, bgH, 0x3a3a5a, 0.5);
    bg.setOrigin(0, 0);
    this.detailsContainer.add(bg);

    const item = this.getItemAt(this.selectedIndex);
    if (!item) {
      const ph = this.add.text(bgW / 2, bgH / 2, 'Empty slot', {
        fontSize: '12px',
        fontFamily: 'monospace',
        color: '#888888',
        align: 'center'
      }).setOrigin(0.5);
      this.detailsContainer.add(ph);
      return;
    }

    const cx = bgW / 2;

    // Icon
    const icon = this.add.image(cx, 35, item.sprite).setScale(3);
    this.detailsContainer.add(icon);

    // Name
    const name = this.add.text(cx, 65, item.name, {
      fontSize: '14px',
      fontFamily: 'monospace',
      color: '#c9a227'
    }).setOrigin(0.5);
    this.detailsContainer.add(name);

    // Type
    const typeLabel = item.type === 'armor'
      ? (item.slot === 'shield' ? 'SHIELD' : 'ARMOR')
      : item.type.toUpperCase();
    const typeText = this.add.text(cx, 82, typeLabel, {
      fontSize: '8px',
      fontFamily: 'monospace',
      color: '#888888'
    }).setOrigin(0.5);
    this.detailsContainer.add(typeText);

    // Description
    const desc = this.add.text(cx, 98, item.description, {
      fontSize: '9px',
      fontFamily: 'monospace',
      color: '#aaaaaa',
      wordWrap: { width: 210 },
      align: 'center'
    }).setOrigin(0.5, 0);
    this.detailsContainer.add(desc);

    // Stats
    let statsY = 140;
    if (item.stats.damage) {
      const dmg = this.add.text(cx, statsY, `Damage: ${item.stats.damage}`, {
        fontSize: '11px', fontFamily: 'monospace', color: '#ff6666'
      }).setOrigin(0.5);
      this.detailsContainer.add(dmg);
      statsY += 16;
    }
    if (item.stats.speed) {
      const spd = this.add.text(cx, statsY, `Speed: ${item.stats.speed}x`, {
        fontSize: '11px', fontFamily: 'monospace', color: '#66ff66'
      }).setOrigin(0.5);
      this.detailsContainer.add(spd);
      statsY += 16;
    }
    if (item.stats.defense) {
      const def = this.add.text(cx, statsY, `Defense: ${item.stats.defense}`, {
        fontSize: '11px', fontFamily: 'monospace', color: '#6688ff'
      }).setOrigin(0.5);
      this.detailsContainer.add(def);
      statsY += 16;
    }
    if (item.stats.healAmount) {
      const heal = this.add.text(cx, statsY, `Heals: ${item.stats.healAmount} HP`, {
        fontSize: '11px', fontFamily: 'monospace', color: '#66ff66'
      }).setOrigin(0.5);
      this.detailsContainer.add(heal);
      statsY += 16;
    }

    // Action button
    const btnY = Math.max(statsY + 15, 230);
    if (this.mode === 'buy') {
      const shopItem = this.displayedItems[this.selectedIndex];
      if (shopItem) {
        const canBuy = this.shopSystem.canBuy(shopItem);
        const btnLabel = canBuy.canBuy ? `[ BUY - ${shopItem.buyPrice}g ]` : canBuy.reason || 'Unavailable';
        const btnColor = canBuy.canBuy ? '#00ff00' : '#ff0000';

        // Stock info
        const stockText = this.add.text(cx, btnY - 20, `Stock: ${shopItem.stock}`, {
          fontSize: '10px', fontFamily: 'monospace',
          color: shopItem.stock > 0 ? '#aaaaaa' : '#ff6666'
        }).setOrigin(0.5);
        this.detailsContainer.add(stockText);

        const buyBtn = this.add.text(cx, btnY, btnLabel, {
          fontSize: '12px', fontFamily: 'monospace', color: btnColor,
          backgroundColor: '#2a2a4a', padding: { x: 8, y: 4 }
        }).setOrigin(0.5);

        if (canBuy.canBuy) {
          buyBtn.setInteractive({ useHandCursor: true });
          buyBtn.on('pointerover', () => buyBtn.setColor('#88ff88'));
          buyBtn.on('pointerout', () => buyBtn.setColor('#00ff00'));
          buyBtn.on('pointerdown', () => this.activateSelected());
        }
        this.detailsContainer.add(buyBtn);
      }
    } else {
      // Sell mode
      const sellCheck = this.shopSystem.canSell(this.selectedIndex);
      if (sellCheck.canSell) {
        const sellBtn = this.add.text(cx, btnY, `[ SELL - ${sellCheck.sellPrice}g ]`, {
          fontSize: '12px', fontFamily: 'monospace', color: '#ffaa00',
          backgroundColor: '#2a2a4a', padding: { x: 8, y: 4 }
        }).setOrigin(0.5);
        sellBtn.setInteractive({ useHandCursor: true });
        sellBtn.on('pointerover', () => sellBtn.setColor('#ffcc44'));
        sellBtn.on('pointerout', () => sellBtn.setColor('#ffaa00'));
        sellBtn.on('pointerdown', () => this.activateSelected());
        this.detailsContainer.add(sellBtn);
      }
    }
  }

  private moveGrid(dx: number, dy: number): void {
    const count = this.getSlotCount();
    if (count === 0) return;

    const cols = this.GRID_COLS;
    const col = this.selectedIndex % cols;
    const row = Math.floor(this.selectedIndex / cols);
    const rows = Math.ceil(count / cols);

    let newCol = col + dx;
    let newRow = row + dy;

    // Wrap
    if (newCol < 0) newCol = cols - 1;
    if (newCol >= cols) newCol = 0;
    if (newRow < 0) newRow = rows - 1;
    if (newRow >= rows) newRow = 0;

    let newIndex = newRow * cols + newCol;
    if (newIndex >= count) {
      // Clamp to last item in row
      newIndex = count - 1;
    }

    this.selectedIndex = newIndex;
    this.updateSelection();
  }

  private updateSelection(): void {
    const count = this.getSlotCount();
    this.slotBgs.forEach((bg, i) => {
      if (i === this.selectedIndex) {
        bg.setStrokeStyle(2, 0xffdd55);
        bg.setFillStyle(0x5a5a7a);
      } else {
        bg.setStrokeStyle(1, 0x5a5a7a);
        bg.setFillStyle(0x3a3a5a);
      }
    });

    if (count > 0) {
      this.updateDetailsPanel();
    }
  }

  private activateSelected(): void {
    if (this.mode === 'buy') {
      this.buySelected();
    } else {
      this.sellSelected();
    }
  }

  private buySelected(): void {
    if (this.selectedIndex >= this.displayedItems.length) return;
    const shopItem = this.displayedItems[this.selectedIndex];

    const check = this.shopSystem.canBuy(shopItem);
    if (!check.canBuy) {
      if (check.reason === 'Inventory full') {
        this.showFlash('Inventory full!', '#ff4444');
      }
      return;
    }

    if (this.shopSystem.buyItem(shopItem)) {
      this.player.gold = this.playerGold.current;
      this.goldText.setText(`Gold: ${this.playerGold.current}`);
      this.cameras.main.flash(100, 255, 215, 0, false);
      this.scene.get(SCENE_KEYS.GAME).events.emit(EVENTS.PLAYER_GOLD_CHANGED, this.player.gold);
      this.updateDetailsPanel();
    }
  }

  private sellSelected(): void {
    if (this.selectedIndex >= INVENTORY_SLOTS) return;
    const sellPrice = this.shopSystem.sellItem(this.selectedIndex);
    if (sellPrice > 0) {
      this.player.gold = this.playerGold.current;
      this.goldText.setText(`Gold: ${this.playerGold.current}`);
      this.cameras.main.flash(100, 0, 255, 100, false);
      this.scene.get(SCENE_KEYS.GAME).events.emit(EVENTS.PLAYER_GOLD_CHANGED, this.player.gold);
      this.showFlash(`+${sellPrice}g`, '#ffd700');
      // Rebuild grid to reflect removed item
      this.rebuildGrid();
      // Clamp selection
      if (this.selectedIndex >= INVENTORY_SLOTS) this.selectedIndex = INVENTORY_SLOTS - 1;
      this.updateSelection();
    }
  }

  private showFlash(message: string, color: string): void {
    if (this.flashText) this.flashText.destroy();

    this.flashText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 130, message, {
      fontSize: '16px',
      fontFamily: 'monospace',
      color,
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5).setDepth(2000);

    this.tweens.add({
      targets: this.flashText,
      alpha: 0,
      y: this.flashText.y - 30,
      duration: 1200,
      ease: 'Power2',
      onComplete: () => {
        this.flashText?.destroy();
        this.flashText = null;
      }
    });
  }

  private closeShop(): void {
    this.scene.get(SCENE_KEYS.GAME).events.emit(EVENTS.CLOSE_SHOP);
    this.scene.stop();
  }
}
