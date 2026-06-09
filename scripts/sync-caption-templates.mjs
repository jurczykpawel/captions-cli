#!/usr/bin/env node
/**
 * sync-caption-templates.mjs — source the HF caption preset builders from the
 * shared reelstack-modules repo into captions' gitignored packs/hf/{basic,premium}/.
 *
 * captions is HF-only and the shared catalogue lives in reelstack-modules. Rather
 * than author presets twice, this mirrors each reelstack-modules HF caption preset
 * into the captions preset format (an `HfPresetDefinition` with a `tier` + a
 * description from the manifest below). No npm — the two repos are siblings; point
 * REELSTACK_MODULES_DIR at the source (defaults to ~/workspace/projects/reelstack-modules).
 *
 * Usage:  node scripts/sync-caption-templates.mjs
 * Then:   ./scripts/install-pack.sh premium   (to build with the synced packs)
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SRC_REPO = process.env.REELSTACK_MODULES_DIR || join(homedir(), 'workspace', 'projects', 'reelstack-modules');
const SRC = join(SRC_REPO, 'src', 'agent', 'hf-captions', 'presets');

// Tier + description per preset slug. reelstack-modules presets carry no tier
// metadata (they self-register into a flat registry), so the basic/premium split
// and the user-facing copy are owned here.
const MANIFEST = {
  'box-highlight': { tier: 'basic', description: 'Translucent box behind the active word.' },
  pill: { tier: 'basic', description: 'Solid colour pill behind the active word.' },
  glow: { tier: 'premium', description: 'Text-shadow halo on the active word.' },
  hormozi: { tier: 'premium', description: 'Active word recoloured + scaled 1.15. Business benchmark.' },
  hype: { tier: 'premium', description: 'Dramatic UPPERCASE condensed. Ghost upcoming, solid active/past + scale.' },
  label: { tier: 'premium', description: 'Rectangular tag highlight behind the active word.' },
  'outline-pop': { tier: 'premium', description: 'UPPERCASE + heavy outline, active word recoloured. Submagic-style.' },
  'paper-cutout': { tier: 'premium', description: 'Off-white paper sticker per cue, drop shadow, slight tilt.' },
  'paper-cutout-typed': { tier: 'premium', description: 'Paper sticker + per-letter typewriter reveal.' },
  'pop-word': { tier: 'premium', description: 'Subtle scale bounce on the active word, colour-agnostic.' },
  'single-word': { tier: 'premium', description: 'One word centred, jumbo scale.' },
  'underline-sweep': { tier: 'premium', description: 'Active word underlined.' },
};

function pascal(slug) {
  return slug.replace(/(^|-)([a-z])/g, (_, __, c) => c.toUpperCase());
}

/** Rewrite a reelstack-modules preset source into the captions preset format. */
function transform(src, slug) {
  const meta = MANIFEST[slug];
  if (!meta) throw new Error(`No manifest entry for preset "${slug}" — add a tier + description.`);
  const buildName = `build${pascal(slug)}Preset`;

  // Find the exact exported builder const name (handles any naming).
  const exportMatch = src.match(/export const (\w+):\s*CaptionPresetBuilder/);
  if (!exportMatch) throw new Error(`${slug}: no "export const X: CaptionPresetBuilder" found.`);
  const actualBuildName = exportMatch[1];

  let out = src
    // Drop the @reelstack/agent imports; bring in the captions types instead.
    .replace(/import type \{ CaptionPresetBuilder \} from '@reelstack\/agent';\n?/g, '')
    .replace(/import \{ registerHfCaptionPreset \} from '@reelstack\/agent';\n?/g, '')
    // Builder type → captions' HfPresetBuilder.
    .replace(/:\s*CaptionPresetBuilder/g, ': HfPresetBuilder')
    // Drop the self-registration call (captions uses a generated index instead).
    .replace(/\n?registerHfCaptionPreset\([^)]*\);\n?/g, '\n');

  // Add the captions types import after the JSDoc block (before the first export).
  out = out.replace(
    /(export const )/,
    `import type { HfPresetBuilder, HfPresetDefinition } from '../types';\n\n$1`,
  );

  // Append the definition export the captions index generator expects.
  out = out.trimEnd() + '\n\n' + [
    `export const definition: HfPresetDefinition = {`,
    `  slug: '${slug}',`,
    `  tier: '${meta.tier}',`,
    `  description: ${JSON.stringify(meta.description)},`,
    `  build: ${actualBuildName},`,
    `};\n`,
  ].join('\n');

  return out;
}

function main() {
  let files;
  try {
    files = readdirSync(SRC).filter((f) => f.endsWith('.ts') && f !== 'index.ts');
  } catch {
    console.error(`Error: reelstack-modules HF presets not found at ${SRC}`);
    console.error('Set REELSTACK_MODULES_DIR or clone the repo as a sibling.');
    process.exit(1);
  }

  // Reset the gitignored pack dirs so removed upstream presets don't linger.
  for (const tier of ['basic', 'premium']) {
    const dir = join(ROOT, 'packs', 'hf', tier);
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
  }

  const counts = { basic: 0, premium: 0 };
  for (const file of files) {
    const slug = file.replace(/\.ts$/, '');
    const meta = MANIFEST[slug];
    if (!meta) {
      console.warn(`  ! skipping "${slug}" — no manifest entry (free baseline or unknown).`);
      continue;
    }
    const out = transform(readFileSync(join(SRC, file), 'utf8'), slug);
    writeFileSync(join(ROOT, 'packs', 'hf', meta.tier, file), out);
    counts[meta.tier]++;
  }

  console.log(`Synced HF caption templates from ${SRC}`);
  console.log(`  basic:   ${counts.basic}`);
  console.log(`  premium: ${counts.premium}`);
  console.log('Run ./scripts/install-pack.sh premium to build with them.');
}

main();
