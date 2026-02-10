import { generateQuestDefinition, GeneratedQuestDefinition } from './llmService.js';
import { validateQuest } from './questValidator.js';
import { config } from '../config.js';
import { llmLogger } from '../logger.js';

const POOL_SIZE = 2;
const MAX_RETRIES = 3;

class QuestPoolService {
  private pool: GeneratedQuestDefinition[] = [];
  private generating: boolean = false;
  private existingIds: string[] = [];

  async initialize(): Promise<void> {
    if (!config.llm.enabled) {
      llmLogger.info('DISABLED - Quest pool will not be populated. Using hardcoded quests only.');
      return;
    }

    llmLogger.info('ENABLED - Model: %s, Base URL: %s', config.llm.model, config.llm.baseURL);
    llmLogger.info('Generating initial quest pool (target size: %d)...', POOL_SIZE);
    const startTime = Date.now();
    for (let i = 0; i < POOL_SIZE; i++) {
      await this.generateOne();
    }
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    llmLogger.info('Quest pool initialized: %d/%d quests generated in %ss', this.pool.length, POOL_SIZE, elapsed);
  }

  private async generateOne(): Promise<boolean> {
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        llmLogger.info('Requesting quest generation (attempt %d/%d)...', attempt + 1, MAX_RETRIES);
        const startTime = Date.now();
        const quest = await generateQuestDefinition({
          existingQuestIds: this.existingIds
        });
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

        const validation = validateQuest(quest);
        if (!validation.valid) {
          llmLogger.warn('Quest validation failed (attempt %d/%d, took %ss): %s', attempt + 1, MAX_RETRIES, elapsed, validation.errors.join(', '));
          continue;
        }

        // Ensure unique ID
        if (this.existingIds.includes(quest.id)) {
          const oldId = quest.id;
          quest.id = `quest_llm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
          llmLogger.info('Duplicate ID "%s" renamed to "%s"', oldId, quest.id);
        }

        this.pool.push(quest);
        this.existingIds.push(quest.id);
        llmLogger.info('Quest generated successfully in %ss: id="%s", name="%s", npc="%s", type="%s"', elapsed, quest.id, quest.name, quest.npcId, quest.type);
        return true;
      } catch (err) {
        const delay = Math.pow(2, attempt) * 1000;
        llmLogger.error({ err }, 'Quest generation failed (attempt %d/%d), retrying in %dms', attempt + 1, MAX_RETRIES, delay);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    llmLogger.error('Quest generation failed after all %d retries', MAX_RETRIES);
    return false;
  }

  getAvailableQuests(): GeneratedQuestDefinition[] {
    return [...this.pool];
  }

  getQuestsForNPC(npcId: string): GeneratedQuestDefinition[] {
    return this.pool.filter(q => q.npcId === npcId);
  }

  getAvailableQuest(npcId?: string): GeneratedQuestDefinition | null {
    const candidates = npcId ? this.pool.filter(q => q.npcId === npcId) : this.pool;
    if (candidates.length === 0) {
      llmLogger.info('No quests available in pool%s', npcId ? ` for NPC "${npcId}"` : '');
      return null;
    }

    const quest = candidates[0];
    // Remove from pool
    this.pool = this.pool.filter(q => q.id !== quest.id);

    llmLogger.info('Quest dispensed from pool: id="%s", name="%s" (pool size: %d/%d)', quest.id, quest.name, this.pool.length, POOL_SIZE);

    // Trigger background replenishment
    this.replenishPool();

    return quest;
  }

  private async replenishPool(): Promise<void> {
    if (this.generating || this.pool.length >= POOL_SIZE) return;
    this.generating = true;

    llmLogger.info('Replenishing quest pool (current: %d, target: %d)...', this.pool.length, POOL_SIZE);
    try {
      while (this.pool.length < POOL_SIZE) {
        await this.generateOne();
      }
      llmLogger.info('Quest pool replenished to %d/%d', this.pool.length, POOL_SIZE);
    } finally {
      this.generating = false;
    }
  }

  acceptQuest(questId: string): boolean {
    const index = this.pool.findIndex(q => q.id === questId);
    if (index === -1) {
      llmLogger.info('Accept failed - quest "%s" not found in pool', questId);
      return false;
    }
    const quest = this.pool[index];
    this.pool.splice(index, 1);
    llmLogger.info('Quest accepted: id="%s", name="%s" (pool size: %d/%d)', quest.id, quest.name, this.pool.length, POOL_SIZE);
    this.replenishPool();
    return true;
  }

  getPoolStatus(): { size: number; generating: boolean; llmEnabled: boolean } {
    return {
      size: this.pool.length,
      generating: this.generating,
      llmEnabled: config.llm.enabled
    };
  }
}

export const questPoolService = new QuestPoolService();
