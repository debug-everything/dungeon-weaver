export const GAME_WIDTH = 800;
export const GAME_HEIGHT = 600;
export const TILE_SIZE = 16;
export const SCALE = 2;

export const PLAYER_SPEED = 120;
export const PLAYER_MAX_HEALTH = 100;
export const PLAYER_START_GOLD = 50;

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
  unarmed: { arcWidth: 90,  knockback: 10 }
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

export const SCENE_KEYS = {
  BOOT: 'BootScene',
  MENU: 'MenuScene',
  GAME: 'GameScene',
  UI: 'UIScene',
  INVENTORY: 'InventoryScene',
  SHOP: 'ShopScene',
  NPC_INTERACTION: 'NPCInteractionScene',
  QUEST_DIALOG: 'QuestDialogScene',
  MAP: 'MapScene',
  QUEST_LOG: 'QuestLogScene'
} as const;

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
  ARC_NEXT_QUEST_NPC: 'arc-next-quest-npc'
} as const;
