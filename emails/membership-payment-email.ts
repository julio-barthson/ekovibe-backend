import { SUPPORT_EMAIL } from './support-contact';

interface MembershipPaymentEmailProps {
  fullName: string;
  tier: 'GOLD' | 'BLACK';
  amount: string; // formatted, e.g. "₦50,000"
  paymentUrl: string;
}

export function MembershipPaymentEmail({
  fullName,
  tier,
  amount,
  paymentUrl,
}: MembershipPaymentEmailProps): string {
  const tierLabel = tier === 'GOLD' ? 'Gold' : 'Black';
  const tierAccent = tier === 'GOLD' ? '#C9A84C' : '#6B6560';
  const tierBorder = tier === 'GOLD' ? '#C9A84C' : '#9E9892';
  const btnBg = tier === 'GOLD' ? '#C9A84C' : '#1C1A14';
  const btnText = tier === 'GOLD' ? '#1C1A14' : '#ffffff';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Membership Approved — Ekovibe</title>
</head>
<body style="margin:0;padding:0;background-color:#F5F0E8;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F0E8;padding:48px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:20px;border:1px solid #E8E2D9;">

          <!-- Header -->
          <tr>
            <td style="background:#1C1A14;padding:40px;text-align:center;border-radius:20px 20px 0 0;">
              <p style="margin:0 0 8px;font-size:16px;font-weight:800;letter-spacing:0.45em;color:#C9A84C;text-transform:uppercase;">EKOVIBE</p>
              <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  <td style="border:1px solid ${tierBorder};border-radius:100px;padding:6px 20px;">
                    <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:0.2em;color:${tierAccent};text-transform:uppercase;">${tierLabel} Membership</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px;">

              <!-- Success Banner -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#ECFDF5;border:1px solid #BBF7D0;border-radius:12px;margin-bottom:28px;">
                <tr>
                  <td style="padding:18px 24px;">
                    <p style="margin:0 0 3px;font-size:12px;font-weight:700;letter-spacing:0.15em;color:#16803C;text-transform:uppercase;">&#10003; Application Approved</p>
                    <p style="margin:0;font-size:13px;color:#166534;">Complete your payment to activate your membership.</p>
                  </td>
                </tr>
              </table>

              <h1 style="margin:0 0 8px;font-size:28px;font-weight:800;color:#1C1A14;line-height:1.2;">
                You've Been<br/><span style="color:${tierAccent};">Approved</span>
              </h1>

              <p style="margin:16px 0 32px;font-size:15px;color:#6B6560;line-height:1.7;">
                ${fullName}, your application for <strong style="color:#1C1A14;">Ekovibe ${tierLabel} Membership</strong> has been approved. Complete your membership by making the payment below.
              </p>

              <!-- Payment Details -->
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E8E2D9;border-radius:12px;margin-bottom:28px;">
                <tr>
                  <td style="padding:16px 20px;border-bottom:1px solid #E8E2D9;background:#F9F7F3;border-radius:12px 12px 0 0;">
                    <p style="margin:0 0 3px;font-size:10px;letter-spacing:0.2em;color:#9E9892;text-transform:uppercase;">Membership Tier</p>
                    <p style="margin:0;font-size:15px;font-weight:700;color:${tierAccent};">${tierLabel}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 20px;background:#F9F7F3;border-radius:0 0 12px 12px;">
                    <p style="margin:0 0 3px;font-size:10px;letter-spacing:0.2em;color:#9E9892;text-transform:uppercase;">Amount Due</p>
                    <p style="margin:0;font-size:24px;font-weight:800;color:#1C1A14;">${amount}</p>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 28px;font-size:13px;color:#6B6560;line-height:1.7;">
                This payment link is unique to your application and expires in <strong style="color:#1C1A14;">48 hours</strong>. Once payment is confirmed, your account will be upgraded automatically.
              </p>

              <!-- CTA -->
              <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td style="background:${btnBg};border-radius:8px;">
                    <a href="${paymentUrl}"
                       style="display:inline-block;padding:14px 40px;font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${btnText};text-decoration:none;">
                      Complete Payment
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0;font-size:12px;color:#B8B0A8;line-height:1.7;">
                If you did not apply for Ekovibe membership or need help, contact us at <a href="mailto:${SUPPORT_EMAIL()}" style="color:#C9A84C;text-decoration:none;">${SUPPORT_EMAIL()}</a>.
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
