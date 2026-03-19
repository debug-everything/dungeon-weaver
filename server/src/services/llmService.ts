import OpenAI from 'openai';
import { config, gameConfig } from '../config.js';
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
  EVALUATOR_SYSTEM_PROMPT,
  buildEvaluatorUserPrompt,
  INTRO_SYSTEM_PROMPT,
  buildIntroUserPrompt,
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
  critique?: string;
}

// ── Call metadata (for debug console) ──

export interface CallMeta {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  model: string;
  elapsedMs: number;
}

let lastCallMeta: CallMeta | null = null;
export function getLastCallMeta(): CallMeta | null { return lastCallMeta; }

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

// ── Model routing ──

function resolveModel(importance: 'fast' | 'capable'): string {
  if (!gameConfig.aiPatterns?.routingEnabled) return config.llm.model;
  return importance === 'fast' ? config.llm.modelFast : config.llm.model;
}

// ── Shared LLM call helper ──

async function callLLM(systemPrompt: string, userPrompt: string, maxTokens: number = 3000, temperature: number = 0.7, model?: string): Promise<string> {
  const startTime = Date.now();
  const openai = getClient();
  const useModel = model ?? config.llm.model;

  llmLogger.info('API call starting - model: %s, baseURL: %s, json_mode: %s', useModel, config.llm.baseURL, supportsJsonMode !== false);

  let response;
  if (supportsJsonMode !== false) {
    try {
      response = await openai.chat.completions.create({
        model: useModel,
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
          model: useModel,
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
      model: useModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: maxTokens
    });
  }

  const usage = response.usage;
  lastCallMeta = {
    promptTokens: usage?.prompt_tokens ?? 0,
    completionTokens: usage?.completion_tokens ?? 0,
    totalTokens: usage?.total_tokens ?? 0,
    model: useModel,
    elapsedMs: Date.now() - startTime
  };
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
  const raw = await callLLM(buildQuestSystemPrompt(tier, false), userPrompt, 3000, 0.7, resolveModel('fast'));
  try {
    return JSON.parse(raw) as GeneratedQuestDefinition;
  } catch {
    throw new Error(`Failed to parse quest definition JSON: ${raw.slice(0, 200)}`);
  }
}

// ── Story Arc generation ──

export async function generateStoryArc(questCount: number, existingArcIds: string[], previousTitles: string[] = []): Promise<StoryArcOutline> {
  const userPrompt = buildArcOutlineUserPrompt(questCount, existingArcIds, previousTitles);

  llmLogger.info('Generating story arc outline (%d quests)...', questCount);
  const raw = await callLLM(ARC_SYSTEM_PROMPT, userPrompt, 1500, 0.9, resolveModel('capable'));
  try {
    return JSON.parse(raw) as StoryArcOutline;
  } catch {
    throw new Error(`Failed to parse story arc JSON: ${raw.slice(0, 200)}`);
  }
}

export async function generateArcQuest(context: ArcQuestContext): Promise<GeneratedQuestDefinition> {
  const userPrompt = buildArcQuestUserPrompt(context, context.lore, context.critique);
  const tier = context.tier ?? 1;
  const questInfo = context.arc.quests[context.questIndex];

  llmLogger.info('Generating arc quest %d/%d for NPC "%s" (boss=%s, tier=%d)...', context.questIndex + 1, context.arc.quests.length, questInfo.npcId, context.isBossQuest, tier);
  const raw = await callLLM(buildQuestSystemPrompt(tier, context.isBossQuest), userPrompt, 3000, 0.7, resolveModel('capable'));
  try {
    return JSON.parse(raw) as GeneratedQuestDefinition;
  } catch {
    throw new Error(`Failed to parse arc quest JSON: ${raw.slice(0, 200)}`);
  }
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

// ── Quest evaluation (Evaluator-Optimizer pattern) ──

export interface QuestEvaluation {
  scores: {
    arc_coherence: number;
    lore_integration: number;
    continuity: number;
    npc_voice: number;
    dialog_specificity: number;
  };
  average: number;
  critique: string;
}

function isValidEvaluation(obj: unknown): obj is QuestEvaluation {
  if (!obj || typeof obj !== 'object') return false;
  const eval_ = obj as Record<string, unknown>;

  if (!eval_.scores || typeof eval_.scores !== 'object') return false;
  const scores = eval_.scores as Record<string, unknown>;
  const dimensions = ['arc_coherence', 'lore_integration', 'continuity', 'npc_voice', 'dialog_specificity'];
  for (const dim of dimensions) {
    if (typeof scores[dim] !== 'number' || scores[dim] < 1 || scores[dim] > 10) return false;
  }

  if (typeof eval_.average !== 'number') return false;
  if (typeof eval_.critique !== 'string') return false;

  return true;
}

export async function evaluateQuestQuality(
  quest: GeneratedQuestDefinition,
  context: {
    arcTitle: string;
    arcTheme: string;
    lore: LoreFragment | null;
    previousSummaries: string[];
    npcPersonality: string;
    isBossQuest: boolean;
  }
): Promise<QuestEvaluation> {
  const userPrompt = buildEvaluatorUserPrompt(quest, context);

  llmLogger.info('Evaluating quest quality for "%s"...', quest.name);
  const raw = await callLLM(EVALUATOR_SYSTEM_PROMPT, userPrompt, 500, 0.3, resolveModel('fast'));
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Failed to parse evaluation JSON: ${raw.slice(0, 200)}`);
  }

  if (!isValidEvaluation(parsed)) {
    throw new Error('Invalid evaluation response: missing or malformed fields');
  }

  // Recalculate average to ensure consistency
  const scores = parsed.scores;
  parsed.average = (scores.arc_coherence + scores.lore_integration + scores.continuity + scores.npc_voice + scores.dialog_specificity) / 5;

  llmLogger.info({ avg: parsed.average, scores }, 'Quest evaluation for "%s"', quest.name);
  return parsed;
}

// ── Lore generation (Prompt Chaining step) ──

// ── Intro narration generation ──

export async function generateIntroNarration(
  arc: { title: string; theme: string },
  lore: LoreFragment | null
): Promise<string[] | null> {
  llmLogger.info('Generating intro narration for arc "%s"...', arc.title);
  try {
    const raw = await callLLM(INTRO_SYSTEM_PROMPT, buildIntroUserPrompt(arc, lore), 300, 0.9, resolveModel('fast'));
    let parsed = JSON.parse(raw);

    // json_object mode forces an object wrapper, unwrap if needed
    if (!Array.isArray(parsed) && typeof parsed === 'object' && parsed !== null) {
      const values = Object.values(parsed);
      const arr = values.find(v => Array.isArray(v));
      if (arr) {
        llmLogger.info('Intro narration unwrapped from object key');
        parsed = arr;
      }
    }

    if (!Array.isArray(parsed) || parsed.length < 3 || parsed.length > 5 || !parsed.every((s: unknown) => typeof s === 'string')) {
      llmLogger.warn('Invalid intro narration: expected array of 3-5 strings, got %s', JSON.stringify(parsed).slice(0, 200));
      return null;
    }

    llmLogger.info({ lines: parsed }, 'Intro narration generated: %d lines', parsed.length);
    return parsed;
  } catch (err) {
    llmLogger.warn({ err }, 'Intro narration generation failed (non-fatal)');
    return null;
  }
}

export async function generateLoreFragment(arc: StoryArcOutline): Promise<LoreFragment> {
  llmLogger.info('Generating lore fragment for arc "%s"...', arc.title);
  const raw = await callLLM(LORE_SYSTEM_PROMPT, buildLoreUserPrompt(arc), 500, 0.8, resolveModel('capable'));
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Failed to parse lore fragment JSON: ${raw.slice(0, 200)}`);
  }

  if (!isValidLore(parsed)) {
    throw new Error('Invalid lore fragment: missing required fields');
  }

  llmLogger.info({ lore: parsed }, 'Lore generated: %d locations, faction "%s", artifact "%s"',
    parsed.locations.length, parsed.faction.name, parsed.artifact.name);
  return parsed;
}
