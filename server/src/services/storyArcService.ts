import { generateStoryArc, generateArcQuest, GeneratedQuestDefinition, StoryArcOutline, NPC_PROFILES } from './llmService.js';
import { validateQuest } from './questValidator.js';
import { gameConfig } from '../config.js';
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
}

class StoryArcService {
  private currentArc: StoryArc | null = null;
  private currentQuest: GeneratedQuestDefinition | null = null;
  private existingArcIds: string[] = [];
  private existingQuestIds: string[] = [];
  private generating: boolean = false;

  async initialize(): Promise<void> {
    llmLogger.info('Initializing story arc system (questsPerArc=%d, bossEnabled=%s)...',
      gameConfig.storyArc.questsPerArc, gameConfig.storyArc.bossQuestEnabled);

    await this.generateNewArc();
    if (this.currentArc) {
      await this.generateNextQuest();
    }
  }

  private async generateNewArc(): Promise<boolean> {
    const totalQuests = gameConfig.storyArc.questsPerArc + (gameConfig.storyArc.bossQuestEnabled ? 1 : 0);

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const outline = await generateStoryArc(totalQuests, this.existingArcIds);

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
        llmLogger.info('Story arc generated: "%s" (%d quests)', outline.title, totalQuests);
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
          isBossQuest: isBoss
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
      llmLogger.info('Story arc completed: "%s"! Starting new arc in background...', this.currentArc.title);

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

  getArcStatus(): ArcStatus | null {
    if (!this.currentArc) return null;

    return {
      id: this.currentArc.id,
      title: this.currentArc.title,
      currentQuestIndex: this.currentArc.currentQuestIndex,
      totalQuests: this.currentArc.totalQuests,
      status: this.currentArc.status,
      nextQuestNpcId: this.getNextQuestNpcId(),
      nextQuestReady: this.currentQuest !== null
    };
  }

  isGenerating(): boolean {
    return this.generating;
  }
}

export const storyArcService = new StoryArcService();
