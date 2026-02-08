import Phaser from 'phaser';
import { QuestDefinition, QuestState, QuestObjectiveProgress, QuestReward, MonsterData } from '../types';
import { EVENTS } from '../config/constants';
import { InventorySystem } from './InventorySystem';

export class QuestSystem {
  private scene: Phaser.Scene;
  private quests: Map<string, QuestDefinition> = new Map();
  private questStates: Map<string, QuestState> = new Map();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.scene.events.on(EVENTS.MONSTER_KILLED, this.onMonsterKilled, this);
    this.scene.events.on(EVENTS.ITEM_PICKED_UP, this.onItemPickedUp, this);

    this.scene.events.on('shutdown', () => {
      this.scene.events.off(EVENTS.MONSTER_KILLED, this.onMonsterKilled, this);
      this.scene.events.off(EVENTS.ITEM_PICKED_UP, this.onItemPickedUp, this);
    });
  }

  registerQuest(definition: QuestDefinition): void {
    const def = JSON.parse(JSON.stringify(definition)) as QuestDefinition;
    this.quests.set(def.id, def);
    this.questStates.set(def.id, {
      questId: def.id,
      status: 'available',
      objectiveProgress: def.objectives.map(obj => ({
        objectiveId: obj.id,
        currentCount: 0,
        completed: false
      }))
    });
  }

  acceptQuest(questId: string): boolean {
    const state = this.questStates.get(questId);
    if (!state || state.status !== 'available') return false;

    state.status = 'active';
    this.scene.events.emit(EVENTS.QUEST_ACCEPTED, questId);
    this.scene.events.emit(EVENTS.QUEST_LOG_CHANGED);
    return true;
  }

  /**
   * Turn in a completed quest. Returns the rewards if successful.
   * Handles consumeOnTurnIn by removing collected items from inventory.
   */
  turnInQuest(questId: string, inventory: InventorySystem): QuestReward | null {
    const state = this.questStates.get(questId);
    const definition = this.quests.get(questId);
    if (!state || !definition) return null;
    if (state.status !== 'completed') return null;

    // Consume items that have consumeOnTurnIn flag
    for (const objective of definition.objectives) {
      if (objective.type === 'collect' && objective.consumeOnTurnIn) {
        let remaining = objective.requiredCount;
        const allItems = inventory.getAllItems();
        for (let i = 0; i < allItems.length && remaining > 0; i++) {
          const slot = allItems[i];
          if (slot && slot.item.id === objective.target) {
            const toRemove = Math.min(slot.quantity, remaining);
            inventory.removeItem(i, toRemove);
            remaining -= toRemove;
          }
        }
      }
    }

    state.status = 'turned_in';
    this.scene.events.emit(EVENTS.QUEST_TURNED_IN, questId, definition.rewards);
    this.scene.events.emit(EVENTS.QUEST_LOG_CHANGED);
    return definition.rewards;
  }

  getQuestDefinition(questId: string): QuestDefinition | undefined {
    return this.quests.get(questId);
  }

  getQuestState(questId: string): QuestState | undefined {
    return this.questStates.get(questId);
  }

  getQuestsForNPC(npcId: string): { definition: QuestDefinition; state: QuestState }[] {
    const results: { definition: QuestDefinition; state: QuestState }[] = [];
    for (const [questId, definition] of this.quests) {
      if (definition.npcId === npcId) {
        const state = this.questStates.get(questId);
        if (state) {
          results.push({ definition, state });
        }
      }
    }
    return results;
  }

  /** Returns the most actionable quest for an NPC: ready-to-turn-in > available > active */
  getMostActionableQuest(npcId: string): { definition: QuestDefinition; state: QuestState } | null {
    const quests = this.getQuestsForNPC(npcId);
    // Priority: completed (ready to turn in) > available > active
    const readyToTurnIn = quests.find(q => q.state.status === 'completed');
    if (readyToTurnIn) return readyToTurnIn;

    const available = quests.find(q => q.state.status === 'available');
    if (available) return available;

    const active = quests.find(q => q.state.status === 'active');
    if (active) return active;

    return null;
  }

  hasQuestAvailable(npcId: string): boolean {
    return this.getQuestsForNPC(npcId).some(q => q.state.status === 'available');
  }

  hasQuestReadyToTurnIn(npcId: string): boolean {
    return this.getQuestsForNPC(npcId).some(q => q.state.status === 'completed');
  }

  hasAnyQuest(npcId: string): boolean {
    return this.getQuestsForNPC(npcId).some(
      q => q.state.status !== 'turned_in'
    );
  }

  getActiveQuests(): { definition: QuestDefinition; state: QuestState }[] {
    const results: { definition: QuestDefinition; state: QuestState }[] = [];
    for (const [questId, state] of this.questStates) {
      if (state.status === 'active' || state.status === 'completed') {
        const definition = this.quests.get(questId);
        if (definition) results.push({ definition, state });
      }
    }
    return results;
  }

  private onMonsterKilled(monsterData: MonsterData): void {
    for (const [questId, state] of this.questStates) {
      if (state.status !== 'active') continue;

      const definition = this.quests.get(questId);
      if (!definition) continue;

      for (const objProgress of state.objectiveProgress) {
        const objective = definition.objectives.find(o => o.id === objProgress.objectiveId);
        if (!objective || objective.type !== 'kill') continue;
        if (objProgress.completed) continue;

        if (monsterData.type === objective.target) {
          objProgress.currentCount = Math.min(objProgress.currentCount + 1, objective.requiredCount);
          if (objProgress.currentCount >= objective.requiredCount) {
            objProgress.completed = true;
            this.scene.events.emit(EVENTS.QUEST_OBJECTIVE_COMPLETED, questId, objProgress.objectiveId);
          }
          this.scene.events.emit(EVENTS.QUEST_PROGRESS_UPDATED, questId);
          this.checkQuestCompletion(questId);
        }
      }
    }
  }

  private onItemPickedUp(itemId: string): void {
    for (const [questId, state] of this.questStates) {
      if (state.status !== 'active') continue;

      const definition = this.quests.get(questId);
      if (!definition) continue;

      for (const objProgress of state.objectiveProgress) {
        const objective = definition.objectives.find(o => o.id === objProgress.objectiveId);
        if (!objective || objective.type !== 'collect') continue;
        if (objProgress.completed) continue;

        if (itemId === objective.target) {
          objProgress.currentCount = Math.min(objProgress.currentCount + 1, objective.requiredCount);
          if (objProgress.currentCount >= objective.requiredCount) {
            objProgress.completed = true;
            this.scene.events.emit(EVENTS.QUEST_OBJECTIVE_COMPLETED, questId, objProgress.objectiveId);
          }
          this.scene.events.emit(EVENTS.QUEST_PROGRESS_UPDATED, questId);
          this.checkQuestCompletion(questId);
        }
      }
    }
  }

  private checkQuestCompletion(questId: string): void {
    const state = this.questStates.get(questId);
    if (!state || state.status !== 'active') return;

    const allComplete = state.objectiveProgress.every(op => op.completed);
    if (allComplete) {
      state.status = 'completed';
      this.scene.events.emit(EVENTS.QUEST_READY_TO_TURN_IN, questId);
      this.scene.events.emit(EVENTS.QUEST_LOG_CHANGED);
    }
  }
}
