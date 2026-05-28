/**
 * Hormozi — colour swap + scale 1.15 on the active word. The classic
 * Alex-Hormozi look: white line with a single accent-coloured word
 * pulled forward.
 */
import type { HfPresetBuilder } from '../types';

export const buildHormoziPreset: HfPresetBuilder = ({
  fontColor,
  highlightColor,
  upcomingColor,
}) => {
  const upcoming = upcomingColor ?? fontColor;
  return {
    css: `
#captions .word {
  display: inline-block;
  margin-right: 0.25em;
  transform-origin: center bottom;
  color: ${upcoming};
  will-change: transform, color;
}
#captions .word--past { color: ${fontColor}; }
#captions .word--active { color: ${highlightColor}; }
`.trim(),
    timelineJs: `
cuesData.forEach((cue, cueIdx) => {
  (cue.words || []).forEach((w, wIdx) => {
    var sel = '#cue-' + cueIdx + '-w-' + wIdx;
    tl.fromTo(sel, { scale: 1.0 }, { scale: 1.15, duration: 0.1, ease: 'back.out(2)' }, w.startTime);
    tl.to(sel, { scale: 1.0, duration: 0.1, ease: 'power1.out' }, w.endTime - 0.05);
  });
});
`.trim(),
  };
};
