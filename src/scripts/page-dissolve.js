(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  addEventListener('pagereveal', async (event) => {
    const transition = event.viewTransition;
    if (!transition) return;
    if (reduced.matches) { transition.skipTransition(); return; }
    const root = document.documentElement;
    const skip = () => transition.skipTransition();
    reduced.addEventListener('change', skip, { once: true });
    try {
      const seed = Number(root.dataset.worldSeed) >>> 0;
      const hash = (x, y) => {
        let n = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ seed;
        n = Math.imul(n ^ (n >>> 13), 1274126177);
        return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
      };
      const noise = (x, y) => {
        const ix = Math.floor(x), iy = Math.floor(y);
        let u = x - ix, v = y - iy;
        u = u * u * (3 - 2 * u); v = v * v * (3 - 2 * v);
        const a = hash(ix, iy), b = hash(ix + 1, iy);
        const c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
        return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
      };
      // Only alpha is generated. Both visible images are native page snapshots.
      const canvas = document.createElement('canvas');
      canvas.width = Math.min(240, Math.ceil(innerWidth / 6));
      canvas.height = Math.max(1, Math.round(canvas.width * innerHeight / innerWidth));
      const ctx = canvas.getContext('2d');
      if (!ctx) { skip(); return; }
      const pixels = ctx.createImageData(canvas.width, canvas.height);
      const field = [];
      for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
          const u = x / 28, v = y / 28;
          field.push(noise(u, v) * .55 + noise(u * 2, v * 2) * .25 + hash(x, y) * .2);
        }
      }
      // Rank thresholds so the dissolve advances evenly rather than stalling at its ends.
      const order = field.map((value, i) => ({ value, i })).sort((a, b) => a.value - b.value);
      const ranks = new Float32Array(field.length);
      order.forEach(({ i }, rank) => { ranks[i] = (rank + .5) / field.length; });
      const frames = [];
      for (let step = 0; step <= 24; step++) {
        for (let i = 0; i < ranks.length; i++) {
          pixels.data[i * 4 + 3] = ranks[i] >= step / 24 ? 255 : 0;
        }
        ctx.putImageData(pixels, 0, 0);
        frames.push({ maskImage: `url("${canvas.toDataURL()}")`, offset: step / 24, easing: 'steps(1, end)' });
      }
      await transition.ready;
      root.dataset.transition = 'dissolve';
      root.animate(frames, { duration: 620, fill: 'forwards', pseudoElement: '::view-transition-old(root)' });
      await transition.finished;
    } catch {
      transition.skipTransition();
    } finally {
      delete root.dataset.transition;
      reduced.removeEventListener('change', skip);
    }
  });
})();
