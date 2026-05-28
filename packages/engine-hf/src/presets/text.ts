/**
 * Text — the free baseline. Plain white subtitles on the default black pill,
 * no per-word highlight and no word-timing colour change. Deliberately plain:
 * it shows the tool works; the paid styles add the karaoke flair.
 */
import type { HfPresetBuilder, HfPresetDefinition } from '../types';

export const buildTextPreset: HfPresetBuilder = () => ({
  css: `
#captions .word {
  display: inline-block;
  margin-right: 0.25em;
  color: #ffffff;
}
`.trim(),
});

export const definition: HfPresetDefinition = {
  slug: 'text',
  tier: 'free',
  description: 'Plain white subtitles, no word-timing highlight. Free demo.',
  build: buildTextPreset,
};
