export function mapWithConcurrency<T, R>(
  items: readonly T[],
  worker: (item: T, index: number) => R | Promise<R>,
  concurrency: number,
): Promise<(R | null)[]> {
  const results: (R | null)[] = new Array(items.length);
  let index = 0;
  let active = 0;
  return new Promise((resolve) => {
    function next(): void {
      if (index >= items.length && active === 0) return resolve(results);
      while (active < concurrency && index < items.length) {
        const cur = index++;
        active++;
        Promise.resolve(worker(items[cur] as T, cur))
          .then((res) => {
            results[cur] = res;
          })
          .catch((err: unknown) => {
            const message = err instanceof Error ? err.message : String(err);
            console.error('Worker error:', message);
            results[cur] = null;
          })
          .finally(() => {
            active--;
            next();
          });
      }
    }
    next();
  });
}
