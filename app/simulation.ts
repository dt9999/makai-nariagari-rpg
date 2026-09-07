type Position = { x: number; y: number };

/** Reused local buckets; ordering ties match the original stable nearest sort. */
export class NearbyIndex<T extends Position> {
  private buckets = new Map<string, T[]>();
  private pool: T[][] = [];
  private locations = new Map<T, string>();
  private order = new Map<T, number>();
  private cellSize: number;
  constructor(cellSize = 512) {
    this.cellSize = cellSize;
  }

  private key(point: Position) {
    return `${Math.floor(point.x / this.cellSize)},${Math.floor(point.y / this.cellSize)}`;
  }

  rebuild(items: readonly T[], include: (item: T) => boolean) {
    for (const bucket of this.buckets.values()) {
      bucket.length = 0;
      this.pool.push(bucket);
    }
    this.buckets.clear();
    this.locations.clear();
    this.order.clear();
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!include(item)) continue;
      this.order.set(item, i);
      this.insert(item, this.key(item));
    }
  }

  private insert(item: T, key: string) {
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = this.pool.pop() ?? [];
      this.buckets.set(key, bucket);
    }
    bucket.push(item);
    this.locations.set(item, key);
  }

  moved(item: T) {
    const previous = this.locations.get(item);
    if (previous === undefined) return;
    const next = this.key(item);
    if (next === previous) return;
    const bucket = this.buckets.get(previous)!;
    bucket.splice(bucket.indexOf(item), 1);
    if (!bucket.length) {
      this.buckets.delete(previous);
      this.pool.push(bucket);
    }
    this.insert(item, next);
  }

  nearest(
    point: Position,
    radius: number,
    include: (item: T) => boolean,
  ): T | undefined {
    let best: T | undefined;
    let squared = radius * radius;
    for (
      let x = Math.floor((point.x - radius) / this.cellSize);
      x <= Math.floor((point.x + radius) / this.cellSize);
      x++
    ) {
      for (
        let y = Math.floor((point.y - radius) / this.cellSize);
        y <= Math.floor((point.y + radius) / this.cellSize);
        y++
      ) {
        const bucket = this.buckets.get(`${x},${y}`);
        if (!bucket) continue;
        for (const item of bucket) {
          if (!include(item)) continue;
          const distance = (item.x - point.x) ** 2 + (item.y - point.y) ** 2;
          if (
            distance < squared ||
            (distance === squared &&
              (!best || this.order.get(item)! < this.order.get(best)!))
          ) {
            best = item;
            squared = distance;
          }
        }
      }
    }
    return best;
  }
}

type Actor = Position & {
  id: number;
  ally?: boolean;
  attackAnim?: number;
  hitAnim?: number;
};

/** Only invisible, idle hostile patrols may use coarse simulation. Combat and workers never do. */
export class PatrolClock {
  private pending = new WeakMap<Actor, { elapsed: number; interval: number }>();
  step(actor: Actor, player: Position, dt: number) {
    if (
      actor.ally ||
      (actor.attackAnim ?? 0) > 0 ||
      (actor.hitAnim ?? 0) > 0 ||
      (actor.x - player.x) ** 2 + (actor.y - player.y) ** 2 <= 2400 ** 2
    ) {
      this.pending.delete(actor);
      return dt;
    }
    let state = this.pending.get(actor);
    if (!state) {
      state = { elapsed: 0, interval: 0.25 - ((actor.id * 37) % 15) / 60 };
      this.pending.set(actor, state);
    }
    state.elapsed += dt;
    if (state.elapsed < state.interval) return 0;
    const accumulated = state.elapsed;
    state.elapsed = 0;
    state.interval = 0.25;
    return Math.min(accumulated, 0.29);
  }
}
