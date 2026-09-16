const reduced = matchMedia("(prefers-reduced-motion: reduce)");
const targets = document.querySelectorAll("[data-enter]");
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.08 },
);
if (!reduced.matches)
  targets.forEach((target) => {
    target.classList.add("will-enter");
    observer.observe(target);
  });
const progress = document.querySelector<HTMLElement>(".reading-progress");
const photo = document.querySelector<HTMLElement>(".matchday-photo");
let queued = false;
const render = () => {
  const height = document.documentElement.scrollHeight - innerHeight;
  if (progress)
    progress.style.transform = `scaleX(${height > 0 ? scrollY / height : 0})`;
  if (photo)
    photo.style.transform = reduced.matches
      ? "none"
      : `translateY(${Math.min(scrollY, innerHeight) * 0.06}px)`;
  queued = false;
};
addEventListener(
  "scroll",
  () => {
    if (!queued) {
      queued = true;
      requestAnimationFrame(render);
    }
  },
  { passive: true },
);
addEventListener("resize", render);
reduced.addEventListener("change", () => {
  if (reduced.matches) targets.forEach((t) => t.classList.add("is-visible"));
  render();
});
render();
