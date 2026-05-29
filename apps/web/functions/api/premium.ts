// Serve the premium preset data ONLY to a verified buyer (email that purchased).
// Premium JSON is never in the static build — this gated endpoint is the only
// source for the browser.
import { normEmail, entitlementKey, PREMIUM_PRESETS, json, type Ctx } from '../_lib/premium';

export const onRequestPost = async ({ request, env }: Ctx): Promise<Response> => {
  let email = '';
  try {
    email = normEmail(((await request.json()) as { email?: string })?.email);
  } catch {
    /* fallthrough to email_required */
  }
  if (!email) return json({ error: 'email_required' }, 400);

  const entitlement = await env.PREMIUM.get(entitlementKey(email));
  if (!entitlement) return json({ error: 'not_found' }, 403);

  return json({ presets: PREMIUM_PRESETS });
};
