import { SUPPORT_EMAIL } from './support-contact';

export const WelcomeEmail = ({ firstName }: { firstName: string }) => {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Welcome to Ekovibe</title>
</head>
<body style="margin:0;padding:0;background-color:#F5F0E8;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F0E8;padding:48px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:20px;border:1px solid #E8E2D9;">

          <!-- Header -->
          <tr>
            <td style="background:#1C1A14;padding:40px;text-align:center;border-radius:20px 20px 0 0;">
              <p style="margin:0 0 2px;font-size:18px;font-weight:800;letter-spacing:0.45em;color:#C9A84C;text-transform:uppercase;">EKOVIBE</p>
              <p style="margin:0;font-size:10px;letter-spacing:0.15em;color:#6B5A35;text-transform:uppercase;">Destination &amp; Vibes</p>
            </td>
          </tr>

          <!-- Hero -->
          <tr>
            <td style="background:#1C1A14;padding:40px;text-align:center;border-bottom:2px solid #C9A84C;">
              <p style="margin:0 0 12px;font-size:11px;letter-spacing:0.3em;color:#C9A84C;text-transform:uppercase;font-weight:600;">Welcome to the Movement</p>
              <h1 style="margin:0;font-size:32px;font-weight:800;color:#ffffff;line-height:1.2;">Hello, ${firstName}.</h1>
              <p style="margin:16px 0 0;font-size:15px;color:#9E9892;line-height:1.6;">Your Ekovibe account is now active.</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px;">

              <p style="margin:0 0 28px;font-size:15px;color:#6B6560;line-height:1.7;">
                You're now part of Lagos' premier lifestyle platform — your gateway to exclusive events, curated nightlife, and experiences that define the culture.
              </p>

              <!-- Feature 1 -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#F9F7F3;border:1px solid #E8E2D9;border-radius:12px;margin-bottom:12px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#1C1A14;">Exclusive Events</p>
                    <p style="margin:0;font-size:13px;color:#6B6560;line-height:1.6;">Browse and book tickets to the most curated events across Lagos, Abuja, and Ibadan.</p>
                  </td>
                </tr>
              </table>

              <!-- Feature 2 -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#F9F7F3;border:1px solid #E8E2D9;border-radius:12px;margin-bottom:12px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#1C1A14;">Digital Access</p>
                    <p style="margin:0;font-size:13px;color:#6B6560;line-height:1.6;">Manage and view all your tickets and passes from your personal dashboard, anywhere.</p>
                  </td>
                </tr>
              </table>

              <!-- Feature 3 -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#F9F7F3;border:1px solid #E8E2D9;border-radius:12px;margin-bottom:32px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#1C1A14;">Premium Experiences</p>
                    <p style="margin:0;font-size:13px;color:#6B6560;line-height:1.6;">From private dining to gallery nights — discover what Lagos' lifestyle scene truly has to offer.</p>
                  </td>
                </tr>
              </table>

              <!-- CTA -->
              <table cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
                <tr>
                  <td style="background:#C9A84C;border-radius:8px;">
                    <a href="${process.env.FRONTEND_URL}/ticketing"
                       style="display:inline-block;padding:14px 32px;font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#1C1A14;text-decoration:none;">
                      Explore Experiences
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 4px;font-size:14px;color:#6B6560;">See you at the door,</p>
              <p style="margin:0;font-size:14px;font-weight:700;color:#1C1A14;">The Ekovibe Team</p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#F9F7F3;border-top:1px solid #E8E2D9;padding:28px 40px;text-align:center;border-radius:0 0 20px 20px;">
              <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:0.25em;color:#C9A84C;text-transform:uppercase;">EKOVIBE</p>
              <p style="margin:0 0 8px;font-size:11px;color:#9E9892;">Lagos &bull; Abuja &bull; Ibadan</p>
              <p style="margin:0 0 6px;font-size:11px;color:#B8B0A8;">&copy; ${new Date().getFullYear()} ekovibe Lifestyle Group</p>
              <p style="margin:0;font-size:11px;color:#B8B0A8;">If you did not create this account, please <a href="mailto:${SUPPORT_EMAIL()}" style="color:#C9A84C;text-decoration:none;">contact support</a>.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};
