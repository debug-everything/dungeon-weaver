export const GAME_WIDTH = 800;
export const GAME_HEIGHT = 600;
export const TILE_SIZE = 16;
export const SCALE = 2;

export const PLAYER_SPEED = 120;
export const PLAYER_MAX_HEALTH = 100;
export const PLAYER_MAX_MANA = 50;
export const PLAYER_START_GOLD = 50;

// Mana regeneration
export const MANA_REGEN_BASE = 1.0;
export const MANA_REGEN_PER_INT = 0.3;
export const MANA_REGEN_TICK = 500;

export const DUNGEON_WIDTH = 60;
export const DUNGEON_HEIGHT = 45;
export const ROOM_MIN_SIZE = 5;
export const ROOM_MAX_SIZE = 10;
export const MAX_ROOMS = 10;
export const ROOMS_TO_CLEAR_FOR_BOSS = 4;

export const INTERACTION_DISTANCE = 32;
export const ATTACK_COOLDOWN = 400;
export const VISIBILITY_RADIUS = 6;

export const INVENTORY_SLOTS = 20;
export const INVENTORY_COLS = 5;
export const SHOP_DISPLAY_LIMIT = 10;

// Weapon class defaults: arcWidth (degrees), knockback (force)
export const WEAPON_CLASS_DEFAULTS: Record<string, { arcWidth: number; knockback: number }> = {
  dagger:  { arcWidth: 90,  knockback: 20 },
  sword:   { arcWidth: 120, knockback: 40 },
  hammer:  { arcWidth: 160, knockback: 80 },
  katana:  { arcWidth: 100, knockback: 30 },
  unarmed: { arcWidth: 90,  knockback: 10 },
  staff:   { arcWidth: 100, knockback: 50 },
  spell:   { arcWidth: 0,   knockback: 0 }
};

// Spell projectile settings
export const SPELL_PROJECTILE_SPEED: Record<string, number> = {
  fireball: 200,
  lightning: 350,
  frost: 160
};

export const SPELL_COLORS: Record<string, { primary: number; secondary: number; trail: number }> = {
  fireball:  { primary: 0xff6600, secondary: 0xff2200, trail: 0xffaa00 },
  lightning: { primary: 0x4488ff, secondary: 0xffffff, trail: 0x2266cc },
  frost:     { primary: 0x88ddff, secondary: 0xffffff, trail: 0x44aadd }
};

// Monster projectile colors (visually distinct from player spell colors)
import type { MonsterProjectileStyle } from '../types';
export const MONSTER_PROJECTILE_COLORS: Record<MonsterProjectileStyle, { primary: number; secondary: number; trail: number }> = {
  bone_arrow:  { primary: 0xddddcc, secondary: 0xffffff, trail: 0xaaaaaa },
  poison_bolt: { primary: 0x44cc22, secondary: 0x88ff44, trail: 0x226611 },
  fire_bolt:   { primary: 0xff8800, secondary: 0xffcc00, trail: 0xcc4400 },
  skull_bolt:  { primary: 0xaa44ff, secondary: 0xdd88ff, trail: 0x662299 },
  energy_orb:  { primary: 0x00dddd, secondary: 0x88ffff, trail: 0x008888 },
};

// Chests
export const CHESTS_PER_ROOM = { min: 0, max: 2 };
export const CHEST_GOLD = { min: 5, max: 30 };
export const CHEST_LOOT_TABLE = [
  { itemId: 'flask_red', chance: 0.35 },
  { itemId: 'flask_green', chance: 0.15 },
  { itemId: 'flask_blue', chance: 0.15 },
  { itemId: 'flask_big_red', chance: 0.10 },
  { itemId: 'weapon_dagger_small', chance: 0.05 },
  { itemId: 'weapon_sword_rusty', chance: 0.04 },
  { itemId: 'weapon_sword_steel', chance: 0.02 },
];

// Leveling system
export const MAX_LEVEL = 20;
export const STAT_POINTS_PER_LEVEL = 3;
export const BASE_STATS = { strength: 1, dexterity: 1, constitution: 1, luck: 1, intelligence: 1 };
export const BASE_MAX_HEALTH = 100;
// Cumulative XP thresholds: XP_PER_LEVEL[n] = 80n + 20n² (index 0 unused, index 1 = level 2 threshold)
export const XP_PER_LEVEL: number[] = (() => {
  const table = [0]; // index 0 = no threshold for level 1
  let cumulative = 0;
  for (let n = 1; n <= MAX_LEVEL; n++) {
    cumulative += 80 * n + 20 * n * n;
    table.push(cumulative);
  }
  return table;
})();

// Tab-navigable player overlay scenes (in cycle order)
export const PLAYER_OVERLAY_TABS = ['INVENTORY', 'QUEST_LOG', 'MAP', 'LEVEL_UP'] as const;
export type PlayerOverlayTab = typeof PLAYER_OVERLAY_TABS[number];

// I-frames
export const PLAYER_IFRAMES_DURATION = 500;
export const PLAYER_IFRAMES_FLASH_RATE = 80;

// Dodge/roll
export const DODGE_SPEED = 300;
export const DODGE_DURATION = 200;
export const DODGE_COOLDOWN = 600;
export const DODGE_IFRAMES = 250;

// Combo system
export const COMBO_WINDOW = 500;
export const COMBO_DAMAGE_MULTIPLIERS = [1.0, 1.2, 1.5, 1.8, 2.0];

// Charged attacks
export const CHARGE_TIME = 800;
export const CHARGE_MIN_TIME = 200;

// Multi-floor dungeon
export const TOTAL_FLOORS = 3;
export const FLOOR_SCALING: Record<number, { hp: number; damage: number }> = {
  1: { hp: 1.0, damage: 1.0 },
  2: { hp: 1.3, damage: 1.3 },
  3: { hp: 1.7, damage: 1.6 },
  4: { hp: 2.1, damage: 2.0 },
  5: { hp: 2.5, damage: 2.5 },
};

export const SCENE_KEYS = {
  BOOT: 'BootScene',
  SPLASH: 'SplashScene',
  MENU: 'MenuScene',
  GAME: 'GameScene',
  UI: 'UIScene',
  INVENTORY: 'InventoryScene',
  SHOP: 'ShopScene',
  NPC_INTERACTION: 'NPCInteractionScene',
  QUEST_DIALOG: 'QuestDialogScene',
  MAP: 'MapScene',
  QUEST_LOG: 'QuestLogScene',
  NARRATOR: 'NarratorScene',
  LEVEL_UP: 'LevelUpScene',
  TERMINAL: 'TerminalScene'
} as const;

// Monster tier system
import type { MonsterFamily } from '../types';
export type MonsterTier = 1 | 2 | 3;
export const MONSTER_TIER_FAMILIES: Record<MonsterTier, MonsterFamily[]> = {
  1: ['undead', 'beast'],
  2: ['undead', 'beast', 'orc', 'demon'],
  3: ['undead', 'beast', 'orc', 'demon', 'elemental', 'dark_knight']
};
export const BOSS_LABEL_COLORS = { miniBoss: '#ffaa00', arcBoss: '#ff4444' };

// Boss ability system
export const BOSS_ABILITY_BASE_COOLDOWN = 5000; // ms between abilities

// Monster spawners/nests
export const SPAWNER_HP: Record<MonsterTier, number> = { 1: 20, 2: 30, 3: 40 };
export const SPAWNER_SPAWN_COOLDOWN = 8000;
export const SPAWNER_MAX_SPAWNED = 3;
export const SPAWNER_CHANCE = 0.3;
export const SPAWNER_XP: Record<MonsterTier, number> = { 1: 15, 2: 20, 3: 25 };
export const SPAWNER_FAMILY_TINTS: Record<string, number> = {
  undead: 0xaaaaaa,
  beast: 0x66cc66,
  orc: 0xccaa77,
  demon: 0xff4444,
  elemental: 0x4488ff,
  dark_knight: 0xaa44ff
};

export const EVENTS = {
  PLAYER_HEALTH_CHANGED: 'player-health-changed',
  PLAYER_GOLD_CHANGED: 'player-gold-changed',
  PLAYER_EQUIPMENT_CHANGED: 'player-equipment-changed',
  INVENTORY_CHANGED: 'inventory-changed',
  MONSTER_KILLED: 'monster-killed',
  ITEM_PICKED_UP: 'item-picked-up',
  OPEN_SHOP: 'open-shop',
  CLOSE_SHOP: 'close-shop',
  OPEN_INVENTORY: 'open-inventory',
  CLOSE_INVENTORY: 'close-inventory',
  OPEN_NPC_INTERACTION: 'open-npc-interaction',
  CLOSE_NPC_INTERACTION: 'close-npc-interaction',
  OPEN_QUEST_DIALOG: 'open-quest-dialog',
  CLOSE_QUEST_DIALOG: 'close-quest-dialog',
  QUEST_ACCEPTED: 'quest-accepted',
  QUEST_PROGRESS_UPDATED: 'quest-progress-updated',
  QUEST_OBJECTIVE_COMPLETED: 'quest-objective-completed',
  QUEST_READY_TO_TURN_IN: 'quest-ready-to-turn-in',
  QUEST_TURNED_IN: 'quest-turned-in',
  QUEST_LOG_CHANGED: 'quest-log-changed',
  OPEN_MAP: 'open-map',
  CLOSE_MAP: 'close-map',
  OPEN_QUEST_LOG: 'open-quest-log',
  CLOSE_QUEST_LOG: 'close-quest-log',
  ARC_NEXT_QUEST_NPC: 'arc-next-quest-npc',
  BOSS_ROOM_ENTERED: 'boss-room-entered',
  BOSS_DEFEATED: 'boss-defeated',
  CLOSE_NARRATOR: 'close-narrator',
  XP_GAINED: 'xp-gained',
  LEVEL_UP: 'level-up',
  STATS_CHANGED: 'stats-changed',
  OPEN_LEVEL_UP: 'open-level-up',
  CLOSE_LEVEL_UP: 'close-level-up',
  PLAYER_MANA_CHANGED: 'player-mana-changed',
  PLAYER_SPELL: 'player-spell',
  OPEN_TERMINAL: 'open-terminal',
  CLOSE_TERMINAL: 'close-terminal',
  FLOOR_CHANGED: 'floor-changed',
  LLM_STATUS_CHANGED: 'llm-status-changed'
} as const;
