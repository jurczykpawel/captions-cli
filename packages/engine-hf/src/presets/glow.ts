/**
 * Glow — text-shadow halo on the active word. No box-size change,
 * always layout-stable.
 */
import type { HfPresetBuilder } from '../types';

export const buildGlowPreset: HfPresetBuilder = ({ fontColor, highlightColor, upcomingColor }) => {
  const upcoming = upcomingColor ?? fontColor;
  return {
    css: `
#captions .word {
  display: inline-block;
  margin-right: 0.25em;
  color: ${upcoming};
  will-change: color, text-shadow;
}
#captions .word--past { color: ${fontColor}; }
#captions .word--active {
  color: ${highlightColor};
  text-shadow:
    0 0 12px ${highlightColor},
    0 0 24px ${highlightColor}88,
    0 0 48px ${highlightColor}44;
}
`.trim(),
  };
};
