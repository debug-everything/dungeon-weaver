import { MonsterData, MonsterFamily } from '../types';

export const MONSTERS: Record<string, MonsterData> = {
  // ── Undead Family ──
  monster_zombie: {
    id: 'monster_zombie',
    name: 'Zombie',
    type: 'zombie',
    family: 'undead',
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
      { itemId: 'armor_peasant', chance: 0.03 }
    ]
  },
  monster_zombie_small: {
    id: 'monster_zombie_small',
    name: 'Zombie Runt',
    type: 'zombie_small',
    family: 'undead',
    sprite: 'monster_zombie_small',
    health: 8,
    damage: 2,
    speed: 35,
    attackRange: 18,
    attackCooldown: 1300,
    detectRange: 80,
    xpReward: 6,
    goldDrop: { min: 1, max: 5 },
    lootTable: [
      { itemId: 'flask_red', chance: 0.15 }
    ]
  },
  monster_zombie_green: {
    id: 'monster_zombie_green',
    name: 'Plague Zombie',
    type: 'zombie_green',
    family: 'undead',
    sprite: 'monster_zombie_green',
    health: 20,
    damage: 4,
    speed: 38,
    attackRange: 20,
    attackCooldown: 1200,
    detectRange: 100,
    xpReward: 14,
    goldDrop: { min: 3, max: 10 },
    lootTable: [
      { itemId: 'flask_red', chance: 0.2 },
      { itemId: 'flask_green', chance: 0.1 }
    ]
  },
  monster_zombie_tall: {
    id: 'monster_zombie_tall',
    name: 'Hulking Zombie',
    type: 'zombie_tall',
    family: 'undead',
    sprite: 'monster_zombie_tall',
    health: 30,
    damage: 5,
    speed: 30,
    attackRange: 22,
    attackCooldown: 1400,
    detectRange: 90,
    xpReward: 20,
    goldDrop: { min: 5, max: 15 },
    lootTable: [
      { itemId: 'flask_red', chance: 0.25 },
      { itemId: 'flask_big_red', chance: 0.1 },
      { itemId: 'armor_peasant', chance: 0.05 }
    ]
  },
  monster_skelet: {
    id: 'monster_skelet',
    name: 'Skeleton',
    type: 'skelet',
    family: 'undead',
    sprite: 'monster_skelet',
    health: 12,
    damage: 4,
    speed: 60,
    attackRange: 100,
    attackCooldown: 1000,
    detectRange: 140,
    xpReward: 15,
    goldDrop: { min: 5, max: 12 },
    lootTable: [
      { itemId: 'flask_red', chance: 0.15 },
      { itemId: 'weapon_sword_rusty', chance: 0.08 },
      { itemId: 'armor_peasant', chance: 0.05 }
    ],
    ranged: {
      projectileSpeed: 160,
      projectileRange: 140,
      projectileDamage: 3,
      projectileStyle: 'bone_arrow',
      preferredRange: 80,
      meleeRange: 22,
      rangedCooldown: 1500
    }
  },
  monster_necromancer: {
    id: 'monster_necromancer',
    name: 'Necromancer',
    type: 'necromancer',
    family: 'undead',
    sprite: 'monster_necromancer',
    health: 70,
    damage: 9,
    speed: 50,
    attackRange: 130,
    attackCooldown: 1000,
    detectRange: 180,
    xpReward: 100,
    goldDrop: { min: 40, max: 80 },
    lootTable: [
      { itemId: 'flask_big_red', chance: 0.5 },
      { itemId: 'weapon_sword_silver', chance: 0.15 },
      { itemId: 'armor_wizard', chance: 0.1 }
    ],
    bossOnly: true,
    ranged: {
      projectileSpeed: 180,
      projectileRange: 180,
      projectileDamage: 8,
      projectileStyle: 'skull_bolt',
      preferredRange: 100,
      meleeRange: 26,
      rangedCooldown: 1400
    }
  },

  // ── Beast Family ──
  monster_bat: {
    id: 'monster_bat',
    name: 'Bat',
    type: 'bat',
    family: 'beast',
    sprite: 'monster_bat',
    health: 6,
    damage: 2,
    speed: 100,
    attackRange: 16,
    attackCooldown: 900,
    detectRange: 160,
    xpReward: 8,
    goldDrop: { min: 1, max: 4 },
    lootTable: [
      { itemId: 'flask_red', chance: 0.1 }
    ]
  },
  monster_wogol: {
    id: 'monster_wogol',
    name: 'Wogol',
    type: 'wogol',
    family: 'beast',
    sprite: 'monster_wogol',
    health: 18,
    damage: 5,
    speed: 70,
    attackRange: 20,
    attackCooldown: 1000,
    detectRange: 120,
    xpReward: 18,
    goldDrop: { min: 6, max: 14 },
    lootTable: [
      { itemId: 'flask_red', chance: 0.2 },
      { itemId: 'flask_green', chance: 0.08 }
    ]
  },
  monster_rokita: {
    id: 'monster_rokita',
    name: 'Rokita',
    type: 'rokita',
    family: 'beast',
    sprite: 'monster_rokita',
    health: 28,
    damage: 6,
    speed: 75,
    attackRange: 22,
    attackCooldown: 1000,
    detectRange: 130,
    xpReward: 22,
    goldDrop: { min: 8, max: 18 },
    lootTable: [
      { itemId: 'flask_red', chance: 0.2 },
      { itemId: 'flask_big_red', chance: 0.08 },
      { itemId: 'weapon_dagger_steel', chance: 0.05 }
    ]
  },
  monster_tentackle: {
    id: 'monster_tentackle',
    name: 'Tentacle Horror',
    type: 'tentacle',
    family: 'beast',
    sprite: 'monster_tentackle',
    health: 80,
    damage: 11,
    speed: 35,
    attackRange: 30,
    attackCooldown: 1000,
    detectRange: 170,
    xpReward: 110,
    goldDrop: { min: 50, max: 100 },
    lootTable: [
      { itemId: 'flask_big_red', chance: 0.5 },
      { itemId: 'weapon_sword_ruby', chance: 0.15 },
      { itemId: 'armor_barbarian', chance: 0.1 }
    ],
    bossOnly: true,
    spriteSize: { width: 32, height: 32 }
  },

  // ── Orc Family ──
  monster_goblin: {
    id: 'monster_goblin',
    name: 'Goblin',
    type: 'goblin',
    family: 'orc',
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
      { itemId: 'armor_spy', chance: 0.04 }
    ]
  },
  monster_orc: {
    id: 'monster_orc',
    name: 'Orc Warrior',
    type: 'orc',
    family: 'orc',
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
      { itemId: 'armor_barbarian', chance: 0.05 },
      { itemId: 'armor_shield_iron', chance: 0.04 }
    ]
  },
  monster_orc_armored: {
    id: 'monster_orc_armored',
    name: 'Armored Orc',
    type: 'orc_armored',
    family: 'orc',
    sprite: 'monster_orc_armored',
    health: 35,
    damage: 7,
    speed: 45,
    attackRange: 24,
    attackCooldown: 1200,
    detectRange: 110,
    xpReward: 30,
    goldDrop: { min: 12, max: 28 },
    lootTable: [
      { itemId: 'flask_big_red', chance: 0.15 },
      { itemId: 'weapon_sword_steel', chance: 0.06 },
      { itemId: 'armor_barbarian', chance: 0.08 },
      { itemId: 'armor_shield_iron', chance: 0.06 }
    ]
  },
  monster_orc_masked: {
    id: 'monster_orc_masked',
    name: 'Masked Orc',
    type: 'orc_masked',
    family: 'orc',
    sprite: 'monster_orc_masked',
    health: 28,
    damage: 8,
    speed: 65,
    attackRange: 22,
    attackCooldown: 900,
    detectRange: 130,
    xpReward: 28,
    goldDrop: { min: 10, max: 25 },
    lootTable: [
      { itemId: 'flask_red', chance: 0.2 },
      { itemId: 'weapon_dagger_steel', chance: 0.1 },
      { itemId: 'armor_spy', chance: 0.06 }
    ]
  },
  monster_orc_shaman: {
    id: 'monster_orc_shaman',
    name: 'Orc Shaman',
    type: 'orc_shaman',
    family: 'orc',
    sprite: 'monster_orc_shaman',
    health: 22,
    damage: 6,
    speed: 50,
    attackRange: 110,
    attackCooldown: 1100,
    detectRange: 150,
    xpReward: 25,
    goldDrop: { min: 10, max: 22 },
    lootTable: [
      { itemId: 'flask_red', chance: 0.2 },
      { itemId: 'flask_blue', chance: 0.1 },
      { itemId: 'flask_green', chance: 0.08 }
    ],
    ranged: {
      projectileSpeed: 140,
      projectileRange: 140,
      projectileDamage: 5,
      projectileStyle: 'poison_bolt',
      preferredRange: 70,
      meleeRange: 24,
      rangedCooldown: 1800
    }
  },
  monster_orc_veteran: {
    id: 'monster_orc_veteran',
    name: 'Orc Veteran',
    type: 'orc_veteran',
    family: 'orc',
    sprite: 'monster_orc_veteran',
    health: 40,
    damage: 9,
    speed: 50,
    attackRange: 26,
    attackCooldown: 1000,
    detectRange: 120,
    xpReward: 35,
    goldDrop: { min: 15, max: 35 },
    lootTable: [
      { itemId: 'flask_big_red', chance: 0.2 },
      { itemId: 'weapon_sword_steel', chance: 0.1 },
      { itemId: 'weapon_hammer', chance: 0.06 },
      { itemId: 'armor_barbarian', chance: 0.06 },
      { itemId: 'armor_shield_iron', chance: 0.05 }
    ]
  },
  monster_ogre: {
    id: 'monster_ogre',
    name: 'Ogre',
    type: 'ogre',
    family: 'orc',
    sprite: 'monster_ogre',
    health: 90,
    damage: 12,
    speed: 40,
    attackRange: 30,
    attackCooldown: 1100,
    detectRange: 160,
    xpReward: 120,
    goldDrop: { min: 60, max: 120 },
    lootTable: [
      { itemId: 'flask_big_red', chance: 0.5 },
      { itemId: 'weapon_sledgehammer', chance: 0.15 },
      { itemId: 'weapon_hammer', chance: 0.2 },
      { itemId: 'armor_knight', chance: 0.1 }
    ],
    bossOnly: true,
    spriteSize: { width: 32, height: 32 }
  },

  // ── Demon Family ──
  monster_imp: {
    id: 'monster_imp',
    name: 'Imp',
    type: 'imp',
    family: 'demon',
    sprite: 'monster_imp',
    health: 10,
    damage: 3,
    speed: 85,
    attackRange: 90,
    attackCooldown: 800,
    detectRange: 140,
    xpReward: 12,
    goldDrop: { min: 5, max: 12 },
    lootTable: [
      { itemId: 'flask_red', chance: 0.2 },
      { itemId: 'flask_yellow', chance: 0.05 }
    ],
    ranged: {
      projectileSpeed: 180,
      projectileRange: 120,
      projectileDamage: 2,
      projectileStyle: 'fire_bolt',
      preferredRange: 60,
      meleeRange: 16,
      rangedCooldown: 1200
    }
  },
  monster_chort: {
    id: 'monster_chort',
    name: 'Chort',
    type: 'chort',
    family: 'demon',
    sprite: 'monster_chort',
    health: 30,
    damage: 7,
    speed: 65,
    attackRange: 22,
    attackCooldown: 1000,
    detectRange: 140,
    xpReward: 30,
    goldDrop: { min: 15, max: 30 },
    lootTable: [
      { itemId: 'flask_big_red', chance: 0.15 },
      { itemId: 'weapon_dagger_golden', chance: 0.05 },
      { itemId: 'flask_yellow', chance: 0.08 }
    ]
  },
  monster_bies: {
    id: 'monster_bies',
    name: 'Bies',
    type: 'bies',
    family: 'demon',
    sprite: 'monster_bies',
    health: 45,
    damage: 8,
    speed: 60,
    attackRange: 24,
    attackCooldown: 1000,
    detectRange: 150,
    xpReward: 40,
    goldDrop: { min: 20, max: 40 },
    lootTable: [
      { itemId: 'flask_big_red', chance: 0.2 },
      { itemId: 'weapon_sword_silver', chance: 0.08 },
      { itemId: 'armor_spy', chance: 0.06 }
    ]
  },
  monster_demon: {
    id: 'monster_demon',
    name: 'Demon Lord',
    type: 'demon',
    family: 'demon',
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
      { itemId: 'armor_knight', chance: 0.15 },
      { itemId: 'armor_shield_golden', chance: 0.1 }
    ],
    bossOnly: true
  },

  // ── Elemental Family ──
  monster_elemental_goo: {
    id: 'monster_elemental_goo',
    name: 'Goo Elemental',
    type: 'elemental_goo',
    family: 'elemental',
    sprite: 'monster_elemental_goo',
    health: 15,
    damage: 3,
    speed: 45,
    attackRange: 18,
    attackCooldown: 1200,
    detectRange: 100,
    xpReward: 12,
    goldDrop: { min: 4, max: 10 },
    lootTable: [
      { itemId: 'flask_green', chance: 0.15 },
      { itemId: 'flask_red', chance: 0.15 }
    ]
  },
  monster_elemental_fire: {
    id: 'monster_elemental_fire',
    name: 'Fire Elemental',
    type: 'elemental_fire',
    family: 'elemental',
    sprite: 'monster_elemental_fire',
    health: 25,
    damage: 8,
    speed: 60,
    attackRange: 22,
    attackCooldown: 1000,
    detectRange: 130,
    xpReward: 28,
    goldDrop: { min: 10, max: 22 },
    lootTable: [
      { itemId: 'flask_red', chance: 0.2 },
      { itemId: 'flask_yellow', chance: 0.1 }
    ]
  },
  monster_elemental_water: {
    id: 'monster_elemental_water',
    name: 'Water Elemental',
    type: 'elemental_water',
    family: 'elemental',
    sprite: 'monster_elemental_water',
    health: 30,
    damage: 5,
    speed: 55,
    attackRange: 22,
    attackCooldown: 1100,
    detectRange: 120,
    xpReward: 25,
    goldDrop: { min: 8, max: 20 },
    lootTable: [
      { itemId: 'flask_blue', chance: 0.2 },
      { itemId: 'flask_red', chance: 0.15 }
    ]
  },
  monster_elemental_air: {
    id: 'monster_elemental_air',
    name: 'Air Elemental',
    type: 'elemental_air',
    family: 'elemental',
    sprite: 'monster_elemental_air',
    health: 20,
    damage: 6,
    speed: 80,
    attackRange: 20,
    attackCooldown: 900,
    detectRange: 140,
    xpReward: 22,
    goldDrop: { min: 8, max: 18 },
    lootTable: [
      { itemId: 'flask_blue', chance: 0.15 },
      { itemId: 'flask_green', chance: 0.1 }
    ]
  },
  monster_elemental_earth: {
    id: 'monster_elemental_earth',
    name: 'Earth Elemental',
    type: 'elemental_earth',
    family: 'elemental',
    sprite: 'monster_elemental_earth',
    health: 40,
    damage: 7,
    speed: 35,
    attackRange: 24,
    attackCooldown: 1300,
    detectRange: 100,
    xpReward: 30,
    goldDrop: { min: 12, max: 25 },
    lootTable: [
      { itemId: 'flask_red', chance: 0.2 },
      { itemId: 'armor_shield_iron', chance: 0.05 }
    ]
  },
  monster_elemental_plant: {
    id: 'monster_elemental_plant',
    name: 'Plant Elemental',
    type: 'elemental_plant',
    family: 'elemental',
    sprite: 'monster_elemental_plant',
    health: 22,
    damage: 4,
    speed: 50,
    attackRange: 20,
    attackCooldown: 1100,
    detectRange: 110,
    xpReward: 18,
    goldDrop: { min: 6, max: 14 },
    lootTable: [
      { itemId: 'flask_green', chance: 0.2 },
      { itemId: 'flask_red', chance: 0.15 }
    ]
  },
  monster_elemental_gold: {
    id: 'monster_elemental_gold',
    name: 'Gold Elemental',
    type: 'elemental_gold',
    family: 'elemental',
    sprite: 'monster_elemental_gold',
    health: 50,
    damage: 9,
    speed: 45,
    attackRange: 24,
    attackCooldown: 1000,
    detectRange: 120,
    xpReward: 45,
    goldDrop: { min: 30, max: 60 },
    lootTable: [
      { itemId: 'flask_big_red', chance: 0.2 },
      { itemId: 'flask_yellow', chance: 0.15 },
      { itemId: 'weapon_sword_golden', chance: 0.05 }
    ]
  },
  monster_elemental_lord: {
    id: 'monster_elemental_lord',
    name: 'Elemental Lord',
    type: 'elemental_lord',
    family: 'elemental',
    sprite: 'npc_wizzard',
    health: 85,
    damage: 11,
    speed: 55,
    attackRange: 130,
    attackCooldown: 950,
    detectRange: 180,
    xpReward: 110,
    goldDrop: { min: 50, max: 100 },
    lootTable: [
      { itemId: 'flask_big_red', chance: 0.5 },
      { itemId: 'weapon_sword_ruby', chance: 0.15 },
      { itemId: 'armor_wizard', chance: 0.15 },
      { itemId: 'armor_shield_golden', chance: 0.1 }
    ],
    bossOnly: true,
    ranged: {
      projectileSpeed: 200,
      projectileRange: 180,
      projectileDamage: 9,
      projectileStyle: 'energy_orb',
      preferredRange: 100,
      meleeRange: 28,
      rangedCooldown: 1300
    }
  },

  // ── Dark Knight Family ──
  monster_dark_knight: {
    id: 'monster_dark_knight',
    name: 'Dark Knight',
    type: 'dark_knight',
    family: 'dark_knight',
    sprite: 'monster_dark_knight',
    health: 55,
    damage: 10,
    speed: 55,
    attackRange: 26,
    attackCooldown: 1000,
    detectRange: 140,
    xpReward: 50,
    goldDrop: { min: 25, max: 50 },
    lootTable: [
      { itemId: 'flask_big_red', chance: 0.25 },
      { itemId: 'weapon_sword_silver', chance: 0.1 },
      { itemId: 'armor_knight', chance: 0.08 },
      { itemId: 'armor_shield_iron', chance: 0.06 }
    ]
  }
};

export function getMonster(id: string): MonsterData | undefined {
  return MONSTERS[id];
}

export function getAllMonsterTypes(): string[] {
  return Object.keys(MONSTERS);
}

/** Get all monsters belonging to a specific family */
export function getMonstersByFamily(family: MonsterFamily): MonsterData[] {
  return Object.values(MONSTERS).filter(m => m.family === family);
}

/** Get non-boss monsters belonging to a specific family */
export function getNonBossMonstersByFamily(family: MonsterFamily): MonsterData[] {
  return Object.values(MONSTERS).filter(m => m.family === family && !m.bossOnly);
}

/** Get all boss-only monsters */
export function getBossMonsters(): MonsterData[] {
  return Object.values(MONSTERS).filter(m => m.bossOnly);
}
