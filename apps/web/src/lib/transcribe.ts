/**
 * Pure transcription helpers (no heavy deps, unit-tested). The actual Whisper
 * inference lives in whisper.ts, which imports the mapper here.
 */
import type { Word } from '@captions-cli/core/pure';

export type WhisperModelSize = 'base' | 'tiny';

export const WHISPER_MODELS: Record<WhisperModelSize, string> = {
  base: 'onnx-community/whisper-base',
  tiny: 'onnx-community/whisper-tiny',
};

export interface WhisperChunk {
  text: string;
  /** [start, end] in seconds; end can be null on the final partial chunk. */
  timestamp: [number, number | null];
}

/** Map transformers.js word chunks to core Word[], dropping empties and
 *  repairing a missing end timestamp on the last word. */
export function mapChunksToWords(chunks: WhisperChunk[]): Word[] {
  const words: Word[] = [];
  for (const c of chunks) {
    const text = c.text.trim();
    if (!text) continue;
    const start = c.timestamp[0] ?? 0;
    const end = c.timestamp[1] ?? start + 0.3;
    words.push({ text, startTime: start, endTime: Math.max(end, start) });
  }
  return words;
}
