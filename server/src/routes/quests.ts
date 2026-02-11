import { Router } from 'express';
import { questPoolService } from '../services/questPoolService.js';
import { config } from '../config.js';
import { llmLogger } from '../logger.js';

export const questsRouter = Router();

// Get all available LLM quests
questsRouter.get('/available', (_req, res) => {
  if (!config.llm.enabled) {
    llmLogger.debug('GET /quests/available - LLM disabled, returning []');
    res.json([]);
    return;
  }
  const quests = questPoolService.getAvailableQuests();
  llmLogger.info('GET /quests/available - returning %d quests', quests.length);
  res.json(quests);
});

// Get quests for a specific NPC (generates on-demand if pool is empty for this NPC)
questsRouter.get('/available/:npcId', async (req, res) => {
  if (!config.llm.enabled) {
    llmLogger.debug('GET /quests/available/%s - LLM disabled, returning []', req.params.npcId);
    res.json([]);
    return;
  }
  try {
    const quests = await questPoolService.getOrGenerateForNPC(req.params.npcId);
    llmLogger.info('GET /quests/available/%s - returning %d quests', req.params.npcId, quests.length);
    res.json(quests);
  } catch (err) {
    llmLogger.error({ err }, 'Failed to get/generate quests for NPC "%s"', req.params.npcId);
    res.json([]);
  }
});

// Accept a quest (removes from pool, triggers replenishment)
questsRouter.post('/accept', (req, res) => {
  const { questId } = req.body as { questId: string };
  if (!questId) {
    res.status(400).json({ error: 'Missing questId' });
    return;
  }

  const accepted = questPoolService.acceptQuest(questId);
  if (!accepted) {
    res.status(404).json({ error: 'Quest not found in pool' });
    return;
  }
  res.json({ success: true });
});

// Debug: pool status
questsRouter.get('/pool-status', (_req, res) => {
  res.json(questPoolService.getPoolStatus());
});
