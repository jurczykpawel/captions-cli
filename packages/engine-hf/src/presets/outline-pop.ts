/**
 * Outline Pop — Submagic-style burned-in look. Heavy black 8-direction
 * outline on every word, uppercase, bold weight. Three-state karaoke:
 * past = fontColor, active = highlightColor, upcoming = upcomingColor.
 * Drops the default pill background; the outline is the structure.
 */
import type { HfPresetBuilder } from '../types';

const OUTLINE_SHADOW = [
  '-5px -5px 0 #000',
  '0 -5px 0 #000',
  '5px -5px 0 #000',
  '5px 0 0 #000',
  '5px 5px 0 #000',
  '0 5px 0 #000',
  '-5px 5px 0 #000',
  '-5px 0 0 #000',
].join(',');

export const buildOutlinePopPreset: HfPresetBuilder = ({
  fontColor,
  highlightColor,
  upcomingColor,
}) => {
  const upcoming = upcomingColor ?? '#8E8E9C';
  return {
    css: `
#captions .caption-pill {
  background-color: transparent;
  padding: 0;
}
#captions {
  text-shadow: none;
}
#captions .word {
  display: inline-block;
  margin-right: 0.25em;
  text-transform: uppercase;
  font-weight: 900;
  letter-spacing: 0.02em;
  text-shadow: ${OUTLINE_SHADOW};
  color: ${upcoming};
  will-change: color;
}
#captions .word--past { color: ${fontColor}; }
#captions .word--active { color: ${highlightColor}; }
`.trim(),
  };
};
