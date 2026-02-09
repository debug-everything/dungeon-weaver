import { Router } from 'express';
import { createSave, listSaves, getSave, updateSave, deleteSave } from '../services/gameStateService.js';
import type { CreateSaveRequest } from '../types/api.js';

export const gameStateRouter = Router();

// Create new save
gameStateRouter.post('/', (req, res) => {
  try {
    const data = req.body as CreateSaveRequest;
    if (!data.playerName || !data.playerState) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }
    const save = createSave(data);
    res.status(201).json(save);
  } catch (err) {
    console.error('Error creating save:', err);
    res.status(500).json({ error: 'Failed to create save' });
  }
});

// List all saves
gameStateRouter.get('/', (_req, res) => {
  try {
    const saves = listSaves();
    res.json(saves);
  } catch (err) {
    console.error('Error listing saves:', err);
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
    console.error('Error getting save:', err);
    res.status(500).json({ error: 'Failed to get save' });
  }
});

// Update save
gameStateRouter.put('/:id', (req, res) => {
  try {
    const data = req.body as CreateSaveRequest;
    const save = updateSave(req.params.id, data);
    if (!save) {
      res.status(404).json({ error: 'Save not found' });
      return;
    }
    res.json(save);
  } catch (err) {
    console.error('Error updating save:', err);
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
    console.error('Error deleting save:', err);
    res.status(500).json({ error: 'Failed to delete save' });
  }
});
