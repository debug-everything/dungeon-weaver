export const GAME_WIDTH = 800;
export const GAME_HEIGHT = 600;
export const TILE_SIZE = 16;
export const SCALE = 2;

export const PLAYER_SPEED = 120;
export const PLAYER_MAX_HEALTH = 100;
export const PLAYER_START_GOLD = 50;

export const DUNGEON_WIDTH = 40;
export const DUNGEON_HEIGHT = 30;
export const ROOM_MIN_SIZE = 5;
export const ROOM_MAX_SIZE = 10;
export const MAX_ROOMS = 8;

export const INTERACTION_DISTANCE = 32;
export const ATTACK_COOLDOWN = 400;

export const INVENTORY_SLOTS = 20;
export const INVENTORY_COLS = 5;

export const SCENE_KEYS = {
  BOOT: 'BootScene',
  MENU: 'MenuScene',
  GAME: 'GameScene',
  UI: 'UIScene',
  INVENTORY: 'InventoryScene',
  SHOP: 'ShopScene',
  NPC_INTERACTION: 'NPCInteractionScene',
  QUEST_DIALOG: 'QuestDialogScene'
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
  QUEST_LOG_CHANGED: 'quest-log-changed'
} as const;
