import { generateQuestDefinition, GeneratedQuestDefinition } from './llmService.js';
import { validateQuest } from './questValidator.js';
import { config } from '../config.js';

const POOL_SIZE = 2;
const MAX_RETRIES = 3;

class QuestPoolService {
  private pool: GeneratedQuestDefinition[] = [];
  private generating: boolean = false;
  private existingIds: string[] = [];

  async initialize(): Promise<void> {
    if (!config.llm.enabled) {
      console.log('LLM disabled - quest pool will not be populated');
      return;
    }

    console.log('Generating initial quest pool...');
    for (let i = 0; i < POOL_SIZE; i++) {
      await this.generateOne();
    }
    console.log(`Quest pool initialized with ${this.pool.length} quests`);
  }

  private async generateOne(): Promise<boolean> {
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const quest = await generateQuestDefinition({
          existingQuestIds: this.existingIds
        });

        const validation = validateQuest(quest);
        if (!validation.valid) {
          console.warn(`Quest validation failed (attempt ${attempt + 1}):`, validation.errors);
          continue;
        }

        // Ensure unique ID
        if (this.existingIds.includes(quest.id)) {
          quest.id = `quest_llm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        }

        this.pool.push(quest);
        this.existingIds.push(quest.id);
        return true;
      } catch (err) {
        const delay = Math.pow(2, attempt) * 1000;
        console.error(`Quest generation failed (attempt ${attempt + 1}), retrying in ${delay}ms:`, err);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    console.error('Quest generation failed after all retries');
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
    if (candidates.length === 0) return null;

    const quest = candidates[0];
    // Remove from pool
    this.pool = this.pool.filter(q => q.id !== quest.id);

    // Trigger background replenishment
    this.replenishPool();

    return quest;
  }

  private async replenishPool(): Promise<void> {
    if (this.generating || this.pool.length >= POOL_SIZE) return;
    this.generating = true;

    try {
      while (this.pool.length < POOL_SIZE) {
        await this.generateOne();
      }
    } finally {
      this.generating = false;
    }
  }

  acceptQuest(questId: string): boolean {
    const index = this.pool.findIndex(q => q.id === questId);
    if (index === -1) return false;
    this.pool.splice(index, 1);
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
