export type ItemType = 'weapon' | 'armor' | 'consumable' | 'misc';
export type EquipmentSlot = 'weapon' | 'armor' | 'shield';
export type WeaponClass = 'sword' | 'dagger' | 'hammer' | 'katana' | 'unarmed';

export interface ItemStats {
  damage?: number;
  defense?: number;
  speed?: number;
  range?: number;
  healAmount?: number;
  weaponClass?: WeaponClass;
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
  armor: Item | null;
  shield: Item | null;
}

export type MonsterType = 'zombie' | 'zombie_small' | 'zombie_green' | 'zombie_tall' | 'skelet' | 'necromancer'
  | 'bat' | 'wogol' | 'rokita' | 'tentacle'
  | 'goblin' | 'orc' | 'orc_armored' | 'orc_masked' | 'orc_shaman' | 'orc_veteran' | 'ogre'
  | 'imp' | 'chort' | 'bies' | 'demon'
  | 'elemental_goo' | 'elemental_fire' | 'elemental_water' | 'elemental_air' | 'elemental_earth' | 'elemental_plant' | 'elemental_gold' | 'elemental_lord'
  | 'dark_knight';
export type MonsterFamily = 'undead' | 'beast' | 'orc' | 'demon' | 'elemental' | 'dark_knight';
export type MonsterState = 'idle' | 'chasing' | 'attacking' | 'dead';

export interface MonsterData {
  id: string;
  name: string;
  type: MonsterType;
  family: MonsterFamily;
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
  nameColor?: string;
  bossOnly?: boolean;
  spriteSize?: { width: number; height: number };
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

export type RoomType = 'start' | 'challenge' | 'boss';

export interface DungeonRoom {
  x: number;
  y: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  roomType?: RoomType;
  connectedTo?: number[];
  isCleared?: boolean;
  isBossRoom?: boolean;
  isLocked?: boolean;
}

export interface DungeonTile {
  x: number;
  y: number;
  type: 'floor' | 'wall' | 'door';
  walkable: boolean;
}

// Chest data
export interface ChestData {
  x: number;
  y: number;
  opened: boolean;
  gold: number;
  items: { itemId: string; quantity: number }[];
  questItemId?: string;
}

// Quest system types (JSON-serializable for future LLM generation)
export type QuestType = 'rescue' | 'recover' | 'destroy' | 'investigate';
export type QuestStatus = 'available' | 'active' | 'completed' | 'turned_in';
export type QuestObjectiveType = 'kill' | 'collect' | 'talk_to' | 'explore';
export type DialogAction =
  | { type: 'accept_quest' }
  | { type: 'decline_quest' }
  | { type: 'end_dialog' }
  | { type: 'turn_in_quest' };

export interface DialogNode {
  id: string;
  speaker: string;
  text: string;
  responses?: DialogResponse[];
}

export interface DialogResponse {
  text: string;
  nextNodeId: string;
  action?: DialogAction;
}

export interface QuestObjective {
  id: string;
  type: QuestObjectiveType;
  description: string;
  target: string; // monster type id or item id
  requiredCount: number;
  consumeOnTurnIn: boolean;
}

export interface QuestReward {
  xp: number;
  gold?: number;
  items?: { itemId: string; quantity: number }[];
}

export interface MonsterVariant {
  variantId: string;
  baseType: MonsterType;
  baseSprite: string;
  name: string;
  statMultiplier: number;
  nameColor?: string;
}

export interface ItemVariant {
  variantId: string;
  baseItem: string;
  name: string;
  description: string;
}

export interface QuestDefinition {
  id: string;
  name: string;
  type: QuestType;
  description: string;
  npcId: string;
  level: number;
  intro?: string[];
  dialog: {
    offer: DialogNode[];
    inProgress: DialogNode[];
    readyToTurnIn: DialogNode[];
    completed: DialogNode[];
  };
  objectives: QuestObjective[];
  rewards: QuestReward;
  variants?: {
    monsters?: MonsterVariant[];
    items?: ItemVariant[];
  };
}

export interface QuestObjectiveProgress {
  objectiveId: string;
  currentCount: number;
  completed: boolean;
}

export interface QuestState {
  questId: string;
  status: QuestStatus;
  objectiveProgress: QuestObjectiveProgress[];
  targetRoom?: { x: number; y: number; width: number; height: number };
}

export interface StoryArcInfo {
  id: string;
  title: string;
  currentQuestIndex: number;
  totalQuests: number;
  status: 'active' | 'completed';
  nextQuestNpcId: string | null;
  nextQuestReady: boolean;
}

export interface QuestMapIndicator {
  questId: string;
  questName: string;
  targetArea: { x: number; y: number; width: number; height: number };
  type: QuestObjectiveType;
  isVisible: boolean;
  isExplored: boolean;
  completed: boolean;
}
