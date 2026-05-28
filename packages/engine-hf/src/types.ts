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
