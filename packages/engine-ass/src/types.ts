/**
 * ASS-engine preset types. Each preset emits:
 *   1. A `[V4+ Styles]` line — the default look applied to every word.
 *   2. A function that, given a word + its state (past/active/upcoming)
 *      + the global PresetInput, returns the ASS inline tag string
 *      that wraps the word in a per-event override.
 *   3. Optional text transform (e.g. uppercase for outline-pop).
 *   4. Optional whole-cue event renderer for presets that need a
 *      different event topology (one event per word, etc.).
 *
 * The renderer composes these into a real .ass file and feeds it to
 * ffmpeg's `subtitles` filter (libass).
 */
import type { Cue, PresetInput, Word } from '@captions-cli/core';

export type WordState = 'past' | 'active' | 'upcoming';

/** Pack tier the preset belongs to. Drives `--list-presets` grouping.
 *  `free` ships in the public repo and base image; `basic` and `premium`
 *  are paid packs distributed as separate builds (tiers are labels, not an
 *  enforced license gate). */
export type AssPresetTier = 'free' | 'basic' | 'premium';

export interface AssPresetBlock {
  /**
   * The single `Style:` line written under `[V4+ Styles]`. The renderer
   * names it `Default`. ASS field reference:
   * https://aegisub.org/docs/latest/ASS_Tags/
   */
  style: string;
  /**
   * Optional `\fnFontName\fs<size>` etc. tag prepended to every event,
   * useful for forcing per-cue defaults without changing the Style row.
   */
  globalTags?: string;
  /**
   * Per-word inline tag returned for each state. Examples:
   *   active   → '{\\c&H00A5F0&\\fscx115\\fscy115}' (hormozi)
   *   past     → '' (Default style applies)
   *   upcoming → '{\\c&H8E8E9C&}'
   */
  wordTag(state: WordState, word: Word, input: PresetInput): string;
  /**
   * Optional surface-text transform — ASS has no `text-transform`, so
   * presets that want UPPERCASE (outline-pop) declare it here and the
   * renderer applies it before composing the dialogue line.
   */
  transformText?(text: string): string;
  /**
   * Optional dialogue-event-level override. When present, the renderer
   * asks the preset to format an entire cue's events instead of using
   * the default per-cue dialogue. Used by `single-word` which needs
   * one event per word.
   */
  renderEvents?(input: { cues: Cue[]; preset: PresetInput }): string[];
}

export type AssPresetBuilder = (input: PresetInput) => AssPresetBlock;

/** Metadata-rich preset registration. Each preset file exports one of these. */
export interface AssPresetDefinition {
  /** CLI slug, e.g. `clean-white`. */
  slug: string;
  /** Pack tier — drives grouping and (eventually) license gating. */
  tier: AssPresetTier;
  /** One-line description shown by `--list-presets`. */
  description: string;
  /** Builder that produces the per-render ASS preset block. */
  build: AssPresetBuilder;
}
