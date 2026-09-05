/**
 * Seamless cloud rolling loop.
 *
 * The original cloud artwork is never redrawn or restyled. Two exact clones
 * move in phase and cross-blend at the wrap point so a non-tileable source can
 * reset without a visible jump. Wrapper-only opacity/transform changes are
 * used; the clone contents remain untouched.
 */
export function installCloudLoop(sourceLayer, options = {}) {
  if (!sourceLayer) throw new Error('Cloud layer not found.');
  if (sourceLayer.dataset.cloudLoopInstalled === 'true') {
    return sourceLayer.__cloudLoopController || null;
  }

  const {
    duration = 72000,
    direction = -1,
    verticalDrift = 1.5,
    verticalCycles = 2,
    travelPercent = 18,
    crossfadeFraction = 0.12
  } = options;

  if (!Number.isFinite(duration) || duration < 1000) throw new RangeError('duration must be at least 1000 ms');
  if (!Number.isFinite(verticalDrift) || Math.abs(verticalDrift) > 50) throw new RangeError('verticalDrift is out of range');
  if (!Number.isFinite(verticalCycles) || verticalCycles < 0 || verticalCycles > 16) throw new RangeError('verticalCycles is out of range');
  if (!Number.isFinite(travelPercent) || travelPercent <= 0 || travelPercent > 100) throw new RangeError('travelPercent must be in (0, 100]');

  const parent = sourceLayer.parentElement;
  if (!parent) throw new Error('Cloud layer needs a parent element.');

  const originalParentPosition = parent.style.position;
  const originalParentOverflow = parent.style.overflow;
  const originalVisibility = sourceLayer.style.visibility;

  if (getComputedStyle(parent).position === 'static') parent.style.position = 'relative';
  parent.style.overflow = 'hidden';

  const host = document.createElement('div');
  host.className = 'cloud-loop-host';
  host.setAttribute('aria-hidden', 'true');

  function makeCopy(className) {
    const wrapper = document.createElement('div');
    wrapper.className = `cloud-loop-copy ${className}`;
    const copy = sourceLayer.cloneNode(true);
    copy.removeAttribute('id');
    copy.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
    copy.style.position = 'absolute';
    copy.style.inset = '0';
    copy.style.width = '100%';
    copy.style.height = '100%';
    copy.style.pointerEvents = 'none';
    copy.style.visibility = 'visible';
    copy.dataset.cloudLoopClone = 'true';
    wrapper.append(copy);
    return wrapper;
  }

  const copyA = makeCopy('cloud-loop-a');
  const copyB = makeCopy('cloud-loop-b');
  host.append(copyA, copyB);
  parent.append(host);

  sourceLayer.style.visibility = 'hidden';
  sourceLayer.dataset.cloudLoopInstalled = 'true';

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let raf = 0;
  let startedAt = performance.now();
  let pausedAt = null;
  const fade = Math.max(0.02, Math.min(0.45, crossfadeFraction));
  const sign = direction < 0 ? -1 : 1;

  const smoothstep = x => x * x * (3 - 2 * x);
  function opacityFor(phase) {
    if (phase < 1 - fade) return 1;
    return 1 - smoothstep((phase - (1 - fade)) / fade);
  }

  function apply(wrapper, phase) {
    const x = sign * travelPercent * phase;
    const y = Math.sin(phase * Math.PI * 2 * verticalCycles) * verticalDrift;
    wrapper.style.transform = `translate3d(${x.toFixed(4)}%, ${y.toFixed(3)}px, 0)`;
    wrapper.style.opacity = opacityFor(phase).toFixed(4);
  }

  function frame(now) {
    if (pausedAt !== null) return;
    if (reducedMotion.matches) {
      copyA.style.transform = 'translate3d(0,0,0)';
      copyA.style.opacity = '1';
      copyB.style.opacity = '0';
      raf = requestAnimationFrame(frame);
      return;
    }
    const p = ((now - startedAt) % duration) / duration;
    apply(copyA, p);
    apply(copyB, (p + 0.5) % 1);
    // Whichever clone is nearer its reset is below the other clone.
    copyA.style.zIndex = p > 0.5 ? '0' : '1';
    copyB.style.zIndex = p > 0.5 ? '1' : '0';
    raf = requestAnimationFrame(frame);
  }

  const controller = {
    destroy() {
      cancelAnimationFrame(raf);
      host.remove();
      sourceLayer.style.visibility = originalVisibility;
      delete sourceLayer.dataset.cloudLoopInstalled;
      delete sourceLayer.__cloudLoopController;
      parent.style.position = originalParentPosition;
      parent.style.overflow = originalParentOverflow;
    },
    restart() {
      startedAt = performance.now();
      pausedAt = null;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(frame);
    },
    pause() {
      if (pausedAt !== null) return;
      pausedAt = performance.now();
      cancelAnimationFrame(raf);
    },
    play() {
      if (pausedAt === null) return;
      startedAt += performance.now() - pausedAt;
      pausedAt = null;
      raf = requestAnimationFrame(frame);
    }
  };

  sourceLayer.__cloudLoopController = controller;
  raf = requestAnimationFrame(frame);
  return controller;
}
