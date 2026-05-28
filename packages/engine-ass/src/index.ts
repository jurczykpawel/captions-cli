/**
 * ASS engine. ffmpeg + libass — pure C/C++, no browser. Renders
 * 5-10× faster than the HF engine and ships in a ~200 MB Docker
 * image (no Chromium). Trades some CSS niceties (filter blur, 3-D
 * transforms) for size and speed.
 */
import type { CaptionEngine, EngineRenderInput } from '@captions-cli/core';
import { renderCaptions } from './render';
import {
  PRESETS,
  PRESET_DESCRIPTIONS,
  DEFINITIONS,
  tierForPreset,
  presetsByTier,
  listPresets,
} from './presets';

export const assEngine: CaptionEngine = {
  id: 'ass',
  description: 'ffmpeg + libass. Tiny image, ~5x faster than HF, slight visual fidelity tradeoffs.',
  listPresets,
  presetDescriptions: () => PRESET_DESCRIPTIONS,
  async render(input: EngineRenderInput): Promise<void> {
    if (!PRESETS[input.preset]) {
      throw new Error(
        `Unknown ASS preset "${input.preset}". Available: ${listPresets().join(', ')}`,
      );
    }
    await renderCaptions(input);
  },
};

export type {
  AssPresetBuilder,
  AssPresetBlock,
  AssPresetDefinition,
  AssPresetTier,
  WordState,
} from './types';
export {
  PRESETS as ASS_PRESETS,
  PRESET_DESCRIPTIONS as ASS_PRESET_DESCRIPTIONS,
  DEFINITIONS as ASS_PRESET_DEFINITIONS,
  tierForPreset as assTierForPreset,
  presetsByTier as assPresetsByTier,
};
