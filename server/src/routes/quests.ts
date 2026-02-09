import { Router } from 'express';
import { questPoolService } from '../services/questPoolService.js';
import { config } from '../config.js';

export const questsRouter = Router();

// Get all available LLM quests
questsRouter.get('/available', (_req, res) => {
  if (!config.llm.enabled) {
    res.json([]);
    return;
  }
  res.json(questPoolService.getAvailableQuests());
});

// Get quests for a specific NPC
questsRouter.get('/available/:npcId', (req, res) => {
  if (!config.llm.enabled) {
    res.json([]);
    return;
  }
  res.json(questPoolService.getQuestsForNPC(req.params.npcId));
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
