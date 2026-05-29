// Same-origin ALTCHA challenge for the email form (the widget's challengeurl).
import { createChallenge } from '../_lib/altcha';
import { json } from '../_lib/crypto';

interface Env {
  ALTCHA_HMAC_SECRET: string;
}

export const onRequestGet = async ({ env }: { env: Env }): Promise<Response> => {
  if (!env.ALTCHA_HMAC_SECRET) return json({ error: 'not_configured' }, 500);
  return json(await createChallenge(env.ALTCHA_HMAC_SECRET));
};
