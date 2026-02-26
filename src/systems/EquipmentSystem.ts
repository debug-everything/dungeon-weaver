import { Equipment, EquipmentSlot, Item } from '../types';

export class EquipmentSystem {
  private equipment: Equipment;

  constructor() {
    this.equipment = {
      weapon: null,
      armor: null,
      shield: null,
      spellbook: null
    };
  }

  equip(slot: EquipmentSlot, item: Item | null): Item | null {
    const previous = this.equipment[slot];
    this.equipment[slot] = item;
    return previous;
  }

  unequip(slot: EquipmentSlot): Item | null {
    const item = this.equipment[slot];
    this.equipment[slot] = null;
    return item;
  }

  getEquipped(slot: EquipmentSlot): Item | null {
    return this.equipment[slot];
  }

  getAllEquipment(): Equipment {
    return { ...this.equipment };
  }

  calculateTotalStats(): { damage: number; defense: number; speed: number } {
    let damage = 0;
    let defense = 0;
    let speed = 1;

    for (const item of Object.values(this.equipment)) {
      if (item) {
        damage += item.stats.damage || 0;
        defense += item.stats.defense || 0;
        if (item.stats.speed) {
          speed = item.stats.speed;
        }
      }
    }

    return { damage, defense, speed };
  }
}
