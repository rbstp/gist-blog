export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  worker: (item: T, index: number) => R | Promise<R>,
  concurrency: number,
): Promise<(R | null)[]> {
  const results: (R | null)[] = new Array(items.length);
  let cursor = 0;

  // Each worker pulls the next item from a shared cursor until the list is drained.
  // Clamp to [1, items.length] so concurrency <= 0 can't silently drop work and an
  // empty list yields zero workers (→ []).
  const workerCount = Math.min(Math.max(1, concurrency), items.length);

  const run = async (): Promise<void> => {
    while (cursor < items.length) {
      const i = cursor++;
      try {
        results[i] = await worker(items[i] as T, i);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('Worker error:', message);
        results[i] = null;
      }
    }
  };

  await Promise.all(Array.from({ length: workerCount }, run));
  return results;
}
