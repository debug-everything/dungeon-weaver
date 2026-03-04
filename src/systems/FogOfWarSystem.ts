export type TileVisibility = 'hidden' | 'explored' | 'visible';

export class FogOfWarSystem {
  private grid: TileVisibility[][];
  private width: number;
  private height: number;
  private visibilityRadius: number;
  private dungeon: number[][];
  private lastPlayerTileX: number = -1;
  private lastPlayerTileY: number = -1;

  // Multipliers for the 8 octants in recursive shadowcasting.
  // Each row: [xx, xy, yx, yy] transforms (col, row) → (dx, dy):
  //   mapX = cx + col * xx + row * yx
  //   mapY = cy + col * xy + row * yy
  private static MULT: number[][] = [
    [ 1,  0,  0,  1],
    [ 0,  1,  1,  0],
    [ 0, -1,  1,  0],
    [-1,  0,  0,  1],
    [-1,  0,  0, -1],
    [ 0, -1, -1,  0],
    [ 0,  1, -1,  0],
    [ 1,  0,  0, -1],
  ];

  constructor(width: number, height: number, visibilityRadius: number, dungeon: number[][]) {
    this.width = width;
    this.height = height;
    this.visibilityRadius = visibilityRadius;
    this.dungeon = dungeon;

    this.grid = [];
    for (let y = 0; y < height; y++) {
      this.grid[y] = [];
      for (let x = 0; x < width; x++) {
        this.grid[y][x] = 'hidden';
      }
    }
  }

  update(playerTileX: number, playerTileY: number): boolean {
    if (playerTileX === this.lastPlayerTileX && playerTileY === this.lastPlayerTileY) {
      return false;
    }
    this.lastPlayerTileX = playerTileX;
    this.lastPlayerTileY = playerTileY;

    // Mark all currently visible tiles as explored
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.grid[y][x] === 'visible') {
          this.grid[y][x] = 'explored';
        }
      }
    }

    // Player tile is always visible
    this.grid[playerTileY][playerTileX] = 'visible';

    // Recursive shadowcasting in 8 octants
    for (let oct = 0; oct < 8; oct++) {
      const m = FogOfWarSystem.MULT[oct];
      this.castLight(playerTileX, playerTileY, 1, 1.0, 0.0, m[0], m[1], m[2], m[3]);
    }

    return true;
  }

  /**
   * Recursive shadowcasting for one octant.
   * Scans row by row outward from the player, tracking visible angular range
   * via start/end slopes. Walls narrow the visible range; open cells behind
   * walls are hidden.
   */
  private castLight(
    cx: number, cy: number,
    row: number,
    startSlope: number, endSlope: number,
    xx: number, xy: number, yx: number, yy: number
  ): void {
    if (startSlope < endSlope) return;

    let nextStartSlope = startSlope;

    for (let j = row; j <= this.visibilityRadius; j++) {
      let dx = -j - 1;
      const dy = -j;
      let blocked = false;

      while (dx <= 0) {
        dx++;

        // Transform octant-local (dx, dy) to map coordinates
        const mapX = cx + dx * xx + dy * yx;
        const mapY = cy + dx * xy + dy * yy;

        // Slopes for left and right edges of this cell
        const leftSlope = (dx - 0.5) / (dy + 0.5);
        const rightSlope = (dx + 0.5) / (dy - 0.5);

        if (startSlope < rightSlope) continue;
        if (endSlope > leftSlope) break;

        // Mark visible if within square radius (Chebyshev distance)
        if (Math.abs(dx) <= this.visibilityRadius && Math.abs(dy) <= this.visibilityRadius) {
          if (mapX >= 0 && mapX < this.width && mapY >= 0 && mapY < this.height) {
            this.grid[mapY][mapX] = 'visible';
          }
        }

        const wall = this.isWall(mapX, mapY);

        if (blocked) {
          if (wall) {
            nextStartSlope = rightSlope;
          } else {
            blocked = false;
            startSlope = nextStartSlope;
          }
        } else if (wall) {
          if (j < this.visibilityRadius) {
            blocked = true;
            this.castLight(cx, cy, j + 1, startSlope, leftSlope, xx, xy, yx, yy);
            nextStartSlope = rightSlope;
          }
        }
      }

      if (blocked) break;
    }
  }

  private isWall(x: number, y: number): boolean {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return true;
    const tile = this.dungeon[y][x];
    return tile === 1 || tile === 2 || tile === 4; // walls, closed doors, and locked doors block vision
  }

  forceRecalculate(): void {
    this.lastPlayerTileX = -1;
    this.lastPlayerTileY = -1;
  }

  /** Reveal the entire map (debug). Sets all non-wall floor tiles to visible. */
  revealAll(): void {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.dungeon[y][x] !== 1) {
          this.grid[y][x] = 'visible';
        }
      }
    }
  }

  isVisible(x: number, y: number): boolean {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return false;
    return this.grid[y][x] === 'visible';
  }

  isExplored(x: number, y: number): boolean {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return false;
    return this.grid[y][x] === 'explored';
  }

  getVisibility(x: number, y: number): TileVisibility {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return 'hidden';
    return this.grid[y][x];
  }

  getVisibilityGrid(): TileVisibility[][] {
    return this.grid;
  }

  /**
   * Bresenham line-of-sight check between two tile coordinates.
   * Returns true if no wall/closed-door tile blocks the path.
   * Endpoints are not checked (so standing on a door tile is fine).
   */
  hasLineOfSight(x0: number, y0: number, x1: number, y1: number): boolean {
    let dx = Math.abs(x1 - x0);
    let dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;

    let cx = x0;
    let cy = y0;

    while (cx !== x1 || cy !== y1) {
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        cx += sx;
      }
      if (e2 < dx) {
        err += dx;
        cy += sy;
      }

      // Don't check the final endpoint
      if (cx === x1 && cy === y1) break;

      if (this.isWall(cx, cy)) return false;
    }
    return true;
  }

  /** World-space line-of-sight: converts pixel coords to tiles, then checks */
  hasLineOfSightWorld(
    x0: number, y0: number,
    x1: number, y1: number,
    scaledTile: number
  ): boolean {
    const tx0 = Math.floor(x0 / scaledTile);
    const ty0 = Math.floor(y0 / scaledTile);
    const tx1 = Math.floor(x1 / scaledTile);
    const ty1 = Math.floor(y1 / scaledTile);
    return this.hasLineOfSight(tx0, ty0, tx1, ty1);
  }
}
