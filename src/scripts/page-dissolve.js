(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  addEventListener('pagereveal', async (event) => {
    const transition = event.viewTransition;
    if (!transition) return;
    if (reduced.matches) { transition.skipTransition(); return; }
    const root = document.documentElement;
    const skip = () => transition.skipTransition();
    let animation;
    reduced.addEventListener('change', skip, { once: true });
    try {
      const seed = Number(root.dataset.worldSeed) >>> 0;
      const random = (index) => {
        let n = Math.imul(index + 1, 374761393) ^ seed;
        n = Math.imul(n ^ (n >>> 13), 1274126177);
        return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
      };
      // Solve the x coordinate of cubic-bezier(.76, 0, .24, 1).
      // Timing is then edited like film: two seeded holds followed by catch-up cuts.
      const bezier = (time) => {
        let low = 0, high = 1;
        for (let i = 0; i < 14; i++) {
          const t = (low + high) / 2, inv = 1 - t;
          const x = 3 * inv * inv * t * .76 + 3 * inv * t * t * .24 + t * t * t;
          if (x < time) low = t; else high = t;
        }
        const t = (low + high) / 2;
        return 3 * (1 - t) * t * t + t * t * t;
      };
      // Alpha only: the browser supplies both actual page snapshots.
      const width = 640;
      const height = Math.max(1, Math.round(width * innerHeight / innerWidth));
      const lanes = 9;
      const direction = random(30) > .5 ? 1 : -1;
      const holds = [9 + Math.floor(random(31) * 5), 23 + Math.floor(random(32) * 5)];
      const offsets = Array.from({ length: lanes }, (_, i) => (random(i) - .5) * .27);
      const frames = [];
      for (let step = 0; step <= 40; step++) {
        const held = holds.find((start) => step > start && step <= start + 2);
        const edited = held === undefined ? step : held;
        const progress = step === 0 ? 0 : step === 40 ? 1 : bezier(edited / 40);
        const polygons = [];
        for (let lane = 0; lane < lanes; lane++) {
          const top = Math.floor(lane * height / lanes);
          const bottom = Math.ceil((lane + 1) * height / lanes);
          // Coherent, staggered shutters with a slight diagonal leading edge.
          const cut = progress === 0 ? 0 : progress === 1 ? 1 :
            Math.max(0, Math.min(1, progress * 1.4 - .2 + offsets[lane]));
          const x = cut * width;
          const bevel = Math.sin(cut * Math.PI) * 12;
          polygons.push(`<polygon points="${x + bevel},${top} ${width},${top} ${width},${bottom} ${x - bevel},${bottom}"/>`);
        }
        const mirror = direction < 0 ? `transform="translate(${width} 0) scale(-1 1)"` : '';
        const mask = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><g fill="black" ${mirror}>${polygons.join('')}</g></svg>`;
        frames.push({
          maskImage: `url("data:image/svg+xml,${encodeURIComponent(mask)}")`,
          transform: `translateX(${direction * -14 * progress}px) scale(${1 + .012 * progress})`,
          offset: step / 40,
          easing: 'steps(1, end)',
        });
      }
      await transition.ready;
      root.dataset.transition = 'film-cut';
      animation = root.animate(frames, {
        duration: 720, fill: 'forwards', pseudoElement: '::view-transition-old(root)',
      });
      await transition.finished;
    } catch {
      transition.skipTransition();
    } finally {
      animation?.cancel();
      delete root.dataset.transition;
      reduced.removeEventListener('change', skip);
    }
  });
})();
