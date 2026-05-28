/**
 * Paper Cutout (Typed) — same paper sticker as `paper-cutout`, plus a
 * per-letter typewriter reveal inside each word. We split each `.word`
 * into `.char` spans on the timeline pass, then fade each char's
 * opacity 0 → 1 sequentially along its parent word's audio window.
 *
 * Per-char timing: `wordMs / chars`, clamped to 30-80 ms.
 */
import type { HfPresetBuilder } from '../types';

export const buildPaperCutoutTypedPreset: HfPresetBuilder = () => ({
  css: `
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
  white-space: nowrap;
}
#captions .word:last-child { margin-right: 0; }
#captions .char {
  display: inline-block;
  opacity: 0;
}
#captions > [id^="cue-"]:nth-of-type(4n+1) .caption-pill { transform: rotate(-2deg); }
#captions > [id^="cue-"]:nth-of-type(4n+2) .caption-pill { transform: rotate( 2deg); }
#captions > [id^="cue-"]:nth-of-type(4n+3) .caption-pill { transform: rotate(-3deg); }
#captions > [id^="cue-"]:nth-of-type(4n+4) .caption-pill { transform: rotate( 3deg); }
`.trim(),
  timelineJs: `
// Split words into per-char spans + paper intro tween + per-char fades.
cuesData.forEach(function(cue, cueIdx) {
  // Paper intro.
  var paperSel = '#cue-' + cueIdx + ' .caption-pill';
  var t = (cue.words && cue.words[0] && cue.words[0].startTime) || 0;
  tl.fromTo(paperSel,
    { scale: 0.92, y: -6 },
    { scale: 1, y: 0, duration: 0.25, ease: 'back.out(2)' },
    t
  );

  (cue.words || []).forEach(function(w, wIdx) {
    var wordEl = document.getElementById('cue-' + cueIdx + '-w-' + wIdx);
    if (!wordEl) return;
    var text = wordEl.textContent;
    wordEl.textContent = '';
    var charSels = [];
    Array.from(text).forEach(function(ch, ci) {
      var span = document.createElement('span');
      span.className = 'char';
      span.textContent = ch;
      span.id = 'cue-' + cueIdx + '-w-' + wIdx + '-c-' + ci;
      wordEl.appendChild(span);
      charSels.push('#' + span.id);
    });
    var wordMs = Math.max(60, (w.endTime - w.startTime) * 1000);
    var perCharMs = Math.min(80, Math.max(30, wordMs / charSels.length));
    charSels.forEach(function(sel, i) {
      tl.to(sel, { opacity: 1, duration: 0.04, ease: 'none' }, w.startTime + (i * perCharMs / 1000));
    });
  });
});
`.trim(),
});
