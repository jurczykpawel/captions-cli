/**
 * Shared types — used by every engine. The CLI passes these around;
 * each engine wraps them in its own renderer.
 */

/** Single word with start/end timestamps in seconds. */
export interface Word {
  text: string;
  startTime: number;
  endTime: number;
}

/** A caption cue (phrase shown together) with word-level timing. */
export interface Cue {
  id: string;
  text: string;
  startTime: number;
  endTime: number;
  words: Word[];
}

/** Probe results for a source video. */
export interface VideoProbe {
  durationSeconds: number;
  width: number;
  height: number;
}

/** Input every engine's `render()` receives from the CLI. */
export interface EngineRenderInput {
  videoPath: string;
  cues: Cue[];
  durationSeconds: number;
  frameWidth: number;
  frameHeight: number;
  preset: string;
  presetInput: PresetInput;
  position: number;
  outputPath: string;
}

/** Inputs every preset receives (engine-agnostic colour/size knobs). */
export interface PresetInput {
  fontColor: string;
  highlightColor: string;
  upcomingColor?: string;
  fontSize: number;
}

/**
 * Engine contract. Each engine (Hyperframes, ffmpeg+ASS, …) implements
 * this interface and exposes a singleton instance the CLI dispatches to
 * based on the `--engine` flag.
 */
export interface CaptionEngine {
  /** Stable id passed via `--engine` (`hf`, `ass`). */
  readonly id: string;
  /** Human-readable description shown in `--list-engines`. */
  readonly description: string;
  /** Slugs registered in this engine's preset registry. */
  listPresets(): string[];
  /** Description per preset for `--list-presets`. */
  presetDescriptions(): Record<string, string>;
  /** Run the render. Throws on hard failures. */
  render(input: EngineRenderInput): Promise<void>;
}
