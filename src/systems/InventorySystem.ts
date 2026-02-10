import { Item, InventoryItem, Equipment, EquipmentSlot, WeaponClass } from '../types';
import { INVENTORY_SLOTS, EVENTS } from '../config/constants';
import { getItem } from '../data/items';

export class InventorySystem {
  private items: (InventoryItem | null)[];
  private equipment: Equipment;
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.items = new Array(INVENTORY_SLOTS).fill(null);
    this.equipment = {
      weapon: null,
      head: null,
      chest: null,
      legs: null,
      boots: null,
      shield: null
    };
  }

  addItem(itemId: string, quantity: number = 1): boolean {
    const item = getItem(itemId);
    if (!item) return false;

    if (item.stackable) {
      // Find existing stack
      const existingIndex = this.items.findIndex(
        inv => inv?.item.id === itemId && inv.quantity < (item.maxStack || 99)
      );

      if (existingIndex !== -1) {
        const existing = this.items[existingIndex]!;
        const maxAdd = (item.maxStack || 99) - existing.quantity;
        const toAdd = Math.min(quantity, maxAdd);
        existing.quantity += toAdd;
        quantity -= toAdd;

        if (quantity <= 0) {
          this.emitChange();
          return true;
        }
      }
    }

    // Find empty slot for remaining items
    while (quantity > 0) {
      const emptyIndex = this.items.findIndex(inv => inv === null);
      if (emptyIndex === -1) return false;

      const stackSize = item.stackable ? Math.min(quantity, item.maxStack || 99) : 1;
      this.items[emptyIndex] = { item, quantity: stackSize };
      quantity -= stackSize;
    }

    this.emitChange();
    return true;
  }

  removeItem(slotIndex: number, quantity: number = 1): Item | null {
    const slot = this.items[slotIndex];
    if (!slot) return null;

    const item = slot.item;
    slot.quantity -= quantity;

    if (slot.quantity <= 0) {
      this.items[slotIndex] = null;
    }

    this.emitChange();
    return item;
  }

  getItem(slotIndex: number): InventoryItem | null {
    return this.items[slotIndex];
  }

  getAllItems(): (InventoryItem | null)[] {
    return [...this.items];
  }

  equipItem(slotIndex: number): boolean {
    const invItem = this.items[slotIndex];
    if (!invItem || !invItem.item.slot) return false;

    const item = invItem.item;
    const equipSlot = item.slot as EquipmentSlot;
    const currentEquipped = this.equipment[equipSlot];

    // Remove from inventory
    this.items[slotIndex] = null;

    // Put currently equipped item back in inventory
    if (currentEquipped) {
      const emptySlot = this.items.findIndex(inv => inv === null);
      if (emptySlot !== -1) {
        this.items[emptySlot] = { item: currentEquipped, quantity: 1 };
      } else {
        // No space, put item back
        this.items[slotIndex] = invItem;
        return false;
      }
    }

    // Equip new item
    this.equipment[equipSlot] = item;

    this.emitChange();
    this.scene.events.emit(EVENTS.PLAYER_EQUIPMENT_CHANGED, this.equipment);
    return true;
  }

  unequipItem(slot: EquipmentSlot): boolean {
    const item = this.equipment[slot];
    if (!item) return false;

    const emptySlot = this.items.findIndex(inv => inv === null);
    if (emptySlot === -1) return false;

    this.items[emptySlot] = { item, quantity: 1 };
    this.equipment[slot] = null;

    this.emitChange();
    this.scene.events.emit(EVENTS.PLAYER_EQUIPMENT_CHANGED, this.equipment);
    return true;
  }

  getEquipment(): Equipment {
    return { ...this.equipment };
  }

  getEquippedWeapon(): Item | null {
    return this.equipment.weapon;
  }

  getWeaponDamage(): number {
    return this.equipment.weapon?.stats.damage || 5;
  }

  getWeaponSpeed(): number {
    return this.equipment.weapon?.stats.speed || 1;
  }

  getWeaponRange(): number {
    return this.equipment.weapon?.stats.range || 20;
  }

  getWeaponClass(): WeaponClass {
    return this.equipment.weapon?.stats.weaponClass || 'unarmed';
  }

  getTotalDefense(): number {
    let defense = 0;
    for (const slot of Object.values(this.equipment)) {
      if (slot?.stats.defense) {
        defense += slot.stats.defense;
      }
    }
    return defense;
  }

  hasItem(itemId: string): boolean {
    return this.items.some(inv => inv?.item.id === itemId);
  }

  getItemCount(itemId: string): number {
    return this.items.reduce((count, inv) => {
      if (inv?.item.id === itemId) {
        return count + inv.quantity;
      }
      return count;
    }, 0);
  }

  private emitChange(): void {
    this.scene.events.emit(EVENTS.INVENTORY_CHANGED, this.items);
  }

  moveItem(fromIndex: number, toIndex: number): void {
    if (fromIndex === toIndex) return;
    if (fromIndex < 0 || fromIndex >= INVENTORY_SLOTS) return;
    if (toIndex < 0 || toIndex >= INVENTORY_SLOTS) return;

    const temp = this.items[toIndex];
    this.items[toIndex] = this.items[fromIndex];
    this.items[fromIndex] = temp;

    this.emitChange();
  }
}
