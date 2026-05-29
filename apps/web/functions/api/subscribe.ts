// Same-origin email capture for the free "unlock with email" tier. Verifies the
// altcha PoW + consent, then subscribes server-side to Listmonk (which is
// cross-origin and CORS-closed, so the browser can't call it directly).
import { verifySolution } from '../_lib/altcha';
import { normEmail, json } from '../_lib/crypto';

interface Env {
  ALTCHA_HMAC_SECRET: string;
  LISTMONK_SUBSCRIBE_URL?: string;
  LISTMONK_LIST_UUID?: string;
}

const DEFAULT_URL = 'https://mail.techskills.academy/api/public/subscription';
const DEFAULT_LIST = '3836801a-e2d6-4fbb-9351-634623fe9812'; // "Captions Web"
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const onRequestPost = async ({ request, env }: { request: Request; env: Env }): Promise<Response> => {
  let body: { email?: unknown; consent?: unknown; altcha?: unknown; locale?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'bad_json' }, 400);
  }

  const email = normEmail(body.email);
  const locale = body.locale === 'pl' ? 'pl' : 'en';
  if (!EMAIL_RE.test(email)) return json({ error: 'invalid_email' }, 400);
  if (body.consent !== true) return json({ error: 'consent_required' }, 400);
  if (!(await verifySolution(String(body.altcha ?? ''), env.ALTCHA_HMAC_SECRET))) {
    return json({ error: 'altcha_failed' }, 400);
  }

  const url = env.LISTMONK_SUBSCRIBE_URL || DEFAULT_URL;
  const list = env.LISTMONK_LIST_UUID || DEFAULT_LIST;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, list_uuids: [list], attribs: { source: 'captions.web', locale } }),
    });
    // Listmonk returns 200 for new + already-subscribed; 409 on some dupes.
    if (!res.ok && res.status !== 409) return json({ error: 'listmonk_error' }, 502);
    return json({ ok: true });
  } catch {
    return json({ error: 'listmonk_unreachable' }, 502);
  }
};
