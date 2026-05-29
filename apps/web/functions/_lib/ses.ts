// Send the license key to the buyer via AWS SES v2 (SigV4 from the Worker).
import { AwsClient } from 'aws4fetch';
import type { Env } from './premium';

export async function sendLicenseEmail(env: Env, to: string, key: string): Promise<void> {
  const aws = new AwsClient({
    accessKeyId: env.SES_ACCESS_KEY_ID,
    secretAccessKey: env.SES_SECRET_ACCESS_KEY,
    service: 'ses',
    region: env.SES_REGION,
  });

  const html = `
    <p>Thanks for buying <b>Captions Premium Styles</b>!</p>
    <p>Your license key:</p>
    <p style="font-size:18px"><b>${key}</b></p>
    <p>Paste it at <a href="https://captions.techskills.academy">captions.techskills.academy</a>
    to unlock the premium styles in your browser (export with no watermark), or use it there to
    download the pack for the open-source CLI.</p>`;
  const text =
    `Thanks for buying Captions Premium Styles!\n\n` +
    `Your license key:\n${key}\n\n` +
    `Paste it at https://captions.techskills.academy to unlock premium styles, ` +
    `or download the CLI pack from the same place.`;

  const res = await aws.fetch(`https://email.${env.SES_REGION}.amazonaws.com/v2/email/outbound-emails`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      FromEmailAddress: env.SES_FROM,
      Destination: { ToAddresses: [to] },
      Content: {
        Simple: {
          Subject: { Data: 'Your Captions Premium license key' },
          Body: { Html: { Data: html }, Text: { Data: text } },
        },
      },
    }),
  });
  if (!res.ok) {
    throw new Error(`SES send failed: ${res.status} ${await res.text()}`);
  }
}
