import { NPCData } from '../types';

export const NPCS: Record<string, NPCData> = {
  npc_merchant: {
    id: 'npc_merchant',
    name: 'Marcus the Merchant',
    type: 'merchant',
    sprite: 'npc_merchant',
    dialogue: [
      "Welcome, adventurer! I have fine wares for sale.",
      "Looking for a sturdy blade? You've come to the right place.",
      "Stay safe out there in the dungeon!"
    ],
    shopInventory: [
      { itemId: 'weapon_sword_wooden', stock: 3, buyPrice: 20, sellPrice: 8 },
      { itemId: 'weapon_sword_steel', stock: 2, buyPrice: 120, sellPrice: 50 },
      { itemId: 'weapon_dagger_small', stock: 5, buyPrice: 12, sellPrice: 5 },
      { itemId: 'weapon_dagger_steel', stock: 3, buyPrice: 60, sellPrice: 25 },
      { itemId: 'flask_red', stock: 10, buyPrice: 25, sellPrice: 10 },
      { itemId: 'flask_big_red', stock: 5, buyPrice: 55, sellPrice: 22 },
      { itemId: 'armor_peasant', stock: 3, buyPrice: 20, sellPrice: 8 },
      { itemId: 'armor_spy', stock: 2, buyPrice: 95, sellPrice: 38 },
      { itemId: 'armor_shield_wooden', stock: 3, buyPrice: 30, sellPrice: 12 }
    ]
  },
  npc_merchant_2: {
    id: 'npc_merchant_2',
    name: 'Elena the Exotic',
    type: 'merchant_2',
    sprite: 'npc_merchant_2',
    dialogue: [
      "Greetings! I deal in only the finest rare goods.",
      "These weapons are hard to come by... and worth every coin.",
      "A true warrior knows quality when they see it."
    ],
    shopInventory: [
      { itemId: 'weapon_sword_ruby', stock: 1, buyPrice: 600, sellPrice: 250 },
      { itemId: 'weapon_sword_golden', stock: 1, buyPrice: 480, sellPrice: 200 },
      { itemId: 'weapon_sword_silver', stock: 2, buyPrice: 250, sellPrice: 100 },
      { itemId: 'weapon_katana_silver', stock: 1, buyPrice: 550, sellPrice: 225 },
      { itemId: 'weapon_sledgehammer', stock: 1, buyPrice: 420, sellPrice: 175 },
      { itemId: 'weapon_dagger_golden', stock: 2, buyPrice: 180, sellPrice: 75 },
      { itemId: 'armor_knight', stock: 1, buyPrice: 420, sellPrice: 168 },
      { itemId: 'armor_wizard', stock: 1, buyPrice: 180, sellPrice: 72 },
      { itemId: 'armor_barbarian', stock: 1, buyPrice: 240, sellPrice: 96 },
      { itemId: 'armor_shield_golden', stock: 1, buyPrice: 480, sellPrice: 192 },
      { itemId: 'armor_shield_iron', stock: 2, buyPrice: 155, sellPrice: 62 }
    ]
  },
  npc_sage: {
    id: 'npc_sage',
    name: 'Aldric the Sage',
    type: 'sage',
    sprite: 'npc_sage',
    dialogue: [
      "Ah, a seeker of knowledge... or perhaps just potions?",
      "The arcane arts require preparation. Stock up wisely.",
      "May the ancient spirits guide your path."
    ],
    shopInventory: [
      { itemId: 'flask_red', stock: 20, buyPrice: 22, sellPrice: 10 },
      { itemId: 'flask_big_red', stock: 10, buyPrice: 50, sellPrice: 22 },
      { itemId: 'flask_blue', stock: 15, buyPrice: 30, sellPrice: 12 },
      { itemId: 'flask_green', stock: 8, buyPrice: 35, sellPrice: 15 },
      { itemId: 'flask_yellow', stock: 5, buyPrice: 50, sellPrice: 20 }
    ]
  }
};

export function getNPC(id: string): NPCData | undefined {
  return NPCS[id];
}

export function getAllNPCIds(): string[] {
  return Object.keys(NPCS);
}
