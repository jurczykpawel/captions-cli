/**
 * Pill — solid coloured pill background behind the active word. Base
 * keeps identical padding/margins so the line never reflows.
 */
import type { HfPresetBuilder } from '../types';

export const buildPillPreset: HfPresetBuilder = ({ fontColor, highlightColor, upcomingColor }) => {
  const upcoming = upcomingColor ?? fontColor;
  return {
    css: `
#captions .word {
  display: inline-block;
  margin-right: 0.25em;
  padding: 0.16em 0.4em;
  border-radius: 0.4em;
  background-color: transparent;
  color: ${upcoming};
  will-change: background-color, color;
}
#captions .word--past { color: ${fontColor}; }
#captions .word--active {
  background-color: ${highlightColor};
  color: ${fontColor};
}
`.trim(),
  };
};
