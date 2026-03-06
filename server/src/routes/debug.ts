import { Router, Request, Response } from 'express';
import { config, gameConfig } from '../config.js';
import {
  generateStoryArc,
  generateArcQuest,
  generateLoreFragment,
  generateQuestDefinition,
  evaluateQuestQuality,
  getLastCallMeta,
  NPC_PROFILES,
  type StoryArcOutline,
  type GeneratedQuestDefinition,
  type QuestEvaluation,
  type CallMeta,
  type LoreFragment
} from '../services/llmService.js';
import { validateQuest } from '../services/questValidator.js';

export const debugRouter = Router();

// Block in production
debugRouter.use((_req, res, next) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Not found' });
  }
  next();
});

// ── In-memory session ──

interface DebugSession {
  arc: StoryArcOutline | null;
  lore: LoreFragment | null;
  quests: (GeneratedQuestDefinition | null)[];
  evaluations: (QuestEvaluation | null)[];
}

let session: DebugSession = {
  arc: null,
  lore: null,
  quests: [],
  evaluations: []
};

function resetSession(): void {
  session = { arc: null, lore: null, quests: [], evaluations: [] };
}

function wrapResult(data: unknown, meta: CallMeta | null) {
  return { data, meta, timestamp: new Date().toISOString() };
}

// ── GET /api/debug/config ──

debugRouter.get('/config', (_req: Request, res: Response) => {
  res.json({
    llmEnabled: config.llm.enabled,
    model: config.llm.model,
    modelFast: config.llm.modelFast,
    baseURL: config.llm.baseURL,
    aiPatterns: gameConfig.aiPatterns ?? {},
    storyArc: gameConfig.storyArc,
    npcIds: Object.keys(NPC_PROFILES)
  });
});

// ── GET /api/debug/session ──

debugRouter.get('/session', (_req: Request, res: Response) => {
  res.json({
    hasArc: !!session.arc,
    arcTitle: session.arc?.title ?? null,
    hasLore: !!session.lore,
    questCount: session.quests.filter(Boolean).length,
    evaluationCount: session.evaluations.filter(Boolean).length
  });
});

// ── DELETE /api/debug/session ──

debugRouter.delete('/session', (_req: Request, res: Response) => {
  resetSession();
  res.json({ ok: true });
});

// ── POST /api/debug/arc ──

debugRouter.post('/arc', async (_req: Request, res: Response) => {
  try {
    const questCount = gameConfig.storyArc?.questsPerArc ?? 3;
    const arc = await generateStoryArc(questCount + 1, [], []); // +1 for boss quest
    session.arc = arc;
    session.lore = null;
    session.quests = new Array(arc.quests.length).fill(null);
    session.evaluations = new Array(arc.quests.length).fill(null);
    res.json(wrapResult(arc, getLastCallMeta()));
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ── POST /api/debug/lore ──

debugRouter.post('/lore', async (_req: Request, res: Response) => {
  if (!session.arc) {
    return res.status(400).json({ error: 'Generate an arc first' });
  }
  try {
    const lore = await generateLoreFragment(session.arc);
    session.lore = lore;
    res.json(wrapResult(lore, getLastCallMeta()));
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ── POST /api/debug/quest ──

debugRouter.post('/quest', async (req: Request, res: Response) => {
  if (!session.arc) {
    return res.status(400).json({ error: 'Generate an arc first' });
  }
  const { questIndex, tier } = req.body as { questIndex: number; tier?: number };
  if (questIndex < 0 || questIndex >= session.arc.quests.length) {
    return res.status(400).json({ error: `questIndex must be 0-${session.arc.quests.length - 1}` });
  }

  const isBossQuest = questIndex === session.arc.quests.length - 1;
  const previousSummaries = session.quests
    .slice(0, questIndex)
    .filter(Boolean)
    .map(q => `${q!.name}: ${q!.description}`);

  try {
    const quest = await generateArcQuest({
      existingQuestIds: session.quests.filter(Boolean).map(q => q!.id),
      arc: session.arc,
      questIndex,
      previousSummaries,
      isBossQuest,
      tier: tier ?? 1,
      lore: session.lore ?? undefined
    });

    const validation = validateQuest(quest);
    session.quests[questIndex] = quest;
    session.evaluations[questIndex] = null;

    res.json(wrapResult({ quest, validation }, getLastCallMeta()));
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ── POST /api/debug/evaluate ──

debugRouter.post('/evaluate', async (req: Request, res: Response) => {
  const { questIndex } = req.body as { questIndex: number };
  const quest = session.quests[questIndex];
  if (!quest) {
    return res.status(400).json({ error: `No quest at index ${questIndex}. Generate it first.` });
  }
  if (!session.arc) {
    return res.status(400).json({ error: 'No arc in session' });
  }

  const npcProfile = NPC_PROFILES[quest.npcId];
  const isBossQuest = questIndex === session.arc.quests.length - 1;

  try {
    const evaluation = await evaluateQuestQuality(quest, {
      arcTitle: session.arc.title,
      arcTheme: session.arc.theme,
      lore: session.lore,
      previousSummaries: session.quests
        .slice(0, questIndex)
        .filter(Boolean)
        .map(q => `${q!.name}: ${q!.description}`),
      npcPersonality: npcProfile?.personality ?? 'Unknown NPC',
      isBossQuest
    });

    session.evaluations[questIndex] = evaluation;
    res.json(wrapResult(evaluation, getLastCallMeta()));
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ── POST /api/debug/standalone ──

debugRouter.post('/standalone', async (req: Request, res: Response) => {
  const { npcId, tier } = req.body as { npcId: string; tier?: number };
  if (!NPC_PROFILES[npcId]) {
    return res.status(400).json({ error: `Invalid npcId: ${npcId}. Valid: ${Object.keys(NPC_PROFILES).join(', ')}` });
  }

  try {
    const quest = await generateQuestDefinition({
      existingQuestIds: [],
      targetNpcId: npcId,
      tier: tier ?? 1
    });

    const validation = validateQuest(quest);
    res.json(wrapResult({ quest, validation }, getLastCallMeta()));
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
