interface GuestRequestDeclinedEmailProps {
  guestName: string;
  eventTitle: string;
  eventDate: string;
  venueName: string;
  eventImageUrl?: string;
}

export function GuestRequestDeclinedEmail({
  guestName,
  eventTitle,
  eventDate,
  venueName,
  eventImageUrl,
}: GuestRequestDeclinedEmailProps): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Request Update — ${eventTitle}</title>
</head>
<body style="margin:0;padding:0;background-color:#F5F0E8;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F0E8;padding:48px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:20px;border:1px solid #E8E2D9;">

          <tr>
            <td style="background:#1C1A14;padding:32px 40px;border-radius:20px 20px 0 0;">
              <p style="margin:0 0 2px;font-size:14px;font-weight:800;letter-spacing:0.4em;color:#C9A84C;text-transform:uppercase;">EKOVIBE</p>
              <p style="margin:0;font-size:10px;letter-spacing:0.15em;color:#6B5A35;text-transform:uppercase;">Destination &amp; Vibes</p>
            </td>
          </tr>

          <tr>
            <td style="padding:40px;">

              ${eventImageUrl ? `<img src="${eventImageUrl}" width="520" alt="${eventTitle}" style="display:block;width:100%;max-width:520px;height:auto;border-radius:12px;margin-bottom:32px;"/>` : ''}

              <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.25em;color:#9E9892;text-transform:uppercase;font-weight:700;">Attendance Request</p>
              <h1 style="margin:0 0 8px;font-size:28px;font-weight:800;color:#1C1A14;line-height:1.2;">
                Thank You<br/><span style="color:#9E9892;">for Applying.</span>
              </h1>

              <p style="margin:16px 0 32px;font-size:15px;color:#6B6560;line-height:1.7;">
                Dear <strong style="color:#1C1A14;">${guestName}</strong>, thank you for your interest in attending <strong style="color:#1C1A14;">${eventTitle}</strong> on ${eventDate} at ${venueName}.<br/><br/>
                Unfortunately, we're unable to accommodate your request at this time. This event is very exclusive and spaces are limited. We hope to see you at a future Ekovibe experience.
              </p>

              <p style="margin:0;font-size:14px;color:#6B6560;line-height:1.7;">
                Stay connected with us for upcoming events and early access opportunities.
              </p>

            </td>
          </tr>

          <tr>
            <td style="background:#F9F7F3;border-top:1px solid #E8E2D9;padding:28px 40px;text-align:center;border-radius:0 0 20px 20px;">
              <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:0.25em;color:#C9A84C;text-transform:uppercase;">EKOVIBE</p>
              <p style="margin:0 0 8px;font-size:11px;color:#9E9892;">Lagos &bull; Abuja &bull; Ibadan</p>
              <p style="margin:0;font-size:11px;color:#B8B0A8;">&copy; ${new Date().getFullYear()} Ekovibe Lifestyle Group</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
