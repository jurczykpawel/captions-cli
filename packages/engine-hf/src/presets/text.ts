/**
 * Text — baseline word-level karaoke. Plain colour swap on the active
 * word, no decoration. Free; works on any background.
 */
import type { HfPresetBuilder, HfPresetDefinition } from '../types';

export const buildTextPreset: HfPresetBuilder = ({ fontColor, highlightColor, upcomingColor }) => {
  const upcoming = upcomingColor ?? fontColor;
  return {
    css: `
#captions .word {
  display: inline-block;
  margin-right: 0.25em;
  color: ${upcoming};
  will-change: color;
}
#captions .word--past { color: ${fontColor}; }
#captions .word--active { color: ${highlightColor}; }
`.trim(),
  };
};

export const definition: HfPresetDefinition = {
  slug: 'text',
  tier: 'free',
  description: 'Plain colour swap on active word. Baseline.',
  build: buildTextPreset,
};
