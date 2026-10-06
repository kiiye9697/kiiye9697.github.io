// Event-driven lighting; ambient CSS motion sleeps outside the viewport.
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const finePointer = matchMedia("(hover: hover) and (pointer: fine)");
const scenes = document.querySelectorAll<HTMLElement>("[data-ambient]");
const visible = new Set<Element>();
const sync = () =>
  scenes.forEach((scene) => {
    scene.classList.toggle(
      "is-sleeping",
      document.hidden || reducedMotion.matches || !visible.has(scene),
    );
  });
const sceneObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) =>
      entry.isIntersecting
        ? visible.add(entry.target)
        : visible.delete(entry.target),
    );
    sync();
  },
  { rootMargin: "80px" },
);
scenes.forEach((scene) => {
  scene.classList.add("is-sleeping");
  sceneObserver.observe(scene);
});
document.addEventListener("visibilitychange", sync);
reducedMotion.addEventListener("change", sync);
document
  .querySelectorAll<HTMLElement>("[data-prism], [data-glass]")
  .forEach((surface) => {
    let frame = 0;
    let x = 0.5;
    let y = 0.5;
    const reset = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      surface.style.removeProperty("--tilt-x");
      surface.style.removeProperty("--tilt-y");
      surface.style.removeProperty("--light-x");
      surface.style.removeProperty("--light-y");
    };
    surface.addEventListener("pointermove", (event) => {
      if (reducedMotion.matches || !finePointer.matches || document.hidden)
        return;
      const bounds = surface.getBoundingClientRect();
      x = (event.clientX - bounds.left) / bounds.width;
      y = (event.clientY - bounds.top) / bounds.height;
      if (!frame)
        frame = requestAnimationFrame(() => {
          surface.style.setProperty("--tilt-x", `${(0.5 - y) * 12}deg`);
          surface.style.setProperty("--tilt-y", `${(x - 0.5) * 16}deg`);
          surface.style.setProperty("--light-x", `${x * 100}%`);
          surface.style.setProperty("--light-y", `${y * 100}%`);
          frame = 0;
        });
    });
    surface.addEventListener("pointerleave", reset);
    reducedMotion.addEventListener("change", reset);
    finePointer.addEventListener("change", reset);
  });
