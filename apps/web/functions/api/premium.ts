// Serve premium preset data ONLY to a valid Sellf license token. Premium JSON is
// never in the static build — this gated endpoint is the only browser source.
// The token's `tier` claim decides how much is returned (basic vs premium).
import { verifySellfToken, presetsForTier, PREMIUM_PRESETS, json, type Ctx } from '../_lib/premium';

export const onRequestPost = async ({ request, env }: Ctx): Promise<Response> => {
  let token = '';
  try {
    token = String(((await request.json()) as { token?: string })?.token ?? '').trim();
  } catch {
    /* fallthrough to token_required */
  }
  if (!token) return json({ error: 'token_required' }, 400);

  const result = await verifySellfToken(token, env.SELLF_JWKS_URL);
  if (!result.valid) return json({ error: 'invalid_token', reason: result.reason }, 403);

  return json({ tier: result.tier, presets: presetsForTier(PREMIUM_PRESETS, result.tier) });
};
