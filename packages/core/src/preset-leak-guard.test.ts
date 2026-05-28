import { test, expect } from 'bun:test';
import { execFileSync } from 'node:child_process';

/**
 * Public-repo invariant: only the FREE preset ships per engine. Paid packs
 * are gitignored and injected at build time by scripts/install-pack.sh. This
 * guard fails if a paid preset is ever `git add`-ed into a tracked presets
 * dir. It checks git tracking (not the on-disk registry), so it stays green
 * regardless of which pack tier a developer has installed locally.
 */
const ROOT = execFileSync('git', ['rev-parse', '--show-toplevel'], {
  encoding: 'utf8',
}).trim();

function trackedTsFiles(dir: string): string[] {
  const out = execFileSync('git', ['ls-files', dir], { cwd: ROOT, encoding: 'utf8' });
  return out
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.endsWith('.ts'))
    .map((p) => p.split('/').pop() as string)
    .sort();
}

const CASES = [
  { engine: 'ass', dir: 'packages/engine-ass/src/presets', free: 'clean-white.ts' },
  { engine: 'hf', dir: 'packages/engine-hf/src/presets', free: 'text.ts' },
] as const;

for (const { engine, dir, free } of CASES) {
  test(`${engine} engine tracks only the free preset (no paid leak)`, () => {
    expect(trackedTsFiles(dir)).toEqual(['index.ts', free].sort());
  });
}
