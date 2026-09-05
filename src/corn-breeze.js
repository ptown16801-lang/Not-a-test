/**
 * Subtle corn breeze animation.
 * Applies only wrapper transforms; it never changes corn artwork, color, or texture.
 */
export function installCornBreeze(elements, options = {}) {
  const stalks = Array.from(elements || []).filter(Boolean);
  if (!stalks.length) return { destroy() {}, pause() {}, play() {} };

  const {
    amplitudeDeg = 1.1,
    liftPx = 0.7,
    minDurationMs = 3600,
    maxDurationMs = 6200,
    phaseSpreadMs = 2200,
    seed = 2026
  } = options;

  if (!Number.isFinite(amplitudeDeg) || amplitudeDeg < 0 || amplitudeDeg > 8) throw new RangeError('amplitudeDeg must be between 0 and 8');
  if (!Number.isFinite(liftPx) || Math.abs(liftPx) > 8) throw new RangeError('liftPx is out of range');

  let state = (seed >>> 0) || 1;
  const random = () => { let x=state; x^=x<<13; x^=x>>>17; x^=x<<5; state=x>>>0; return state/4294967296; };
  const controllers = [];
  const originals = stalks.map(el => ({
    el,
    transform: el.style.transform,
    transformOrigin: el.style.transformOrigin,
    willChange: el.style.willChange
  }));

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  for (const item of originals) {
    const el = item.el;
    if (reduced) continue;
    el.style.transformOrigin = el.style.transformOrigin || '50% 100%';
    el.style.willChange = 'transform';

    const duration = minDurationMs + random() * Math.max(0, maxDurationMs - minDurationMs);
    const delay = -random() * phaseSpreadMs;
    const dir = random() < 0.5 ? -1 : 1;
    const a = amplitudeDeg * (0.55 + random() * 0.45) * dir;
    const b = -a * (0.55 + random() * 0.35);
    const lift = liftPx * (0.45 + random() * 0.55);

    const animation = el.animate([
      { transform: `${item.transform || ''} rotate(0deg) translateY(0px)`.trim(), offset: 0 },
      { transform: `${item.transform || ''} rotate(${a.toFixed(3)}deg) translateY(${-lift.toFixed(3)}px)`.trim(), offset: 0.28 },
      { transform: `${item.transform || ''} rotate(${b.toFixed(3)}deg) translateY(${(lift*0.35).toFixed(3)}px)`.trim(), offset: 0.63 },
      { transform: `${item.transform || ''} rotate(0deg) translateY(0px)`.trim(), offset: 1 }
    ], { duration, delay, iterations: Infinity, easing: 'ease-in-out' });
    controllers.push(animation);
  }

  return {
    pause() { controllers.forEach(a => a.pause()); },
    play() { controllers.forEach(a => a.play()); },
    destroy() {
      controllers.forEach(a => a.cancel());
      originals.forEach(({el,transform,transformOrigin,willChange}) => {
        el.style.transform = transform;
        el.style.transformOrigin = transformOrigin;
        el.style.willChange = willChange;
      });
    }
  };
}

/** Convenience helper for DOM scenes. */
export function installCornBreezeFrom(root=document, selector='[data-corn-stalk], .corn-stalk', options={}) {
  return installCornBreeze(root.querySelectorAll(selector), options);
}
