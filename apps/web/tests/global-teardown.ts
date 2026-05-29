import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Restore the free-only public state after the suite so the working tree never
// stays in the leaky (basic/premium-installed) state. See global-setup.ts.
export default function globalTeardown() {
  const root = resolve(process.cwd(), '../../');
  if (!existsSync(resolve(root, 'packs/hf/premium'))) return;
  execSync('bash scripts/install-pack.sh free', { cwd: root, stdio: 'ignore' });
}
