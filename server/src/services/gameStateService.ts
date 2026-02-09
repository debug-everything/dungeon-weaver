import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../db/database.js';
import type { GameSave, GameSaveResponse, GameSaveListItem, CreateSaveRequest } from '../types/api.js';

function toResponse(row: GameSave): GameSaveResponse {
  return {
    id: row.id,
    playerName: row.player_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    playerState: JSON.parse(row.player_state),
    inventoryState: JSON.parse(row.inventory_state),
    equipmentState: JSON.parse(row.equipment_state),
    dungeonLayout: JSON.parse(row.dungeon_layout),
    rooms: JSON.parse(row.rooms),
    questStates: JSON.parse(row.quest_states),
    fogState: row.fog_state ? JSON.parse(row.fog_state) : null
  };
}

export function createSave(data: CreateSaveRequest): GameSaveResponse {
  const db = getDatabase();
  const id = uuidv4();
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO game_saves (id, player_name, created_at, updated_at, player_state, inventory_state, equipment_state, dungeon_layout, rooms, quest_states, fog_state)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    data.playerName,
    now,
    now,
    JSON.stringify(data.playerState),
    JSON.stringify(data.inventoryState),
    JSON.stringify(data.equipmentState),
    JSON.stringify(data.dungeonLayout),
    JSON.stringify(data.rooms),
    JSON.stringify(data.questStates),
    data.fogState ? JSON.stringify(data.fogState) : null
  );

  return getSave(id)!;
}

export function listSaves(): GameSaveListItem[] {
  const db = getDatabase();
  const rows = db.prepare('SELECT id, player_name, updated_at FROM game_saves ORDER BY updated_at DESC').all() as Pick<GameSave, 'id' | 'player_name' | 'updated_at'>[];
  return rows.map(row => ({
    id: row.id,
    playerName: row.player_name,
    updatedAt: row.updated_at
  }));
}

export function getSave(id: string): GameSaveResponse | null {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM game_saves WHERE id = ?').get(id) as GameSave | undefined;
  if (!row) return null;
  return toResponse(row);
}

export function updateSave(id: string, data: CreateSaveRequest): GameSaveResponse | null {
  const db = getDatabase();
  const existing = db.prepare('SELECT id FROM game_saves WHERE id = ?').get(id);
  if (!existing) return null;

  const now = new Date().toISOString();
  const stmt = db.prepare(`
    UPDATE game_saves SET
      player_name = ?,
      updated_at = ?,
      player_state = ?,
      inventory_state = ?,
      equipment_state = ?,
      dungeon_layout = ?,
      rooms = ?,
      quest_states = ?,
      fog_state = ?
    WHERE id = ?
  `);

  stmt.run(
    data.playerName,
    now,
    JSON.stringify(data.playerState),
    JSON.stringify(data.inventoryState),
    JSON.stringify(data.equipmentState),
    JSON.stringify(data.dungeonLayout),
    JSON.stringify(data.rooms),
    JSON.stringify(data.questStates),
    data.fogState ? JSON.stringify(data.fogState) : null,
    id
  );

  return getSave(id);
}

export function deleteSave(id: string): boolean {
  const db = getDatabase();
  const result = db.prepare('DELETE FROM game_saves WHERE id = ?').run(id);
  return result.changes > 0;
}
