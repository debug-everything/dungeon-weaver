export type ItemType = 'weapon' | 'armor' | 'consumable' | 'misc';
export type EquipmentSlot = 'weapon' | 'head' | 'chest' | 'legs' | 'boots' | 'shield';
export type ArmorType = 'head' | 'chest' | 'legs' | 'boots' | 'shield';

export interface ItemStats {
  damage?: number;
  defense?: number;
  speed?: number;
  range?: number;
  healAmount?: number;
}

export interface Item {
  id: string;
  name: string;
  type: ItemType;
  slot?: EquipmentSlot;
  stats: ItemStats;
  value: number;
  sprite: string;
  description: string;
  stackable: boolean;
  maxStack?: number;
}

export interface InventoryItem {
  item: Item;
  quantity: number;
}

export interface Equipment {
  weapon: Item | null;
  head: Item | null;
  chest: Item | null;
  legs: Item | null;
  boots: Item | null;
  shield: Item | null;
}

export type MonsterType = 'zombie' | 'skelet' | 'orc' | 'goblin' | 'demon';
export type MonsterState = 'idle' | 'chasing' | 'attacking' | 'dead';

export interface MonsterData {
  id: string;
  name: string;
  type: MonsterType;
  sprite: string;
  health: number;
  damage: number;
  speed: number;
  attackRange: number;
  attackCooldown: number;
  detectRange: number;
  xpReward: number;
  goldDrop: { min: number; max: number };
  lootTable: LootEntry[];
}

export interface LootEntry {
  itemId: string;
  chance: number;
}

export type NPCType = 'merchant' | 'merchant_2' | 'sage';

export interface NPCData {
  id: string;
  name: string;
  type: NPCType;
  sprite: string;
  dialogue: string[];
  shopInventory: ShopItem[];
}

export interface ShopItem {
  itemId: string;
  stock: number;
  buyPrice: number;
  sellPrice: number;
}

export interface PlayerState {
  health: number;
  maxHealth: number;
  gold: number;
  inventory: InventoryItem[];
  equipment: Equipment;
  position: { x: number; y: number };
}

export interface DungeonRoom {
  x: number;
  y: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
}

export interface DungeonTile {
  x: number;
  y: number;
  type: 'floor' | 'wall' | 'door';
  walkable: boolean;
}
