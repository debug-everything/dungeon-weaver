import { generateStoryArc, generateArcQuest, GeneratedQuestDefinition, StoryArcOutline, NPC_PROFILES } from './llmService.js';
import { validateQuest } from './questValidator.js';
import { config, gameConfig } from '../config.js';
import { llmLogger } from '../logger.js';

const MAX_RETRIES = 3;
const BOSS_STAT_BOOST = 2.5; // Boss variant stat multiplier floor
const BOSS_NAME_COLOR = '#ff4444';

export interface StoryArc {
  id: string;
  title: string;
  theme: string;
  questSummaries: string[];
  npcAssignments: string[];
  questTypes: string[];
  completedQuestIds: string[];
  currentQuestIndex: number;
  totalQuests: number;
  status: 'active' | 'completed';
}

export interface ArcStatus {
  id: string;
  title: string;
  currentQuestIndex: number;
  totalQuests: number;
  status: 'active' | 'completed';
  nextQuestNpcId: string | null;
  nextQuestReady: boolean;
  completedArcCount: number;
  tier: number;
  dailyArcsUsed: number;
  dailyArcsMax: number;
}

class StoryArcService {
  private currentArc: StoryArc | null = null;
  private currentQuest: GeneratedQuestDefinition | null = null;
  private existingArcIds: string[] = [];
  private existingArcTitles: string[] = [];
  private existingQuestIds: string[] = [];
  private generating: boolean = false;
  private completedArcCount: number = 0;

  // Daily arc generation limit
  private dailyArcCount: number = 0;
  private dailyArcDate: string = ''; // YYYY-MM-DD

  async initialize(): Promise<void> {
    llmLogger.info('Initializing story arc system (questsPerArc=%d, bossEnabled=%s, dailyMax=%d)...',
      gameConfig.storyArc.questsPerArc, gameConfig.storyArc.bossQuestEnabled, config.storyArcDailyMax);

    await this.generateNewArc();
    if (this.currentArc) {
      await this.generateNextQuest();
    }
  }

  private isDailyLimitReached(): boolean {
    const today = new Date().toISOString().slice(0, 10);
    if (this.dailyArcDate !== today) {
      // New day — reset counter
      this.dailyArcDate = today;
      this.dailyArcCount = 0;
    }
    return this.dailyArcCount >= config.storyArcDailyMax;
  }

  private incrementDailyArcCount(): void {
    const today = new Date().toISOString().slice(0, 10);
    if (this.dailyArcDate !== today) {
      this.dailyArcDate = today;
      this.dailyArcCount = 0;
    }
    this.dailyArcCount++;
  }

  private async generateNewArc(): Promise<boolean> {
    if (this.isDailyLimitReached()) {
      llmLogger.warn('Daily story arc limit reached (%d/%d). No new arcs will be generated until tomorrow.',
        this.dailyArcCount, config.storyArcDailyMax);
      return false;
    }

    const totalQuests = gameConfig.storyArc.questsPerArc + (gameConfig.storyArc.bossQuestEnabled ? 1 : 0);

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const outline = await generateStoryArc(totalQuests, this.existingArcIds, this.existingArcTitles);

        // Validate outline
        if (!outline.id || !outline.title || !outline.theme || !Array.isArray(outline.quests)) {
          llmLogger.warn('Invalid arc outline (attempt %d/%d): missing fields', attempt + 1, MAX_RETRIES);
          continue;
        }

        // Validate NPC assignments
        const validNpcs = Object.keys(NPC_PROFILES);
        for (const q of outline.quests) {
          if (!validNpcs.includes(q.npcId)) {
            q.npcId = validNpcs[Math.floor(Math.random() * validNpcs.length)];
          }
        }

        // Ensure correct quest count (pad or trim)
        while (outline.quests.length < totalQuests) {
          outline.quests.push({
            summary: 'Defeat the remaining threat',
            npcId: validNpcs[Math.floor(Math.random() * validNpcs.length)],
            questType: 'destroy'
          });
        }
        if (outline.quests.length > totalQuests) {
          outline.quests.length = totalQuests;
        }

        // Ensure last quest is destroy type for boss
        if (gameConfig.storyArc.bossQuestEnabled) {
          outline.quests[outline.quests.length - 1].questType = 'destroy';
        }

        this.currentArc = {
          id: outline.id,
          title: outline.title,
          theme: outline.theme,
          questSummaries: outline.quests.map(q => q.summary),
          npcAssignments: outline.quests.map(q => q.npcId),
          questTypes: outline.quests.map(q => q.questType),
          completedQuestIds: [],
          currentQuestIndex: 0,
          totalQuests,
          status: 'active'
        };

        this.existingArcIds.push(outline.id);
        this.existingArcTitles.push(outline.title);
        this.incrementDailyArcCount();
        llmLogger.info('Story arc generated: "%s" (%d quests, daily %d/%d)',
          outline.title, totalQuests, this.dailyArcCount, config.storyArcDailyMax);
        return true;
      } catch (err) {
        llmLogger.error({ err }, 'Arc generation failed (attempt %d/%d)', attempt + 1, MAX_RETRIES);
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }

    llmLogger.error('Arc generation failed after all retries');
    return false;
  }

  async generateNextQuest(): Promise<boolean> {
    if (!this.currentArc || this.currentArc.status === 'completed') return false;
    if (this.generating) return false;

    this.generating = true;
    const idx = this.currentArc.currentQuestIndex;
    const isBoss = gameConfig.storyArc.bossQuestEnabled && idx === this.currentArc.totalQuests - 1;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const quest = await generateArcQuest({
          existingQuestIds: this.existingQuestIds,
          arc: {
            id: this.currentArc.id,
            title: this.currentArc.title,
            theme: this.currentArc.theme,
            quests: this.currentArc.questSummaries.map((summary, i) => ({
              summary,
              npcId: this.currentArc!.npcAssignments[i],
              questType: this.currentArc!.questTypes[i]
            }))
          },
          questIndex: idx,
          previousSummaries: this.currentArc.questSummaries.slice(0, idx),
          isBossQuest: isBoss,
          tier: this.getTier()
        });

        // Force correct NPC
        quest.npcId = this.currentArc.npcAssignments[idx];

        // Validate
        const validation = validateQuest(quest);
        if (!validation.valid) {
          llmLogger.warn('Arc quest validation failed (attempt %d/%d): %s', attempt + 1, MAX_RETRIES, validation.errors.join(', '));
          continue;
        }

        // Ensure unique ID
        if (this.existingQuestIds.includes(quest.id)) {
          quest.id = `quest_llm_arc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        }

        // Boss enhancements: boost stats and add nameColor marker
        if (isBoss && quest.variants?.monsters) {
          for (const mv of quest.variants.monsters) {
            if (mv.statMultiplier < BOSS_STAT_BOOST) {
              mv.statMultiplier = BOSS_STAT_BOOST;
            }
            // Add nameColor via a custom field (will be passed through to client)
            (mv as Record<string, unknown>)['nameColor'] = BOSS_NAME_COLOR;
          }
        }

        this.currentQuest = quest;
        this.existingQuestIds.push(quest.id);
        this.generating = false;

        llmLogger.info('Arc quest %d/%d generated: "%s" for NPC "%s" (boss=%s)',
          idx + 1, this.currentArc.totalQuests, quest.name, quest.npcId, isBoss);
        return true;
      } catch (err) {
        llmLogger.error({ err }, 'Arc quest generation failed (attempt %d/%d)', attempt + 1, MAX_RETRIES);
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }

    this.generating = false;
    llmLogger.error('Arc quest generation failed after all retries');
    return false;
  }

  getCurrentQuestForNPC(npcId: string): GeneratedQuestDefinition | null {
    if (!this.currentArc || !this.currentQuest) return null;
    if (this.currentQuest.npcId !== npcId) return null;
    return this.currentQuest;
  }

  isArcQuest(questId: string): boolean {
    return this.currentQuest?.id === questId ||
      (this.currentArc?.completedQuestIds.includes(questId) ?? false);
  }

  onQuestAccepted(questId: string): void {
    if (this.currentQuest?.id === questId) {
      llmLogger.info('Arc quest accepted: "%s"', this.currentQuest.name);
      this.currentQuest = null;
    }
  }

  async onQuestCompleted(questId: string): Promise<string | null> {
    if (!this.currentArc) return null;

    // Only track if this quest belongs to the current arc
    if (!this.existingQuestIds.includes(questId)) return null;

    // Avoid duplicates
    if (this.currentArc.completedQuestIds.includes(questId)) {
      return this.getNextQuestNpcId();
    }

    this.currentArc.completedQuestIds.push(questId);
    this.currentArc.currentQuestIndex++;

    llmLogger.info('Arc quest completed: "%s" (%d/%d)',
      questId, this.currentArc.currentQuestIndex, this.currentArc.totalQuests);

    if (this.currentArc.currentQuestIndex >= this.currentArc.totalQuests) {
      // Arc complete!
      this.currentArc.status = 'completed';
      this.completedArcCount++;
      llmLogger.info('Story arc completed: "%s"! (total completed: %d, new tier: %d) Starting new arc in background...',
        this.currentArc.title, this.completedArcCount, this.getTier());

      // Start new arc in background
      this.startNewArcInBackground();
      return null;
    }

    // Generate next quest in background
    this.generateNextQuest().catch(err => {
      llmLogger.error({ err }, 'Failed to generate next arc quest');
    });

    return this.getNextQuestNpcId();
  }

  private startNewArcInBackground(): void {
    (async () => {
      const ok = await this.generateNewArc();
      if (ok) {
        await this.generateNextQuest();
      }
    })().catch(err => {
      llmLogger.error({ err }, 'Failed to start new arc');
    });
  }

  private getNextQuestNpcId(): string | null {
    if (!this.currentArc || this.currentArc.status === 'completed') return null;
    const idx = this.currentArc.currentQuestIndex;
    if (idx >= this.currentArc.totalQuests) return null;
    return this.currentArc.npcAssignments[idx];
  }

  /** Monster tier based on completed arc count: 0 arcs → 1, 1 arc → 2, 2+ arcs → 3 */
  getTier(): number {
    if (this.completedArcCount >= 2) return 3;
    if (this.completedArcCount >= 1) return 2;
    return 1;
  }

  getCompletedArcCount(): number {
    return this.completedArcCount;
  }

  getArcStatus(): ArcStatus | null {
    if (!this.currentArc) return null;

    return {
      id: this.currentArc.id,
      title: this.currentArc.title,
      currentQuestIndex: this.currentArc.currentQuestIndex,
      totalQuests: this.currentArc.totalQuests,
      status: this.currentArc.status,
      nextQuestNpcId: this.getNextQuestNpcId(),
      nextQuestReady: this.currentQuest !== null,
      completedArcCount: this.completedArcCount,
      tier: this.getTier(),
      dailyArcsUsed: this.dailyArcCount,
      dailyArcsMax: config.storyArcDailyMax
    };
  }

  isGenerating(): boolean {
    return this.generating;
  }
}

export const storyArcService = new StoryArcService();
