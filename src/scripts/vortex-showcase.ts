type Experiment = { id: string; title: string; src: string; poster: string; treatment: string; scale: number };
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

document.querySelectorAll<HTMLElement>("[data-vortex]").forEach((root) => {
  const experiments: Experiment[] = JSON.parse(root.dataset.experiments ?? "[]");
  if (experiments.length < 2) return;
  const slots = [...root.querySelectorAll<HTMLElement>("[data-slot]")];
  const title = root.querySelector<HTMLElement>("[data-experiment-title]")!;
  const counter = root.querySelector<HTMLElement>("[data-experiment-counter]")!;
  const roll = root.querySelector<HTMLButtonElement>("[data-experiment-roll]")!;
  const toggle = root.querySelector<HTMLButtonElement>("[data-experiment-toggle]")!;
  const status = root.querySelector<HTMLElement>("[data-experiment-status]")!;
  const saveData = Boolean((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData);
  let current = 0;
  let activeSlot = 0;
  let visible = false;
  let busy = false;
  let userPaused = false;
  let manualPlayback = false;
  let disposed = false;
  let initializing = true;
  const videoAt = (index: number) => slots[index].querySelector<HTMLVideoElement>("video")!;
  root.querySelector<HTMLElement>("[data-experiment-controls]")!.hidden = false;

  function syncButton() {
    const playing = !videoAt(activeSlot).paused;
    toggle.setAttribute("aria-label", playing ? "暂停实验影像" : "播放实验影像");
    toggle.innerHTML = `<span aria-hidden="true">${playing ? "Ⅱ" : "▷"}</span>`;
    root.dataset.playback = playing ? "playing" : "paused";
  }
  function updatePlayback() {
    const video = videoAt(activeSlot);
    const allowed = !initializing && visible && !document.hidden && !userPaused && (manualPlayback || (!reducedMotion.matches && !saveData));
    slots.forEach((_, index) => { if (index !== activeSlot) videoAt(index).pause(); });
    if (!allowed) { video.pause(); syncButton(); return; }
    if (!video.getAttribute("src")) {
      video.src = experiments[current].src;
      video.load();
    }
    video.play().catch(() => { if (!disposed) syncButton(); });
    syncButton();
  }
  slots.forEach((slot, index) => {
    const video = videoAt(index);
    video.muted = true;
    video.addEventListener("loadeddata", () => {
      if (index === activeSlot && video.readyState >= 2) slot.classList.add("has-frame");
    });
    video.addEventListener("play", syncButton);
    video.addEventListener("pause", syncButton);
    video.addEventListener("error", () => { slot.classList.remove("has-frame"); syncButton(); });
  });

  async function select(next: number, initial = false) {
    if (busy || disposed || next === current) return;
    busy = true;
    roll.disabled = true;
    root.setAttribute("aria-busy", "true");
    status.textContent = "";
    const experiment = experiments[next];
    const incoming = 1 - activeSlot;
    const slot = slots[incoming];
    const poster = slot.querySelector<HTMLImageElement>("img")!;
    try {
      poster.src = experiment.poster;
      await Promise.race([poster.decode(), new Promise((_, reject) => setTimeout(() => reject(new Error("poster timeout")), 8000))]);
      if (disposed) return;
      slot.dataset.treatment = experiment.treatment;
      slot.style.setProperty("--experiment-scale", String(experiment.scale));
      slot.classList.remove("has-frame");
      const previous = activeSlot;
      const video = videoAt(incoming);
      video.setAttribute("aria-label", `${experiment.title}，预渲染流体实验影像`);
      videoAt(previous).pause();
      current = next;
      activeSlot = incoming;
      root.dataset.experiment = experiment.id;
      slot.removeAttribute("aria-hidden");
      slots[previous].setAttribute("aria-hidden", "true");
      title.textContent = experiment.title;
      counter.textContent = `${String(next + 1).padStart(2, "0")} / ${String(experiments.length).padStart(2, "0")}`;
      slot.classList.add("is-active");
      slots[previous].classList.remove("is-active");
      updatePlayback();
      if (!reducedMotion.matches && !initial) await new Promise(resolve => setTimeout(resolve, 420));
      const oldVideo = videoAt(previous);
      oldVideo.removeAttribute("src");
      oldVideo.load();
      slots[previous].classList.remove("has-frame");
    } catch {
      status.textContent = "影像暂时无法载入，请稍后再试。";
    } finally {
      busy = false;
      roll.disabled = false;
      root.removeAttribute("aria-busy");
      syncButton();
    }
  }
  roll.addEventListener("click", () => {
    const offset = 1 + Math.floor(Math.random() * (experiments.length - 1));
    void select((current + offset) % experiments.length);
  });
  toggle.addEventListener("click", () => {
    userPaused = !videoAt(activeSlot).paused;
    manualPlayback = !userPaused;
    updatePlayback();
  });
  const observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    updatePlayback();
  }, { threshold: .1 });
  observer.observe(root);
  const motionChange = () => { manualPlayback = false; updatePlayback(); };
  document.addEventListener("visibilitychange", updatePlayback);
  reducedMotion.addEventListener("change", motionChange);
  document.addEventListener("astro:before-swap", () => {
    disposed = true;
    observer.disconnect();
    slots.forEach((_, index) => videoAt(index).pause());
    document.removeEventListener("visibilitychange", updatePlayback);
    reducedMotion.removeEventListener("change", motionChange);
  }, { once: true });
  void select(Math.floor(Math.random() * experiments.length), true).finally(() => {
    initializing = false;
    updatePlayback();
  });
  syncButton();
});

