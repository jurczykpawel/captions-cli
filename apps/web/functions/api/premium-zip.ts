// Serve the premium pack ZIP (for the CLI) ONLY to a verified premium token. The
// ZIP lives in R2 and is streamed straight through — zero per-request CPU and the
// Worker bundle stays small (the pack can grow without redeploying the Worker).
import { verifySellfToken, parseJwksJson, allowedTiers, PREMIUM_ZIP_KEY, type Ctx } from '../_lib/premium';

export const onRequestGet = async ({ request, env }: Ctx): Promise<Response> => {
  const token = (new URL(request.url).searchParams.get('token') ?? '').trim();
  if (!token) return new Response('token required', { status: 400 });

  const result = await verifySellfToken(token, env.SELLF_JWKS_URL, {
    fallbackKeys: parseJwksJson(env.SELLF_JWKS_FALLBACK),
  });
  // The CLI pack ZIP is the full premium pack — premium tier only.
  if (!result.valid || !allowedTiers(result.tier).includes('premium')) {
    return new Response('not authorized', { status: 403 });
  }

  const object = await env.PREMIUM_BUCKET.get(PREMIUM_ZIP_KEY);
  if (!object) return new Response('pack unavailable', { status: 404 });

  return new Response(object.body, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename="captions-premium.zip"',
    },
  });
};
