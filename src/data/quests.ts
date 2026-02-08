import { QuestDefinition } from '../types';
import questData from './quests.json';

// Load quests from JSON, keyed by quest id for fast lookup
export const QUESTS: Record<string, QuestDefinition> = {};
for (const quest of questData as QuestDefinition[]) {
  QUESTS[quest.id] = quest;
}

export function getQuestsForNPC(npcId: string): QuestDefinition[] {
  return Object.values(QUESTS).filter(q => q.npcId === npcId);
}
