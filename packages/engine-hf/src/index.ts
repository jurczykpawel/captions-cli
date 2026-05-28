/**
 * Hyperframes engine. HTML+CSS+GSAP rendered through headless Chromium
 * via the `hyperframes` CLI. Heavier image (chromium ~600 MB), but
 * supports the full CSS palette including filters, transforms, etc.
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

export const hfEngine: CaptionEngine = {
  id: 'hf',
  description:
    'Hyperframes (HTML+CSS+GSAP via headless Chromium). Full CSS power, larger image.',
  listPresets,
  presetDescriptions: () => PRESET_DESCRIPTIONS,
  async render(input: EngineRenderInput): Promise<void> {
    if (!PRESETS[input.preset]) {
      throw new Error(
        `Unknown HF preset "${input.preset}". Available: ${listPresets().join(', ')}`,
      );
    }
    await renderCaptions(input);
  },
};

export type {
  HfPresetBuilder,
  HfPresetBlock,
  HfPresetDefinition,
  HfPresetTier,
} from './types';
export {
  PRESETS as HF_PRESETS,
  PRESET_DESCRIPTIONS as HF_PRESET_DESCRIPTIONS,
  DEFINITIONS as HF_PRESET_DEFINITIONS,
  tierForPreset as hfTierForPreset,
  presetsByTier as hfPresetsByTier,
};
