import * as ROT from 'rot-js';
import { DungeonRoom, RoomType } from '../types';

export interface DungeonResult {
  dungeon: number[][];    // 0=floor, 1=wall, 2=door, 3=open door, 4=locked door
  rooms: DungeonRoom[];   // room[0]=start, room[last]=boss
  roomGraph: { from: number; to: number }[];
}

/** Check if a tile coordinate borders any room's interior floor area */
function isAdjacentToRoom(
  x: number, y: number,
  rooms: DungeonRoom[]
): boolean {
  for (const r of rooms) {
    // Check if (x,y) is within 1 tile of the room rect
    if (x >= r.x - 1 && x <= r.x + r.width &&
        y >= r.y - 1 && y <= r.y + r.height) {
      return true;
    }
  }
  return false;
}

/**
 * Generate a dungeon using rot.js BSP Digger with mission graph overlaid.
 * Boss room gets a locked door (tile 4) that unlocks after clearing rooms.
 */
export function generateDungeon(width: number, height: number): DungeonResult {
  // Step 1: BSP with rot.js Digger — retry until we get enough rooms
  // IMPORTANT: create() regenerates each call, so we must call it exactly once
  // with the callback, then get rooms from that same generation.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let digger: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let rotRooms: any[] = [];
  const minRooms = 8;

  const dungeon: number[][] = [];
  for (let y = 0; y < height; y++) {
    dungeon[y] = new Array(width).fill(1);
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    digger = new ROT.Map.Digger(width, height, {
      roomWidth: [5, 10],
      roomHeight: [5, 8],
      corridorLength: [2, 6],
      dugPercentage: 0.35
    });
    // Single create() call — populates grid AND sets up rooms
    digger.create((x: number, y: number, value: number) => {
      if (x >= 0 && x < width && y >= 0 && y < height) {
        dungeon[y][x] = value === 0 ? 0 : 1;
      }
    });
    rotRooms = digger.getRooms();
    if (rotRooms.length >= minRooms) break;
    // Reset grid for retry
    for (let y = 0; y < height; y++) {
      dungeon[y].fill(1);
    }
  }

  // Build room rectangles from rot.js rooms
  // These coords are the inclusive floor area (no walls included)
  const rooms: DungeonRoom[] = rotRooms.map((r: any) => ({
    x: r.getLeft(),
    y: r.getTop(),
    width: r.getRight() - r.getLeft() + 1,
    height: r.getBottom() - r.getTop() + 1,
    centerX: Math.floor((r.getLeft() + r.getRight()) / 2),
    centerY: Math.floor((r.getTop() + r.getBottom()) / 2),
  }));

  // Build room lookup: for a tile, which room index is it in?
  const tileToRoom = new Map<string, number>();
  for (let ri = 0; ri < rooms.length; ri++) {
    const r = rooms[ri];
    for (let y = r.y; y < r.y + r.height; y++) {
      for (let x = r.x; x < r.x + r.width; x++) {
        tileToRoom.set(`${x},${y}`, ri);
      }
    }
  }

  // Step 2: Widen corridors carefully — only widen walls that don't border rooms
  const corridorTiles: { x: number; y: number }[] = [];
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      if (dungeon[y][x] !== 0) continue;
      if (tileToRoom.has(`${x},${y}`)) continue;
      corridorTiles.push({ x, y });
    }
  }

  for (const { x, y } of corridorTiles) {
    const wallAbove = dungeon[y - 1]?.[x] === 1;
    const wallBelow = dungeon[y + 1]?.[x] === 1;
    const wallLeft = dungeon[y]?.[x - 1] === 1;
    const wallRight = dungeon[y]?.[x + 1] === 1;

    if (wallAbove && wallBelow) {
      // Horizontal corridor → try to widen vertically, but only if the wall
      // being carved is NOT adjacent to any room
      if (y - 1 >= 1 && dungeon[y - 1][x] === 1 && !isAdjacentToRoom(x, y - 1, rooms)) {
        dungeon[y - 1][x] = 0;
      }
      if (y + 1 < height - 1 && dungeon[y + 1][x] === 1 && !isAdjacentToRoom(x, y + 1, rooms)) {
        dungeon[y + 1][x] = 0;
      }
    } else if (wallLeft && wallRight) {
      // Vertical corridor → try to widen horizontally
      if (x - 1 >= 1 && dungeon[y][x - 1] === 1 && !isAdjacentToRoom(x - 1, y, rooms)) {
        dungeon[y][x - 1] = 0;
      }
      if (x + 1 < width - 1 && dungeon[y][x + 1] === 1 && !isAdjacentToRoom(x + 1, y, rooms)) {
        dungeon[y][x + 1] = 0;
      }
    }
  }

  // Step 3: Mission Graph — sort rooms by distance from top-left
  const distFromOrigin = (r: DungeonRoom) =>
    Math.sqrt(r.centerX * r.centerX + r.centerY * r.centerY);

  const sortedIndices = rooms
    .map((_, i) => i)
    .sort((a, b) => distFromOrigin(rooms[a]) - distFromOrigin(rooms[b]));

  const startIdx = sortedIndices[0];
  const bossIdx = sortedIndices[sortedIndices.length - 1];

  // Spine: start → 2-3 challenge rooms → boss
  const spineIndices = [startIdx];
  const innerCount = Math.min(3, sortedIndices.length - 2);
  for (let i = 0; i < innerCount; i++) {
    const pick = sortedIndices[Math.floor((i + 1) * (sortedIndices.length - 1) / (innerCount + 1))];
    if (pick !== startIdx && pick !== bossIdx) {
      spineIndices.push(pick);
    }
  }
  spineIndices.push(bossIdx);

  // Build room graph edges
  const roomGraph: { from: number; to: number }[] = [];
  const addEdge = (a: number, b: number) => {
    roomGraph.push({ from: a, to: b });
  };

  for (let i = 0; i < spineIndices.length - 1; i++) {
    addEdge(spineIndices[i], spineIndices[i + 1]);
  }

  const spineSet = new Set(spineIndices);
  for (const idx of sortedIndices) {
    if (spineSet.has(idx)) continue;
    let bestSpine = spineIndices[0];
    let bestDist = Infinity;
    for (const si of spineIndices) {
      const dx = rooms[idx].centerX - rooms[si].centerX;
      const dy = rooms[idx].centerY - rooms[si].centerY;
      const d = dx * dx + dy * dy;
      if (d < bestDist) {
        bestDist = d;
        bestSpine = si;
      }
    }
    addEdge(bestSpine, idx);
  }

  // Reorder: start first, boss last, challenge rooms in between
  const reordered: DungeonRoom[] = [];
  const oldToNew = new Map<number, number>();

  oldToNew.set(startIdx, 0);
  reordered.push({
    ...rooms[startIdx],
    roomType: 'start' as RoomType,
    connectedTo: [],
    isCleared: false
  });

  for (let i = 0; i < rooms.length; i++) {
    if (i === startIdx || i === bossIdx) continue;
    oldToNew.set(i, reordered.length);
    reordered.push({
      ...rooms[i],
      roomType: 'challenge' as RoomType,
      connectedTo: [],
      isCleared: false
    });
  }

  oldToNew.set(bossIdx, reordered.length);
  reordered.push({
    ...rooms[bossIdx],
    roomType: 'boss' as RoomType,
    connectedTo: [],
    isCleared: false,
    isBossRoom: true,
    isLocked: true
  });

  // Remap graph edges
  const remappedGraph = roomGraph.map(e => ({
    from: oldToNew.get(e.from)!,
    to: oldToNew.get(e.to)!
  }));

  for (const edge of remappedGraph) {
    if (!reordered[edge.from].connectedTo) reordered[edge.from].connectedTo = [];
    if (!reordered[edge.to].connectedTo) reordered[edge.to].connectedTo = [];
    reordered[edge.from].connectedTo!.push(edge.to);
    reordered[edge.to].connectedTo!.push(edge.from);
  }

  // Step 4: Door placement by scanning room boundaries for corridor entries
  // This is more reliable than getDoors() because it works on the actual grid
  // after corridor widening.
  const bossNewIdx = oldToNew.get(bossIdx)!;

  for (let ri = 0; ri < reordered.length; ri++) {
    // Skip start room (no doors)
    if (ri === 0) continue;

    const room = reordered[ri];
    const isBoss = ri === bossNewIdx;
    const doorChance = isBoss ? 1.0 : 0.6;
    const tileValue = isBoss ? 4 : 2;

    // Scan one tile OUTSIDE the room boundary to find corridor entries.
    // Group consecutive floor tiles into runs — each run is one corridor entry.
    const findEntryRuns = (
      length: number,
      outsideFn: (idx: number) => { x: number; y: number },
      insideFn: (idx: number) => { x: number; y: number }
    ): { x: number; y: number }[][] => {
      const runs: { x: number; y: number }[][] = [];
      let run: { x: number; y: number }[] = [];

      for (let idx = 0; idx < length; idx++) {
        const out = outsideFn(idx);
        const inn = insideFn(idx);
        if (out.x >= 0 && out.x < width && out.y >= 0 && out.y < height &&
            inn.x >= 0 && inn.x < width && inn.y >= 0 && inn.y < height &&
            dungeon[out.y][out.x] === 0 && dungeon[inn.y][inn.x] === 0) {
          run.push(out);
        } else {
          if (run.length > 0) { runs.push(run); run = []; }
        }
      }
      if (run.length > 0) runs.push(run);
      return runs;
    };

    const allRuns: { x: number; y: number }[][] = [];

    // Top edge — outside is y = room.y - 1
    allRuns.push(...findEntryRuns(room.width,
      (dx) => ({ x: room.x + dx, y: room.y - 1 }),
      (dx) => ({ x: room.x + dx, y: room.y })
    ));
    // Bottom edge — outside is y = room.y + room.height
    allRuns.push(...findEntryRuns(room.width,
      (dx) => ({ x: room.x + dx, y: room.y + room.height }),
      (dx) => ({ x: room.x + dx, y: room.y + room.height - 1 })
    ));
    // Left edge — outside is x = room.x - 1
    allRuns.push(...findEntryRuns(room.height,
      (dy) => ({ x: room.x - 1, y: room.y + dy }),
      (dy) => ({ x: room.x, y: room.y + dy })
    ));
    // Right edge — outside is x = room.x + room.width
    allRuns.push(...findEntryRuns(room.height,
      (dy) => ({ x: room.x + room.width, y: room.y + dy }),
      (dy) => ({ x: room.x + room.width - 1, y: room.y + dy })
    ));

    for (const run of allRuns) {
      // Only handle reasonable corridor widths (1-3 tiles).
      // Wider openings are room-to-room merges — skip.
      if (run.length === 0 || run.length > 3) continue;
      if (Math.random() > doorChance) continue;

      const midIdx = Math.floor(run.length / 2);
      const doorPos = run[midIdx];

      // Don't place a door if there's already one nearby
      let nearbyDoor = false;
      for (let dy = -3; dy <= 3 && !nearbyDoor; dy++) {
        for (let dx = -3; dx <= 3 && !nearbyDoor; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = doorPos.x + dx;
          const ny = doorPos.y + dy;
          if (nx >= 0 && nx < width && ny >= 0 && ny < height &&
              (dungeon[ny][nx] === 2 || dungeon[ny][nx] === 4)) {
            nearbyDoor = true;
          }
        }
      }
      if (nearbyDoor) continue;

      // Place door at center of the run
      dungeon[doorPos.y][doorPos.x] = tileValue;

      // Convert flanking tiles to walls to create a doorframe
      for (let j = 0; j < run.length; j++) {
        if (j === midIdx) continue;
        dungeon[run[j].y][run[j].x] = 1;
      }
    }
  }

  return {
    dungeon,
    rooms: reordered,
    roomGraph: remappedGraph
  };
}
