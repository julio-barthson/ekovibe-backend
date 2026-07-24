import { SUPPORT_EMAIL } from './support-contact';

interface EntryConfirmedEmailProps {
  firstName: string;
  eventTitle: string;
  tierName: string;
  ticketCode: string;
  scannedAt: string;
  eventImageUrl?: string;
}

export function EntryConfirmedEmail({
  firstName,
  eventTitle,
  tierName,
  ticketCode,
  scannedAt,
  eventImageUrl,
}: EntryConfirmedEmailProps): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Entry Confirmed — ${eventTitle}</title>
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

              <!-- Success Banner -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#ECFDF5;border:1px solid #BBF7D0;border-radius:12px;margin-bottom:28px;">
                <tr>
                  <td style="padding:18px 24px;">
                    <p style="margin:0 0 3px;font-size:12px;font-weight:700;letter-spacing:0.15em;color:#16803C;text-transform:uppercase;">&#10003; Entry Confirmed</p>
                    <p style="margin:0;font-size:13px;color:#166534;">Your ticket has been scanned and verified.</p>
                  </td>
                </tr>
              </table>

              <h1 style="margin:0 0 8px;font-size:28px;font-weight:800;color:#1C1A14;line-height:1.2;">
                You're In,<br/><span style="color:#16803C;">Enjoy the Night</span>
              </h1>

              <p style="margin:16px 0 32px;font-size:15px;color:#6B6560;line-height:1.7;">
                ${firstName}, your entry at <strong style="color:#1C1A14;">${eventTitle}</strong> has been confirmed. Have an incredible experience.
              </p>

              <!-- Entry Details -->
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E8E2D9;border-radius:12px;margin-bottom:28px;">
                <tr>
                  <td style="padding:16px 20px;border-bottom:1px solid #E8E2D9;background:#F9F7F3;border-radius:12px 12px 0 0;">
                    <p style="margin:0 0 3px;font-size:10px;letter-spacing:0.2em;color:#9E9892;text-transform:uppercase;">Event</p>
                    <p style="margin:0;font-size:15px;font-weight:700;color:#1C1A14;">${eventTitle}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 20px;border-bottom:1px solid #E8E2D9;background:#F9F7F3;">
                    <p style="margin:0 0 3px;font-size:10px;letter-spacing:0.2em;color:#9E9892;text-transform:uppercase;">Ticket Tier</p>
                    <p style="margin:0;font-size:14px;color:#1C1A14;">${tierName}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 20px;border-bottom:1px solid #E8E2D9;background:#F9F7F3;">
                    <p style="margin:0 0 3px;font-size:10px;letter-spacing:0.2em;color:#9E9892;text-transform:uppercase;">Ticket Code</p>
                    <p style="margin:0;font-size:13px;font-family:'Courier New',Courier,monospace;letter-spacing:0.08em;color:#6B6560;">${ticketCode}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 20px;background:#F9F7F3;border-radius:0 0 12px 12px;">
                    <p style="margin:0 0 3px;font-size:10px;letter-spacing:0.2em;color:#9E9892;text-transform:uppercase;">Entry Time</p>
                    <p style="margin:0;font-size:14px;color:#1C1A14;">${scannedAt}</p>
                  </td>
                </tr>
              </table>

              <p style="margin:0;font-size:12px;color:#B8B0A8;line-height:1.7;">
                This ticket has been used and cannot be re-scanned. If you believe this was an error, contact us immediately at <a href="mailto:${SUPPORT_EMAIL()}" style="color:#C9A84C;text-decoration:none;">${SUPPORT_EMAIL()}</a>.
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
