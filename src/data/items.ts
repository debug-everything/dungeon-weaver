import { Item } from '../types';

export const ITEMS: Record<string, Item> = {
  // Weapons - Swords
  weapon_sword_wooden: {
    id: 'weapon_sword_wooden',
    name: 'Wooden Sword',
    type: 'weapon',
    slot: 'weapon',
    stats: { damage: 5, speed: 1.2, range: 24, weaponClass: 'sword' },
    value: 15,
    sprite: 'weapon_sword_wooden',
    description: 'A simple wooden training sword.',
    stackable: false
  },
  weapon_sword_rusty: {
    id: 'weapon_sword_rusty',
    name: 'Rusty Sword',
    type: 'weapon',
    slot: 'weapon',
    stats: { damage: 8, speed: 1.0, range: 26, weaponClass: 'sword' },
    value: 25,
    sprite: 'weapon_sword_rusty',
    description: 'An old sword with rust spots.',
    stackable: false
  },
  weapon_sword_steel: {
    id: 'weapon_sword_steel',
    name: 'Steel Sword',
    type: 'weapon',
    slot: 'weapon',
    stats: { damage: 15, speed: 1.0, range: 28, weaponClass: 'sword' },
    value: 100,
    sprite: 'weapon_sword_steel',
    description: 'A reliable steel blade.',
    stackable: false
  },
  weapon_sword_silver: {
    id: 'weapon_sword_silver',
    name: 'Silver Sword',
    type: 'weapon',
    slot: 'weapon',
    stats: { damage: 20, speed: 1.1, range: 28, weaponClass: 'sword' },
    value: 200,
    sprite: 'weapon_sword_silver',
    description: 'A gleaming silver sword, deadly to undead.',
    stackable: false
  },
  weapon_sword_ruby: {
    id: 'weapon_sword_ruby',
    name: 'Ruby Sword',
    type: 'weapon',
    slot: 'weapon',
    stats: { damage: 30, speed: 1.0, range: 30, weaponClass: 'sword' },
    value: 500,
    sprite: 'weapon_sword_ruby',
    description: 'A rare sword with a ruby-encrusted hilt.',
    stackable: false
  },
  weapon_sword_golden: {
    id: 'weapon_sword_golden',
    name: 'Golden Sword',
    type: 'weapon',
    slot: 'weapon',
    stats: { damage: 25, speed: 0.9, range: 28, weaponClass: 'sword' },
    value: 400,
    sprite: 'weapon_sword_golden',
    description: 'A heavy golden blade, more decorative than practical.',
    stackable: false
  },

  // Weapons - Daggers
  weapon_dagger_small: {
    id: 'weapon_dagger_small',
    name: 'Small Dagger',
    type: 'weapon',
    slot: 'weapon',
    stats: { damage: 4, speed: 1.8, range: 16, weaponClass: 'dagger' },
    value: 10,
    sprite: 'weapon_dagger_small',
    description: 'A tiny but quick dagger.',
    stackable: false
  },
  weapon_dagger_steel: {
    id: 'weapon_dagger_steel',
    name: 'Steel Dagger',
    type: 'weapon',
    slot: 'weapon',
    stats: { damage: 8, speed: 1.6, range: 18, weaponClass: 'dagger' },
    value: 50,
    sprite: 'weapon_dagger_steel',
    description: 'A well-balanced steel dagger.',
    stackable: false
  },
  weapon_dagger_golden: {
    id: 'weapon_dagger_golden',
    name: 'Golden Dagger',
    type: 'weapon',
    slot: 'weapon',
    stats: { damage: 12, speed: 1.5, range: 18, weaponClass: 'dagger' },
    value: 150,
    sprite: 'weapon_dagger_golden',
    description: 'An ornate golden dagger.',
    stackable: false
  },

  // Weapons - Heavy
  weapon_hammer: {
    id: 'weapon_hammer',
    name: 'War Hammer',
    type: 'weapon',
    slot: 'weapon',
    stats: { damage: 22, speed: 0.7, range: 24, weaponClass: 'hammer' },
    value: 180,
    sprite: 'weapon_hammer',
    description: 'A heavy hammer that crushes enemies.',
    stackable: false
  },
  weapon_sledgehammer: {
    id: 'weapon_sledgehammer',
    name: 'Sledgehammer',
    type: 'weapon',
    slot: 'weapon',
    stats: { damage: 35, speed: 0.5, range: 28, weaponClass: 'hammer' },
    value: 350,
    sprite: 'weapon_sledgehammer',
    description: 'A massive sledgehammer. Slow but devastating.',
    stackable: false
  },
  weapon_katana_silver: {
    id: 'weapon_katana_silver',
    name: 'Silver Katana',
    type: 'weapon',
    slot: 'weapon',
    stats: { damage: 28, speed: 1.3, range: 32, weaponClass: 'katana' },
    value: 450,
    sprite: 'weapon_katana_silver',
    description: 'An elegant blade from distant lands.',
    stackable: false
  },

  // Consumables - Potions
  flask_red: {
    id: 'flask_red',
    name: 'Health Potion',
    type: 'consumable',
    stats: { healAmount: 25 },
    value: 20,
    sprite: 'flask_red',
    description: 'Restores 25 health.',
    stackable: true,
    maxStack: 10
  },
  flask_big_red: {
    id: 'flask_big_red',
    name: 'Large Health Potion',
    type: 'consumable',
    stats: { healAmount: 50 },
    value: 45,
    sprite: 'flask_big_red',
    description: 'Restores 50 health.',
    stackable: true,
    maxStack: 10
  },
  flask_blue: {
    id: 'flask_blue',
    name: 'Mana Potion',
    type: 'consumable',
    stats: {},
    value: 25,
    sprite: 'flask_blue',
    description: 'Restores magical energy.',
    stackable: true,
    maxStack: 10
  },
  flask_green: {
    id: 'flask_green',
    name: 'Antidote',
    type: 'consumable',
    stats: {},
    value: 30,
    sprite: 'flask_green',
    description: 'Cures poison effects.',
    stackable: true,
    maxStack: 10
  },
  flask_yellow: {
    id: 'flask_yellow',
    name: 'Speed Potion',
    type: 'consumable',
    stats: {},
    value: 40,
    sprite: 'flask_yellow',
    description: 'Temporarily increases movement speed.',
    stackable: true,
    maxStack: 10
  }
};

export function getItem(id: string): Item | undefined {
  return ITEMS[id];
}
