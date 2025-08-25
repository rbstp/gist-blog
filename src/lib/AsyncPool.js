async function mapWithConcurrency(items, worker, concurrency) {
  const results = new Array(items.length);
  let index = 0;
  let active = 0;
  return new Promise((resolve) => {
    function next() {
      if (index >= items.length && active === 0) return resolve(results);
      while (active < concurrency && index < items.length) {
        const cur = index++;
        active++;
        Promise.resolve(worker(items[cur], cur))
          .then((res) => {
            results[cur] = res;
          })
          .catch((err) => {
            console.error('Worker error:', err?.message || err);
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

module.exports = { mapWithConcurrency };
