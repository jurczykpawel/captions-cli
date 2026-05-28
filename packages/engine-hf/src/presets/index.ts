/**
 * Caption preset registry. Statically-imported builders — registered
 * by name. The CLI looks up by the `--preset` flag and falls back to
 * `text` when the slug is unknown.
 */
import type { HfPresetBuilder } from '../types';
import { buildTextPreset } from './text';
import { buildOutlinePopPreset } from './outline-pop';
import { buildHormoziPreset } from './hormozi';
import { buildPopWordPreset } from './pop-word';
import { buildPillPreset } from './pill';
import { buildGlowPreset } from './glow';
import { buildUnderlineSweepPreset } from './underline-sweep';
import { buildBoxHighlightPreset } from './box-highlight';
import { buildSingleWordPreset } from './single-word';
import { buildPaperCutoutPreset } from './paper-cutout';
import { buildPaperCutoutTypedPreset } from './paper-cutout-typed';
import { buildHypePreset } from './hype';

export const PRESETS: Record<string, HfPresetBuilder> = {
  text: buildTextPreset,
  'outline-pop': buildOutlinePopPreset,
  hormozi: buildHormoziPreset,
  'pop-word': buildPopWordPreset,
  pill: buildPillPreset,
  glow: buildGlowPreset,
  'underline-sweep': buildUnderlineSweepPreset,
  'box-highlight': buildBoxHighlightPreset,
  'single-word': buildSingleWordPreset,
  'paper-cutout': buildPaperCutoutPreset,
  'paper-cutout-typed': buildPaperCutoutTypedPreset,
  hype: buildHypePreset,
};

export const PRESET_DESCRIPTIONS: Record<string, string> = {
  text: 'Plain colour swap on active word. Baseline.',
  'outline-pop': 'Heavy black outline + uppercase. Submagic-style.',
  hormozi: 'Colour swap + scale 1.15 on active. Alex-Hormozi look.',
  'pop-word': 'Bounce only, no colour change. Reads on any background.',
  pill: 'Solid coloured pill behind active word.',
  glow: 'Text-shadow halo on active word.',
  'underline-sweep': '4px accent underline on active word.',
  'box-highlight': 'Translucent bg + left-border accent. Good for busy footage.',
  'single-word': 'One word at a time, others hidden. Submagic-style.',
  'paper-cutout': 'Off-white paper sticker per cue, torn edges, drop shadow, slight tilt. Magazine collage.',
  'paper-cutout-typed': 'Paper sticker + per-letter typewriter reveal inside each word.',
  hype: 'Dramatic UPPERCASE condensed white. Upcoming hollow, active solid + scaled, past solid.',
};

export function listPresets(): string[] {
  return Object.keys(PRESETS).sort();
}
