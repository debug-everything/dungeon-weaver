import Phaser from 'phaser';
import { SCENE_KEYS, GAME_WIDTH, GAME_HEIGHT, EVENTS } from '../config/constants';
import { NPCData, ShopItem } from '../types';
import { InventorySystem } from '../systems/InventorySystem';
import { ShopSystem } from '../systems/ShopSystem';
import { getItem } from '../data/items';
import { Player } from '../entities/Player';

interface ShopSceneData {
  npcData: NPCData;
  inventory: InventorySystem;
  playerGold: { current: number };
  player: Player;
}

export class ShopScene extends Phaser.Scene {
  private npcData!: NPCData;
  private inventory!: InventorySystem;
  private shopSystem!: ShopSystem;
  private player!: Player;
  private playerGold!: { current: number };

  private shopItems: ShopItem[] = [];
  private selectedIndex: number = -1;
  private goldText!: Phaser.GameObjects.Text;
  private itemButtons: Phaser.GameObjects.Container[] = [];
  private detailsPanel!: Phaser.GameObjects.Container;
  private prevGamepadButtons: boolean[] = [];

  constructor() {
    super({ key: SCENE_KEYS.SHOP });
  }

  init(data: ShopSceneData): void {
    this.npcData = data.npcData;
    this.inventory = data.inventory;
    this.player = data.player;
    this.playerGold = { current: data.player.gold };
    this.shopSystem = new ShopSystem(this.inventory, this.playerGold);
    this.shopItems = [...this.npcData.shopInventory];
  }

  create(): void {
    // Reset state from previous launches (scene instance is reused)
    this.itemButtons = [];
    this.selectedIndex = -1;
    this.prevGamepadButtons = [];

    // Semi-transparent background
    const bg = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.7);
    bg.setInteractive();

    // Shop panel
    const panelWidth = 600;
    const panelHeight = 400;
    const panelX = GAME_WIDTH / 2;
    const panelY = GAME_HEIGHT / 2;

    const panel = this.add.rectangle(panelX, panelY, panelWidth, panelHeight, 0x2a2a4a, 0.95);
    panel.setStrokeStyle(2, 0x4a4a6a);

    // Title
    this.add.text(panelX, panelY - panelHeight / 2 + 30, this.npcData.name, {
      fontSize: '24px',
      fontFamily: 'monospace',
      color: '#c9a227'
    }).setOrigin(0.5);

    // Gold display
    this.goldText = this.add.text(panelX + panelWidth / 2 - 20, panelY - panelHeight / 2 + 30, `Gold: ${this.playerGold.current}`, {
      fontSize: '16px',
      fontFamily: 'monospace',
      color: '#ffd700'
    }).setOrigin(1, 0.5);

    // Create shop item list
    this.createShopList(panelX - panelWidth / 2 + 30, panelY - panelHeight / 2 + 70);

    // Create details panel
    this.createDetailsPanel(panelX + 100, panelY - panelHeight / 2 + 70);

    // Close button
    const closeBtn = this.add.text(panelX + panelWidth / 2 - 40, panelY - panelHeight / 2 + 15, 'X', {
      fontSize: '20px',
      fontFamily: 'monospace',
      color: '#ff6666'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    closeBtn.on('pointerover', () => closeBtn.setColor('#ff0000'));
    closeBtn.on('pointerout', () => closeBtn.setColor('#ff6666'));
    closeBtn.on('pointerdown', () => this.closeShop());

    // ESC to close
    this.input.keyboard?.on('keydown-ESC', () => this.closeShop());
  }

  update(): void {
    const pad = this.input.gamepad?.getPad(0);
    if (!pad) return;
    const prev = this.prevGamepadButtons;
    const justDown = (i: number) => (pad.buttons[i]?.pressed ?? false) && !(prev[i] ?? false);

    if (justDown(1)) this.closeShop(); // B button

    this.prevGamepadButtons = pad.buttons.map(b => b.pressed);
  }

  private createShopList(startX: number, startY: number): void {
    const itemHeight = 50;

    this.shopItems.forEach((shopItem, index) => {
      const item = getItem(shopItem.itemId);
      if (!item) return;

      const y = startY + index * itemHeight;
      const container = this.add.container(startX, y);

      // Background
      const itemBg = this.add.rectangle(100, 0, 200, 45, 0x3a3a5a);
      itemBg.setInteractive({ useHandCursor: true });

      // Item icon
      const icon = this.add.image(20, 0, item.sprite).setScale(1.5);

      // Item name
      const nameText = this.add.text(50, -8, item.name, {
        fontSize: '12px',
        fontFamily: 'monospace',
        color: '#ffffff'
      });

      // Price and stock
      const priceText = this.add.text(50, 8, `${shopItem.buyPrice}g | Stock: ${shopItem.stock}`, {
        fontSize: '10px',
        fontFamily: 'monospace',
        color: shopItem.stock > 0 ? '#aaaaaa' : '#ff6666'
      });

      container.add([itemBg, icon, nameText, priceText]);
      this.itemButtons.push(container);

      // Hover effects
      itemBg.on('pointerover', () => {
        itemBg.setFillStyle(0x5a5a7a);
        this.selectItem(index);
      });

      itemBg.on('pointerout', () => {
        if (this.selectedIndex !== index) {
          itemBg.setFillStyle(0x3a3a5a);
        }
      });

      itemBg.on('pointerdown', () => {
        this.buyItem(index);
      });
    });
  }

  private createDetailsPanel(startX: number, startY: number): void {
    this.detailsPanel = this.add.container(startX, startY);

    // Background
    const detailsBg = this.add.rectangle(100, 100, 250, 250, 0x3a3a5a, 0.5);
    this.detailsPanel.add(detailsBg);

    // Placeholder text
    const placeholder = this.add.text(100, 100, 'Select an item\nto see details', {
      fontSize: '14px',
      fontFamily: 'monospace',
      color: '#888888',
      align: 'center'
    }).setOrigin(0.5);
    this.detailsPanel.add(placeholder);
  }

  private selectItem(index: number): void {
    this.selectedIndex = index;
    const shopItem = this.shopItems[index];
    const item = getItem(shopItem.itemId);
    if (!item) return;

    // Clear details panel
    this.detailsPanel.removeAll(true);

    // Background
    const detailsBg = this.add.rectangle(100, 100, 250, 250, 0x3a3a5a, 0.5);
    this.detailsPanel.add(detailsBg);

    // Item icon (larger)
    const icon = this.add.image(100, 40, item.sprite).setScale(3);
    this.detailsPanel.add(icon);

    // Item name
    const name = this.add.text(100, 80, item.name, {
      fontSize: '16px',
      fontFamily: 'monospace',
      color: '#c9a227'
    }).setOrigin(0.5);
    this.detailsPanel.add(name);

    // Item description
    const desc = this.add.text(100, 105, item.description, {
      fontSize: '10px',
      fontFamily: 'monospace',
      color: '#aaaaaa',
      wordWrap: { width: 220 },
      align: 'center'
    }).setOrigin(0.5, 0);
    this.detailsPanel.add(desc);

    // Stats
    let statsY = 145;
    if (item.stats.damage) {
      const dmg = this.add.text(100, statsY, `Damage: ${item.stats.damage}`, {
        fontSize: '12px',
        fontFamily: 'monospace',
        color: '#ff6666'
      }).setOrigin(0.5);
      this.detailsPanel.add(dmg);
      statsY += 18;
    }
    if (item.stats.speed) {
      const spd = this.add.text(100, statsY, `Speed: ${item.stats.speed}x`, {
        fontSize: '12px',
        fontFamily: 'monospace',
        color: '#66ff66'
      }).setOrigin(0.5);
      this.detailsPanel.add(spd);
      statsY += 18;
    }
    if (item.stats.defense) {
      const def = this.add.text(100, statsY, `Defense: ${item.stats.defense}`, {
        fontSize: '12px',
        fontFamily: 'monospace',
        color: '#6688ff'
      }).setOrigin(0.5);
      this.detailsPanel.add(def);
      statsY += 18;
    }
    if (item.stats.healAmount) {
      const heal = this.add.text(100, statsY, `Heals: ${item.stats.healAmount} HP`, {
        fontSize: '12px',
        fontFamily: 'monospace',
        color: '#66ff66'
      }).setOrigin(0.5);
      this.detailsPanel.add(heal);
      statsY += 18;
    }

    // Buy button
    const canBuy = this.shopSystem.canBuy(shopItem);
    const buyBtn = this.add.text(100, 210, canBuy.canBuy ? `[ BUY - ${shopItem.buyPrice}g ]` : canBuy.reason || 'Unavailable', {
      fontSize: '14px',
      fontFamily: 'monospace',
      color: canBuy.canBuy ? '#00ff00' : '#ff0000',
      backgroundColor: '#2a2a4a',
      padding: { x: 10, y: 5 }
    }).setOrigin(0.5);

    if (canBuy.canBuy) {
      buyBtn.setInteractive({ useHandCursor: true });
      buyBtn.on('pointerover', () => buyBtn.setStyle({ color: '#88ff88' }));
      buyBtn.on('pointerout', () => buyBtn.setStyle({ color: '#00ff00' }));
      buyBtn.on('pointerdown', () => this.buyItem(index));
    }

    this.detailsPanel.add(buyBtn);
  }

  private buyItem(index: number): void {
    const shopItem = this.shopItems[index];

    if (this.shopSystem.buyItem(shopItem)) {
      // Update player gold
      this.player.gold = this.playerGold.current;
      this.goldText.setText(`Gold: ${this.playerGold.current}`);

      // Update the item button
      this.updateItemButton(index);

      // Re-select to update details panel
      this.selectItem(index);

      // Visual feedback
      this.cameras.main.flash(100, 255, 215, 0, false);

      // Emit gold changed event
      this.scene.get(SCENE_KEYS.GAME).events.emit(EVENTS.PLAYER_GOLD_CHANGED, this.player.gold);
    }
  }

  private updateItemButton(index: number): void {
    const shopItem = this.shopItems[index];
    const container = this.itemButtons[index];

    // Update price/stock text (4th element in container)
    const priceText = container.getAt(3) as Phaser.GameObjects.Text;
    priceText.setText(`${shopItem.buyPrice}g | Stock: ${shopItem.stock}`);
    priceText.setColor(shopItem.stock > 0 ? '#aaaaaa' : '#ff6666');
  }

  private closeShop(): void {
    this.scene.get(SCENE_KEYS.GAME).events.emit(EVENTS.CLOSE_SHOP);
    this.scene.stop();
  }
}
