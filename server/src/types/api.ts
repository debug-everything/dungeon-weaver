export interface GameSave {
  id: string;
  player_name: string;
  created_at: string;
  updated_at: string;
  player_state: string;      // JSON
  inventory_state: string;   // JSON
  equipment_state: string;   // JSON
  dungeon_layout: string;    // JSON
  rooms: string;             // JSON
  quest_states: string;      // JSON
  fog_state: string | null;  // JSON, nullable
}

export interface GameSaveResponse {
  id: string;
  playerName: string;
  createdAt: string;
  updatedAt: string;
  playerState: unknown;
  inventoryState: unknown;
  equipmentState: unknown;
  dungeonLayout: unknown;
  rooms: unknown;
  questStates: unknown;
  fogState: unknown;
}

export interface GameSaveListItem {
  id: string;
  playerName: string;
  updatedAt: string;
}

export interface CreateSaveRequest {
  playerName: string;
  playerState: unknown;
  inventoryState: unknown;
  equipmentState: unknown;
  dungeonLayout: unknown;
  rooms: unknown;
  questStates: unknown;
  fogState?: unknown;
}
