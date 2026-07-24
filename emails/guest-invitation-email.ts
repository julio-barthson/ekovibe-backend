interface GuestInvitationEmailProps {
  guestName: string;
  eventTitle: string;
  eventDate: string;
  venueName: string;
  rsvpLink: string;
  rsvpDeadline?: string;
  customMessage?: string;
  eventImageUrl?: string;
  isReminder?: boolean;
  accentColor?: string;
}

export function GuestInvitationEmail({
  guestName,
  eventTitle,
  eventDate,
  venueName,
  rsvpLink,
  rsvpDeadline,
  customMessage,
  eventImageUrl,
  isReminder = false,
  accentColor,
}: GuestInvitationEmailProps): string {
  const accent = accentColor || '#C9A84C';
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>You're Invited — ${eventTitle}</title>
</head>
<body style="margin:0;padding:0;background-color:#F5F0E8;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F0E8;padding:48px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:20px;border:1px solid #E8E2D9;">

          <!-- Header -->
          <tr>
            <td style="background:#1C1A14;padding:32px 40px;border-radius:20px 20px 0 0;">
              <p style="margin:0 0 2px;font-size:14px;font-weight:800;letter-spacing:0.4em;color:${accent};text-transform:uppercase;">EKOVIBE</p>
              <p style="margin:0;font-size:10px;letter-spacing:0.15em;color:#6B5A35;text-transform:uppercase;">Destination &amp; Vibes</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px;">

              ${eventImageUrl ? `<img src="${eventImageUrl}" width="520" alt="${eventTitle}" style="display:block;width:100%;max-width:520px;height:auto;border-radius:12px;margin-bottom:32px;"/>` : ''}

              <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.25em;color:${accent};text-transform:uppercase;font-weight:700;">${isReminder ? 'Friendly Reminder' : 'Personal Invitation'}</p>
              <h1 style="margin:0 0 8px;font-size:28px;font-weight:800;color:#1C1A14;line-height:1.2;">
                ${isReminder ? `Don't<br/><span style="color:${accent};">Miss Out.</span>` : `You're<br/><span style="color:${accent};">Invited.</span>`}
              </h1>

              <p style="margin:16px 0 32px;font-size:15px;color:#6B6560;line-height:1.7;">
                ${isReminder
                  ? `Dear <strong style="color:#1C1A14;">${guestName}</strong>, we noticed you haven't RSVP'd yet for <strong style="color:#1C1A14;">${eventTitle}</strong>. We'd love to see you there — please confirm or decline below.`
                  : `Dear <strong style="color:#1C1A14;">${guestName}</strong>, you have been personally selected to attend <strong style="color:#1C1A14;">${eventTitle}</strong>. We look forward to seeing you there.`}
              </p>

              ${customMessage ? `
              <table width="100%" cellpadding="0" cellspacing="0" style="border-left:3px solid #C9A84C;margin-bottom:24px;">
                <tr><td style="padding:12px 16px;background:#F9F7F3;">
                  <p style="margin:0;font-size:14px;color:#1C1A14;line-height:1.7;">${customMessage}</p>
                </td></tr>
              </table>` : ''}

              <!-- Event Details -->
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E8E2D9;border-radius:12px;margin-bottom:32px;">
                <tr>
                  <td style="padding:16px 20px;border-bottom:1px solid #E8E2D9;background:#F9F7F3;border-radius:12px 12px 0 0;">
                    <p style="margin:0 0 3px;font-size:10px;letter-spacing:0.2em;color:#9E9892;text-transform:uppercase;">Event</p>
                    <p style="margin:0;font-size:15px;font-weight:700;color:#1C1A14;">${eventTitle}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 20px;border-bottom:1px solid #E8E2D9;background:#F9F7F3;">
                    <p style="margin:0 0 3px;font-size:10px;letter-spacing:0.2em;color:#9E9892;text-transform:uppercase;">Date</p>
                    <p style="margin:0;font-size:14px;color:#1C1A14;">${eventDate}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 20px;background:#F9F7F3;border-radius:0 0 12px 12px;">
                    <p style="margin:0 0 3px;font-size:10px;letter-spacing:0.2em;color:#9E9892;text-transform:uppercase;">Venue</p>
                    <p style="margin:0;font-size:14px;color:#1C1A14;">${venueName}</p>
                  </td>
                </tr>
              </table>

              <!-- RSVP CTA -->
              <p style="margin:0 0 16px;font-size:13px;color:#6B6560;line-height:1.7;">
                Please confirm your attendance using the button below. This is a personal link — it can only be used once.${rsvpDeadline ? ` <strong style="color:${accent};">RSVP by ${rsvpDeadline}.</strong>` : ''}
              </p>

              <table cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td style="background:${accent};border-radius:8px;">
                    <a href="${rsvpLink}"
                       style="display:inline-block;padding:16px 40px;font-size:13px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:#1C1A14;text-decoration:none;">
                      RSVP Now
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0;font-size:11px;color:#B8B0A8;line-height:1.6;">
                If the button doesn't work, copy this link into your browser:<br/>
                <span style="font-family:'Courier New',Courier,monospace;color:#9E9892;">${rsvpLink}</span>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#F9F7F3;border-top:1px solid #E8E2D9;padding:28px 40px;text-align:center;border-radius:0 0 20px 20px;">
              <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:0.25em;color:${accent};text-transform:uppercase;">EKOVIBE</p>
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
