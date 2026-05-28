/**
 * Box Highlight — translucent background + left-border accent on the
 * active word. Reads well on busy footage where pure colour swaps lose
 * contrast.
 */
import type { HfPresetBuilder } from '../types';

export const buildBoxHighlightPreset: HfPresetBuilder = ({
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
  padding: 2px 6px;
  border-radius: 4px;
  background-color: transparent;
  border-left: 3px solid transparent;
  color: ${upcoming};
  will-change: background-color, border-left-color, color;
}
#captions .word--past { color: ${fontColor}; }
#captions .word--active {
  color: ${fontColor};
  background-color: ${highlightColor}55;
  border-left-color: ${highlightColor};
}
`.trim(),
  };
};
