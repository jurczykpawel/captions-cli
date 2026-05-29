// Serve the premium pack ZIP (for the CLI) ONLY to a verified buyer. Gated by
// the same KV entitlement; no public R2 link.
import { normEmail, entitlementKey, PREMIUM_ZIP_B64, b64ToBytes, type Ctx } from '../_lib/premium';

export const onRequestGet = async ({ request, env }: Ctx): Promise<Response> => {
  const email = normEmail(new URL(request.url).searchParams.get('email'));
  if (!email) return new Response('email required', { status: 400 });

  const entitlement = await env.PREMIUM.get(entitlementKey(email));
  if (!entitlement) return new Response('not found', { status: 403 });

  return new Response(b64ToBytes(PREMIUM_ZIP_B64), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename="captions-premium.zip"',
    },
  });
};
