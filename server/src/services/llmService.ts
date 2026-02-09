import OpenAI from 'openai';
import { config } from '../config.js';

export interface QuestGenerationContext {
  existingQuestIds: string[];
}

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

const SYSTEM_PROMPT = `You are a quest designer for a dungeon crawler RPG. Generate a single quest definition in JSON format.

## Valid Values

NPC IDs and names:
- "npc_merchant" = "Marcus the Merchant"
- "npc_merchant_2" = "Elena the Exotic"
- "npc_sage" = "Aldric the Sage"

Monster types (for kill objectives): "zombie", "skelet", "orc", "goblin", "demon"

Item IDs (for collect objectives or rewards):
- Weapons: "weapon_sword_wooden", "weapon_sword_steel", "weapon_sword_silver", "weapon_sword_golden", "weapon_sword_ruby", "weapon_dagger_small", "weapon_dagger_steel", "weapon_dagger_golden", "weapon_katana_silver", "weapon_hammer", "weapon_sledgehammer"
- Potions: "flask_red", "flask_big_red", "flask_blue", "flask_green", "flask_yellow"

Quest types: "rescue", "recover", "destroy", "investigate"
Objective types: "kill", "collect"
Dialog action types: "accept_quest", "decline_quest", "end_dialog", "turn_in_quest"

## Dialog Structure Rules

Each dialog phase (offer, inProgress, readyToTurnIn, completed) must have:
1. A first node with responses array (2-3 player response options)
2. One response in "offer" phase MUST have action {"type": "accept_quest"}
3. One response in "offer" phase MUST have action {"type": "decline_quest"} or {"type": "end_dialog"}
4. One response in "readyToTurnIn" phase MUST have action {"type": "turn_in_quest"}
5. All response nextNodeId values must reference existing node IDs in the same phase
6. Terminal nodes (referenced by responses) should have NO responses array
7. Each phase should have 3-5 nodes total

## Quest ID Format
Use "quest_llm_" prefix followed by a descriptive name, e.g. "quest_llm_spider_hunt"

## Example Quest (abbreviated)
{
  "id": "quest_llm_goblin_raid",
  "name": "Goblin Raid",
  "type": "destroy",
  "description": "Clear out the goblins...",
  "npcId": "npc_merchant",
  "level": 1,
  "objectives": [{"id": "kill_goblins", "type": "kill", "description": "Kill goblins", "target": "goblin", "requiredCount": 3, "consumeOnTurnIn": false}],
  "rewards": {"xp": 50, "gold": 30},
  "dialog": {
    "offer": [
      {"id": "offer_1", "speaker": "Marcus the Merchant", "text": "...", "responses": [
        {"text": "Accept", "nextNodeId": "offer_accept", "action": {"type": "accept_quest"}},
        {"text": "Decline", "nextNodeId": "offer_decline", "action": {"type": "decline_quest"}}
      ]},
      {"id": "offer_accept", "speaker": "Marcus the Merchant", "text": "Great!"},
      {"id": "offer_decline", "speaker": "Marcus the Merchant", "text": "Maybe later."}
    ],
    "inProgress": [...],
    "readyToTurnIn": [...],
    "completed": [...]
  }
}

Respond with ONLY the JSON object, no markdown or other text.`;

let client: OpenAI | null = null;

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

  const userPrompt = `Generate a unique quest. Avoid these existing quest IDs: ${context.existingQuestIds.join(', ') || 'none'}.
Pick a random NPC and create an interesting quest with varied dialog. Make the quest feel distinct and flavorful.`;

  const response = await openai.chat.completions.create({
    model: config.llm.model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt }
    ],
    temperature: 0.9,
    max_tokens: 3000
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('LLM returned empty response');
  }

  // Parse JSON, stripping any markdown code fences
  const cleaned = content.replace(/```json\n?|\n?```/g, '').trim();
  return JSON.parse(cleaned) as GeneratedQuestDefinition;
}
