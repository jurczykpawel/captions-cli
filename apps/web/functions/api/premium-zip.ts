// Serve the premium pack ZIP (for the CLI) ONLY to a valid license key. The ZIP
// lives in R2 and is streamed straight through — zero per-request CPU and the
// Worker bundle stays small (the pack can grow without redeploying the Worker).
import { entitlementKey, PREMIUM_ZIP_KEY, type Ctx } from '../_lib/premium';

export const onRequestGet = async ({ request, env }: Ctx): Promise<Response> => {
  const key = (new URL(request.url).searchParams.get('key') ?? '').trim();
  if (!key) return new Response('key required', { status: 400 });

  const entitlement = await env.PREMIUM.get(entitlementKey(key));
  if (!entitlement) return new Response('not found', { status: 403 });

  const object = await env.PREMIUM_BUCKET.get(PREMIUM_ZIP_KEY);
  if (!object) return new Response('pack unavailable', { status: 404 });

  return new Response(object.body, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename="captions-premium.zip"',
    },
  });
};
