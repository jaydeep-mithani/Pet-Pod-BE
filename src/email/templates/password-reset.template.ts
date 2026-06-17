interface PasswordResetTemplateArgs {
  name: string;
  resetUrl: string;
  expiresInMinutes: number;
}

interface UseGoogleSigninTemplateArgs {
  name: string;
  signInUrl: string;
}

export function passwordResetTemplate({
  name,
  resetUrl,
  expiresInMinutes,
}: PasswordResetTemplateArgs): { subject: string; html: string } {
  const subject = 'Reset your Pet Pod password';
  const safeName = escapeHtml(name);
  const safeUrl = escapeHtml(resetUrl);

  const html = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="referrer" content="no-referrer" />
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin: 0; padding: 0; background-color: #fff1f2;">
    <!-- Preheader: hidden first text line shown in inbox preview. -->
    <div style="display:none;font-size:1px;color:#fff1f2;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
      Your reset link expires in ${expiresInMinutes} minutes.
    </div>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #fff1f2; background-image: linear-gradient(135deg, #fff1f2 0%, #fffbeb 50%, #fff1f2 100%);">
      <tr>
        <td align="center" style="padding: 40px 16px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width: 560px;">
            <tr>
              <td style="background-color: #ffffff; border-radius: 24px; padding: 40px 32px; box-shadow: 0 25px 50px -12px rgba(17, 24, 39, 0.10); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; color: #111827;">

                ${brandRow()}

                <h1 style="margin: 32px 0 12px; font-size: 24px; font-weight: 700; color: #111827; line-height: 1.3; letter-spacing: -0.02em;">
                  Reset your password, ${safeName}.
                </h1>
                <p style="margin: 0 0 28px; font-size: 15px; color: #4b5563; line-height: 1.65;">
                  Click the button below to choose a new password. The link expires in <strong style="color: #111827;">${expiresInMinutes} minutes</strong> and can only be used once.
                </p>

                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                  <tr>
                    <td align="center" style="padding: 8px 0 24px;">
                      <a href="${safeUrl}" style="display: inline-block; background-color: #9333ea; background-image: linear-gradient(135deg, #ec4899 0%, #9333ea 100%); color: #ffffff; text-decoration: none; font-weight: 600; font-size: 15px; padding: 14px 28px; border-radius: 999px; letter-spacing: 0.01em;">
                        Reset password
                      </a>
                    </td>
                  </tr>
                </table>

                <p style="margin: 0 0 12px; font-size: 13px; color: #6b7280; line-height: 1.6;">
                  Button not working? Copy and paste this link into your browser:
                </p>
                <p style="margin: 0 0 28px; font-size: 12px; color: #9ca3af; word-break: break-all; font-family: 'SF Mono', Menlo, Consolas, monospace;">
                  ${safeUrl}
                </p>

                <p style="margin: 0; font-size: 13px; color: #6b7280; line-height: 1.6;">
                  Didn’t request this? You can safely ignore this email — your password won’t change unless you click the link above and choose a new one.
                </p>

                ${brandFooter()}
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

export function useGoogleSigninTemplate({
  name,
  signInUrl,
}: UseGoogleSigninTemplateArgs): { subject: string; html: string } {
  // Subject deliberately matches the reset email to avoid leaking that the
  // recipient is a Google-only account via inbox metadata.
  const subject = 'Reset your Pet Pod password';
  const safeName = escapeHtml(name);
  const safeUrl = escapeHtml(signInUrl);

  const html = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="referrer" content="no-referrer" />
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin: 0; padding: 0; background-color: #fff1f2;">
    <div style="display:none;font-size:1px;color:#fff1f2;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
      This account uses Google sign-in.
    </div>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #fff1f2; background-image: linear-gradient(135deg, #fff1f2 0%, #fffbeb 50%, #fff1f2 100%);">
      <tr>
        <td align="center" style="padding: 40px 16px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width: 560px;">
            <tr>
              <td style="background-color: #ffffff; border-radius: 24px; padding: 40px 32px; box-shadow: 0 25px 50px -12px rgba(17, 24, 39, 0.10); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; color: #111827;">

                ${brandRow()}

                <h1 style="margin: 32px 0 12px; font-size: 24px; font-weight: 700; color: #111827; line-height: 1.3; letter-spacing: -0.02em;">
                  Hey ${safeName},
                </h1>
                <p style="margin: 0 0 28px; font-size: 15px; color: #4b5563; line-height: 1.65;">
                  You requested a password reset, but your Pet Pod account uses <strong style="color: #111827;">Google sign-in</strong> — there’s no password to reset. Just head back to sign-in and click <em>Continue with Google</em>.
                </p>

                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                  <tr>
                    <td align="center" style="padding: 8px 0 24px;">
                      <a href="${safeUrl}" style="display: inline-block; background-color: #9333ea; background-image: linear-gradient(135deg, #ec4899 0%, #9333ea 100%); color: #ffffff; text-decoration: none; font-weight: 600; font-size: 15px; padding: 14px 28px; border-radius: 999px; letter-spacing: 0.01em;">
                        Go to sign in
                      </a>
                    </td>
                  </tr>
                </table>

                <p style="margin: 0; font-size: 13px; color: #6b7280; line-height: 1.6;">
                  Didn’t request this? You can safely ignore this email.
                </p>

                ${brandFooter()}
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

interface PasswordChangedTemplateArgs {
  name: string;
  changedAt: Date;
  contactUrl: string;
}

export function passwordChangedTemplate({
  name,
  changedAt,
  contactUrl,
}: PasswordChangedTemplateArgs): { subject: string; html: string } {
  const subject = 'Your Pet Pod password was changed';
  const safeName = escapeHtml(name);
  const safeContact = escapeHtml(contactUrl);
  const when = escapeHtml(changedAt.toUTCString().replace(/GMT$/, 'UTC'));

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

                ${brandRow()}

                <h1 style="margin: 32px 0 12px; font-size: 24px; font-weight: 700; color: #111827; line-height: 1.3; letter-spacing: -0.02em;">
                  Your password was changed, ${safeName}.
                </h1>
                <p style="margin: 0 0 18px; font-size: 15px; color: #4b5563; line-height: 1.65;">
                  We’re letting you know because a password change is one of the most security-sensitive actions on your account.
                </p>
                <p style="margin: 0 0 28px; font-size: 14px; color: #6b7280; line-height: 1.6;">
                  <strong style="color: #111827;">When:</strong> ${when}
                </p>

                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 0 0 24px; background-color: #fdf2f8; border: 1px solid #fbcfe8; border-radius: 14px;">
                  <tr>
                    <td style="padding: 16px 18px;">
                      <p style="margin: 0; font-size: 14px; color: #831843; line-height: 1.55;">
                        <strong>Didn’t do this?</strong> Someone may have accessed your inbox. <a href="${safeContact}" style="color: #be185d; text-decoration: underline;">Secure your account</a> right away.
                      </p>
                    </td>
                  </tr>
                </table>

                <p style="margin: 0; font-size: 13px; color: #6b7280; line-height: 1.6;">
                  If this was you, no further action is needed. We’ve also signed you out everywhere as a precaution.
                </p>

                ${brandFooter()}
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

function brandRow(): string {
  return `
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
  `;
}

function brandFooter(): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top: 36px; border-top: 1px solid #f3f4f6;">
      <tr>
        <td align="center" style="padding-top: 20px; font-size: 12px; color: #9ca3af;">
          No money. Just love.<br />
          <span style="font-weight: 600; color: #6b7280;">Pet Pod</span> &middot; helping pets find homes
        </td>
      </tr>
    </table>
  `;
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
