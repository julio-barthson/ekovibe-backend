interface GuestRsvpConfirmationEmailProps {
  guestName: string;
  eventTitle: string;
  eventDate: string;
  venueName: string;
  qrCode: string;
  tableNumber?: string;
  eventImageUrl?: string;
}

export function GuestRsvpConfirmationEmail({
  guestName,
  eventTitle,
  eventDate,
  venueName,
  qrCode,
  tableNumber,
  eventImageUrl,
}: GuestRsvpConfirmationEmailProps): string {
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrCode)}&bgcolor=F5F0E8&color=1C1A14&margin=15`;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>RSVP Confirmed — ${eventTitle}</title>
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

              ${eventImageUrl ? `<img src="${eventImageUrl}" width="520" alt="${eventTitle}" style="display:block;width:100%;max-width:520px;height:auto;border-radius:12px;margin-bottom:32px;"/>` : ''}

              <h1 style="margin:0 0 8px;font-size:28px;font-weight:800;color:#1C1A14;line-height:1.2;">
                See You<br/><span style="color:#C9A84C;">There.</span>
              </h1>

              <p style="margin:16px 0 32px;font-size:15px;color:#6B6560;line-height:1.7;">
                <strong style="color:#1C1A14;">${guestName}</strong>, your RSVP for <strong style="color:#1C1A14;">${eventTitle}</strong> is confirmed. Your personal QR code is below — present it at the entrance on the day.
              </p>

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
                  <td style="padding:16px 20px;${tableNumber ? 'border-bottom:1px solid #E8E2D9;' : ''}background:#F9F7F3;${!tableNumber ? 'border-radius:0 0 12px 12px;' : ''}">
                    <p style="margin:0 0 3px;font-size:10px;letter-spacing:0.2em;color:#9E9892;text-transform:uppercase;">Venue</p>
                    <p style="margin:0;font-size:14px;color:#1C1A14;">${venueName}</p>
                  </td>
                </tr>
                ${tableNumber ? `
                <tr>
                  <td style="padding:16px 20px;background:#F9F7F3;border-radius:0 0 12px 12px;">
                    <p style="margin:0 0 3px;font-size:10px;letter-spacing:0.2em;color:#9E9892;text-transform:uppercase;">Table</p>
                    <p style="margin:0;font-size:14px;font-weight:700;color:#C9A84C;">${tableNumber}</p>
                  </td>
                </tr>` : ''}
              </table>

              <!-- QR Code -->
              <p style="margin:0 0 12px;font-size:10px;letter-spacing:0.2em;color:#9E9892;text-transform:uppercase;font-weight:600;text-align:center;">Your Entry Pass</p>
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E8E2D9;border-radius:12px;margin-bottom:12px;">
                <tr>
                  <td style="padding:32px;text-align:center;background:#F9F7F3;border-radius:12px 12px 0 0;">
                    <img src="${qrImageUrl}" width="200" height="200" alt="Your QR Code" style="display:inline-block;border-radius:8px;"/>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 20px;text-align:center;background:#F9F7F3;border-radius:0 0 12px 12px;border-top:1px solid #E8E2D9;">
                    <p style="margin:0;font-size:13px;font-family:'Courier New',Courier,monospace;color:#6B6560;letter-spacing:0.1em;">${qrCode}</p>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 32px;font-size:12px;color:#9E9892;line-height:1.7;text-align:center;">
                Save this email. You may screenshot the QR code for easy access on the day.
              </p>

            </td>
          </tr>

          <!-- Footer -->
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
