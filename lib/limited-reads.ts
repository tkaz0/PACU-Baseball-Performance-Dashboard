/** One request-local queue shared by paginated readers. Never caches data across requests. */
export function createReadLimiter(limit: number) {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 4) throw new Error("Invalid read concurrency.");
  let active = 0;
  const waiting: Array<() => void> = [];
  return async function read<T>(request: () => PromiseLike<T>): Promise<T> {
    await new Promise<void>(resolve => {
      const start = () => { active++; resolve(); };
      if (active < limit) start(); else waiting.push(start);
    });
    try { return await request(); }
    finally { active--; waiting.shift()?.(); }
  };
}
