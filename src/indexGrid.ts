/**
 * Uniform grid for radius searches.
 *
 * Cell size must be at least the search radius. Any point within that radius
 * then lies in the query cell or one of the eight neighbors, so a 3×3 visit
 * is a superset of the brute-force hits. Callers still apply the exact
 * distance test; this only drops points that cannot qualify.
 */

const KEY_STRIDE = 1_000_003;

function cellKey(cx: number, cy: number): number {
  return cx * KEY_STRIDE + cy;
}

/** Lower score wins. Equal scores keep the smaller index, matching an in-order scan. */
export function betterRank(
  score: number,
  index: number,
  otherScore: number,
  otherIndex: number,
): boolean {
  if (otherIndex < 0) return true;
  if (score < otherScore) return true;
  if (score > otherScore) return false;
  return index < otherIndex;
}

export class IndexGrid {
  private cell = 1;
  private readonly buckets = new Map<number, number[]>();
  private readonly pool: number[][] = [];
  private poolUsed = 0;

  begin(cellSize: number): void {
    this.cell = cellSize > 0 && Number.isFinite(cellSize) ? cellSize : 1;
    this.buckets.clear();
    this.poolUsed = 0;
  }

  add(index: number, x: number, y: number): void {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const cx = Math.floor(x / this.cell);
    const cy = Math.floor(y / this.cell);
    this.bucket(cx, cy).push(index);
  }

  /**
   * Visit indexes that might lie within `cell` of (x, y).
   * Return false from `fn` to stop.
   */
  visit(x: number, y: number, fn: (index: number) => boolean | void): void {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const cx = Math.floor(x / this.cell);
    const cy = Math.floor(y / this.cell);
    for (let oy = -1; oy <= 1; oy++) {
      for (let ox = -1; ox <= 1; ox++) {
        const bucket = this.buckets.get(cellKey(cx + ox, cy + oy));
        if (!bucket) continue;
        for (let i = 0; i < bucket.length; i++) {
          const index = bucket[i];
          if (index === undefined) continue;
          if (fn(index) === false) return;
        }
      }
    }
  }

  private bucket(cx: number, cy: number): number[] {
    const key = cellKey(cx, cy);
    const existing = this.buckets.get(key);
    if (existing) return existing;
    let list = this.pool[this.poolUsed];
    if (!list) {
      list = [];
      this.pool[this.poolUsed] = list;
    }
    list.length = 0;
    this.poolUsed++;
    this.buckets.set(key, list);
    return list;
  }
}
