import OpenAI from 'openai';
import { config } from '../config.js';
import { llmLogger } from '../logger.js';
import {
  NPC_PROFILES,
  BOSS_TYPES,
  buildQuestSystemPrompt,
  ARC_SYSTEM_PROMPT,
  buildArcOutlineUserPrompt,
  buildArcQuestUserPrompt,
  buildStandaloneQuestUserPrompt,
  LORE_SYSTEM_PROMPT,
  buildLoreUserPrompt,
  LoreFragment
} from './promptTemplates.js';

// Re-export so downstream imports don't break
export { NPC_PROFILES };
export type { LoreFragment };

export interface QuestGenerationContext {
  existingQuestIds: string[];
  targetNpcId: string;
  tier?: number;
}

// Matches the frontend QuestDefinition type
export interface GeneratedQuestDefinition {
  id: string;
  name: string;
  type: 'rescue' | 'recover' | 'destroy' | 'investigate';
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
    monsters?: { variantId: string; baseType: string; baseSprite: string; name: string; statMultiplier: number }[];
    items?: { variantId: string; baseItem: string; name: string; description: string }[];
  };
  narration?: {
    onComplete?: string[];
    onBossEncounter?: string[];
    onBossDefeat?: string[];
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

// ── Story Arc types ──

export interface StoryArcOutline {
  id: string;
  title: string;
  theme: string;
  quests: { summary: string; npcId: string; questType: string }[];
}

export interface ArcQuestContext {
  existingQuestIds: string[];
  arc: StoryArcOutline;
  questIndex: number;
  previousSummaries: string[];
  isBossQuest: boolean;
  tier?: number;
  lore?: LoreFragment;
}

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

// ── Shared LLM call helper ──

async function callLLM(systemPrompt: string, userPrompt: string, maxTokens: number = 3000, temperature: number = 0.7): Promise<string> {
  const openai = getClient();

  llmLogger.info('API call starting - model: %s, baseURL: %s, json_mode: %s', config.llm.model, config.llm.baseURL, supportsJsonMode !== false);

  let response;
  if (supportsJsonMode !== false) {
    try {
      response = await openai.chat.completions.create({
        model: config.llm.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        response_format: { type: 'json_object' },
        temperature,
        max_tokens: maxTokens
      });
      if (supportsJsonMode === null) {
        supportsJsonMode = true;
        llmLogger.info('JSON mode supported by provider - enforcing strict JSON responses');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('response_format') || message.includes('json_object') || message.includes('not supported')) {
        supportsJsonMode = false;
        llmLogger.info('JSON mode not supported by provider - falling back to prompt-based JSON');
        response = await openai.chat.completions.create({
          model: config.llm.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature,
          max_tokens: maxTokens
        });
      } else {
        throw err;
      }
    }
  } else {
    response = await openai.chat.completions.create({
      model: config.llm.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: maxTokens
    });
  }

  const usage = response.usage;
  llmLogger.info('API call completed - tokens: %d prompt, %d completion, %d total', usage?.prompt_tokens ?? 0, usage?.completion_tokens ?? 0, usage?.total_tokens ?? 0);

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('LLM returned empty response');
  }

  return content.replace(/```json\n?|\n?```/g, '').trim();
}

// ── Quest generation (standalone or arc) ──

export async function generateQuestDefinition(context: QuestGenerationContext): Promise<GeneratedQuestDefinition> {
  const tier = context.tier ?? 1;
  const userPrompt = buildStandaloneQuestUserPrompt(context);
  const raw = await callLLM(buildQuestSystemPrompt(tier, false), userPrompt);
  return JSON.parse(raw) as GeneratedQuestDefinition;
}

// ── Story Arc generation ──

export async function generateStoryArc(questCount: number, existingArcIds: string[], previousTitles: string[] = []): Promise<StoryArcOutline> {
  const userPrompt = buildArcOutlineUserPrompt(questCount, existingArcIds, previousTitles);

  llmLogger.info('Generating story arc outline (%d quests)...', questCount);
  const raw = await callLLM(ARC_SYSTEM_PROMPT, userPrompt, 1500, 0.9);
  return JSON.parse(raw) as StoryArcOutline;
}

export async function generateArcQuest(context: ArcQuestContext): Promise<GeneratedQuestDefinition> {
  const userPrompt = buildArcQuestUserPrompt(context, context.lore);
  const tier = context.tier ?? 1;
  const questInfo = context.arc.quests[context.questIndex];

  llmLogger.info('Generating arc quest %d/%d for NPC "%s" (boss=%s, tier=%d)...', context.questIndex + 1, context.arc.quests.length, questInfo.npcId, context.isBossQuest, tier);
  const raw = await callLLM(buildQuestSystemPrompt(tier, context.isBossQuest), userPrompt);
  return JSON.parse(raw) as GeneratedQuestDefinition;
}

// ── Lore generation (Prompt Chaining step) ──

function isValidLore(obj: unknown): obj is LoreFragment {
  if (!obj || typeof obj !== 'object') return false;
  const lore = obj as Record<string, unknown>;

  if (!Array.isArray(lore.locations) || lore.locations.length === 0) return false;
  for (const loc of lore.locations) {
    if (!loc || typeof loc !== 'object' || !loc.name || !loc.description) return false;
  }

  if (!lore.faction || typeof lore.faction !== 'object') return false;
  const faction = lore.faction as Record<string, unknown>;
  if (!faction.name || !faction.description) return false;

  if (typeof lore.history !== 'string' || lore.history.length === 0) return false;

  if (!lore.artifact || typeof lore.artifact !== 'object') return false;
  const artifact = lore.artifact as Record<string, unknown>;
  if (!artifact.name || !artifact.description) return false;

  return true;
}

export async function generateLoreFragment(arc: StoryArcOutline): Promise<LoreFragment> {
  llmLogger.info('Generating lore fragment for arc "%s"...', arc.title);
  const raw = await callLLM(LORE_SYSTEM_PROMPT, buildLoreUserPrompt(arc), 500, 0.8);
  const parsed = JSON.parse(raw);

  if (!isValidLore(parsed)) {
    throw new Error('Invalid lore fragment: missing required fields');
  }

  llmLogger.info('Lore generated: %d locations, faction "%s", artifact "%s"',
    parsed.locations.length, parsed.faction.name, parsed.artifact.name);
  return parsed;
}
