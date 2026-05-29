// Sellf -> here on purchase. Verifies the signed webhook (X-Sellf-Signature =
// hex HMAC-SHA256 of the raw body) and records the buyer's entitlement in KV.
// Unsigned / forged calls are rejected, so nobody can self-grant premium.
import { verifyHmacHex, normEmail, entitlementKey, PREMIUM_SLUG, type Ctx } from '../_lib/premium';

export const onRequestPost = async ({ request, env }: Ctx): Promise<Response> => {
  const raw = await request.text();
  const signature = request.headers.get('X-Sellf-Signature') ?? '';
  const event = request.headers.get('X-Sellf-Event') ?? '';

  if (!(await verifyHmacHex(env.SELLF_WEBHOOK_SECRET, raw, signature))) {
    return new Response('invalid signature', { status: 401 });
  }
  if (event !== 'purchase.completed') {
    return new Response('ignored', { status: 200 });
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response('bad json', { status: 400 });
  }
  const data = ((body as { data?: unknown })?.data ?? body) as {
    customer?: { email?: string };
    product?: { slug?: string };
  };
  const email = normEmail(data?.customer?.email);
  const slug = data?.product?.slug;

  if (email && slug === PREMIUM_SLUG) {
    await env.PREMIUM.put(entitlementKey(email), JSON.stringify({ slug, ts: Date.now() }));
  }
  return new Response('ok', { status: 200 });
};
