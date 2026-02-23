import Phaser from 'phaser';
import { NPCData, ShopItem } from '../types';
import { InventorySystem } from './InventorySystem';
import { SHOP_DISPLAY_LIMIT } from '../config/constants';
import { getItem } from '../data/items';

/** Per-NPC displayed shop subset, stored on GameScene lifetime */
const displayedSubsets = new Map<string, ShopItem[]>();

export function clearShopSubsets(): void {
  displayedSubsets.clear();
}

export function rotateShopSubset(npcId: string): void {
  const subset = displayedSubsets.get(npcId);
  if (!subset) return;
  // Will be regenerated on next getDisplayedShopItems call
  displayedSubsets.delete(npcId);
}

export function getDisplayedShopItems(npcData: NPCData): ShopItem[] {
  const all = npcData.shopInventory;
  if (all.length <= SHOP_DISPLAY_LIMIT) return all;

  const existing = displayedSubsets.get(npcData.id);
  if (existing) return existing;

  // Pick a random subset of 6-10 items, prioritizing in-stock
  const count = Math.min(all.length, Phaser.Math.Between(6, SHOP_DISPLAY_LIMIT));
  const inStock = all.filter(i => i.stock > 0);
  const outOfStock = all.filter(i => i.stock <= 0);

  // Shuffle in-stock first
  Phaser.Utils.Array.Shuffle(inStock);
  Phaser.Utils.Array.Shuffle(outOfStock);

  const result = [...inStock, ...outOfStock].slice(0, count);
  displayedSubsets.set(npcData.id, result);
  return result;
}

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
    // Check inventory capacity
    if (!this.hasInventorySpace(shopItem.itemId)) {
      return { canBuy: false, reason: 'Inventory full' };
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

  private hasInventorySpace(itemId: string): boolean {
    const item = getItem(itemId);
    if (!item) return false;

    const allItems = this.inventory.getAllItems();

    if (item.stackable) {
      // Check if existing stack has room
      const existingStack = allItems.find(
        inv => inv?.item.id === itemId && inv.quantity < (item.maxStack || 99)
      );
      if (existingStack) return true;
    }

    // Check for empty slot
    return allItems.some(slot => slot === null);
  }
}
