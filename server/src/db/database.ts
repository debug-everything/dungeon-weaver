import Database from 'better-sqlite3';
import { config } from '../config.js';
import { mkdirSync } from 'fs';
import { dirname } from 'path';

let db: Database.Database;

export function getDatabase(): Database.Database {
  if (!db) {
    // Ensure directory exists
    mkdirSync(dirname(config.databasePath), { recursive: true });
    db = new Database(config.databasePath);
    db.pragma('journal_mode = WAL');
    runMigrations(db);
  }
  return db;
}

function runMigrations(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS game_saves (
      id TEXT PRIMARY KEY,
      player_name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      player_state TEXT NOT NULL,
      inventory_state TEXT NOT NULL,
      equipment_state TEXT NOT NULL,
      dungeon_layout TEXT NOT NULL,
      rooms TEXT NOT NULL,
      quest_states TEXT NOT NULL,
      fog_state TEXT
    )
  `);
}
