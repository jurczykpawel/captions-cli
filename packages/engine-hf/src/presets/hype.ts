/**
 * Hype (HF) — dramatic UPPERCASE condensed white with hollow → solid
 * state transitions. Mirror of the ASS `hype` preset: upcoming words
 * render as outline-only via `-webkit-text-stroke` + `color: transparent`,
 * active + past words flip to solid white. Active also scales 1.15.
 */
import type { HfPresetBuilder } from '../types';

export const buildHypePreset: HfPresetBuilder = () => ({
  css: `
#captions .caption-pill {
  background: transparent !important;
  padding: 0 !important;
  border-radius: 0 !important;
}
#captions {
  font-family: 'Inter', system-ui, sans-serif;
  font-weight: 900;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}
/* Upcoming = ghost letters (semi-transparent white, lighter weight).
   Real hollow via -webkit-text-stroke turned out unworkable in HF: at
   the runtime font size, any stroke thick enough to read fills the
   inside of the glyph into a solid blob; thinner strokes are invisible.
   Ghost letters give the same "not yet spoken" cue without the CSS
   sub-pixel limits. ASS hype keeps real hollow because libass renders
   strokes natively. */
#captions .word {
  display: inline-block;
  margin-right: 0.25em;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.4);
  will-change: color, transform;
}
#captions .word:last-child { margin-right: 0; }
#captions .word--past,
#captions .word--active {
  font-weight: 900;
  color: #ffffff;
}
`.trim(),
  // Active scale bounce, same shape as hormozi (back.out into 1.15, ease back).
  timelineJs: `
cuesData.forEach(function(cue, cueIdx) {
  (cue.words || []).forEach(function(w, wIdx) {
    var sel = '#cue-' + cueIdx + '-w-' + wIdx;
    tl.fromTo(sel, { scale: 1.0 }, { scale: 1.15, duration: 0.1, ease: 'back.out(2)' }, w.startTime);
    tl.to(sel, { scale: 1.0, duration: 0.1, ease: 'power1.out' }, w.endTime - 0.05);
  });
});
`.trim(),
});
