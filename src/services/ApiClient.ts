const BASE_URL = '/api';

export interface SaveListItem {
  id: string;
  playerName: string;
  updatedAt: string;
}

export interface SaveData {
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

export interface SaveGamePayload {
  playerName: string;
  playerState: unknown;
  inventoryState: unknown;
  equipmentState: unknown;
  dungeonLayout: unknown;
  rooms: unknown;
  questStates: unknown;
  fogState?: unknown;
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers
    }
  });
  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export async function saveGame(data: SaveGamePayload): Promise<SaveData> {
  return apiFetch<SaveData>('/saves', {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

export async function updateGame(id: string, data: SaveGamePayload): Promise<SaveData> {
  return apiFetch<SaveData>(`/saves/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
}

export async function loadGame(id: string): Promise<SaveData> {
  return apiFetch<SaveData>(`/saves/${id}`);
}

export async function listSaves(): Promise<SaveListItem[]> {
  return apiFetch<SaveListItem[]>('/saves');
}

export async function deleteGame(id: string): Promise<void> {
  await apiFetch(`/saves/${id}`, { method: 'DELETE' });
}

export async function getAvailableQuests(npcId?: string): Promise<unknown[]> {
  const path = npcId ? `/quests/available/${npcId}` : '/quests/available';
  return apiFetch<unknown[]>(path);
}

export async function acceptDynamicQuest(questId: string): Promise<void> {
  await apiFetch('/quests/accept', {
    method: 'POST',
    body: JSON.stringify({ questId })
  });
}
