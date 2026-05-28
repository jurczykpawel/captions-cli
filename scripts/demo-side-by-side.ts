#!/usr/bin/env bun
/**
 * Renders all 9 presets through BOTH engines on a synthetic gradient
 * background, then ffmpeg-stacks the matching frame from each pair so
 * you can spot the look differences at a glance.
 *
 * Output: ~/Downloads/caption-engines-compare/
 *   pop-word-ass.mp4 + pop-word-hf.mp4 + pop-word-compare.png
 *   hormozi-ass.mp4 + hormozi-hf.mp4 + hormozi-compare.png
 *   …
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { groupWordsIntoCues, probeVideo } from '@captions-cli/core';
import type { Cue, Word } from '@captions-cli/core';
import { hfEngine } from '@captions-cli/engine-hf';
import { assEngine } from '@captions-cli/engine-ass';

const PRESETS = [
  'text',
  'outline-pop',
  'hormozi',
  'pop-word',
  'pill',
  'glow',
  'underline-sweep',
  'box-highlight',
  'single-word',
] as const;

const OUT_DIR = path.join(os.homedir(), 'Downloads', 'caption-engines-compare');
const SAMPLE_VIDEO = path.join(os.tmpdir(), 'demo-bg.mp4');
const CLIP_DURATION = 12;
const FRAME_AT = 6;

fs.mkdirSync(OUT_DIR, { recursive: true });

if (!fs.existsSync(SAMPLE_VIDEO)) {
  console.log('Generating synthetic gradient background…');
  execFileSync('ffmpeg', [
    '-y',
    '-f', 'lavfi',
    '-i', `gradients=s=1080x1920:c0=0x141428:c1=0x3a1f5c:type=radial:speed=0.01:duration=${CLIP_DURATION}`,
    '-t', String(CLIP_DURATION),
    '-pix_fmt', 'yuv420p',
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-crf', '20',
    SAMPLE_VIDEO,
  ], { stdio: 'pipe' });
}

const probe = probeVideo(SAMPLE_VIDEO);

// Fabricated cue track — 4 cues, 3-4 words, 3 seconds each.
function buildCues(): Cue[] {
  const sentences = [
    ['ReelStack', 'caption', 'styles'],
    ['eight', 'presets', 'available'],
    ['pick', 'your', 'favorite', 'look'],
    ['same', 'render', 'zero', 'cost'],
  ];
  const out: Cue[] = [];
  let t = 0;
  sentences.forEach((words, i) => {
    const cueDuration = 3.0;
    const wordDuration = cueDuration / words.length;
    const wordObjs: Word[] = words.map((text, w) => ({
      text,
      startTime: t + w * wordDuration,
      endTime: t + (w + 1) * wordDuration,
    }));
    out.push({
      id: `cue-${i}`,
      text: words.join(' '),
      startTime: t,
      endTime: t + cueDuration,
      words: wordObjs,
    });
    t += cueDuration;
  });
  return out;
}

const cues = buildCues();

const presetInput = {
  fontColor: '#FFFFFF',
  highlightColor: '#F59E0B',
  upcomingColor: '#8E8E9C',
  fontSize: 64,
};

async function renderOne(engine: typeof hfEngine | typeof assEngine, preset: string, outPath: string) {
  await engine.render({
    videoPath: SAMPLE_VIDEO,
    cues,
    durationSeconds: CLIP_DURATION,
    frameWidth: probe.width,
    frameHeight: probe.height,
    preset,
    presetInput,
    position: 65,
    outputPath: outPath,
  });
}

function extractFrame(mp4: string, png: string) {
  execFileSync('ffmpeg', ['-y', '-ss', String(FRAME_AT), '-i', mp4, '-frames:v', '1', png], {
    stdio: 'pipe',
  });
}

function stackComparison(assPng: string, hfPng: string, outPng: string) {
  execFileSync('ffmpeg', [
    '-y',
    '-i', assPng,
    '-i', hfPng,
    '-filter_complex',
    '[0:v]drawtext=text=ASS:fontcolor=white:fontsize=48:x=20:y=20:box=1:boxcolor=black@0.6[a];[1:v]drawtext=text=HF:fontcolor=white:fontsize=48:x=20:y=20:box=1:boxcolor=black@0.6[b];[a][b]hstack=inputs=2',
    outPng,
  ], { stdio: 'pipe' });
}

console.log(`Output: ${OUT_DIR}`);
console.log(`Presets: ${PRESETS.join(', ')}\n`);

for (const preset of PRESETS) {
  const tagAss = path.join(OUT_DIR, `${preset}-ass.mp4`);
  const tagHf = path.join(OUT_DIR, `${preset}-hf.mp4`);
  const pngAss = path.join(OUT_DIR, `${preset}-ass.png`);
  const pngHf = path.join(OUT_DIR, `${preset}-hf.png`);
  const pngCompare = path.join(OUT_DIR, `${preset}-compare.png`);

  process.stdout.write(`[${preset}]  ass…  `);
  const t1 = performance.now();
  await renderOne(assEngine, preset, tagAss);
  process.stdout.write(`${((performance.now() - t1) / 1000).toFixed(1)}s   hf…  `);
  const t2 = performance.now();
  await renderOne(hfEngine, preset, tagHf);
  process.stdout.write(`${((performance.now() - t2) / 1000).toFixed(1)}s   `);

  extractFrame(tagAss, pngAss);
  extractFrame(tagHf, pngHf);
  stackComparison(pngAss, pngHf, pngCompare);
  process.stdout.write('compare ✓\n');
}

console.log(`\nopen ${OUT_DIR}`);
