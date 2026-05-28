/**
 * Speech-to-text. Two providers:
 *
 * 1. `whisper-cpp` (default, free, local) — requires `whisper-cli`
 *    binary on PATH (`brew install whisper-cpp`). Auto-downloads a
 *    model file on first run.
 * 2. `openai` — calls the OpenAI Whisper API. Requires
 *    `OPENAI_API_KEY` env var. ~$0.006 per audio minute.
 *
 * Both return word-level timestamps which the renderer groups into
 * cues (no more than 5 words / 3 seconds per cue).
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Word, Cue } from './types';

const MODEL_DIR = path.join(os.homedir(), '.cache', 'whisper.cpp');
const DEFAULT_MODEL = 'ggml-base.bin';
const MODEL_URLS: Record<string, string> = {
  'ggml-tiny.bin': 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin',
  'ggml-base.bin': 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin',
  'ggml-small.bin': 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin',
  'ggml-medium.bin': 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.bin',
  'ggml-large-v3-turbo.bin':
    'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo.bin',
};

function ensureModel(modelName: string): string {
  fs.mkdirSync(MODEL_DIR, { recursive: true });
  const modelPath = path.join(MODEL_DIR, modelName);
  if (fs.existsSync(modelPath)) return modelPath;
  const url = MODEL_URLS[modelName];
  if (!url) {
    throw new Error(
      `Unknown whisper model "${modelName}". Known: ${Object.keys(MODEL_URLS).join(', ')}`,
    );
  }
  console.log(`Downloading ${modelName} (one-time, ~140 MB for base)…`);
  execFileSync('curl', ['-L', '-o', modelPath, url], { stdio: 'inherit' });
  return modelPath;
}

export function extractAudio(videoPath: string, outputWavPath: string): void {
  fs.mkdirSync(path.dirname(outputWavPath), { recursive: true });
  execFileSync(
    'ffmpeg',
    ['-y', '-i', videoPath, '-vn', '-acodec', 'pcm_s16le', '-ar', '16000', '-ac', '1', outputWavPath],
    { stdio: 'pipe' },
  );
}

interface WhisperCppSegment {
  text: string;
  offsets: { from: number; to: number };
  tokens?: { text: string; offsets: { from: number; to: number } }[];
}

export function transcribeWithWhisperCpp(
  audioPath: string,
  language: string,
  modelName = DEFAULT_MODEL,
): Word[] {
  const modelPath = ensureModel(modelName);
  const tmpJson = path.join(os.tmpdir(), `whisper-${Date.now()}.json`);

  // -ml 1 forces token-level timestamps (one token per "segment" in JSON).
  // -oj writes JSON output. Whisper.cpp prefixes the file with audio path.
  execFileSync(
    'whisper-cli',
    [
      '-m', modelPath,
      '-l', language,
      '-ml', '1',
      '-oj',
      '-of', tmpJson.replace(/\.json$/, ''),
      audioPath,
    ],
    { stdio: 'pipe' },
  );

  const raw = JSON.parse(fs.readFileSync(tmpJson, 'utf-8')) as {
    transcription: WhisperCppSegment[];
  };
  fs.unlinkSync(tmpJson);

  // With -ml 1 every "segment" is effectively one token. Coalesce
  // tokens that belong to the same surface word (whisper.cpp emits
  // sub-word pieces like " hel" + "lo" — joined on whitespace boundary).
  const words: Word[] = [];
  let buffer = '';
  let bufferStart = 0;
  let bufferEnd = 0;
  for (const seg of raw.transcription) {
    const text = seg.text.replace(/[\[\]]/g, '');
    const startTime = seg.offsets.from / 1000;
    const endTime = seg.offsets.to / 1000;
    if (text.startsWith(' ') || text === '') {
      if (buffer.trim().length > 0) {
        words.push({ text: buffer.trim(), startTime: bufferStart, endTime: bufferEnd });
      }
      buffer = text.replace(/^ /, '');
      bufferStart = startTime;
      bufferEnd = endTime;
    } else {
      buffer += text;
      bufferEnd = endTime;
    }
  }
  if (buffer.trim().length > 0) {
    words.push({ text: buffer.trim(), startTime: bufferStart, endTime: bufferEnd });
  }
  return words;
}

interface OpenAITranscription {
  words?: { word: string; start: number; end: number }[];
}

export async function transcribeWithOpenAI(audioPath: string, language: string): Promise<Word[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not set.');

  const file = await Bun.file(audioPath).bytes();
  const form = new FormData();
  form.append('file', new Blob([file]), 'audio.wav');
  form.append('model', 'whisper-1');
  form.append('response_format', 'verbose_json');
  form.append('timestamp_granularities[]', 'word');
  form.append('language', language);

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  if (!res.ok) throw new Error(`OpenAI Whisper failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as OpenAITranscription;
  return (json.words ?? []).map((w) => ({
    text: w.word,
    startTime: w.start,
    endTime: w.end,
  }));
}

/**
 * Group flat word stream into caption cues. Splits on:
 *  1. Punctuation at the end of a word (`.`, `!`, `?`, `,`).
 *  2. Long silence (>0.7s) between consecutive words.
 *  3. Cue size cap: max 5 words OR max 3 seconds of duration.
 */
export function groupWordsIntoCues(words: Word[]): Cue[] {
  const cues: Cue[] = [];
  let current: Word[] = [];
  let cueStart = 0;
  const MAX_WORDS = 5;
  const MAX_DURATION = 3;
  const SILENCE_THRESHOLD = 0.7;

  const flush = (i: number) => {
    if (current.length === 0) return;
    const last = current[current.length - 1];
    cues.push({
      id: `cue-${cues.length}`,
      text: current.map((w) => w.text).join(' '),
      startTime: cueStart,
      endTime: last.endTime,
      words: [...current],
    });
    current = [];
  };

  words.forEach((w, i) => {
    if (current.length === 0) {
      cueStart = w.startTime;
      current.push(w);
      return;
    }
    const prev = current[current.length - 1];
    const silence = w.startTime - prev.endTime;
    const duration = w.endTime - cueStart;
    const tooLong = current.length >= MAX_WORDS || duration >= MAX_DURATION;
    const punctEnd = /[.!?,;:]$/.test(prev.text);
    const longGap = silence > SILENCE_THRESHOLD;
    if (tooLong || punctEnd || longGap) {
      flush(i);
      cueStart = w.startTime;
    }
    current.push(w);
  });
  flush(words.length);

  return cues;
}
