/* ---------- UI scale and the narrow shell layout ---------- */
// Options -> UI scale zooms document.body, which media queries don't see, so
// the shell decides "narrow" from the zoomed layout width instead.

export const NARROW_BELOW = 900;

// Fired on window whenever the UI scale (body zoom) changes.
export const UI_SCALE_EVENT = 'ui-scale-changed';

export function isNarrow(innerWidth, zoom) {
  const z = Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
  return innerWidth / z < NARROW_BELOW;
}

export function currentZoom() {
  return parseFloat(getComputedStyle(document.body).zoom) || parseFloat(document.body.style.zoom) || 1;
}

export function isNarrowNow() {
  return isNarrow(window.innerWidth, currentZoom());
}
