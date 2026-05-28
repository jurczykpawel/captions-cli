/**
 * ffmpeg + libass renderer. Compose an `.ass` subtitle file from the
 * preset's wordTag function, then run:
 *
 *   ffmpeg -i input.mp4 -vf "subtitles=tmp.ass" -c:a copy out.mp4
 *
 * libass picks up the `[V4+ Styles]` Default style and renders every
 * word with its inline tags. Per-word state transitions are baked in
 * via `\t(t1,t1+1,...)` tags inside each event so colour/scale flips
 * on the word's start/end timestamps relative to the cue start.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import type { Cue, EngineRenderInput, PresetInput } from '@captions-cli/core';
import type { AssPresetBlock, AssPresetBuilder } from './types';
import { secondsToAssTime, escapeAssText, hexToAss } from './ass-helpers';
import { PRESETS } from './presets';

/**
 * Generate the inverse of an active-state tag body so the word reverts to
 * Style defaults once it's no longer active.
 *
 * Why this exists: presets historically returned `''` for `wordTag('past')`
 * on the assumption that the [V4+ Styles] Default row provided the visuals.
 * That's true for the FIRST event the word appears in — but the renderer
 * uses `\t(t1,t1+1,activeBody)` to flip into active, and ASS keeps inline
 * overrides until the event ends. Without an explicit `\t(t2,t2+1,reset)`
 * call, every word past its active window stays in active state forever
 * (amber colour, scale 115, etc.). Visually: by the cue's mid-point, every
 * word looked active.
 *
 * Rather than force every preset author to remember the reset, we infer it
 * from the active body: for each known tag we emit its Style-default
 * counterpart. Covers the tags any of our 25 presets use today (`\c`,
 * `\1c`, `\3c`, `\fscx/y`, `\u`, `\1a`).
 */
function autoPastFromActive(activeBody: string, fontColorAss: string): string {
  if (!activeBody) return '';
  const out: string[] = [];
  if (/\\c&H[0-9A-Fa-f]+&?/.test(activeBody)) out.push(`\\c${fontColorAss}`);
  if (/\\1c&H[0-9A-Fa-f]+&?/.test(activeBody)) out.push(`\\1c${fontColorAss}`);
  if (/\\3c&H[0-9A-Fa-f]+&?/.test(activeBody)) out.push('\\3c&H000000&');
  if (/\\fscx\d+/.test(activeBody)) out.push('\\fscx100');
  if (/\\fscy\d+/.test(activeBody)) out.push('\\fscy100');
  if (/\\u1/.test(activeBody)) out.push('\\u0');
  if (/\\1a&H[0-9A-Fa-f]+&?/.test(activeBody)) out.push('\\1a&H00&');
  // \bord intentionally NOT auto-reset — the Style line's outline width is
  // opaque from here, so guessing a default (3? 6? 10?) would silently
  // resize past words. Presets that animate \bord must return their own
  // wordTag('past') with the explicit reset.
  return out.join('');
}

function buildAssFile(
  block: AssPresetBlock,
  cues: Cue[],
  preset: PresetInput,
  frameW: number,
  frameH: number,
  position: number,
): string {
  const header = [
    '[Script Info]',
    'ScriptType: v4.00+',
    'WrapStyle: 0',
    'ScaledBorderAndShadow: yes',
    `PlayResX: ${frameW}`,
    `PlayResY: ${frameH}`,
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    `Style: ${block.style}`,
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
  ].join('\n');

  // Position the line: alignment 5 = top-centre wrt PlayRes box. Use
  // \pos so the same script works for any video size.
  const xPos = Math.round(frameW / 2);
  const yPos = Math.round((frameH * position) / 100);
  const posTag = `{\\an5\\pos(${xPos},${yPos})}`;

  let events: string[];
  if (block.renderEvents) {
    events = block.renderEvents({ cues, preset });
  } else {
    events = cues.map((cue) => buildCueEvent(cue, block, preset, posTag));
  }

  return [header, ...events, ''].join('\n');
}

function buildCueEvent(
  cue: Cue,
  block: AssPresetBlock,
  preset: PresetInput,
  posTag: string,
): string {
  const start = secondsToAssTime(cue.startTime);
  const end = secondsToAssTime(cue.endTime);
  const transform = block.transformText ?? ((t: string) => t);
  const globalTags = block.globalTags ?? '';

  // For each word, emit:
  //   <upcoming-tag>WORD<reset><\t(t1,t1+1,active)\t(t2,t2+1,past)>
  // The transition tag flips colour/scale instantly at word boundaries.
  // Times are MILLISECONDS relative to cue start.
  const parts: string[] = [];
  for (const w of cue.words) {
    const upcomingTag = block.wordTag('upcoming', w, preset);
    const text = escapeAssText(transform(w.text));
    const t1 = Math.max(0, Math.round((w.startTime - cue.startTime) * 1000));
    const t2 = Math.round((w.endTime - cue.startTime) * 1000);
    const activeTag = block.wordTag('active', w, preset);
    const pastTag = block.wordTag('past', w, preset);
    // Strip the surrounding braces from active/past tag for use inside \t(...).
    // wordTag returns '{\c...}' — \t(...) wants the bare '\c...' part.
    const activeBody = stripBraces(activeTag);
    const explicitPastBody = stripBraces(pastTag);
    // Past tag: explicit override beats auto-inverse. If the preset doesn't
    // ship one, derive it from active so the word doesn't stay stuck in
    // active state for the rest of the cue (the historical bug).
    const pastBody = explicitPastBody
      || autoPastFromActive(activeBody, hexToAss(preset.fontColor));
    // Transition window: 50 ms with accel=0.5 (decelerate). At 80 ms the
    // ease consumed the entire active dwell on short words (200-300 ms
    // is common in fast narration) — `Math.max(t1+ease, t2-ease)` would
    // collapse the peak to zero, leaving the scale tween bouncing in
    // place. 50 ms + decelerate keeps a soft GSAP-style back.out feel
    // and reserves at least 100 ms of peak time for typical word
    // durations.
    const easeMs = 50;
    const settleStart = Math.max(t1 + easeMs, t2 - easeMs);
    const transitions = [
      activeBody ? `\\t(${t1},${t1 + easeMs},0.5,${activeBody})` : '',
      pastBody ? `\\t(${settleStart},${t2},${pastBody})` : '',
    ]
      .filter(Boolean)
      .join('');
    const wordPrefix = upcomingTag === '' ? '' : upcomingTag;
    const transitionBlock = transitions ? `{${transitions}}` : '';
    parts.push(`${wordPrefix}${transitionBlock}${text}`);
  }
  // Join words with non-breaking-space-equivalent (regular space — ASS
  // collapses multiples but a single space is fine).
  const body = parts.join(' ');
  return `Dialogue: 0,${start},${end},Default,,0,0,0,,${posTag}${globalTags}${body}`;
}

function stripBraces(tag: string): string {
  if (tag.startsWith('{') && tag.endsWith('}')) {
    return tag.slice(1, -1);
  }
  return tag;
}

/**
 * The ASS engine renders captions through ffmpeg's `subtitles` filter,
 * which only exists when ffmpeg was compiled with libass. Some builds
 * (notably Homebrew's stock `ffmpeg` on certain setups) ship without it.
 * Detect that up front and fail with an actionable message instead of a
 * cryptic ffmpeg filtergraph error mid-render.
 */
function assertSubtitlesFilter(): void {
  const res = spawnSync('ffmpeg', ['-hide_banner', '-filters'], {
    encoding: 'utf-8',
  });
  if (res.error) {
    throw new Error(
      'ffmpeg not found on PATH. Install it (e.g. `brew install ffmpeg`) or use the Docker image.',
    );
  }
  if (!/\bsubtitles\b/.test(res.stdout ?? '')) {
    throw new Error(
      'Your ffmpeg was built without libass, so the ASS engine cannot render captions.\n' +
        '  Fix one of:\n' +
        '    • use the Docker image (ships ffmpeg+libass): see README "Option A"\n' +
        '    • install an ffmpeg with libass (macOS: `brew reinstall ffmpeg`)\n' +
        '    • switch engines: `--engine hf` (needs hyperframes, no libass)\n' +
        '  Verify with: ffmpeg -filters | grep subtitles',
    );
  }
}

export async function renderCaptions(input: EngineRenderInput): Promise<void> {
  assertSubtitlesFilter();
  const builder: AssPresetBuilder = PRESETS[input.preset] ?? PRESETS.text;
  const block = builder(input.presetInput);
  const ass = buildAssFile(
    block,
    input.cues,
    input.presetInput,
    input.frameWidth,
    input.frameHeight,
    input.position,
  );

  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'captions-cli-ass-'));
  const assPath = path.join(workDir, 'captions.ass');
  fs.writeFileSync(assPath, ass);

  fs.mkdirSync(path.dirname(input.outputPath), { recursive: true });

  // ffmpeg subtitles filter takes the .ass path; libass renders it.
  // `:fontsdir=` forces libass to look in our font dir (Inter).
  // `force_style=` would override Style fields but we already build them
  // perfectly per preset.
  await runFfmpeg(input.videoPath, assPath, input.outputPath);

  fs.rmSync(workDir, { recursive: true, force: true });
}

function runFfmpeg(videoPath: string, assPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // ffmpeg's filter-graph parser treats `/` and `:` inside the
    // `subtitles=` value as separators. Easiest robust workaround:
    // change cwd to the .ass file's directory, pass the relative
    // basename to the filter. Input + output paths stay absolute —
    // they're regular CLI args, not parsed by the filter parser.
    // The explicit `filename=` key is required by ffmpeg 7+/8's parser:
    // a bare positional value (`subtitles=captions.ass`) is rejected
    // with "No option name near ...".
    const assDir = path.dirname(assPath);
    const assName = path.basename(assPath);
    const args = [
      '-y',
      '-i', videoPath,
      '-vf', `subtitles=filename=${assName}`,
      '-c:a', 'copy',
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-crf', '20',
      outputPath,
    ];
    const child = spawn('ffmpeg', args, {
      cwd: assDir,
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    let stderr = '';
    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) return resolve();
      reject(
        new Error(`ffmpeg exited with code ${code}. stderr: ${stderr.slice(-1000)}`),
      );
    });
  });
}

