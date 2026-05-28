/**
 * HF-specific preset types. Each preset emits CSS rules for `.word`
 * state classes (`--past`, `--active`, `--upcoming`) plus optional
 * GSAP timeline tweens.
 */
import type { PresetInput } from '@captions-cli/core';

/**
 * What an HF preset emits. The CSS is wrapped by the dispatcher in a
 * runtime `<script>` injector (Hyperframes strips literal `<style>`
 * tags from the composition body — running JS that appends a `<style>`
 * element to `<head>` survives the strip).
 */
export interface HfPresetBlock {
  css: string;
  /** Optional GSAP timeline tweens. Has access to `tl` + `cuesData`. */
  timelineJs?: string;
}

export type HfPresetBuilder = (input: PresetInput) => HfPresetBlock;

/** Pack tier the preset belongs to. `free` ships in the public repo and base
 *  image; `basic` and `premium` are distributed as separate builds (tiers are
 *  labels, not an enforced license gate). */
export type HfPresetTier = 'free' | 'basic' | 'premium';

/** Metadata-rich preset registration. Each preset file exports one of these. */
export interface HfPresetDefinition {
  /** CLI slug, e.g. `text`. */
  slug: string;
  /** Pack tier — drives grouping and gating. */
  tier: HfPresetTier;
  /** One-line description shown by `--list-presets`. */
  description: string;
  /** Builder that produces the per-render HF preset block. */
  build: HfPresetBuilder;
}
