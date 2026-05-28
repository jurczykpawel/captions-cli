/**
 * Local media helpers. Probe + validation + audio extraction for Whisper.
 * Pure validation (checkVideo/isVideoFile) is unit-tested; the DOM/WebAudio
 * functions run only in the browser and are covered by E2E.
 */

/** Hard cap — this tool targets short-form reels, not long videos. */
export const MAX_DURATION_SECONDS = 600;

/** Sample rate Whisper expects. */
export const WHISPER_SAMPLE_RATE = 16000;

export interface VideoMeta {
  url: string;
  durationSeconds: number;
  width: number;
  height: number;
}

export type VideoCheck = { ok: true } | { ok: false; reason: 'invalid' | 'too-long' };

export function isVideoFile(type: string): boolean {
  return /^video\//.test(type);
}

/** Pure guard: reject non-video and clips longer than the cap. */
export function checkVideo(input: { type: string; durationSeconds: number }): VideoCheck {
  if (!isVideoFile(input.type)) return { ok: false, reason: 'invalid' };
  if (!Number.isFinite(input.durationSeconds) || input.durationSeconds <= 0) {
    return { ok: false, reason: 'invalid' };
  }
  if (input.durationSeconds > MAX_DURATION_SECONDS) return { ok: false, reason: 'too-long' };
  return { ok: true };
}

/** Load a local file into a detached <video> and read its metadata. */
export function probeVideo(file: File): Promise<VideoMeta> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.muted = true;
    v.onloadedmetadata = () => {
      resolve({
        url,
        durationSeconds: v.duration,
        width: v.videoWidth,
        height: v.videoHeight,
      });
    };
    v.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read video metadata'));
    };
    v.src = url;
  });
}

type AudioContextCtor = typeof AudioContext;

/** Decode the file's audio and downmix/resample to 16 kHz mono Float32 PCM. */
export async function decodeAudioMono16k(file: File): Promise<Float32Array> {
  const bytes = await file.arrayBuffer();
  const Ctor: AudioContextCtor =
    window.AudioContext ?? (window as unknown as { webkitAudioContext: AudioContextCtor }).webkitAudioContext;
  const ctx = new Ctor();
  let decoded: AudioBuffer;
  try {
    decoded = await ctx.decodeAudioData(bytes.slice(0));
  } finally {
    await ctx.close();
  }
  const frames = Math.ceil(decoded.duration * WHISPER_SAMPLE_RATE);
  const offline = new OfflineAudioContext(1, frames, WHISPER_SAMPLE_RATE);
  const src = offline.createBufferSource();
  src.buffer = decoded;
  src.connect(offline.destination);
  src.start();
  const rendered = await offline.startRendering();
  return rendered.getChannelData(0);
}
