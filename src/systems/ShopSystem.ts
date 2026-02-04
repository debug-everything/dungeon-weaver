import { NPCData, ShopItem } from '../types';
import { InventorySystem } from './InventorySystem';
import { getItem } from '../data/items';

export class ShopSystem {
  private inventory: InventorySystem;
  private playerGold: { current: number };

  constructor(inventory: InventorySystem, playerGold: { current: number }) {
    this.inventory = inventory;
    this.playerGold = playerGold;
  }

  canBuy(shopItem: ShopItem): { canBuy: boolean; reason?: string } {
    if (this.playerGold.current < shopItem.buyPrice) {
      return { canBuy: false, reason: 'Not enough gold' };
    }
    if (shopItem.stock <= 0) {
      return { canBuy: false, reason: 'Out of stock' };
    }
    return { canBuy: true };
  }

  buyItem(shopItem: ShopItem): boolean {
    const check = this.canBuy(shopItem);
    if (!check.canBuy) return false;

    const success = this.inventory.addItem(shopItem.itemId);
    if (!success) return false;

    this.playerGold.current -= shopItem.buyPrice;
    shopItem.stock--;
    return true;
  }

  canSell(slotIndex: number): { canSell: boolean; sellPrice: number } {
    const invItem = this.inventory.getItem(slotIndex);
    if (!invItem) {
      return { canSell: false, sellPrice: 0 };
    }

    const sellPrice = Math.floor(invItem.item.value * 0.4);
    return { canSell: true, sellPrice };
  }

  sellItem(slotIndex: number): number {
    const check = this.canSell(slotIndex);
    if (!check.canSell) return 0;

    const item = this.inventory.removeItem(slotIndex);
    if (!item) return 0;

    this.playerGold.current += check.sellPrice;
    return check.sellPrice;
  }

  getShopInventoryWithDetails(npcData: NPCData): Array<ShopItem & { item: ReturnType<typeof getItem> }> {
    return npcData.shopInventory.map(shopItem => ({
      ...shopItem,
      item: getItem(shopItem.itemId)
    }));
  }
}
