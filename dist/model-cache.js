// Pending loads are shared; active leases are never evicted.
export function createModelCache(load, dispose, limit = 3) {
  const assets = new Map();
  let clock = 0;
  function trim() {
    const unused = [...assets.values()].filter((entry) => entry.root && !entry.users)
      .sort((a, b) => a.used - b.used);
    while (assets.size > limit && unused.length) {
      const entry = unused.shift();
      assets.delete(entry.url);
      dispose(entry.root);
    }
  }
  return async function acquire(url) {
    let entry = assets.get(url);
    if (!entry) {
      entry = { url, users: 0, used: ++clock, root: null };
      assets.set(url, entry);
      entry.promise = Promise.resolve().then(() => load(url)).then((root) => {
        entry.root = root;
        return root;
      }).catch((error) => {
        assets.delete(url);
        throw error;
      });
    }
    entry.users++;
    try {
      const root = await entry.promise;
      let released = false;
      trim();
      return { root, release() {
        if (released) return;
        released = true;
        entry.users--;
        entry.used = ++clock;
        trim();
      } };
    } catch (error) {
      entry.users--;
      throw error;
    }
  };
}
