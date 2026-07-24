import { SUPPORT_EMAIL } from './support-contact';

export const ForgotPasswordEmail = ({
  firstName,
  otp,
}: {
  firstName: string;
  otp: string;
}) => {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Reset Your Password — Ekovibe</title>
</head>
<body style="margin:0;padding:0;background-color:#F5F0E8;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F0E8;padding:48px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:20px;border:1px solid #E8E2D9;">

          <!-- Header -->
          <tr>
            <td style="background:#1C1A14;padding:32px 40px;text-align:center;border-radius:20px 20px 0 0;">
              <p style="margin:0 0 2px;font-size:14px;font-weight:800;letter-spacing:0.4em;color:#C9A84C;text-transform:uppercase;">EKOVIBE</p>
              <p style="margin:0;font-size:10px;letter-spacing:0.15em;color:#6B5A35;text-transform:uppercase;">Destination &amp; Vibes</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:48px 40px;text-align:center;">

              <p style="margin:0 0 8px;font-size:11px;letter-spacing:0.3em;color:#C9A84C;text-transform:uppercase;font-weight:600;">Security Verification</p>
              <h1 style="margin:0 0 16px;font-size:28px;font-weight:800;color:#1C1A14;line-height:1.2;">Reset Your Password</h1>

              <p style="margin:0 0 36px;font-size:15px;color:#6B6560;line-height:1.7;">
                Hello ${firstName}, we received a request to reset your Ekovibe account password. Use the verification code below to proceed.
              </p>

              <!-- OTP Box -->
              <table cellpadding="0" cellspacing="0" style="margin:0 auto 16px;">
                <tr>
                  <td style="background:#F9F7F3;border:2px solid #C9A84C;border-radius:16px;padding:28px 48px;text-align:center;">
                    <p style="margin:0 0 6px;font-size:10px;letter-spacing:0.2em;color:#9E9892;text-transform:uppercase;">Verification Code</p>
                    <p style="margin:0;font-size:42px;font-weight:800;letter-spacing:0.2em;color:#1C1A14;font-family:'Courier New',Courier,monospace;">${otp}</p>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 36px;font-size:12px;font-weight:700;color:#DC2626;text-transform:uppercase;letter-spacing:0.1em;">This code expires in 10 minutes</p>

              <p style="margin:0;font-size:13px;color:#9E9892;line-height:1.7;">
                If you did not request this, please secure your account by changing your password or contacting our support team immediately.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#F9F7F3;border-top:1px solid #E8E2D9;padding:28px 40px;text-align:center;border-radius:0 0 20px 20px;">
              <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:0.25em;color:#C9A84C;text-transform:uppercase;">EKOVIBE</p>
              <p style="margin:0 0 8px;font-size:11px;color:#9E9892;">Lagos &bull; Abuja &bull; Ibadan</p>
              <p style="margin:0 0 6px;font-size:11px;color:#B8B0A8;">&copy; ${new Date().getFullYear()} ekovibe Lifestyle Group</p>
              <p style="margin:0;font-size:11px;color:#B8B0A8;">This is an automated security notification. Do not reply. <a href="mailto:${SUPPORT_EMAIL()}" style="color:#C9A84C;text-decoration:none;">Contact Support</a></p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};
