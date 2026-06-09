// Sellf → here on purchase. Verifies the signed webhook (replay-resistant
// X-Sellf-Signature = `t=<unix>,v1=<HMAC-SHA256(secret, "<t>.<rawBody>")>`), then
// forwards the buyer's Sellf-issued license token by email. We do NOT mint or store
// anything — the token is signed by Sellf and verified offline at unlock time.
import { CAPTIONS_SLUGS, type Ctx } from '../_lib/premium';
import { verifyWebhookSignature } from '../_lib/sellf-signature';
import { sendTokenEmail } from '../_lib/ses';

export const onRequestPost = async ({ request, env }: Ctx): Promise<Response> => {
  const raw = await request.text();
  const signature = request.headers.get('X-Sellf-Signature') ?? '';

  if (!(await verifyWebhookSignature(env.SELLF_WEBHOOK_SECRET, raw, signature))) {
    return new Response('invalid signature', { status: 401 });
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response('bad json', { status: 400 });
  }

  const event = (body as { event?: string })?.event;
  // Paid purchases + free-product opt-ins (the latter carries a token only once the
  // Sellf free-product licensing patch is live).
  if (event !== 'purchase.completed' && event !== 'lead.captured') {
    return new Response('ignored', { status: 200 });
  }

  const data = ((body as { data?: unknown })?.data ?? body) as {
    customer?: { email?: string };
    product?: { slug?: string };
    license?: { token?: string };
  };
  const slug = data?.product?.slug;
  if (!slug || !CAPTIONS_SLUGS.has(slug)) {
    return new Response('ignored', { status: 200 });
  }

  const email = data?.customer?.email;
  const token = data?.license?.token;
  if (email && token) {
    await sendTokenEmail(env, email, token);
  }
  // 200 even with no token (e.g. a free event before the Sellf licensing patch) so
  // Sellf doesn't retry a delivery we can't make.
  return new Response('ok', { status: 200 });
};
