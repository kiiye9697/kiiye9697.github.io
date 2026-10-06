const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
document.querySelectorAll<HTMLElement>("[data-glass-showcase]").forEach((root) => {
  const cabinet = root.querySelector<HTMLElement>(".glass-cabinet")!;
  const panels = [...root.querySelectorAll<HTMLElement>(".glass-panel")];
  const tabs = [...root.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
  const dialog = root.querySelector<HTMLDialogElement>("dialog")!;
  const art = root.querySelector<HTMLElement>(".glass-dialog-art")!;
  const closeButton = root.querySelector<HTMLButtonElement>(".glass-close")!;
  let selected = 0, rotation = 0, closing = false;
  let opener: HTMLButtonElement | null = null;
  let oldOverflow = "";
  let savedScroll = { x: 0, y: 0 };
  let expansion: Animation | undefined;
  root.classList.add("is-ready");
  root.style.setProperty("--panel-angle", (360 / panels.length) + "deg");
  root.querySelector<HTMLElement>(".glass-controls")!.hidden = false;
  function select(index: number, focus = false) {
    const next = (index + panels.length) % panels.length;
    let delta = next - selected;
    if (delta > panels.length / 2) delta -= panels.length;
    if (delta < -panels.length / 2) delta += panels.length;
    rotation -= delta * (360 / panels.length);
    selected = next;
    cabinet.style.transform = "translateX(var(--cabinet-offset)) translateZ(-210px) rotateY(" + (rotation - 15) + "deg)";
    panels.forEach((panel, i) => {
      panel.classList.toggle("is-selected", i === selected);
      panel.setAttribute("role", "tabpanel");
      panel.setAttribute("aria-hidden", String(i !== selected));
      panel.setAttribute("aria-labelledby", "glass-tab-" + i);
      panel.querySelector("button")!.tabIndex = i === selected ? 0 : -1;
      tabs[i].setAttribute("aria-selected", String(i === selected));
      tabs[i].tabIndex = i === selected ? 0 : -1;
    });
    if (focus) tabs[selected].focus();
  }
  tabs.forEach((tab, i) => {
    tab.addEventListener("click", () => select(i));
    tab.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      select(event.key === "Home" ? 0 : event.key === "End" ? panels.length - 1 : selected + (event.key === "ArrowRight" ? 1 : -1), true);
    });
  });
  root.querySelector(".glass-prev")!.addEventListener("click", () => select(selected - 1));
  root.querySelector(".glass-next")!.addEventListener("click", () => select(selected + 1));
  function cardTransform() {
    const from = opener!.getBoundingClientRect(), to = dialog.getBoundingClientRect();
    return "translate(" + (from.x + from.width / 2 - to.x - to.width / 2) + "px," + (from.y + from.height / 2 - to.y - to.height / 2) + "px) scale(" + from.width / to.width + "," + from.height / to.height + ")";
  }
  async function close() {
    if (closing || !dialog.open) return;
    closing = true;
    const currentTransform = getComputedStyle(dialog).transform;
    expansion?.cancel();
    art.querySelector("video")?.pause();
    if (!reduced.matches) await dialog.animate([{ transform: currentTransform, opacity: 1 }, { transform: cardTransform(), opacity: 0 }], { duration: 260, easing: "cubic-bezier(.4,0,.7,.2)" }).finished.catch(() => {});
    dialog.close();
  }
  panels.forEach((panel, i) => {
    panel.querySelector<HTMLButtonElement>("button")!.addEventListener("click", (event) => {
      if (i !== selected) { select(i); return; }
      opener = event.currentTarget as HTMLButtonElement;
      root.querySelector("#glass-dialog-title")!.textContent = panel.querySelector("strong")!.textContent;
      root.querySelector(".glass-dialog-tag")!.textContent = "RESERVED / 预留展位";
      root.querySelector(".glass-dialog-description")!.textContent = "待收录。此处为预留展位，线稿仅作为主题示意。";
      art.replaceChildren();
      art.append(panel.querySelector("svg")!.cloneNode(true));
      savedScroll = { x: window.scrollX, y: window.scrollY };
      oldOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      dialog.showModal();
      if (!reduced.matches) expansion = dialog.animate([{ transform: cardTransform(), opacity: .15 }, { transform: "none", opacity: 1 }], { duration: 420, easing: "cubic-bezier(.16,1,.3,1)" });
      closeButton.focus({ preventScroll: true });
    });
  });
  closeButton.addEventListener("click", close);
  dialog.addEventListener("cancel", (event) => { event.preventDefault(); close(); });
  dialog.addEventListener("click", (event) => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close();
  });
  dialog.addEventListener("close", () => {
    art.querySelector("video")?.pause();
    document.body.style.overflow = oldOverflow;
    closing = false;
    opener?.focus({ preventScroll: true });
    window.scrollTo({ left: savedScroll.x, top: savedScroll.y, behavior: "instant" });
  });
  let startX = 0, startY = 0;
  const stage = root.querySelector<HTMLElement>(".glass-stage")!;
  stage.addEventListener("touchstart", (e) => { startX = e.touches[0].clientX; startY = e.touches[0].clientY; }, { passive: true });
  stage.addEventListener("touchend", (e) => {
    const dx = e.changedTouches[0].clientX - startX, dy = e.changedTouches[0].clientY - startY;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) select(selected + (dx < 0 ? 1 : -1));
  }, { passive: true });
  select(0);
});

