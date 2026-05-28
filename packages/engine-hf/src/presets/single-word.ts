/**
 * Single Word — Submagic-style; only the currently active word is
 * visible, others hidden. Pairs naturally with `outline-pop` styling
 * (apply via separate preset/customisation if desired).
 */
import type { HfPresetBuilder } from '../types';

export const buildSingleWordPreset: HfPresetBuilder = ({ fontColor, highlightColor }) => ({
  css: `
#captions .word {
  display: none;
  margin-right: 0;
  color: ${fontColor};
  font-weight: 800;
  will-change: opacity, color, transform;
}
#captions .word--active {
  display: inline-block;
  color: ${highlightColor};
}
`.trim(),
  timelineJs: `
cuesData.forEach((cue, cueIdx) => {
  (cue.words || []).forEach((w, wIdx) => {
    var sel = '#cue-' + cueIdx + '-w-' + wIdx;
    tl.fromTo(sel, { scale: 0.85, opacity: 0 }, { scale: 1.0, opacity: 1, duration: 0.12, ease: 'back.out(2)' }, w.startTime);
  });
});
`.trim(),
});
