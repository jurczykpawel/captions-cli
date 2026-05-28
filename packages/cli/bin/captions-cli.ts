#!/usr/bin/env bun
/**
 * captions-cli — burn word-level karaoke captions onto a video. Local
 * Whisper for speech-to-text + a pluggable render engine. No SaaS.
 *
 *   captions <video.mp4>
 *   captions video.mp4 --preset hormozi --lang pl --color #F59E0B
 *   captions video.mp4 --engine ass           # default (ffmpeg+libass, slim)
 *   captions video.mp4 --engine hf            # full CSS power (headless Chromium)
 *   captions --list-presets
 *   captions --list-engines
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  extractAudio,
  transcribeWithWhisperCpp,
  transcribeWithOpenAI,
  groupWordsIntoCues,
  probeVideo,
} from '@captions-cli/core';
import { ENGINES, listEngines } from '../src/engines';
import type { CliOptions } from '../src/options';

// Print clean one-line errors instead of a stack trace — most failures
// here are user-facing (missing ffmpeg/libass, bad path, no speech).
function die(err: unknown): never {
  console.error(`\nError: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}
process.on('uncaughtException', die);
process.on('unhandledRejection', die);

const HELP = `
captions-cli — burn karaoke captions onto a video. Local. No SaaS.

USAGE
  captions <video.mp4> [options]
  captions --list-presets [--engine hf|ass]
  captions --list-engines
  captions --help

OPTIONS
  --engine <name>          Render engine: ${listEngines().join(' | ')}. Default: ass (slim + fast). Use 'hf' for full CSS power.
  --preset <slug>          Caption look (varies per engine). Default: clean-white
  --output <path>          Default: <input>-captioned.mp4
  --lang <code>            Whisper language (en, pl, de, …). Default: en
  --color <hex>            Active highlight. Default: #F59E0B
  --upcoming <hex>         3-state karaoke "not yet spoken" colour
  --position <0-100>       Vertical % from top (65 = safe zone). Default: 65
  --font-size <px>         Default: 64
  --font-color <hex>       Past-word colour. Default: #FFFFFF
  --whisper <provider>     whisper-cpp (default) | openai
  --whisper-model <id>     ggml-tiny|base|small|medium|large-v3-turbo.bin
`.trim();

function arg(name: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1 || idx === process.argv.length - 1) return undefined;
  return process.argv[idx + 1];
}

function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

if (flag('help') || flag('h') || process.argv.length < 3) {
  console.log(HELP);
  process.exit(flag('help') || flag('h') ? 0 : 1);
}

if (flag('list-engines')) {
  console.log('Available engines:\n');
  for (const id of listEngines()) {
    console.log(`  ${id.padEnd(8)} ${ENGINES[id]!.description}`);
  }
  process.exit(0);
}

const engineId = arg('engine') ?? 'ass';
const engine = ENGINES[engineId];
if (!engine) {
  console.error(
    `Error: unknown engine "${engineId}". Available: ${listEngines().join(', ')}`,
  );
  process.exit(1);
}

if (flag('list-presets')) {
  const descriptions = engine.presetDescriptions();
  console.log(`Available presets for engine '${engine.id}':\n`);
  // ASS engine groups presets by paid tier; HF (and any future engine) just
  // prints a flat list. We import lazily to avoid hard-coupling the CLI
  // module to engine-ass internals.
  if (engine.id === 'ass') {
    const { assPresetsByTier } = await import('@captions-cli/engine-ass');
    const groups = assPresetsByTier();
    const labels: Record<string, string> = {
      free: 'FREE — included in base image',
      basic: 'BASIC pack — 47 PLN',
      premium: 'PREMIUM pack — 97 PLN',
    };
    for (const tier of ['free', 'basic', 'premium'] as const) {
      const list = groups[tier];
      if (list.length === 0) continue;
      console.log(`  [${labels[tier]}]`);
      for (const def of list) {
        console.log(`    ${def.slug.padEnd(22)} ${def.description}`);
      }
      console.log('');
    }
  } else {
    for (const slug of engine.listPresets()) {
      console.log(`  ${slug.padEnd(20)} ${descriptions[slug] ?? ''}`);
    }
  }
  process.exit(0);
}

const positional = process.argv.slice(2).filter((a, i, arr) => {
  if (a.startsWith('--')) return false;
  const prev = arr[i - 1];
  if (
    prev &&
    prev.startsWith('--') &&
    !['--list-presets', '--list-engines', '--help', '--h'].includes(prev)
  ) {
    return false;
  }
  return true;
});

const videoPath = positional[0];
if (!videoPath) {
  console.error('Error: missing video path. Run `captions --help`.');
  process.exit(1);
}
if (!fs.existsSync(videoPath)) {
  console.error(`Error: video not found: ${videoPath}`);
  process.exit(1);
}

const opts: CliOptions = {
  videoPath: path.resolve(videoPath),
  outputPath: path.resolve(
    arg('output') ?? videoPath.replace(/(\.[^.]+)?$/, '-captioned.mp4'),
  ),
  engine: engineId,
  preset: arg('preset') ?? (engineId === 'ass' ? 'clean-white' : 'outline-pop'),
  language: arg('lang') ?? 'en',
  highlightColor: arg('color') ?? '#F59E0B',
  upcomingColor: arg('upcoming'),
  position: parseInt(arg('position') ?? '65', 10),
  fontSize: parseInt(arg('font-size') ?? '64', 10),
  fontColor: arg('font-color') ?? '#FFFFFF',
  whisperProvider: (arg('whisper') ?? 'whisper-cpp') as 'whisper-cpp' | 'openai',
  whisperModel: arg('whisper-model'),
};

if (!engine.listPresets().includes(opts.preset)) {
  console.error(
    `Error: unknown preset "${opts.preset}" for engine '${engine.id}'. Available: ${engine.listPresets().join(', ')}`,
  );
  process.exit(1);
}

const t0 = performance.now();
console.log(`captions-cli — ${path.basename(opts.videoPath)} → ${opts.engine}/${opts.preset}`);

console.log('  probing video…');
const probe = probeVideo(opts.videoPath);
console.log(`  duration: ${probe.durationSeconds.toFixed(1)}s, ${probe.width}x${probe.height}`);

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'captions-cli-'));
const wavPath = path.join(tmpDir, 'audio.wav');
console.log('  extracting audio…');
extractAudio(opts.videoPath, wavPath);

console.log(`  transcribing (${opts.whisperProvider}, lang=${opts.language})…`);
const tT = performance.now();
const words =
  opts.whisperProvider === 'openai'
    ? await transcribeWithOpenAI(wavPath, opts.language)
    : transcribeWithWhisperCpp(wavPath, opts.language, opts.whisperModel);
console.log(`  ${words.length} words (${((performance.now() - tT) / 1000).toFixed(1)}s)`);
if (words.length === 0) {
  console.error('Error: transcription returned no words.');
  process.exit(1);
}

const cues = groupWordsIntoCues(words);
console.log(`  ${cues.length} cues`);

console.log(`  rendering with ${engine.id}…`);
const tR = performance.now();
await engine.render({
  videoPath: opts.videoPath,
  cues,
  durationSeconds: probe.durationSeconds,
  frameWidth: probe.width,
  frameHeight: probe.height,
  preset: opts.preset,
  presetInput: {
    fontColor: opts.fontColor,
    highlightColor: opts.highlightColor,
    upcomingColor: opts.upcomingColor,
    fontSize: opts.fontSize,
  },
  position: opts.position,
  outputPath: opts.outputPath,
});
console.log(`  render: ${((performance.now() - tR) / 1000).toFixed(1)}s`);

fs.rmSync(tmpDir, { recursive: true, force: true });

const total = ((performance.now() - t0) / 1000).toFixed(1);
const sizeKB = (fs.statSync(opts.outputPath).size / 1024).toFixed(0);
console.log(`\n✓ done in ${total}s — ${opts.outputPath} (${sizeKB} KB)`);
