import type { GeneratedQuestDefinition } from './llmService.js';

const VALID_NPC_IDS = ['npc_merchant', 'npc_merchant_2', 'npc_sage'];
const VALID_QUEST_TYPES = ['rescue', 'recover', 'destroy', 'investigate'];
const VALID_MONSTER_TYPES = ['zombie', 'skelet', 'orc', 'goblin', 'demon'];
const VALID_ITEM_IDS = [
  'weapon_sword_wooden', 'weapon_sword_steel', 'weapon_sword_silver',
  'weapon_sword_golden', 'weapon_sword_ruby', 'weapon_dagger_small',
  'weapon_dagger_steel', 'weapon_dagger_golden', 'weapon_katana_silver',
  'weapon_hammer', 'weapon_sledgehammer',
  'flask_red', 'flask_big_red', 'flask_blue', 'flask_green', 'flask_yellow'
];
const VALID_OBJECTIVE_TYPES = ['kill', 'collect', 'talk_to', 'explore'];
const VALID_DIALOG_ACTIONS = ['accept_quest', 'decline_quest', 'end_dialog', 'turn_in_quest'];
const DIALOG_PHASES = ['offer', 'inProgress', 'readyToTurnIn', 'completed'] as const;

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateQuest(quest: unknown): ValidationResult {
  const errors: string[] = [];
  const q = quest as GeneratedQuestDefinition;

  // Basic fields
  if (!q.id || typeof q.id !== 'string') errors.push('Missing or invalid id');
  else if (!q.id.startsWith('quest_llm_')) errors.push('Quest ID must start with "quest_llm_"');

  if (!q.name || typeof q.name !== 'string') errors.push('Missing or invalid name');
  if (!q.type || !VALID_QUEST_TYPES.includes(q.type)) errors.push(`Invalid quest type: ${q.type}`);
  if (!q.description || typeof q.description !== 'string') errors.push('Missing description');
  if (!q.npcId || !VALID_NPC_IDS.includes(q.npcId)) errors.push(`Invalid npcId: ${q.npcId}`);
  if (typeof q.level !== 'number' || q.level < 1) errors.push('Invalid level');

  // Objectives
  if (!Array.isArray(q.objectives) || q.objectives.length === 0) {
    errors.push('Missing or empty objectives');
  } else {
    for (const obj of q.objectives) {
      if (!obj.id) errors.push('Objective missing id');
      if (!VALID_OBJECTIVE_TYPES.includes(obj.type)) errors.push(`Invalid objective type: ${obj.type}`);
      if (obj.type === 'kill' && !VALID_MONSTER_TYPES.includes(obj.target)) {
        errors.push(`Invalid kill target: ${obj.target}`);
      }
      if (obj.type === 'collect' && !VALID_ITEM_IDS.includes(obj.target)) {
        errors.push(`Invalid collect target: ${obj.target}`);
      }
      if (typeof obj.requiredCount !== 'number' || obj.requiredCount < 1) {
        errors.push('Invalid requiredCount');
      }
    }
  }

  // Rewards
  if (!q.rewards || typeof q.rewards.xp !== 'number') {
    errors.push('Missing or invalid rewards');
  } else {
    if (q.rewards.items) {
      for (const item of q.rewards.items) {
        if (!VALID_ITEM_IDS.includes(item.itemId)) {
          errors.push(`Invalid reward item: ${item.itemId}`);
        }
      }
    }
  }

  // Dialog structure
  if (!q.dialog) {
    errors.push('Missing dialog');
  } else {
    for (const phase of DIALOG_PHASES) {
      const nodes = q.dialog[phase];
      if (!Array.isArray(nodes) || nodes.length === 0) {
        errors.push(`Missing or empty dialog phase: ${phase}`);
        continue;
      }

      const nodeIds = new Set(nodes.map(n => n.id));

      // Validate node references
      for (const node of nodes) {
        if (!node.id) errors.push(`Node missing id in ${phase}`);
        if (!node.speaker) errors.push(`Node missing speaker in ${phase}`);
        if (!node.text) errors.push(`Node missing text in ${phase}`);

        if (node.responses) {
          for (const resp of node.responses) {
            if (!resp.text) errors.push(`Response missing text in ${phase}`);
            if (!nodeIds.has(resp.nextNodeId)) {
              errors.push(`Invalid nextNodeId "${resp.nextNodeId}" in ${phase}`);
            }
            if (resp.action && !VALID_DIALOG_ACTIONS.includes(resp.action.type)) {
              errors.push(`Invalid dialog action: ${resp.action.type}`);
            }
          }
        }
      }

      // Check required actions per phase
      if (phase === 'offer') {
        const hasAccept = nodes.some(n => n.responses?.some(r => r.action?.type === 'accept_quest'));
        if (!hasAccept) errors.push('Offer phase missing accept_quest action');
      }
      if (phase === 'readyToTurnIn') {
        const hasTurnIn = nodes.some(n => n.responses?.some(r => r.action?.type === 'turn_in_quest'));
        if (!hasTurnIn) errors.push('ReadyToTurnIn phase missing turn_in_quest action');
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
