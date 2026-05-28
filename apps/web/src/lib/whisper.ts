/**
 * Local Whisper transcription via transformers.js (WebGPU when available,
 * WASM fallback). Returns word-level timestamps as core Word[]. The model is
 * downloaded once and cached by the browser; the loaded pipeline is memoised.
 */
import { pipeline } from '@huggingface/transformers';
import type { Word } from '@captions-cli/core/pure';
import {
  WHISPER_MODELS,
  WHISPER_DTYPE,
  mapChunksToWords,
  type WhisperChunk,
  type WhisperModelSize,
} from './transcribe';

export interface TranscribeProgress {
  stage: 'loading-model' | 'transcribing';
  /** 0..1 during model download. */
  fraction?: number;
}

export interface RunWhisperOptions {
  /** 16 kHz mono PCM (see media.decodeAudioMono16k). */
  audio: Float32Array;
  language: 'en' | 'pl';
  model?: WhisperModelSize;
  /** Override device detection (e.g. force 'wasm' in headless tests). */
  device?: 'webgpu' | 'wasm';
  onProgress?: (p: TranscribeProgress) => void;
}

type Transcriber = (
  audio: Float32Array,
  opts: Record<string, unknown>,
) => Promise<{ chunks?: WhisperChunk[]; text?: string }>;

let cache: { key: string; transcriber: Transcriber } | null = null;

function detectDevice(): 'webgpu' | 'wasm' {
  return typeof navigator !== 'undefined' && 'gpu' in navigator ? 'webgpu' : 'wasm';
}

export async function runWhisper(opts: RunWhisperOptions): Promise<Word[]> {
  const size = opts.model ?? 'base';
  const modelId = WHISPER_MODELS[size];
  const device = opts.device ?? detectDevice();
  const key = `${modelId}:${device}`;

  if (!cache || cache.key !== key) {
    const pipeOpts: Record<string, unknown> = {
      device,
      progress_callback: (info: { status?: string; total?: number; loaded?: number }) => {
        if (info.status === 'progress') {
          opts.onProgress?.({
            stage: 'loading-model',
            fraction: info.total ? (info.loaded ?? 0) / info.total : undefined,
          });
        }
      },
    };
    const dtype = WHISPER_DTYPE[size];
    if (dtype) pipeOpts.dtype = dtype;
    const transcriber = (await pipeline(
      'automatic-speech-recognition',
      modelId,
      pipeOpts,
    )) as unknown as Transcriber;
    cache = { key, transcriber };
  }

  opts.onProgress?.({ stage: 'transcribing' });
  const out = await cache.transcriber(opts.audio, {
    return_timestamps: 'word',
    language: opts.language,
    // 29, not 30: transformers.js bug clusters all word timestamps at 29.98s
    // on a 30s chunk boundary (transformers.js#1358).
    chunk_length_s: 29,
    stride_length_s: 5,
  });
  return mapChunksToWords(out.chunks ?? []);
}
