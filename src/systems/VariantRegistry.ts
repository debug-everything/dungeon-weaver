import { MonsterVariant, ItemVariant, QuestDefinition } from '../types';
import { MONSTERS } from '../data/monsters';
import { ITEMS } from '../data/items';

/**
 * Registers a monster variant into the runtime MONSTERS registry.
 * Clones the base monster, applies stat multiplier, sets new id/name,
 * but keeps the original type (for quest matching) and sprite.
 */
export function registerMonsterVariant(variant: MonsterVariant): void {
  // Skip if already registered
  if (MONSTERS[variant.variantId]) return;

  const base = MONSTERS[variant.baseSprite];
  if (!base) {
    console.warn(`[VariantRegistry] Unknown base monster sprite: ${variant.baseSprite}`);
    return;
  }

  const multiplier = Math.max(0.5, Math.min(2.0, variant.statMultiplier));

  MONSTERS[variant.variantId] = {
    ...base,
    id: variant.variantId,
    name: variant.name,
    type: variant.baseType,
    sprite: variant.baseSprite,
    health: Math.round(base.health * multiplier),
    damage: Math.round(base.damage * multiplier),
    xpReward: Math.round(base.xpReward * multiplier),
    goldDrop: {
      min: Math.round(base.goldDrop.min * multiplier),
      max: Math.round(base.goldDrop.max * multiplier)
    },
    lootTable: [...base.lootTable]
  };
}

/**
 * Registers an item variant into the runtime ITEMS registry.
 * Clones the base item, sets new id/name/description,
 * but keeps the original sprite and stats.
 */
export function registerItemVariant(variant: ItemVariant): void {
  // Skip if already registered
  if (ITEMS[variant.variantId]) return;

  const base = ITEMS[variant.baseItem];
  if (!base) {
    console.warn(`[VariantRegistry] Unknown base item: ${variant.baseItem}`);
    return;
  }

  ITEMS[variant.variantId] = {
    ...base,
    id: variant.variantId,
    name: variant.name,
    description: variant.description,
    sprite: base.sprite
  };
}

/**
 * For quests with 'collect' objectives, inject the target item into
 * relevant monster loot tables so the item can actually drop.
 * If the quest also has 'kill' objectives, inject into those monster types.
 * Otherwise, inject into all non-boss monster loot tables.
 */
export function injectQuestLoot(quest: QuestDefinition): void {
  const collectObjectives = quest.objectives.filter(o => o.type === 'collect');
  if (collectObjectives.length === 0) return;

  const killTargetTypes = quest.objectives
    .filter(o => o.type === 'kill')
    .map(o => o.target);

  for (const obj of collectObjectives) {
    const itemId = obj.target;
    if (!ITEMS[itemId]) continue;

    const dropChance = 0.35;

    for (const monster of Object.values(MONSTERS)) {
      // Skip boss
      if (monster.type === 'demon') continue;

      // If quest has kill targets, only inject into matching monster types
      if (killTargetTypes.length > 0 && !killTargetTypes.includes(monster.type)) continue;

      // Don't add duplicate loot entries
      if (monster.lootTable.some(e => e.itemId === itemId)) continue;

      monster.lootTable.push({ itemId, chance: dropChance });
    }
  }
}
