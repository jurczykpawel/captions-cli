// Serve the premium preset data ONLY to a valid license key. Premium JSON is
// never in the static build — this gated endpoint is the only browser source.
import { entitlementKey, PREMIUM_PRESETS, json, type Ctx } from '../_lib/premium';

export const onRequestPost = async ({ request, env }: Ctx): Promise<Response> => {
  let key = '';
  try {
    key = String(((await request.json()) as { key?: string })?.key ?? '').trim();
  } catch {
    /* fallthrough to key_required */
  }
  if (!key) return json({ error: 'key_required' }, 400);

  const entitlement = await env.PREMIUM.get(entitlementKey(key));
  if (!entitlement) return json({ error: 'not_found' }, 403);

  return json({ presets: PREMIUM_PRESETS });
};
