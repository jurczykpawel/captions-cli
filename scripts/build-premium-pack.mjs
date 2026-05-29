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
import { readdirSync, mkdirSync, writeFileSync, copyFileSync, rmSync, existsSync } from 'node:fs';
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
// Public, client-loadable previews: ONLY the look (css), never timelineJs and
// never the renderable preset. Lets buyers see a style on their own video
// before purchase; the animation + CLI pack stay gated behind a license key.
const PREVIEWS_FILE = join(ROOT, 'apps', 'web', 'public', 'premium-previews.json');

// Free clone / public build: no private packs -> write empty stubs so the
// functions still bundle and the client just shows no previews. Nothing leaks.
if (!existsSync(PREMIUM_DIR)) {
  mkdirSync(dirname(FN_ASSET), { recursive: true });
  writeFileSync(FN_ASSET, JSON.stringify({ presets: [] }));
  mkdirSync(dirname(PREVIEWS_FILE), { recursive: true });
  writeFileSync(PREVIEWS_FILE, JSON.stringify([]));
  console.log('No premium packs present — wrote empty premium-assets + previews stubs.');
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

// Private asset for the CF Pages Functions: the gated premium preset JSON the
// Worker serves only to verified buyers (for /api/premium). NEVER in the static
// build, NEVER public. The ZIP itself is NOT embedded here — it's uploaded to R2
// and streamed by /api/premium-zip (see scripts/deploy-web.sh).
const fnDir = join(ROOT, 'apps', 'web', 'functions');
mkdirSync(fnDir, { recursive: true });
writeFileSync(
  join(fnDir, '_premium-assets.json'),
  JSON.stringify({ presets }),
);

// Public previews: css only (the look). No timelineJs, no slug->definition.
mkdirSync(dirname(PREVIEWS_FILE), { recursive: true });
writeFileSync(
  PREVIEWS_FILE,
  JSON.stringify(presets.map((p) => ({ slug: p.slug, css: p.css }))),
);

console.log(`Wrote ${zipPath} + functions/_premium-assets.json + public/premium-previews.json with ${presets.length} premium styles.`);
console.log(`Styles: ${presets.map((p) => p.slug).join(', ')}`);
