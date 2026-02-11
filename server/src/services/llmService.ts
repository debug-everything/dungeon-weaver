import OpenAI from 'openai';
import { config } from '../config.js';
import { llmLogger } from '../logger.js';

export interface QuestGenerationContext {
  existingQuestIds: string[];
  targetNpcId: string;
}

// NPC personality profiles — influence quest themes, dialog tone, and reward types
export const NPC_PROFILES: Record<string, { name: string; personality: string }> = {
  npc_merchant: {
    name: 'Marcus the Merchant',
    personality: `Marcus is a practical, no-nonsense trader. His quests revolve around protecting trade routes, recovering stolen merchandise, eliminating pests that threaten his business, or sourcing rare goods. He speaks in a direct, business-like manner. He favors "destroy" and "recover" quest types. Rewards lean toward gold and weapons.`
  },
  npc_merchant_2: {
    name: 'Elena the Exotic',
    personality: `Elena is an adventurous collector of rare and exotic artifacts. Her quests involve tracking down ancient relics, investigating mysterious dungeon anomalies, recovering lost treasures, or hunting rare monster variants. She speaks with wonder and excitement. She favors "investigate" and "recover" quest types. Rewards lean toward rare weapons and unique variant items.`
  },
  npc_sage: {
    name: 'Aldric the Sage',
    personality: `Aldric is a scholarly mystic obsessed with arcane knowledge. His quests involve researching supernatural phenomena, collecting alchemical ingredients, investigating cursed areas, or destroying undead abominations. He speaks in a wise, somewhat cryptic manner. He favors "investigate" and "destroy" quest types. Rewards lean toward potions and consumables.`
  }
};

// Matches the frontend QuestDefinition type
export interface GeneratedQuestDefinition {
  id: string;
  name: string;
  type: 'rescue' | 'recover' | 'destroy' | 'investigate';
  description: string;
  npcId: string;
  level: number;
  dialog: {
    offer: DialogNode[];
    inProgress: DialogNode[];
    readyToTurnIn: DialogNode[];
    completed: DialogNode[];
  };
  objectives: QuestObjective[];
  rewards: QuestReward;
  variants?: {
    monsters?: { variantId: string; baseType: string; baseSprite: string; name: string; statMultiplier: number }[];
    items?: { variantId: string; baseItem: string; name: string; description: string }[];
  };
}

interface DialogNode {
  id: string;
  speaker: string;
  text: string;
  responses?: DialogResponse[];
}

interface DialogResponse {
  text: string;
  nextNodeId: string;
  action?: { type: 'accept_quest' | 'decline_quest' | 'end_dialog' | 'turn_in_quest' };
}

interface QuestObjective {
  id: string;
  type: 'kill' | 'collect' | 'talk_to' | 'explore';
  description: string;
  target: string;
  requiredCount: number;
  consumeOnTurnIn: boolean;
}

interface QuestReward {
  xp: number;
  gold?: number;
  items?: { itemId: string; quantity: number }[];
}

const SYSTEM_PROMPT = `You are a quest designer for a dungeon crawler RPG. Generate a single quest as a JSON object.

You can create VARIANT monsters and items — custom-named versions of existing types that reuse base sprites but have unique names and scaled stats. This makes quests feel unique without needing new assets.

## EXACT SCHEMA (follow precisely)

{
  "id": string,              // MUST start with "quest_llm_" e.g. "quest_llm_goblin_raid"
  "name": string,            // Display name e.g. "Goblin Raid"
  "type": enum,              // ONE OF: "rescue", "recover", "destroy", "investigate"
  "description": string,     // 1-2 sentence quest summary
  "npcId": enum,             // ONE OF: "npc_merchant", "npc_merchant_2", "npc_sage"
  "level": number,           // 1-5
  "variants": {              // (optional) Define custom variants of existing monsters/items
    "monsters": [            // (optional) For kill quests — variant monsters
      {
        "variantId": string,      // Unique id e.g. "monster_hunchback_goblin"
        "baseType": enum,         // ONE OF: "zombie","skelet","orc","goblin","demon"
        "baseSprite": enum,       // ONE OF: "monster_zombie","monster_skelet","monster_orc","monster_goblin","monster_demon"
        "name": string,           // Display name e.g. "Hunchback Goblin"
        "statMultiplier": number  // 0.5-2.0, scales base health/damage/xp/gold
      }
    ],
    "items": [               // (optional) For collect quests or unique rewards
      {
        "variantId": string,      // Unique id e.g. "item_cursed_blade"
        "baseItem": enum,         // ONE OF the ITEM_IDS below
        "name": string,           // Display name e.g. "Cursed Blade"
        "description": string     // Flavor text for the item
      }
    ]
  },
  "objectives": [            // Array of 1-3 objectives
    {
      "id": string,          // Unique within quest e.g. "kill_goblins"
      "type": enum,          // ONE OF: "kill", "collect"
      "description": string, // e.g. "Kill 3 hunchback goblins"
      "target": string,      // If type="kill": the BASE TYPE e.g. "goblin" (NOT the variantId)
                              // If type="collect": a variantId OR one of the ITEM_IDS below
      "requiredCount": number, // 1-4 for kill, 1-3 for collect
      "consumeOnTurnIn": boolean // true for collect objectives, false for kill
    }
  ],
  "rewards": {
    "xp": number,            // 25-200
    "gold": number,          // 10-100 (optional)
    "items": [               // (optional) Array of reward items
      {
        "itemId": string,    // MUST be one of the ITEM_IDS below OR a variantId defined in variants.items
        "quantity": number   // 1-3
      }
    ]
  },
  "dialog": {
    "offer": DialogNode[],         // 3 nodes. First node MUST have responses with accept_quest and decline_quest actions.
    "inProgress": DialogNode[],    // 3 nodes. First node MUST have responses. Remind player of objective.
    "readyToTurnIn": DialogNode[], // 3 nodes. First node MUST have responses with turn_in_quest action.
    "completed": DialogNode[]      // 3 nodes. First node MUST have responses with end_dialog action. Thank the player.
  }
}

DialogNode = {
  "id": string,              // Unique within phase e.g. "offer_1", "offer_accept"
  "speaker": string,         // NPC display name matching npcId (see NPC_NAMES below)
  "text": string,            // Dialog text (1-2 sentences, in character)
  "responses": [             // ONLY on the first node of each phase. Omit on terminal nodes.
    {
      "text": string,        // Player response text (short, 2-8 words)
      "nextNodeId": string,  // MUST reference another node id IN THE SAME phase
      "action": {            // Optional action object
        "type": enum         // ONE OF: "accept_quest", "decline_quest", "end_dialog", "turn_in_quest"
      }
    }
  ]
}

## VALID ENUM VALUES

NPC_NAMES (use as "speaker" based on npcId):
- "npc_merchant" → "Marcus the Merchant"
- "npc_merchant_2" → "Elena the Exotic"
- "npc_sage" → "Aldric the Sage"

ITEM_IDS (for objective targets, reward itemId, and variants baseItem):
"weapon_sword_wooden", "weapon_sword_rusty", "weapon_sword_steel", "weapon_sword_silver", "weapon_sword_golden", "weapon_sword_ruby", "weapon_dagger_small", "weapon_dagger_steel", "weapon_dagger_golden", "weapon_katana_silver", "weapon_hammer", "weapon_sledgehammer", "flask_red", "flask_big_red", "flask_blue", "flask_green", "flask_yellow"

## DIALOG RULES
- Each phase has EXACTLY 3 nodes: one with responses (first), two terminal (no responses).
- Every nextNodeId MUST match an id of another node in the SAME phase. Never reference other phases.
- Required actions per phase:
  - offer: one response has {"type":"accept_quest"}, one has {"type":"decline_quest"}
  - readyToTurnIn: one response has {"type":"turn_in_quest"}, one has {"type":"end_dialog"}
  - completed: one response has {"type":"end_dialog"}
  - inProgress: one response has {"type":"end_dialog"}

## VARIANT RULES
- Use variants to give quests flavor: "Hunchback Goblin" instead of just "goblin", "Venom Flask" instead of "flask_green"
- Kill objective "target" MUST be the BASE TYPE (e.g. "goblin"), not the variantId. The game matches kills by base type.
- Collect objective "target" can be a variantId defined in variants.items
- Reward itemId can be a variantId defined in variants.items
- You don't HAVE to use variants — simple quests without them are fine too

## COMPLETE EXAMPLE

{
  "id": "quest_llm_goblin_raid",
  "name": "Goblin Raid",
  "type": "destroy",
  "description": "Hunchback goblins have been raiding the merchant stalls. Clear them out before they steal everything.",
  "npcId": "npc_merchant",
  "level": 1,
  "variants": {
    "monsters": [
      {"variantId": "monster_hunchback_goblin", "baseType": "goblin", "baseSprite": "monster_goblin", "name": "Hunchback Goblin", "statMultiplier": 1.3}
    ]
  },
  "objectives": [
    {"id": "kill_goblins", "type": "kill", "description": "Kill 3 hunchback goblins", "target": "goblin", "requiredCount": 3, "consumeOnTurnIn": false}
  ],
  "rewards": {"xp": 50, "gold": 30, "items": [{"itemId": "flask_red", "quantity": 1}]},
  "dialog": {
    "offer": [
      {"id": "offer_1", "speaker": "Marcus the Merchant", "text": "Those cursed goblins have been raiding my supplies! Will you help me deal with them?", "responses": [
        {"text": "I'll handle it.", "nextNodeId": "offer_accept", "action": {"type": "accept_quest"}},
        {"text": "Not right now.", "nextNodeId": "offer_decline", "action": {"type": "decline_quest"}}
      ]},
      {"id": "offer_accept", "speaker": "Marcus the Merchant", "text": "Thank you! Kill at least three of those pests and I'll reward you handsomely."},
      {"id": "offer_decline", "speaker": "Marcus the Merchant", "text": "I understand. Come back if you change your mind."}
    ],
    "inProgress": [
      {"id": "progress_1", "speaker": "Marcus the Merchant", "text": "Have you dealt with those goblins yet? They're still causing trouble.", "responses": [
        {"text": "Still working on it.", "nextNodeId": "progress_working"},
        {"text": "I'll get back to it.", "nextNodeId": "progress_later", "action": {"type": "end_dialog"}}
      ]},
      {"id": "progress_working", "speaker": "Marcus the Merchant", "text": "Keep at it! I'm counting on you."},
      {"id": "progress_later", "speaker": "Marcus the Merchant", "text": "Hurry if you can. My stock is dwindling."}
    ],
    "readyToTurnIn": [
      {"id": "turnin_1", "speaker": "Marcus the Merchant", "text": "You've done it! I can see the goblin threat is gone. Ready for your reward?", "responses": [
        {"text": "Here to collect.", "nextNodeId": "turnin_accept", "action": {"type": "turn_in_quest"}},
        {"text": "Not yet.", "nextNodeId": "turnin_later", "action": {"type": "end_dialog"}}
      ]},
      {"id": "turnin_accept", "speaker": "Marcus the Merchant", "text": "Excellent work! Here's your reward as promised."},
      {"id": "turnin_later", "speaker": "Marcus the Merchant", "text": "Come back when you're ready to collect."}
    ],
    "completed": [
      {"id": "done_1", "speaker": "Marcus the Merchant", "text": "Thanks again for clearing out those goblins. My business is safe once more.", "responses": [
        {"text": "Glad to help.", "nextNodeId": "done_end", "action": {"type": "end_dialog"}},
        {"text": "Farewell.", "nextNodeId": "done_bye", "action": {"type": "end_dialog"}}
      ]},
      {"id": "done_end", "speaker": "Marcus the Merchant", "text": "May fortune favor you, adventurer!"},
      {"id": "done_bye", "speaker": "Marcus the Merchant", "text": "Safe travels, friend."}
    ]
  }
}

Respond with ONLY the JSON object.`;

let client: OpenAI | null = null;
let supportsJsonMode: boolean | null = null;

function getClient(): OpenAI {
  if (!client) {
    client = new OpenAI({
      apiKey: config.llm.apiKey,
      baseURL: config.llm.baseURL
    });
  }
  return client;
}

export async function generateQuestDefinition(context: QuestGenerationContext): Promise<GeneratedQuestDefinition> {
  const openai = getClient();

  const npcProfile = NPC_PROFILES[context.targetNpcId];
  const npcDirective = npcProfile
    ? `Assign this quest to NPC "${context.targetNpcId}" ("${npcProfile.name}").\n\nNPC PERSONALITY:\n${npcProfile.personality}\n\nLet this personality shape the quest theme, dialog tone, objective choices, and reward types.`
    : `Assign this quest to NPC "${context.targetNpcId}". Use the matching speaker name from NPC_NAMES.`;
  const userPrompt = `Generate a unique quest. Avoid these existing quest IDs: ${context.existingQuestIds.join(', ') || 'none'}.
${npcDirective} Create an interesting quest with varied dialog. Make the quest feel distinct and flavorful.`;

  llmLogger.info('API call starting - model: %s, baseURL: %s, json_mode: %s', config.llm.model, config.llm.baseURL, supportsJsonMode !== false);

  let response;
  // Try with response_format: json_object first; fall back if provider doesn't support it
  if (supportsJsonMode !== false) {
    try {
      response = await openai.chat.completions.create({
        model: config.llm.model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
        max_tokens: 3000
      });
      if (supportsJsonMode === null) {
        supportsJsonMode = true;
        llmLogger.info('JSON mode supported by provider - enforcing strict JSON responses');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      // Detect unsupported response_format and fall back
      if (message.includes('response_format') || message.includes('json_object') || message.includes('not supported')) {
        supportsJsonMode = false;
        llmLogger.info('JSON mode not supported by provider - falling back to prompt-based JSON');
        response = await openai.chat.completions.create({
          model: config.llm.model,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.7,
          max_tokens: 3000
        });
      } else {
        throw err;
      }
    }
  } else {
    response = await openai.chat.completions.create({
      model: config.llm.model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 3000
    });
  }

  const usage = response.usage;
  llmLogger.info('API call completed - tokens: %d prompt, %d completion, %d total', usage?.prompt_tokens ?? 0, usage?.completion_tokens ?? 0, usage?.total_tokens ?? 0);

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('LLM returned empty response');
  }

  // Parse JSON, stripping any markdown code fences (needed when json_mode is unavailable)
  const cleaned = content.replace(/```json\n?|\n?```/g, '').trim();
  return JSON.parse(cleaned) as GeneratedQuestDefinition;
}
