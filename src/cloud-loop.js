/**
 * Seamless cloud rolling loop.
 *
 * The cloud artwork itself is never redrawn or modified. The existing layer
 * is duplicated and only wrapper transforms are animated so the wrap point
 * is pixel-identical to the start of the loop.
 */
export function installCloudLoop(sourceLayer, options = {}) {
  if (!sourceLayer) throw new Error("Cloud layer not found.");

  const {
    duration = 72000,
    direction = -1,
    verticalDrift = 1.5,
    verticalCycles = 2
  } = options;

  const parent = sourceLayer.parentElement;
  if (!parent) throw new Error("Cloud layer needs a parent element.");
  if (sourceLayer.dataset.cloudLoopInstalled === "true") return;

  if (getComputedStyle(parent).position === "static") {
    parent.style.position = "relative";
  }
  parent.style.overflow = "hidden";

  const track = document.createElement("div");
  track.className = "cloud-loop-track";
  track.setAttribute("aria-hidden", "true");

  const copyA = sourceLayer.cloneNode(true);
  const copyB = sourceLayer.cloneNode(true);

  sourceLayer.style.visibility = "hidden";
  sourceLayer.dataset.cloudLoopInstalled = "true";

  for (const copy of [copyA, copyB]) {
    copy.removeAttribute("id");
    copy.querySelectorAll("[id]").forEach((el) => el.removeAttribute("id"));
    copy.style.position = "relative";
    copy.style.inset = "auto";
    copy.style.flex = "0 0 50%";
    copy.style.width = "50%";
    copy.style.height = "100%";
    copy.style.pointerEvents = "none";
    copy.style.visibility = "visible";
    copy.dataset.cloudLoopClone = "true";
  }

  track.append(copyA, copyB);
  parent.append(track);

  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const startX = direction < 0 ? 0 : -50;
  const endX = direction < 0 ? -50 : 0;

  let raf = 0;
  let startedAt = performance.now();

  function frame(now) {
    if (reducedMotion.matches) {
      track.style.transform = "translate3d(0, 0, 0)";
      raf = requestAnimationFrame(frame);
      return;
    }

    const p = ((now - startedAt) % duration) / duration;
    const x = startX + (endX - startX) * p;
    const y = Math.sin(p * Math.PI * 2 * verticalCycles) * verticalDrift;
    track.style.transform = `translate3d(${x}%, ${y.toFixed(3)}px, 0)`;
    raf = requestAnimationFrame(frame);
  }

  raf = requestAnimationFrame(frame);

  return {
    destroy() {
      cancelAnimationFrame(raf);
      track.remove();
      sourceLayer.style.visibility = "";
      delete sourceLayer.dataset.cloudLoopInstalled;
    },
    restart() {
      startedAt = performance.now();
    }
  };
}
