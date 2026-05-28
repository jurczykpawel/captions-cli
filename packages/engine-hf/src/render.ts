/**
 * Hyperframes render driver. Hyperframes' variable injector only
 * accepts http(s) URLs for video sources, so we spin up a tiny local
 * HTTP server on a random port and pass `http://localhost:PORT/video`
 * into the composition. Server is torn down after each render.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { injectVariables } from './inject';
import { PRESETS } from './presets';
import type { EngineRenderInput } from '@captions-cli/core';
// Bun embeds the HTML into the compiled binary via `with { type: 'text' }`,
// so the standalone executable doesn't need the file alongside it. The
// `type: 'text'` attribute yields a string at runtime, but @types/bun
// types every `.html` import as HTMLBundle — hence the cast.
import compositionHtmlBundle from './composition/captions.html' with { type: 'text' };
const compositionHtml = compositionHtmlBundle as unknown as string;

export async function renderCaptions(input: EngineRenderInput): Promise<void> {
  // Build the preset CSS+JS block.
  const builder = PRESETS[input.preset] ?? PRESETS.text;
  const block = builder(input.presetInput);
  const cssLiteral = JSON.stringify(block.css);
  const captionPresetCssBlock = `<script>(function(){var s=document.createElement('style');s.textContent=${cssLiteral};document.head.appendChild(s);})();</script>`;
  const captionPresetTimelineJsBlock = block.timelineJs ?? '';

  // Spin up a local HTTP server that serves the source video.
  const server = Bun.serve({
    port: 0,
    fetch(req) {
      const url = new URL(req.url);
      if (url.pathname === '/video') {
        return new Response(Bun.file(input.videoPath));
      }
      return new Response('not found', { status: 404 });
    },
  });
  const videoUrl = `http://localhost:${server.port}/video`;

  // Build the workdir: clone composition + inject variables.
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'captions-cli-'));
  try {
    const cuesB64 = Buffer.from(JSON.stringify(input.cues), 'utf-8').toString('base64');
    const rendered = injectVariables(compositionHtml, {
      durationSeconds: input.durationSeconds,
      backgroundColor: '#000000',
      videoUrl,
      cuesB64,
      fontSize: input.presetInput.fontSize,
      fontColor: input.presetInput.fontColor,
      captionTopPercent: input.position,
      frameWidth: input.frameWidth,
      frameHeight: input.frameHeight,
      captionPresetCssBlock,
      captionPresetTimelineJsBlock,
    });
    fs.writeFileSync(path.join(workDir, 'index.html'), rendered);

    // Run hyperframes CLI. We rely on `bunx` resolving the
    // user's installed binary (declared in package.json deps).
    fs.mkdirSync(path.dirname(input.outputPath), { recursive: true });
    await runHyperframesCli(workDir, input.outputPath);
  } finally {
    server.stop();
    fs.rmSync(workDir, { recursive: true, force: true });
  }
}

function runHyperframesCli(projectDir: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Look up `hyperframes` directly on PATH so the compiled standalone
    // binary doesn't have to drag along `bunx`/Bun. Users install it
    // once with `npm i -g hyperframes` (or `bun add -g hyperframes`).
    const child = spawn(
      'hyperframes',
      ['render', projectDir, '-o', outputPath, '--quiet'],
      { stdio: ['ignore', 'ignore', 'pipe'] },
    );
    let stderr = '';
    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`hyperframes render exited with code ${code}. stderr: ${stderr.slice(0, 500)}`));
    });
  });
}
