/**
 * Pop Word — colour-agnostic bounce on the active word (1.08x scale).
 * No colour swap; the word stays the same hue throughout. Differentiates
 * from hormozi (which DOES recolour).
 */
import type { HfPresetBuilder } from '../types';

export const buildPopWordPreset: HfPresetBuilder = ({ fontColor }) => ({
  css: `
#captions .word {
  display: inline-block;
  margin-right: 0.25em;
  transform-origin: center bottom;
  color: ${fontColor};
  will-change: transform;
}
#captions .word--past,
#captions .word--upcoming,
#captions .word--active {
  color: ${fontColor};
}
`.trim(),
  timelineJs: `
cuesData.forEach((cue, cueIdx) => {
  (cue.words || []).forEach((w, wIdx) => {
    var sel = '#cue-' + cueIdx + '-w-' + wIdx;
    tl.fromTo(sel, { scale: 1.0 }, { scale: 1.08, duration: 0.12, ease: 'back.out(2)' }, w.startTime);
    tl.to(sel, { scale: 1.0, duration: 0.12, ease: 'power1.out' }, w.endTime - 0.05);
  });
});
`.trim(),
});
