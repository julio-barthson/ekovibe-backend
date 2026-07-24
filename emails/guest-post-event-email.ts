interface GuestPostEventEmailProps {
  guestName: string;
  eventTitle: string;
  eventDate: string;
  photoGalleryUrl?: string;
  followUpMessage?: string;
  eventImageUrl?: string;
}

export function GuestPostEventEmail({
  guestName,
  eventTitle,
  eventDate,
  photoGalleryUrl,
  followUpMessage,
  eventImageUrl,
}: GuestPostEventEmailProps): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Thank You — ${eventTitle}</title>
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

              <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.25em;color:#C9A84C;text-transform:uppercase;font-weight:700;">Post-Event</p>
              <h1 style="margin:0 0 8px;font-size:28px;font-weight:800;color:#1C1A14;line-height:1.2;">
                That Was<br/><span style="color:#C9A84C;">A Vibe.</span>
              </h1>

              <p style="margin:16px 0 32px;font-size:15px;color:#6B6560;line-height:1.7;">
                Dear <strong style="color:#1C1A14;">${guestName}</strong>, thank you for being part of <strong style="color:#1C1A14;">${eventTitle}</strong> on ${eventDate}. It was a night to remember and we're glad you were there.
              </p>

              ${followUpMessage ? `
              <table width="100%" cellpadding="0" cellspacing="0" style="border-left:3px solid #C9A84C;margin-bottom:32px;">
                <tr><td style="padding:12px 16px;background:#F9F7F3;">
                  <p style="margin:0;font-size:14px;color:#1C1A14;line-height:1.7;">${followUpMessage}</p>
                </td></tr>
              </table>` : ''}

              ${photoGalleryUrl ? `
              <table cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
                <tr>
                  <td style="background:#C9A84C;border-radius:8px;">
                    <a href="${photoGalleryUrl}"
                       style="display:inline-block;padding:16px 40px;font-size:13px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:#1C1A14;text-decoration:none;">
                      View Photos
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 32px;font-size:11px;color:#B8B0A8;line-height:1.6;">
                If the button doesn't work, copy this link:<br/>
                <span style="font-family:'Courier New',Courier,monospace;color:#9E9892;">${photoGalleryUrl}</span>
              </p>` : ''}

              <p style="margin:0;font-size:14px;color:#6B6560;line-height:1.7;">
                Stay tuned to our channels for upcoming events. We look forward to seeing you again.
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
