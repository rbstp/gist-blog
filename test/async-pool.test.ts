import assert from 'node:assert';
import { describe, it } from 'node:test';
import { setTimeout as sleep } from 'node:timers/promises';
import { mapWithConcurrency } from '../src/lib/AsyncPool.ts';

describe('mapWithConcurrency', () => {
  it('preserves result order by index regardless of completion order', async () => {
    const items = [30, 5, 20, 1, 15];
    const results = await mapWithConcurrency(items, async (n) => {
      await sleep(n); // later items may finish first
      return n * 2;
    }, 3);
    assert.deepStrictEqual(results, [60, 10, 40, 2, 30]);
  });

  it('never exceeds the concurrency cap', async () => {
    let active = 0;
    let peak = 0;
    await mapWithConcurrency(Array.from({ length: 20 }, (_, i) => i), async () => {
      active += 1;
      peak = Math.max(peak, active);
      await sleep(2);
      active -= 1;
      return null;
    }, 4);
    assert.ok(peak <= 4, `peak concurrency ${peak} should be <= 4`);
    assert.ok(peak >= 2, `peak concurrency ${peak} should actually parallelize`);
  });

  it('maps worker errors to null and keeps other results', async () => {
    const results = await mapWithConcurrency([1, 2, 3, 4], async (n) => {
      if (n % 2 === 0) throw new Error(`boom ${n}`);
      return n;
    }, 2);
    assert.deepStrictEqual(results, [1, null, 3, null]);
  });

  it('returns an empty array for empty input (zero workers)', async () => {
    let called = false;
    const results = await mapWithConcurrency([], async () => { called = true; return 1; }, 5);
    assert.deepStrictEqual(results, []);
    assert.strictEqual(called, false);
  });

  it('still processes all items when concurrency <= 0 (clamped to 1)', async () => {
    const results = await mapWithConcurrency([1, 2, 3], async (n) => n + 1, 0);
    assert.deepStrictEqual(results, [2, 3, 4]);
  });
});
