// ─── NPC PROFILES ───────────────────────────────────────

export const NPC_PROFILES: Record<string, { name: string; personality: string }> = {
  npc_merchant: {
    name: 'Marcus the Barterer',
    personality: `Marcus is a practical, no-nonsense trader. His quests revolve around protecting trade routes, recovering stolen merchandise, eliminating pests that threaten his business, or sourcing rare goods. He speaks in a direct, business-like manner. He favors "destroy" and "recover" quest types. Rewards lean toward gold and weapons.`
  },
  npc_merchant_2: {
    name: 'Elena the Divine',
    personality: `Elena is an adventurous collector of rare and exotic artifacts. Her quests involve tracking down ancient relics, investigating mysterious dungeon anomalies, recovering lost treasures, or hunting rare monster variants. She speaks with wonder and excitement. She favors "investigate" and "recover" quest types. Rewards lean toward rare weapons and unique variant items.`
  },
  npc_sage: {
    name: 'Aldric the Sage',
    personality: `Aldric is a scholarly mystic obsessed with arcane knowledge. His quests involve researching supernatural phenomena, collecting alchemical ingredients, investigating cursed areas, or destroying undead abominations. He speaks in a wise, somewhat cryptic manner. He favors "investigate" and "destroy" quest types. Rewards lean toward potions and consumables.`
  }
};

// ─── TIER SYSTEM ────────────────────────────────────────

export const TIER_MONSTER_TYPES: Record<number, string[]> = {
  1: ['zombie', 'zombie_small', 'zombie_green', 'zombie_tall', 'skelet', 'bat', 'wogol', 'rokita'],
  2: ['zombie', 'zombie_small', 'zombie_green', 'zombie_tall', 'skelet', 'bat', 'wogol', 'rokita',
      'goblin', 'orc', 'orc_armored', 'orc_masked', 'orc_shaman', 'orc_veteran', 'imp', 'chort', 'bies'],
  3: ['zombie', 'zombie_small', 'zombie_green', 'zombie_tall', 'skelet', 'bat', 'wogol', 'rokita',
      'goblin', 'orc', 'orc_armored', 'orc_masked', 'orc_shaman', 'orc_veteran', 'imp', 'chort', 'bies',
      'elemental_goo', 'elemental_fire', 'elemental_water', 'elemental_air', 'elemental_earth', 'elemental_plant', 'elemental_gold', 'dark_knight']
};

export const TIER_MONSTER_SPRITES: Record<number, string[]> = {
  1: ['monster_zombie', 'monster_zombie_small', 'monster_zombie_green', 'monster_zombie_tall', 'monster_skelet', 'monster_bat', 'monster_wogol', 'monster_rokita'],
  2: ['monster_zombie', 'monster_zombie_small', 'monster_zombie_green', 'monster_zombie_tall', 'monster_skelet', 'monster_bat', 'monster_wogol', 'monster_rokita',
      'monster_goblin', 'monster_orc', 'monster_orc_armored', 'monster_orc_masked', 'monster_orc_shaman', 'monster_orc_veteran', 'monster_imp', 'monster_chort', 'monster_bies'],
  3: ['monster_zombie', 'monster_zombie_small', 'monster_zombie_green', 'monster_zombie_tall', 'monster_skelet', 'monster_bat', 'monster_wogol', 'monster_rokita',
      'monster_goblin', 'monster_orc', 'monster_orc_armored', 'monster_orc_masked', 'monster_orc_shaman', 'monster_orc_veteran', 'monster_imp', 'monster_chort', 'monster_bies',
      'monster_elemental_goo', 'monster_elemental_fire', 'monster_elemental_water', 'monster_elemental_air', 'monster_elemental_earth', 'monster_elemental_plant', 'monster_elemental_gold', 'monster_dark_knight']
};

export const BOSS_TYPES = ['demon', 'ogre', 'tentacle', 'necromancer', 'elemental_lord'];
export const BOSS_SPRITES = ['monster_demon', 'monster_ogre', 'monster_tentackle', 'monster_necromancer', 'monster_elemental_lord'];

// ─── QUEST SYSTEM PROMPT ────────────────────────────────

export function buildQuestSystemPrompt(tier: number = 1, isBossQuest: boolean = false): string {
  const allowedTypes = TIER_MONSTER_TYPES[tier] || TIER_MONSTER_TYPES[1];
  const allowedSprites = TIER_MONSTER_SPRITES[tier] || TIER_MONSTER_SPRITES[1];

  const monsterTypeEnum = isBossQuest
    ? `${allowedTypes.map(t => `"${t}"`).join(',')},${BOSS_TYPES.map(t => `"${t}"`).join(',')}`
    : allowedTypes.map(t => `"${t}"`).join(',');
  const monsterSpriteEnum = isBossQuest
    ? `${allowedSprites.map(s => `"${s}"`).join(',')},${BOSS_SPRITES.map(s => `"${s}"`).join(',')}`
    : allowedSprites.map(s => `"${s}"`).join(',');

  return `You are a quest designer for a dungeon crawler RPG. Generate a single quest as a JSON object.

You can create VARIANT monsters and items — custom-named versions of existing types that reuse base sprites but have unique names and scaled stats. This makes quests feel unique without needing new assets.

## EXACT SCHEMA (follow precisely)

{
  "id": string,              // MUST start with "quest_llm_" e.g. "quest_llm_goblin_raid"
  "name": string,            // Display name e.g. "Goblin Raid"
  "type": enum,              // ONE OF: "rescue", "recover", "destroy", "investigate"
  "description": string,     // 1-2 sentence quest summary
  "npcId": enum,             // ONE OF: "npc_merchant", "npc_merchant_2", "npc_sage"
  "level": number,           // 1-5
  "intro": string[],         // (optional) 2-4 atmospheric lines the NPC says BEFORE the offer dialog. The intro builds atmosphere; the offer text should NOT repeat it — just ask if they accept.
  "variants": {              // (optional) Define custom variants of existing monsters/items
    "monsters": [            // (optional) For kill quests — variant monsters
      {
        "variantId": string,      // Unique id e.g. "monster_hunchback_goblin"
        "baseType": enum,         // ONE OF: ${monsterTypeEnum}
        "baseSprite": enum,       // ONE OF: ${monsterSpriteEnum}
        "name": string,           // Display name e.g. "Hunchback Goblin"
        "statMultiplier": number  // 0.5-2.0, scales base health/damage/xp/gold
      }
    ],
    "items": [               // (optional) For collect quests or unique rewards
      {
        "variantId": string,      // Unique id e.g. "item_cursed_blade"
        "baseItem": enum,         // ONE OF the ITEM_IDS below
        "name": string,           // Display name e.g. "Cursed Blade"
        "description": string     // Flavor text for the item
      }
    ]
  },
  "objectives": [            // Array of 1-3 objectives
    {
      "id": string,          // Unique within quest e.g. "kill_goblins"
      "type": enum,          // ONE OF: "kill", "collect"
      "description": string, // e.g. "Kill 3 hunchback goblins"
      "target": string,      // If type="kill": the BASE TYPE e.g. "goblin" (NOT the variantId)
                              // If type="collect": a variantId OR one of the ITEM_IDS below
      "requiredCount": number, // 1-4 for kill, 1-3 for collect
      "consumeOnTurnIn": boolean // true for collect objectives, false for kill
    }
  ],
  "rewards": {
    "xp": number,            // 25-200
    "gold": number,          // 10-100 (optional)
    "items": [               // (optional) Array of reward items
      {
        "itemId": string,    // MUST be one of the ITEM_IDS below OR a variantId defined in variants.items
        "quantity": number   // 1-3
      }
    ]
  },
  "narration": {               // (optional) Cinematic narrator/boss lines shown as overlay text
    "onComplete": string[],    // 1-3 lines in 3rd-person narrator voice when objectives are done
    "onBossEncounter": string[], // 1-3 ominous lines when player enters boss room (boss quests only)
    "onBossDefeat": string[]   // 1-3 cathartic lines when boss dies (boss quests only)
  },
  "dialog": {
    "offer": DialogNode[],         // 3 nodes. First node MUST have responses with accept_quest and decline_quest actions.
    "inProgress": DialogNode[],    // 3 nodes. First node MUST have responses. Remind player of objective.
    "readyToTurnIn": DialogNode[], // 3 nodes. First node MUST have responses with turn_in_quest action.
    "completed": DialogNode[]      // 3 nodes. First node MUST have responses with end_dialog action. Thank the player.
  }
}

DialogNode = {
  "id": string,              // Unique within phase e.g. "offer_1", "offer_accept"
  "speaker": string,         // NPC display name matching npcId (see NPC_NAMES below)
  "text": string,            // Dialog text (1-2 sentences, in character)
  "responses": [             // ONLY on the first node of each phase. Omit on terminal nodes.
    {
      "text": string,        // Player response text (short, 2-8 words)
      "nextNodeId": string,  // MUST reference another node id IN THE SAME phase
      "action": {            // Optional action object
        "type": enum         // ONE OF: "accept_quest", "decline_quest", "end_dialog", "turn_in_quest"
      }
    }
  ]
}

## VALID ENUM VALUES

MONSTER BASE TYPES (for variant baseType and kill objective target):
${monsterTypeEnum}

MONSTER SPRITES (for variant baseSprite):
${monsterSpriteEnum}

NPC_NAMES (use as "speaker" based on npcId):
- "npc_merchant" → "Marcus the Barterer"
- "npc_merchant_2" → "Elena the Divine"
- "npc_sage" → "Aldric the Sage"

ITEM_IDS (for objective targets, reward itemId, and variants baseItem):
"weapon_sword_wooden", "weapon_sword_rusty", "weapon_sword_steel", "weapon_sword_silver", "weapon_sword_golden", "weapon_sword_ruby", "weapon_dagger_small", "weapon_dagger_steel", "weapon_dagger_golden", "weapon_katana_silver", "weapon_hammer", "weapon_sledgehammer", "flask_red", "flask_big_red", "flask_blue", "flask_green", "flask_yellow", "armor_peasant", "armor_spy", "armor_wizard", "armor_barbarian", "armor_knight", "armor_shield_wooden", "armor_shield_iron", "armor_shield_golden"

## DIALOG RULES
- Each phase has EXACTLY 3 nodes: one with responses (first), two terminal (no responses).
- Every nextNodeId MUST match an id of another node in the SAME phase. Never reference other phases.
- IMPORTANT: If "intro" is provided, the player has ALREADY heard the full story pitch. The offer phase's first node text must NOT repeat the intro — just ask a brief question like "So, will you help?" or "What do you say, adventurer?" Keep it short.
- Required actions per phase:
  - offer: one response has {"type":"accept_quest"}, one has {"type":"decline_quest"}
  - readyToTurnIn: one response has {"type":"turn_in_quest"}, one has {"type":"end_dialog"}
  - completed: one response has {"type":"end_dialog"}
  - inProgress: one response has {"type":"end_dialog"}

## VARIANT RULES
- Use variants to give quests flavor: "Hunchback Goblin" instead of just "goblin", "Venom Flask" instead of "flask_green"
- Kill objective "target" MUST be the BASE TYPE (e.g. "goblin"), not the variantId. The game matches kills by base type.
- Collect objective "target" can be a variantId defined in variants.items
- Reward itemId can be a variantId defined in variants.items
- You don't HAVE to use variants — simple quests without them are fine too
- ONLY use monster types and sprites from the lists above. Do NOT use types or sprites not listed.

## NARRATION RULES
- narration is optional but adds cinematic flavor
- Narrator voice is 3rd-person omniscient, atmospheric, and terse. No exclamation marks.
- onComplete: 1-3 lines reflecting on the quest's completion ("The dungeon grew quiet once more.")
- onBossEncounter: 1-3 ominous lines as the player enters the boss chamber (boss quests only)
- onBossDefeat: 1-3 cathartic lines after the boss falls (boss quests only)
- Keep each line under 120 characters

## COMPLETE EXAMPLE

{
  "id": "quest_llm_goblin_raid",
  "name": "Goblin Raid",
  "type": "destroy",
  "description": "Hunchback goblins have been raiding the merchant stalls. Clear them out before they steal everything.",
  "npcId": "npc_merchant",
  "level": 1,
  "intro": ["The trade routes have grown dangerous of late...", "Goblins. Twisted, hunched little beasts. They've been raiding my caravans nightly."],
  "variants": {
    "monsters": [
      {"variantId": "monster_hunchback_goblin", "baseType": "goblin", "baseSprite": "monster_goblin", "name": "Hunchback Goblin", "statMultiplier": 1.3}
    ]
  },
  "narration": {
    "onComplete": ["The last of the twisted goblins fell, and the trade road breathed easier."]
  },
  "objectives": [
    {"id": "kill_goblins", "type": "kill", "description": "Kill 3 hunchback goblins", "target": "goblin", "requiredCount": 3, "consumeOnTurnIn": false}
  ],
  "rewards": {"xp": 50, "gold": 30, "items": [{"itemId": "flask_red", "quantity": 1}]},
  "dialog": {
    "offer": [
      {"id": "offer_1", "speaker": "Marcus the Barterer", "text": "So, what do you say? Will you help me deal with them?", "responses": [
        {"text": "I'll handle it.", "nextNodeId": "offer_accept", "action": {"type": "accept_quest"}},
        {"text": "Not right now.", "nextNodeId": "offer_decline", "action": {"type": "decline_quest"}}
      ]},
      {"id": "offer_accept", "speaker": "Marcus the Barterer", "text": "Thank you! Kill at least three of those pests and I'll reward you handsomely."},
      {"id": "offer_decline", "speaker": "Marcus the Barterer", "text": "I understand. Come back if you change your mind."}
    ],
    "inProgress": [
      {"id": "progress_1", "speaker": "Marcus the Barterer", "text": "Have you dealt with those goblins yet? They're still causing trouble.", "responses": [
        {"text": "Still working on it.", "nextNodeId": "progress_working"},
        {"text": "I'll get back to it.", "nextNodeId": "progress_later", "action": {"type": "end_dialog"}}
      ]},
      {"id": "progress_working", "speaker": "Marcus the Barterer", "text": "Keep at it! I'm counting on you."},
      {"id": "progress_later", "speaker": "Marcus the Barterer", "text": "Hurry if you can. My stock is dwindling."}
    ],
    "readyToTurnIn": [
      {"id": "turnin_1", "speaker": "Marcus the Barterer", "text": "You've done it! I can see the goblin threat is gone. Ready for your reward?", "responses": [
        {"text": "Here to collect.", "nextNodeId": "turnin_accept", "action": {"type": "turn_in_quest"}},
        {"text": "Not yet.", "nextNodeId": "turnin_later", "action": {"type": "end_dialog"}}
      ]},
      {"id": "turnin_accept", "speaker": "Marcus the Barterer", "text": "Excellent work! Here's your reward as promised."},
      {"id": "turnin_later", "speaker": "Marcus the Barterer", "text": "Come back when you're ready to collect."}
    ],
    "completed": [
      {"id": "done_1", "speaker": "Marcus the Barterer", "text": "Thanks again for clearing out those goblins. My business is safe once more.", "responses": [
        {"text": "Glad to help.", "nextNodeId": "done_end", "action": {"type": "end_dialog"}},
        {"text": "Farewell.", "nextNodeId": "done_bye", "action": {"type": "end_dialog"}}
      ]},
      {"id": "done_end", "speaker": "Marcus the Barterer", "text": "May fortune favor you, adventurer!"},
      {"id": "done_bye", "speaker": "Marcus the Barterer", "text": "Safe travels, friend."}
    ]
  }
}

Respond with ONLY the JSON object.`;
}

// ─── ARC OUTLINE PROMPTS ────────────────────────────────

export const ARC_SYSTEM_PROMPT = `You are a narrative designer for a dungeon crawler RPG. Generate a story arc outline as a JSON object.

A story arc is a coherent multi-quest narrative with a title, theme, and sequential quest summaries. Each quest should build on the previous one, creating an escalating storyline.

## SCHEMA
{
  "id": string,           // "arc_" prefix + snake_case, e.g. "arc_heartforge_conspiracy"
  "title": string,        // 2-5 word evocative title, e.g. "The Heartforge Conspiracy"
  "theme": string,        // 2-3 sentences describing the arc's overarching narrative
  "quests": [             // Exactly N quests (count specified in user message)
    {
      "summary": string,  // 1-2 sentence quest objective summary
      "npcId": enum,      // Which NPC gives this quest (pick best fit from personalities)
      "questType": enum   // ONE OF: "rescue", "recover", "destroy", "investigate"
    }
  ]
}

## NPC PERSONALITIES (pick the most fitting NPC per quest)
- "npc_merchant" (Marcus the Barterer): Practical trader. Business threats, stolen goods, trade routes. Favors "destroy" and "recover".
- "npc_merchant_2" (Elena the Divine): Adventurous collector. Relics, mysteries, rare finds. Favors "investigate" and "recover".
- "npc_sage" (Aldric the Sage): Scholarly mystic. Supernatural phenomena, alchemy, undead. Favors "investigate" and "destroy".

## RULES
- Create an evocative, atmospheric storyline with creative naming
- IMPORTANT: Vary title themes widely! Draw from diverse genres: heists, plagues, betrayals, ancient machines, forgotten gods, elemental storms, political intrigue, cursed bloodlines, merchant wars, alchemical disasters, etc. Avoid defaulting to shadow/darkness/void themes.
- Each quest should logically build on the previous one
- Vary the NPC assignments based on narrative fit — use at least 2 different NPCs
- The LAST quest MUST be a climactic "destroy" quest against a powerful boss foe
- Use imaginative names for enemies, items, and locations in the summaries
- Keep summaries specific enough to guide individual quest generation later

Respond with ONLY the JSON object.`;

export function buildArcOutlineUserPrompt(questCount: number, existingArcIds: string[], previousTitles: string[]): string {
  /** Extract significant words from previous titles so the LLM can avoid them */
  const stopWords = new Set(['the', 'of', 'a', 'an', 'and', 'in', 'on', 'at', 'to', 'for', 'is', 'by']);
  const keywords = new Set<string>();
  for (const title of previousTitles) {
    for (const word of title.toLowerCase().split(/\s+/)) {
      if (word.length > 3 && !stopWords.has(word)) {
        keywords.add(word);
      }
    }
  }

  const avoidSection = previousTitles.length > 0
    ? `\nPrevious arc titles used (DO NOT reuse these or similar names): ${previousTitles.map(t => `"${t}"`).join(', ')}.
Pick a COMPLETELY DIFFERENT theme and naming style. Avoid words like: ${[...keywords].join(', ')}.`
    : '';

  return `Generate a story arc with exactly ${questCount} quests.
Avoid these existing arc IDs: ${existingArcIds.join(', ') || 'none'}.${avoidSection}
Create a compelling narrative arc that escalates toward a climactic final boss quest.`;
}

// ─── ARC QUEST USER PROMPT ──────────────────────────────

export interface LoreFragment {
  locations: { name: string; description: string }[];
  faction: { name: string; description: string };
  history: string;
  artifact: { name: string; description: string };
}

export function buildArcQuestUserPrompt(context: {
  arc: { title: string; theme: string; quests: { summary: string; npcId: string; questType: string }[] };
  questIndex: number;
  previousSummaries: string[];
  isBossQuest: boolean;
  existingQuestIds: string[];
}, lore?: LoreFragment): string {
  const questInfo = context.arc.quests[context.questIndex];
  const npcProfile = NPC_PROFILES[questInfo.npcId];
  const npcName = npcProfile?.name ?? questInfo.npcId;

  const previousSection = context.previousSummaries.length > 0
    ? `\nPrevious quests in this arc (already completed by the player):\n${context.previousSummaries.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n`
    : '';

  const bossTypes = BOSS_TYPES.map(t => `"${t}"`).join(', ');
  const bossDirective = context.isBossQuest
    ? `\nIMPORTANT: This is the FINAL BOSS QUEST of the arc. Create a powerful variant monster using one of these boss base types: ${bossTypes} (with statMultiplier 1.8-2.0). Escalate the narrative stakes. Provide higher rewards (xp: 150-200, gold: 80-100). Include dramatic intro lines (3-4 lines). The monster should have an imposing, evocative name. Include ALL THREE narration fields (onComplete, onBossEncounter, onBossDefeat) with 2-3 atmospheric lines each.`
    : `\nInclude narration.onComplete with 1-2 atmospheric lines reflecting on quest completion.`;

  let loreSection = '';
  if (lore) {
    const locationLines = lore.locations.map(l => `- "${l.name}": ${l.description}`).join('\n');
    loreSection = `

## WORLD LORE (reference these in dialog and narration)
LOCATIONS:
${locationLines}

FACTION: "${lore.faction.name}" — ${lore.faction.description}

HISTORY: ${lore.history}

KEY ARTIFACT: "${lore.artifact.name}" — ${lore.artifact.description}

IMPORTANT: Reference at least one location and the faction or artifact in dialog or narration.`;
  }

  return `Generate a quest that is part of a story arc.

ARC TITLE: "${context.arc.title}"
ARC THEME: ${context.arc.theme}

This is quest ${context.questIndex + 1} of ${context.arc.quests.length} in the arc.
${previousSection}
Current quest to generate:
- Summary: ${questInfo.summary}
- Assigned NPC: "${questInfo.npcId}" (${npcName})
- Quest type: ${questInfo.questType}
${bossDirective}
Requirements:
- Set npcId to "${questInfo.npcId}" and use "${npcName}" as speaker in all dialog
- Reference events from previous quests for narrative continuity
- Use the arc theme to guide dialog tone and quest flavor
- Use creative, evocative names for variant monsters/items (not generic)
- Include 2-4 intro lines for atmospheric storytelling

Avoid these existing quest IDs: ${context.existingQuestIds.join(', ') || 'none'}.${loreSection}`;
}

// ─── STANDALONE QUEST USER PROMPT ───────────────────────

export function buildStandaloneQuestUserPrompt(context: {
  existingQuestIds: string[];
  targetNpcId: string;
}): string {
  const npcProfile = NPC_PROFILES[context.targetNpcId];
  const npcDirective = npcProfile
    ? `Assign this quest to NPC "${context.targetNpcId}" ("${npcProfile.name}").\n\nNPC PERSONALITY:\n${npcProfile.personality}\n\nLet this personality shape the quest theme, dialog tone, objective choices, and reward types.`
    : `Assign this quest to NPC "${context.targetNpcId}". Use the matching speaker name from NPC_NAMES.`;

  return `Generate a unique quest. Avoid these existing quest IDs: ${context.existingQuestIds.join(', ') || 'none'}.
${npcDirective} Create an interesting quest with varied dialog. Make the quest feel distinct and flavorful.`;
}

// ─── LORE GENERATION PROMPTS (NEW — Prompt Chaining) ────

export const LORE_SYSTEM_PROMPT = `You are a world-builder for a dungeon crawler RPG. Generate a lore fragment as a JSON object that enriches a story arc with grounded world details.

## SCHEMA
{
  "locations": [           // 2-3 themed dungeon locations
    {
      "name": string,      // Evocative place name, e.g. "The Charred Reliquary"
      "description": string // 1 sentence describing the location
    }
  ],
  "faction": {
    "name": string,        // Group/cult/guild name, e.g. "The Emberveil Covenant"
    "description": string  // 1 sentence describing the faction's purpose
  },
  "history": string,       // 2-3 sentences of backstory connecting locations, faction, and conflict
  "artifact": {
    "name": string,        // Key relic/MacGuffin name, e.g. "The Shard of Valdris"
    "description": string  // 1 sentence describing the artifact's significance
  }
}

## RULES
- Names should be evocative and original — avoid generic fantasy clichés
- All elements should interconnect: the faction seeks the artifact, the locations are where events happened
- Keep descriptions concise but atmospheric
- The lore should provide hooks that quest dialog can naturally reference
- Match the tone and themes of the story arc provided

Respond with ONLY the JSON object.`;

export function buildLoreUserPrompt(arc: { title: string; theme: string }): string {
  return `Generate a lore fragment for this story arc:

ARC TITLE: "${arc.title}"
ARC THEME: ${arc.theme}

Create interconnected lore elements (locations, faction, history, artifact) that enrich quests in this arc. The lore should feel organic to the arc's theme and provide concrete names and places that quest dialog can reference.`;
}
