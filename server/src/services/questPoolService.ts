import { generateQuestDefinition, GeneratedQuestDefinition, NPC_PROFILES } from './llmService.js';
import { validateQuest } from './questValidator.js';
import { config } from '../config.js';
import { llmLogger } from '../logger.js';

const POOL_SIZE_PER_NPC = 1;
const MAX_RETRIES = 3;
const NPC_IDS = Object.keys(NPC_PROFILES);

class QuestPoolService {
  private pools: Map<string, GeneratedQuestDefinition[]> = new Map();
  private generating: Map<string, boolean> = new Map();
  private existingIds: string[] = [];

  async initialize(): Promise<void> {
    if (!config.llm.enabled) {
      llmLogger.info('DISABLED - Quest pool will not be populated. Using hardcoded quests only.');
      return;
    }

    // Initialize empty pools for each NPC
    for (const npcId of NPC_IDS) {
      this.pools.set(npcId, []);
      this.generating.set(npcId, false);
    }

    llmLogger.info('ENABLED - Model: %s, Base URL: %s', config.llm.model, config.llm.baseURL);
    llmLogger.info('Generating initial quest pools (%d per NPC, %d NPCs)...', POOL_SIZE_PER_NPC, NPC_IDS.length);
    const startTime = Date.now();

    // Generate initial quests for each NPC
    for (const npcId of NPC_IDS) {
      for (let i = 0; i < POOL_SIZE_PER_NPC; i++) {
        await this.generateOne(npcId);
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const totalQuests = NPC_IDS.reduce((sum, id) => sum + (this.pools.get(id)?.length ?? 0), 0);
    llmLogger.info('Quest pools initialized: %d total quests across %d NPCs in %ss', totalQuests, NPC_IDS.length, elapsed);
  }

  private async generateOne(npcId: string): Promise<boolean> {
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        llmLogger.info('Requesting quest generation for NPC "%s" (attempt %d/%d)...', npcId, attempt + 1, MAX_RETRIES);
        const startTime = Date.now();
        const quest = await generateQuestDefinition({
          existingQuestIds: this.existingIds,
          targetNpcId: npcId
        });
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

        // Force correct npcId in case LLM ignores the directive
        quest.npcId = npcId;

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

        const pool = this.pools.get(npcId) ?? [];
        pool.push(quest);
        this.pools.set(npcId, pool);
        this.existingIds.push(quest.id);
        llmLogger.info('Quest generated successfully in %ss: id="%s", name="%s", npc="%s", type="%s"', elapsed, quest.id, quest.name, quest.npcId, quest.type);
        return true;
      } catch (err) {
        const delay = Math.pow(2, attempt) * 1000;
        llmLogger.error({ err }, 'Quest generation failed for NPC "%s" (attempt %d/%d), retrying in %dms', npcId, attempt + 1, MAX_RETRIES, delay);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    llmLogger.error('Quest generation failed for NPC "%s" after all %d retries', npcId, MAX_RETRIES);
    return false;
  }

  getAvailableQuests(): GeneratedQuestDefinition[] {
    const all: GeneratedQuestDefinition[] = [];
    for (const pool of this.pools.values()) {
      all.push(...pool);
    }
    return all;
  }

  getQuestsForNPC(npcId: string): GeneratedQuestDefinition[] {
    return [...(this.pools.get(npcId) ?? [])];
  }

  async getOrGenerateForNPC(npcId: string): Promise<GeneratedQuestDefinition[]> {
    const pool = this.pools.get(npcId) ?? [];
    if (pool.length > 0) return [...pool];

    // No quests for this NPC — generate one on-demand
    llmLogger.info('No quests in pool for NPC "%s", generating on-demand...', npcId);
    await this.generateOne(npcId);
    return [...(this.pools.get(npcId) ?? [])];
  }

  acceptQuest(questId: string): boolean {
    // Find which NPC pool contains this quest
    for (const [npcId, pool] of this.pools.entries()) {
      const index = pool.findIndex(q => q.id === questId);
      if (index !== -1) {
        const quest = pool[index];
        pool.splice(index, 1);
        llmLogger.info('Quest accepted: id="%s", name="%s", npc="%s" (npc pool: %d/%d)', quest.id, quest.name, npcId, pool.length, POOL_SIZE_PER_NPC);
        this.replenishNPC(npcId);
        return true;
      }
    }
    llmLogger.info('Accept failed - quest "%s" not found in any pool', questId);
    return false;
  }

  private async replenishNPC(npcId: string): Promise<void> {
    const pool = this.pools.get(npcId) ?? [];
    if (this.generating.get(npcId) || pool.length >= POOL_SIZE_PER_NPC) return;
    this.generating.set(npcId, true);

    llmLogger.info('Replenishing quest pool for NPC "%s" (current: %d, target: %d)...', npcId, pool.length, POOL_SIZE_PER_NPC);
    try {
      while ((this.pools.get(npcId)?.length ?? 0) < POOL_SIZE_PER_NPC) {
        await this.generateOne(npcId);
      }
      llmLogger.info('Quest pool replenished for NPC "%s": %d/%d', npcId, this.pools.get(npcId)?.length ?? 0, POOL_SIZE_PER_NPC);
    } finally {
      this.generating.set(npcId, false);
    }
  }

  getPoolStatus(): { pools: Record<string, { size: number; generating: boolean }>; totalSize: number; llmEnabled: boolean } {
    const pools: Record<string, { size: number; generating: boolean }> = {};
    let totalSize = 0;
    for (const npcId of NPC_IDS) {
      const size = this.pools.get(npcId)?.length ?? 0;
      pools[npcId] = { size, generating: this.generating.get(npcId) ?? false };
      totalSize += size;
    }
    return { pools, totalSize, llmEnabled: config.llm.enabled };
  }
}

export const questPoolService = new QuestPoolService();
