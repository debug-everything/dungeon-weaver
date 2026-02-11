import { MonsterData } from '../types';

export const MONSTERS: Record<string, MonsterData> = {
  monster_zombie: {
    id: 'monster_zombie',
    name: 'Zombie',
    type: 'zombie',
    sprite: 'monster_zombie',
    health: 15,
    damage: 3,
    speed: 40,
    attackRange: 20,
    attackCooldown: 1200,
    detectRange: 100,
    xpReward: 10,
    goldDrop: { min: 2, max: 8 },
    lootTable: [
      { itemId: 'flask_red', chance: 0.2 },
      { itemId: 'weapon_dagger_small', chance: 0.05 },
      { itemId: 'armor_boots_leather', chance: 0.03 }
    ]
  },
  monster_skelet: {
    id: 'monster_skelet',
    name: 'Skeleton',
    type: 'skelet',
    sprite: 'monster_skelet',
    health: 12,
    damage: 4,
    speed: 60,
    attackRange: 22,
    attackCooldown: 1000,
    detectRange: 120,
    xpReward: 15,
    goldDrop: { min: 5, max: 12 },
    lootTable: [
      { itemId: 'flask_red', chance: 0.15 },
      { itemId: 'weapon_sword_rusty', chance: 0.08 },
      { itemId: 'armor_head_leather', chance: 0.05 }
    ]
  },
  monster_goblin: {
    id: 'monster_goblin',
    name: 'Goblin',
    type: 'goblin',
    sprite: 'monster_goblin',
    health: 10,
    damage: 2,
    speed: 90,
    attackRange: 18,
    attackCooldown: 800,
    detectRange: 140,
    xpReward: 12,
    goldDrop: { min: 8, max: 20 },
    lootTable: [
      { itemId: 'flask_red', chance: 0.25 },
      { itemId: 'weapon_dagger_steel', chance: 0.1 },
      { itemId: 'armor_shield_wooden', chance: 0.04 }
    ]
  },
  monster_orc: {
    id: 'monster_orc',
    name: 'Orc Warrior',
    type: 'orc',
    sprite: 'monster_orc',
    health: 25,
    damage: 6,
    speed: 55,
    attackRange: 24,
    attackCooldown: 1100,
    detectRange: 110,
    xpReward: 25,
    goldDrop: { min: 10, max: 25 },
    lootTable: [
      { itemId: 'flask_big_red', chance: 0.15 },
      { itemId: 'weapon_sword_steel', chance: 0.08 },
      { itemId: 'weapon_hammer', chance: 0.05 },
      { itemId: 'armor_chest_chain', chance: 0.05 },
      { itemId: 'armor_head_iron', chance: 0.04 }
    ]
  },
  monster_demon: {
    id: 'monster_demon',
    name: 'Demon Lord',
    type: 'demon',
    sprite: 'monster_demon',
    health: 75,
    damage: 10,
    speed: 70,
    attackRange: 28,
    attackCooldown: 900,
    detectRange: 180,
    xpReward: 100,
    goldDrop: { min: 50, max: 100 },
    lootTable: [
      { itemId: 'flask_big_red', chance: 0.5 },
      { itemId: 'weapon_sword_ruby', chance: 0.2 },
      { itemId: 'weapon_katana_silver', chance: 0.15 },
      { itemId: 'armor_chest_plate', chance: 0.15 },
      { itemId: 'armor_shield_golden', chance: 0.1 }
    ]
  }
};

export function getMonster(id: string): MonsterData | undefined {
  return MONSTERS[id];
}

export function getAllMonsterTypes(): string[] {
  return Object.keys(MONSTERS);
}
