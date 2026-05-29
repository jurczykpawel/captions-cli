#!/usr/bin/env bun
/**
 * Build the premium style pack that buyers receive (via Sellf -> R2):
 *   - premium-pack.json : browser-loadable preset data (css + timelineJs),
 *     consumed by the web app's "Load premium pack" upload.
 *   - the original *.ts   : for the open-source CLI (install-pack).
 *   - README.txt          : how to use both.
 * Output: dist-pack/captions-premium.zip
 *
 * The premium presets are NEVER bundled into the web app; this pack is the
 * only way to get them, and it's delivered only after purchase.
 */
import { readdirSync, mkdirSync, writeFileSync, copyFileSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PREMIUM_DIR = join(ROOT, 'packs', 'hf', 'premium');
const OUT_DIR = join(ROOT, 'dist-pack');
const STAGE = join(OUT_DIR, 'captions-premium');

// Colours the web app renders with (see apps/web/src/lib/app.ts COLORS).
const PRESET_INPUT = {
  fontColor: '#ffffff',
  highlightColor: '#ffca28',
  upcomingColor: '#9aa3af',
  fontSize: 64,
};

const FN_ASSET = join(ROOT, 'apps', 'web', 'functions', '_premium-assets.json');

// Free clone / public build: no private packs -> write an empty stub so the
// functions still bundle (and serve nothing). No premium ever leaks.
if (!existsSync(PREMIUM_DIR)) {
  mkdirSync(dirname(FN_ASSET), { recursive: true });
  writeFileSync(FN_ASSET, JSON.stringify({ presets: [], zipBase64: '' }));
  console.log('No premium packs present — wrote empty premium-assets stub.');
  process.exit(0);
}

const files = readdirSync(PREMIUM_DIR).filter((f) => f.endsWith('.ts'));
const presets = [];
for (const f of files) {
  const mod = await import(join(PREMIUM_DIR, f));
  const d = mod.definition;
  if (!d) throw new Error(`${f} has no definition export`);
  const block = d.build(PRESET_INPUT);
  presets.push({
    slug: d.slug,
    tier: d.tier,
    description: d.description,
    css: block.css,
    timelineJs: block.timelineJs ?? '',
  });
}
presets.sort((a, b) => a.slug.localeCompare(b.slug));

rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(join(STAGE, 'cli'), { recursive: true });

writeFileSync(join(STAGE, 'premium-pack.json'), JSON.stringify(presets, null, 2));
for (const f of files) copyFileSync(join(PREMIUM_DIR, f), join(STAGE, 'cli', f));
writeFileSync(
  join(STAGE, 'README.txt'),
  [
    'Captions — Premium style pack',
    '',
    'WEB (captions.techskills.academy):',
    '  Click "Load premium pack" and select this .zip. Your premium styles',
    '  unlock and export without a watermark.',
    '',
    'CLI (open source):',
    '  Copy the files in /cli into the captions-cli repo under',
    '  packs/hf/premium/, then run: ./scripts/install-pack.sh premium',
    '',
    `Styles included: ${presets.map((p) => p.slug).join(', ')}`,
  ].join('\n'),
);

const zipPath = join(OUT_DIR, 'captions-premium.zip');
const res = spawnSync('zip', ['-r', '-q', zipPath, 'captions-premium'], { cwd: OUT_DIR });
if (res.status !== 0) throw new Error('zip failed (is `zip` installed?)');

// Private asset for the CF Pages Functions: the gated premium JSON + the zip
// (base64) the Worker serves only to verified buyers. NEVER in the static
// build, NEVER public — bundled into the server-side function only.
const zipBase64 = readFileSync(zipPath).toString('base64');
const fnDir = join(ROOT, 'apps', 'web', 'functions');
mkdirSync(fnDir, { recursive: true });
writeFileSync(
  join(fnDir, '_premium-assets.json'),
  JSON.stringify({ presets, zipBase64 }),
);

console.log(`Wrote ${zipPath} + functions/_premium-assets.json with ${presets.length} premium styles.`);
console.log(`Styles: ${presets.map((p) => p.slug).join(', ')}`);
