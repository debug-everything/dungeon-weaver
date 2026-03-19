import { Router } from 'express';
import { createSave, listSaves, getSave, updateSave, deleteSave } from '../services/gameStateService.js';
import type { CreateSaveRequest } from '../types/api.js';
import { apiLogger } from '../logger.js';

export const gameStateRouter = Router();

function validateSaveRequest(body: unknown): { valid: true; data: CreateSaveRequest } | { valid: false; error: string } {
  if (!body || typeof body !== 'object') return { valid: false, error: 'Request body must be a JSON object' };
  const b = body as Record<string, unknown>;
  if (typeof b.playerName !== 'string' || b.playerName.length === 0 || b.playerName.length > 50) {
    return { valid: false, error: 'playerName must be a non-empty string (max 50 chars)' };
  }
  if (!b.playerState || typeof b.playerState !== 'object') return { valid: false, error: 'playerState must be an object' };
  if (!b.inventoryState || typeof b.inventoryState !== 'object') return { valid: false, error: 'inventoryState must be an object' };
  if (!b.equipmentState || typeof b.equipmentState !== 'object') return { valid: false, error: 'equipmentState must be an object' };
  if (!b.dungeonLayout || typeof b.dungeonLayout !== 'object') return { valid: false, error: 'dungeonLayout must be an object' };
  if (!b.rooms || typeof b.rooms !== 'object') return { valid: false, error: 'rooms must be an object' };
  if (!b.questStates || typeof b.questStates !== 'object') return { valid: false, error: 'questStates must be an object' };
  if (b.fogState !== undefined && b.fogState !== null && typeof b.fogState !== 'object') {
    return { valid: false, error: 'fogState must be an object or null' };
  }
  return { valid: true, data: b as unknown as CreateSaveRequest };
}

// Create new save
gameStateRouter.post('/', (req, res) => {
  try {
    const result = validateSaveRequest(req.body);
    if (!result.valid) {
      res.status(400).json({ error: result.error });
      return;
    }
    const save = createSave(result.data);
    res.status(201).json(save);
  } catch (err) {
    apiLogger.error({ err }, 'Error creating save');
    res.status(500).json({ error: 'Failed to create save' });
  }
});

// List all saves
gameStateRouter.get('/', (_req, res) => {
  try {
    const saves = listSaves();
    res.json(saves);
  } catch (err) {
    apiLogger.error({ err }, 'Error listing saves');
    res.status(500).json({ error: 'Failed to list saves' });
  }
});

// Get single save
gameStateRouter.get('/:id', (req, res) => {
  try {
    const save = getSave(req.params.id);
    if (!save) {
      res.status(404).json({ error: 'Save not found' });
      return;
    }
    res.json(save);
  } catch (err) {
    apiLogger.error({ err }, 'Error getting save');
    res.status(500).json({ error: 'Failed to get save' });
  }
});

// Update save
gameStateRouter.put('/:id', (req, res) => {
  try {
    const result = validateSaveRequest(req.body);
    if (!result.valid) {
      res.status(400).json({ error: result.error });
      return;
    }
    const save = updateSave(req.params.id, result.data);
    if (!save) {
      res.status(404).json({ error: 'Save not found' });
      return;
    }
    res.json(save);
  } catch (err) {
    apiLogger.error({ err }, 'Error updating save');
    res.status(500).json({ error: 'Failed to update save' });
  }
});

// Delete save
gameStateRouter.delete('/:id', (req, res) => {
  try {
    const deleted = deleteSave(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: 'Save not found' });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    apiLogger.error({ err }, 'Error deleting save');
    res.status(500).json({ error: 'Failed to delete save' });
  }
});
