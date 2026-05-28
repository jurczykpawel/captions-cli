/**
 * Engine registry. Static imports — every engine the CLI ships with
 * lands here. The CLI's `--engine` flag picks one by id; engine packages
 * not installed in the dependency tree simply aren't imported.
 *
 * Adding a new engine: install its package as a dependency of @captions-cli/cli
 * and import + register it below.
 */
import type { CaptionEngine } from '@captions-cli/core';
import { hfEngine } from '@captions-cli/engine-hf';
import { assEngine } from '@captions-cli/engine-ass';

export const ENGINES: Record<string, CaptionEngine> = {
  [hfEngine.id]: hfEngine,
  [assEngine.id]: assEngine,
};

export function listEngines(): string[] {
  return Object.keys(ENGINES).sort();
}
