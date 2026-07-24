import { SUPPORT_EMAIL } from './support-contact';

interface OrderFailedEmailProps {
  firstName: string;
  eventTitle: string;
  orderReference: string;
  eventImageUrl?: string;
}

export function OrderFailedEmail({
  firstName,
  eventTitle,
  orderReference,
  eventImageUrl,
}: OrderFailedEmailProps): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Payment Unsuccessful — Ekovibe</title>
</head>
<body style="margin:0;padding:0;background-color:#F5F0E8;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F0E8;padding:48px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:20px;border:1px solid #E8E2D9;">

          <!-- Header -->
          <tr>
            <td style="background:#1C1A14;padding:32px 40px;border-radius:20px 20px 0 0;">
              <p style="margin:0 0 2px;font-size:14px;font-weight:800;letter-spacing:0.4em;color:#C9A84C;text-transform:uppercase;">EKOVIBE</p>
              <p style="margin:0;font-size:10px;letter-spacing:0.15em;color:#6B5A35;text-transform:uppercase;">Destination &amp; Vibes</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px;">

              ${
                eventImageUrl
                  ? `
              <img src="${eventImageUrl}" width="520" alt="${eventTitle}" style="display:block;width:100%;max-width:520px;height:auto;border-radius:12px;margin-bottom:32px;"/>
              `
                  : ''
              }

              <!-- Error Banner -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#FEF2F2;border:1px solid #FECACA;border-radius:12px;margin-bottom:28px;">
                <tr>
                  <td style="padding:18px 24px;">
                    <p style="margin:0 0 3px;font-size:12px;font-weight:700;letter-spacing:0.15em;color:#DC2626;text-transform:uppercase;">Payment Unsuccessful</p>
                    <p style="margin:0;font-size:13px;color:#B91C1C;">No charge has been made to your account.</p>
                  </td>
                </tr>
              </table>

              <h1 style="margin:0 0 8px;font-size:28px;font-weight:800;color:#1C1A14;line-height:1.2;">
                Let's Try<br/><span style="color:#DC2626;">That Again</span>
              </h1>

              <p style="margin:16px 0 32px;font-size:15px;color:#6B6560;line-height:1.7;">
                ${firstName}, your payment for <strong style="color:#1C1A14;">${eventTitle}</strong> could not be processed. No charge has been made to your account.
              </p>

              <!-- Order Info -->
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E8E2D9;border-radius:12px;margin-bottom:28px;">
                <tr>
                  <td style="padding:16px 20px;border-bottom:1px solid #E8E2D9;background:#F9F7F3;border-radius:12px 12px 0 0;">
                    <p style="margin:0 0 3px;font-size:10px;letter-spacing:0.2em;color:#9E9892;text-transform:uppercase;">Event</p>
                    <p style="margin:0;font-size:15px;font-weight:700;color:#1C1A14;">${eventTitle}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 20px;background:#F9F7F3;border-radius:0 0 12px 12px;">
                    <p style="margin:0 0 3px;font-size:10px;letter-spacing:0.2em;color:#9E9892;text-transform:uppercase;">Order Reference</p>
                    <p style="margin:0;font-size:13px;font-family:'Courier New',Courier,monospace;color:#6B6560;">${orderReference}</p>
                  </td>
                </tr>
              </table>

              <!-- Reasons -->
              <p style="margin:0 0 12px;font-size:13px;color:#6B6560;font-weight:600;">Common reasons for payment failure:</p>
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#F9F7F3;border:1px solid #E8E2D9;border-radius:12px;margin-bottom:32px;">
                <tr><td style="padding:10px 20px;border-bottom:1px solid #E8E2D9;font-size:13px;color:#6B6560;border-radius:12px 12px 0 0;">Insufficient funds</td></tr>
                <tr><td style="padding:10px 20px;border-bottom:1px solid #E8E2D9;font-size:13px;color:#6B6560;">Card declined by your bank</td></tr>
                <tr><td style="padding:10px 20px;border-bottom:1px solid #E8E2D9;font-size:13px;color:#6B6560;">3DS authentication not completed</td></tr>
                <tr><td style="padding:10px 20px;font-size:13px;color:#6B6560;border-radius:0 0 12px 12px;">Transaction limit exceeded</td></tr>
              </table>

              <!-- CTA -->
              <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td style="background:#1C1A14;border-radius:8px;">
                    <a href="${process.env.FRONTEND_URL}/ticketing"
                       style="display:inline-block;padding:14px 32px;font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#ffffff;text-decoration:none;">
                      Try Again
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0;font-size:12px;color:#B8B0A8;line-height:1.7;">
                If you continue to experience issues, contact us at <a href="mailto:${SUPPORT_EMAIL()}" style="color:#C9A84C;text-decoration:none;">${SUPPORT_EMAIL()}</a> and quote your order reference.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#F9F7F3;border-top:1px solid #E8E2D9;padding:28px 40px;text-align:center;border-radius:0 0 20px 20px;">
              <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:0.25em;color:#C9A84C;text-transform:uppercase;">EKOVIBE</p>
              <p style="margin:0 0 8px;font-size:11px;color:#9E9892;">Lagos &bull; Abuja &bull; Ibadan</p>
              <p style="margin:0;font-size:11px;color:#B8B0A8;">&copy; ${new Date().getFullYear()} ekovibe Lifestyle Group</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
