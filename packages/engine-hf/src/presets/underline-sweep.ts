/**
 * Underline Sweep — 4px accent underline on the active word, every
 * word reserves a transparent border so toggling doesn't lift the line.
 */
import type { HfPresetBuilder } from '../types';

export const buildUnderlineSweepPreset: HfPresetBuilder = ({
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
  border-bottom: 4px solid transparent;
  padding-bottom: 2px;
  color: ${upcoming};
  will-change: border-bottom-color, color;
}
#captions .word--past { color: ${fontColor}; }
#captions .word--active {
  color: ${highlightColor};
  border-bottom-color: ${highlightColor};
}
`.trim(),
  };
};
