import { MonsterVariant, ItemVariant } from '../types';
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
