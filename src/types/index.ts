export type ItemType = 'weapon' | 'armor' | 'consumable' | 'misc';
export type EquipmentSlot = 'weapon' | 'armor' | 'shield' | 'spellbook';
export type WeaponClass = 'sword' | 'dagger' | 'hammer' | 'katana' | 'unarmed' | 'spell' | 'staff';
export type SpellType = 'fireball' | 'lightning' | 'frost';

export interface ItemStats {
  damage?: number;
  defense?: number;
  speed?: number;
  range?: number;
  healAmount?: number;
  manaRestoreAmount?: number;
  manaCost?: number;
  weaponClass?: WeaponClass;
  spellType?: SpellType;
  element?: SpellType;
  aoe?: number;
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
  spellbook: Item | null;
}

export type MonsterType = 'zombie' | 'zombie_small' | 'zombie_green' | 'zombie_tall' | 'skelet' | 'necromancer'
  | 'bat' | 'wogol' | 'rokita' | 'tentacle'
  | 'goblin' | 'orc' | 'orc_armored' | 'orc_masked' | 'orc_shaman' | 'orc_veteran' | 'ogre'
  | 'imp' | 'chort' | 'bies' | 'demon'
  | 'elemental_goo' | 'elemental_fire' | 'elemental_water' | 'elemental_air' | 'elemental_earth' | 'elemental_plant' | 'elemental_gold' | 'elemental_lord'
  | 'dark_knight';
export type MonsterFamily = 'undead' | 'beast' | 'orc' | 'demon' | 'elemental' | 'dark_knight';
export type MonsterState = 'idle' | 'chasing' | 'attacking' | 'retreating' | 'dead';

export type MonsterProjectileStyle = 'bone_arrow' | 'poison_bolt' | 'fire_bolt' | 'skull_bolt' | 'energy_orb';

export interface MonsterRangedData {
  projectileSpeed: number;
  projectileRange: number;
  projectileDamage: number;
  projectileStyle: MonsterProjectileStyle;
  preferredRange: number;
  meleeRange: number;
  rangedCooldown: number;
}

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
  ranged?: MonsterRangedData;
  bossPattern?: BossPatternData;
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

export interface PlayerStats {
  strength: number;
  dexterity: number;
  constitution: number;
  luck: number;
  intelligence: number;
}

export interface PlayerState {
  health: number;
  maxHealth: number;
  mana: number;
  maxMana: number;
  gold: number;
  inventory: InventoryItem[];
  equipment: Equipment;
  position: { x: number; y: number };
  level: number;
  xp: number;
  stats: PlayerStats;
  statPoints: number;
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

export interface QuestNarration {
  onComplete?: string[];       // 1-3 lines when all objectives done (3rd-person narrator voice)
  onBossEncounter?: string[];  // 1-3 lines when player enters boss room (ominous)
  onBossDefeat?: string[];     // 1-3 lines when boss dies (cathartic)
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
  narration?: QuestNarration;
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

export interface LoreFragment {
  locations: { name: string; description: string }[];
  faction: { name: string; description: string };
  history: string;
  artifact: { name: string; description: string };
}

export interface StoryArcInfo {
  id: string;
  title: string;
  currentQuestIndex: number;
  totalQuests: number;
  status: 'active' | 'completed';
  nextQuestNpcId: string | null;
  nextQuestReady: boolean;
  arcQuestIds: string[];
  lore?: LoreFragment;
}

// Boss attack pattern types
export type BossPhase = 1 | 2;
export type BossAbility = 'slam' | 'summon' | 'charge' | 'teleport' | 'barrage';

export interface BossPatternData {
  phase2Threshold: number;          // HP fraction to trigger phase 2 (e.g. 0.5)
  phase2SpeedMultiplier: number;    // speed boost in phase 2
  phase2CooldownMultiplier: number; // faster attacks in phase 2
  abilities: BossAbility[];
  slamRadius?: number;
  summonType?: string;              // monster ID to summon (e.g. 'monster_zombie_small')
  summonCount?: number;
  chargeSpeed?: number;
  barrageCount?: number;
  barrageStyle?: MonsterProjectileStyle;
}

// Monster spawner/nest types
export interface SpawnerData {
  x: number;
  y: number;              // tile coords
  roomIndex: number;
  health: number;
  maxHealth: number;
  monsterFamily: MonsterFamily;
  spawnCooldown: number;
  lastSpawnTime: number;
  maxSpawned: number;
  livingCount: number;    // currently alive from this spawner
}

export interface FloorTransitionData {
  targetFloor: number;
  playerState: {
    health: number; maxHealth: number;
    mana: number; maxMana: number;
    gold: number;
    level: number; xp: number;
    stats: PlayerStats; statPoints: number;
  };
  inventoryState: { items: (InventoryItem | null)[]; equipment: Equipment };
  questData: { definitions: QuestDefinition[]; states: QuestState[] };
  currentTier: 1 | 2 | 3;
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
