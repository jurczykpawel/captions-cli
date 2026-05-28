/**
 * Pluggable export-engine contract. The app talks to this interface only, so
 * the underlying encoder (Mediabunny/WebCodecs today, MediaRecorder or
 * something newer tomorrow) can be swapped without touching the UI.
 */
import type { CaptionStage } from '../captions-renderer';

/** Builds a fresh caption stage mounted inside `parent` (for offscreen render). */
export type StageFactory = (parent: HTMLElement) => CaptionStage;

export interface ExportRequest {
  file: File;
  width: number;
  height: number;
  durationSeconds: number;
  fps: number;
  buildStage: StageFactory;
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
}

export interface ExportResult {
  blob: Blob;
  mimeType: string;
  extension: string;
}

export interface ExportEngine {
  /** Stable id for diagnostics / future selection overrides. */
  readonly id: string;
  /** Feature-detect: can this engine run in the current browser? */
  isSupported(): boolean;
  export(req: ExportRequest): Promise<ExportResult>;
}

/** Pure selection: first supported engine wins. Exposed for unit testing. */
export function pickEngine(engines: readonly ExportEngine[]): ExportEngine | null {
  return engines.find((e) => e.isSupported()) ?? null;
}
