// Serve the premium pack ZIP (for the CLI) ONLY to a valid license key. Gated
// by the same KV entitlement; no public link.
import { entitlementKey, PREMIUM_ZIP_B64, b64ToBytes, type Ctx } from '../_lib/premium';

export const onRequestGet = async ({ request, env }: Ctx): Promise<Response> => {
  const key = (new URL(request.url).searchParams.get('key') ?? '').trim();
  if (!key) return new Response('key required', { status: 400 });

  const entitlement = await env.PREMIUM.get(entitlementKey(key));
  if (!entitlement) return new Response('not found', { status: 403 });

  return new Response(b64ToBytes(PREMIUM_ZIP_B64), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename="captions-premium.zip"',
    },
  });
};
