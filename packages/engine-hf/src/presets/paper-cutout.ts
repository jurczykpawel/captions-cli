/**
 * Paper Cutout (HF) — magazine collage style. Each cue renders inside
 * an off-white paper sticker with drop shadow + small tilt. Per-letter
 * typewriter is in `paper-cutout-typed`.
 *
 * Implementation notes:
 *   - The HF template ships every cue's words inside `.caption-pill`
 *     (the default rounded-black bg). We override `.caption-pill` so it
 *     becomes the paper sticker — no DOM rewriting needed.
 *   - Tilt cycles -2°, +2°, -3°, +3° via `:nth-of-type` on the cue
 *     wrapper so each new cue picks up a different angle.
 *   - Rough/torn edges deliberately omitted — earlier attempt with
 *     `<feDisplacementMap>` made the whole composition render blank
 *     (likely an interaction with hyperframes' SVG sandbox). The plain
 *     rectangle still reads as "paper sticker" thanks to the off-white
 *     bg + drop shadow + tilt.
 */
import type { HfPresetBuilder } from '../types';

export const buildPaperCutoutPreset: HfPresetBuilder = () => ({
  css: `
/* Override the global rounded-black pill into a paper sticker. */
#captions .caption-pill {
  background: #f5f1e8 !important;
  background-image:
    radial-gradient(circle at 50% 50%, rgba(0,0,0,0.05) 1px, transparent 2px) !important;
  background-size: 8px 8px !important;
  padding: 18px 32px !important;
  border-radius: 2px !important;
  filter: drop-shadow(2px 4px 8px rgba(0,0,0,0.45));
  font-family: 'Inter', system-ui, sans-serif;
  font-weight: 900;
  font-stretch: condensed;
  letter-spacing: -0.01em;
}
#captions .word {
  color: #0a0a0a;
  display: inline-block;
  margin-right: 0.18em;
}
#captions .word:last-child { margin-right: 0; }
/* Per-cue tilt — cycles four angles so consecutive cues don't all match. */
#captions > [id^="cue-"]:nth-of-type(4n+1) .caption-pill { transform: rotate(-2deg); }
#captions > [id^="cue-"]:nth-of-type(4n+2) .caption-pill { transform: rotate( 2deg); }
#captions > [id^="cue-"]:nth-of-type(4n+3) .caption-pill { transform: rotate(-3deg); }
#captions > [id^="cue-"]:nth-of-type(4n+4) .caption-pill { transform: rotate( 3deg); }
`.trim(),
  // Tiny scale-in on the paper at cue start so it feels "stuck on".
  // The default cue opacity fade in/out from the template still applies.
  timelineJs: `
cuesData.forEach(function(cue, cueIdx) {
  var sel = '#cue-' + cueIdx + ' .caption-pill';
  var t = (cue.words && cue.words[0] && cue.words[0].startTime) || 0;
  tl.fromTo(sel,
    { scale: 0.92, y: -6 },
    { scale: 1, y: 0, duration: 0.25, ease: 'back.out(2)' },
    t
  );
});
`.trim(),
});
