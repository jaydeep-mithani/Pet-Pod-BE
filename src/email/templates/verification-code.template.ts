interface VerificationCodeTemplateArgs {
  name: string;
  code: string;
  expiresInMinutes: number;
}

export function verificationCodeTemplate({
  name,
  code,
  expiresInMinutes,
}: VerificationCodeTemplateArgs): { subject: string; html: string } {
  const subject = `Your Pet Pod verification code: ${code}`;
  const safeName = escapeHtml(name);
  const safeCode = escapeHtml(code);

  // Email clients are hostile rendering environments: <style> blocks get
  // stripped (Gmail, most mobile clients), Outlook doesn't render CSS
  // gradients, and flex/grid is unreliable. So: inline styles only, tables
  // for layout, solid-colour fallbacks behind every gradient.
  const html = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin: 0; padding: 0; background-color: #fff1f2;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #fff1f2; background-image: linear-gradient(135deg, #fff1f2 0%, #fffbeb 50%, #fff1f2 100%);">
      <tr>
        <td align="center" style="padding: 40px 16px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width: 560px;">
            <tr>
              <td style="background-color: #ffffff; border-radius: 24px; padding: 40px 32px; box-shadow: 0 25px 50px -12px rgba(17, 24, 39, 0.10); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; color: #111827;">

                <!-- Brand row -->
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="vertical-align: middle; padding-right: 10px;">
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="36" height="36" style="background-color: #ec4899; background-image: linear-gradient(135deg, #ec4899 0%, #9333ea 100%); border-radius: 10px;">
                        <tr>
                          <td align="center" valign="middle" height="36" style="color: #ffffff; font-size: 18px; line-height: 1; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                            &#10084;
                          </td>
                        </tr>
                      </table>
                    </td>
                    <td style="vertical-align: middle;">
                      <span style="font-size: 20px; font-weight: 700; color: #111827; letter-spacing: -0.01em;">Pet Pod</span>
                    </td>
                  </tr>
                </table>

                <!-- Heading -->
                <h1 style="margin: 32px 0 12px; font-size: 24px; font-weight: 700; color: #111827; line-height: 1.3; letter-spacing: -0.02em;">
                  Welcome, ${safeName}.
                </h1>
                <p style="margin: 0 0 28px; font-size: 15px; color: #4b5563; line-height: 1.65;">
                  Use the code below to verify your email. Once verified, you’ll be able to list pets for rehoming and start conversations with adopters. The code expires in <strong style="color: #111827;">${expiresInMinutes} minutes</strong>.
                </p>

                <!-- Code card -->
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                  <tr>
                    <td align="center" style="background-color: #fdf2f8; background-image: linear-gradient(135deg, #fdf2f8 0%, #fce7f3 100%); border: 1px solid #fbcfe8; border-radius: 16px; padding: 28px 16px;">
                      <div style="font-family: 'SF Mono', 'Cascadia Mono', Menlo, Consolas, monospace; font-size: 36px; font-weight: 700; letter-spacing: 0.6em; color: #be185d; padding-left: 0.6em;">
                        ${safeCode}
                      </div>
                    </td>
                  </tr>
                </table>

                <!-- Reassurance copy -->
                <p style="margin: 28px 0 0; font-size: 13px; color: #6b7280; line-height: 1.6;">
                  Didn’t sign up for Pet Pod? Someone may have entered your email by mistake — you can safely ignore this message. We won’t email you again unless you request a new code.
                </p>

                <!-- Footer brand -->
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top: 36px; border-top: 1px solid #f3f4f6;">
                  <tr>
                    <td align="center" style="padding-top: 20px; font-size: 12px; color: #9ca3af;">
                      No money. Just love.<br />
                      <span style="font-weight: 600; color: #6b7280;">Pet Pod</span> &middot; helping pets find homes
                    </td>
                  </tr>
                </table>

              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`;

  return { subject, html };
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
