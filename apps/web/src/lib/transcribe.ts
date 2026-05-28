/**
 * Pure transcription helpers (no heavy deps, unit-tested). The actual Whisper
 * inference lives in whisper.ts, which imports the mapper here.
 */
import type { Word } from '@captions-cli/core/pure';

export type WhisperModelSize = 'tiny' | 'base' | 'small' | 'large';

// The `_timestamped` variants are exported with alignment heads (cross
// attentions), which word-level timestamps require. Plain whisper-base throws
// "Model outputs must contain cross attentions". Bigger = more accurate
// (esp. Polish) but a heavier download. `large` is large-v3-turbo.
export const WHISPER_MODELS: Record<WhisperModelSize, string> = {
  tiny: 'onnx-community/whisper-tiny_timestamped',
  base: 'onnx-community/whisper-base_timestamped',
  small: 'onnx-community/whisper-small_timestamped',
  large: 'onnx-community/whisper-large-v3-turbo_timestamped',
};

// Per-model dtype override. large-v3-turbo in fp32 is ~1.6 GB; q4 keeps it
// usable in a browser tab at a small quality cost.
export const WHISPER_DTYPE: Partial<Record<WhisperModelSize, string>> = {
  large: 'q4',
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
