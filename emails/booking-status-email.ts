import { SUPPORT_EMAIL } from './support-contact';

interface BookingStatusEmailProps {
  recipientName: string;
  bookingNumber: string;
  serviceName: string;
  newStatus: string;
  message: string;
  ctaText?: string;
  ctaUrl?: string;
}

export const BookingStatusEmail = ({
  recipientName,
  bookingNumber,
  serviceName,
  newStatus,
  message,
  ctaText,
  ctaUrl,
}: BookingStatusEmailProps) => {
  const statusConfig: Record<
    string,
    { bg: string; border: string; text: string; label: string }
  > = {
    CONFIRMED: {
      bg: '#ECFDF5',
      border: '#BBF7D0',
      text: '#16803C',
      label: 'Confirmed',
    },
    IN_PROGRESS: {
      bg: '#EFF6FF',
      border: '#BFDBFE',
      text: '#1D4ED8',
      label: 'In Progress',
    },
    COMPLETED: {
      bg: '#ECFDF5',
      border: '#BBF7D0',
      text: '#15803D',
      label: 'Completed',
    },
    CANCELLED: {
      bg: '#FEF2F2',
      border: '#FECACA',
      text: '#DC2626',
      label: 'Cancelled',
    },
  };

  const cfg = statusConfig[newStatus] ?? {
    bg: '#F9F7F3',
    border: '#E8E2D9',
    text: '#6B6560',
    label: newStatus.replace('_', ' '),
  };

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Booking Update — Ekovibe</title>
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

              <h1 style="margin:0 0 8px;font-size:26px;font-weight:800;color:#1C1A14;line-height:1.2;">Booking Update</h1>

              <p style="margin:16px 0 28px;font-size:15px;color:#6B6560;line-height:1.7;">
                Hello ${recipientName},
              </p>

              <p style="margin:0 0 28px;font-size:15px;color:#6B6560;line-height:1.7;">${message}</p>

              <!-- Status Badge -->
              <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td style="background:${cfg.bg};border:1px solid ${cfg.border};border-radius:100px;padding:8px 20px;">
                    <p style="margin:0;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:${cfg.text};">${cfg.label}</p>
                  </td>
                </tr>
              </table>

              <!-- Detail Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E8E2D9;border-radius:12px;margin-bottom:28px;">
                <tr>
                  <td style="padding:16px 20px;border-bottom:1px solid #E8E2D9;background:#F9F7F3;border-radius:12px 12px 0 0;">
                    <p style="margin:0 0 3px;font-size:10px;letter-spacing:0.2em;color:#9E9892;text-transform:uppercase;">Booking Reference</p>
                    <p style="margin:0;font-size:14px;font-weight:600;color:#1C1A14;font-family:'Courier New',Courier,monospace;">${bookingNumber}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 20px;border-bottom:1px solid #E8E2D9;background:#F9F7F3;">
                    <p style="margin:0 0 3px;font-size:10px;letter-spacing:0.2em;color:#9E9892;text-transform:uppercase;">Service</p>
                    <p style="margin:0;font-size:14px;font-weight:600;color:#1C1A14;">${serviceName}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 20px;background:#F9F7F3;border-radius:0 0 12px 12px;">
                    <p style="margin:0 0 3px;font-size:10px;letter-spacing:0.2em;color:#9E9892;text-transform:uppercase;">New Status</p>
                    <p style="margin:0;font-size:14px;font-weight:700;color:${cfg.text};">${cfg.label}</p>
                  </td>
                </tr>
              </table>

              ${
                ctaText && ctaUrl
                  ? `
              <!-- CTA -->
              <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td style="background:#1C1A14;border-radius:8px;">
                    <a href="${ctaUrl}"
                       style="display:inline-block;padding:14px 32px;font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#ffffff;text-decoration:none;">
                      ${ctaText}
                    </a>
                  </td>
                </tr>
              </table>
              `
                  : ''
              }

              <p style="margin:0 0 4px;font-size:14px;color:#6B6560;">Best regards,</p>
              <p style="margin:0;font-size:14px;font-weight:700;color:#1C1A14;">The Ekovibe Team</p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#F9F7F3;border-top:1px solid #E8E2D9;padding:28px 40px;text-align:center;border-radius:0 0 20px 20px;">
              <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:0.25em;color:#C9A84C;text-transform:uppercase;">EKOVIBE</p>
              <p style="margin:0 0 8px;font-size:11px;color:#9E9892;">Lagos &bull; Abuja &bull; Ibadan</p>
              <p style="margin:0 0 6px;font-size:11px;color:#B8B0A8;">&copy; ${new Date().getFullYear()} ekovibe Lifestyle Group</p>
              <p style="margin:0;font-size:11px;color:#B8B0A8;">If you have any questions, please <a href="mailto:${SUPPORT_EMAIL()}" style="color:#C9A84C;text-decoration:none;">contact support</a>.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};
