// Deliver the buyer's Sellf license token via AWS SES v2 (SigV4 from the Worker).
// The token itself is minted + signed by Sellf and rides on the webhook payload;
// we only forward it to the customer. They paste it at captions.techskills.academy
// (verified offline against Sellf's JWKS) to unlock their tier.
import { AwsClient } from 'aws4fetch';
import type { Env } from './premium';

export async function sendTokenEmail(env: Env, to: string, token: string): Promise<void> {
  const aws = new AwsClient({
    accessKeyId: env.SES_ACCESS_KEY_ID,
    secretAccessKey: env.SES_SECRET_ACCESS_KEY,
    service: 'ses',
    region: env.SES_REGION,
  });

  const html = `
    <p>Thanks — your <b>Captions</b> styles are ready to unlock.</p>
    <p>Your license token:</p>
    <pre style="white-space:pre-wrap;word-break:break-all;background:#f4f4f5;padding:12px;border-radius:8px;font-size:12px">${token}</pre>
    <p>Paste it at <a href="https://captions.techskills.academy">captions.techskills.academy</a>
    to unlock your styles in the browser (export with no watermark), or use it there to download
    the pack for the open-source CLI. You can also find this token in your Sellf account.</p>`;
  const text =
    `Thanks — your Captions styles are ready to unlock.\n\n` +
    `Your license token:\n${token}\n\n` +
    `Paste it at https://captions.techskills.academy to unlock your styles, or download the CLI ` +
    `pack from the same place. You can also find this token in your Sellf account.`;

  const res = await aws.fetch(`https://email.${env.SES_REGION}.amazonaws.com/v2/email/outbound-emails`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      FromEmailAddress: env.SES_FROM,
      Destination: { ToAddresses: [to] },
      Content: {
        Simple: {
          Subject: { Data: 'Your Captions license token' },
          Body: { Html: { Data: html }, Text: { Data: text } },
        },
      },
    }),
  });
  if (!res.ok) {
    throw new Error(`SES send failed: ${res.status} ${await res.text()}`);
  }
}
