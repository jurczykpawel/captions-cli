/**
 * Browser caption renderer. Ports packages/engine-hf/src/composition/captions.html
 * to run natively in the page: builds the cue/word DOM, a GSAP timeline for cue
 * fades + per-word state classes, then executes the HF preset's own css +
 * timelineJs verbatim. The preset code is reused 1:1 — only the host differs
 * (real browser here vs headless Chromium in the CLI).
 *
 * The stage is an intrinsic-size (frameWidth x frameHeight) element so the
 * preset's px-based CSS renders at composition scale; callers scale it down
 * with a CSS transform for preview, or rasterize it at full size for export.
 */
import { gsap } from 'gsap';
import type { Cue, PresetInput } from '@captions-cli/core/pure';
import type { HfPresetBuilder } from '@captions-cli/engine-hf';

export interface CaptionStageOptions {
  /** Element the stage is mounted into (required so GSAP selectors resolve). */
  parent: HTMLElement;
  cues: Cue[];
  /** HF preset builder, e.g. PRESETS[slug] from @captions-cli/engine-hf/presets. */
  build: HfPresetBuilder;
  preset: PresetInput;
  width: number;
  height: number;
  /** Vertical caption position, percent from top (matches CLI --position). */
  captionTopPercent: number;
}

export interface CaptionStage {
  /** Intrinsic-size element holding #captions. Overlay or rasterize this. */
  stage: HTMLElement;
  timeline: gsap.core.Timeline;
  duration: number;
  /** Move the playhead to time t (seconds) without playing. */
  seek(t: number): void;
  destroy(): void;
}

function baseCss(o: {
  fontSize: number;
  fontColor: string;
  captionTopPercent: number;
}): string {
  return `
.cap-stage { background: transparent; }
.cap-stage #captions {
  position: absolute;
  left: 0;
  right: 0;
  top: ${o.captionTopPercent}%;
  padding: 0 80px;
  text-align: center;
  font-size: ${o.fontSize}px;
  font-weight: 800;
  line-height: 1.2;
  color: ${o.fontColor};
  font-family: 'Inter', -apple-system, system-ui, sans-serif;
  pointer-events: none;
}
.cap-stage #captions .caption-pill {
  display: inline-block;
  background-color: rgba(0, 0, 0, 0.7);
  padding: 18px 28px;
  border-radius: 18px;
}`.trim();
}

export function buildCaptionStage(opts: CaptionStageOptions): CaptionStage {
  const { parent, cues, build, preset, width, height, captionTopPercent } = opts;
  const block = build(preset);

  const stage = document.createElement('div');
  stage.className = 'cap-stage';
  stage.style.cssText = `position:relative;width:${width}px;height:${height}px;overflow:hidden;`;

  const style = document.createElement('style');
  style.textContent =
    baseCss({ fontSize: preset.fontSize, fontColor: preset.fontColor, captionTopPercent }) +
    '\n' +
    block.css;
  stage.appendChild(style);

  const captionsEl = document.createElement('div');
  captionsEl.id = 'captions';
  stage.appendChild(captionsEl);

  // Mount BEFORE building the timeline so GSAP selector strings (used by both
  // the base timeline and the preset's timelineJs) resolve against live nodes.
  parent.appendChild(stage);

  const tl = gsap.timeline({ paused: true });

  cues.forEach((cue, cueIdx) => {
    const words = cue.words ?? [];
    if (words.length === 0) return;

    const wrap = document.createElement('span');
    wrap.id = `cue-${cueIdx}`;
    wrap.style.opacity = '0';
    wrap.style.position = 'absolute';
    wrap.style.left = '0';
    wrap.style.right = '0';

    const pill = document.createElement('span');
    pill.className = 'caption-pill';
    pill.id = `cue-${cueIdx}-pill`;

    words.forEach((w, wIdx) => {
      const span = document.createElement('span');
      span.className = 'word word--upcoming';
      span.id = `cue-${cueIdx}-w-${wIdx}`;
      span.textContent = w.text;
      pill.appendChild(span);
    });
    wrap.appendChild(pill);
    captionsEl.appendChild(wrap);

    const cueStart = words[0].startTime;
    const cueEnd = words[words.length - 1].endTime;
    tl.to(`#cue-${cueIdx}`, { opacity: 1, duration: 0.18 }, cueStart);
    tl.to(`#cue-${cueIdx}`, { opacity: 0, duration: 0.15 }, cueEnd);

    words.forEach((w, wIdx) => {
      const sel = `#cue-${cueIdx}-w-${wIdx}`;
      tl.set(sel, { attr: { class: 'word word--active' } }, w.startTime);
      tl.set(sel, { attr: { class: 'word word--past' } }, w.endTime);
    });
  });

  if (block.timelineJs) {
    try {
      // Same contract as captions.html: the preset script gets `tl`, `cuesData`,
      // `gsap`, `document` in scope.
      const run = new Function('tl', 'cuesData', 'gsap', 'document', block.timelineJs);
      run(tl, cues, gsap, document);
    } catch (err) {
      console.error('caption preset timelineJs error', err);
    }
  }

  return {
    stage,
    timeline: tl,
    duration: tl.duration(),
    seek(t: number) {
      tl.seek(t, false);
    },
    destroy() {
      tl.kill();
      stage.remove();
    },
  };
}
