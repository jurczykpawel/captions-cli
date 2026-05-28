/**
 * Clean White — FREE pack baseline. Bold white, 8 px black outline,
 * multi-word per cue, no per-word highlight, no animation. The "always
 * works" choice — readable on any background, never distracting.
 *
 * Default Style does the entire job; wordTag is a no-op.
 */
import type { AssPresetBuilder, AssPresetDefinition } from '../types';
import { hexToAss } from '../ass-helpers';

export const buildCleanWhitePreset: AssPresetBuilder = ({
  fontColor,
  fontSize,
}) => ({
  style: [
    'Default',
    'Inter',
    String(fontSize),
    hexToAss(fontColor),            // PrimaryColour — every word, every state
    hexToAss(fontColor),
    hexToAss('#000000'),            // OutlineColour
    '&H80000000',
    '-1',                           // Bold
    '0', '0', '0',
    '100', '100', '0', '0',
    '1',                            // BorderStyle 1 = outline + drop-shadow
    '8',                            // Heavy outline so it reads on any bg
    '0',                            // No shadow — keep it clean
    '2', '40', '40', '400', '1',
  ].join(','),
  wordTag: () => '',
});

export const definition: AssPresetDefinition = {
  slug: 'clean-white',
  tier: 'free',
  description: 'Bold white + heavy black outline. Multi-word, no animation. Default.',
  build: buildCleanWhitePreset,
};
