import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import {
  passwordChangedTemplate,
  passwordResetTemplate,
  useGoogleSigninTemplate,
} from '../email/templates/password-reset.template';
import { BCRYPT_ROUNDS } from '../auth/auth.constants';

const TOKEN_BYTES = 32;
const TOKEN_TTL_MINUTES = 30;
const MAX_SENDS_PER_HOUR = 3;

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Always returns { ok: true } within roughly constant time and never
   * surfaces whether the email is registered. Email-sending is done
   * fire-and-forget so the response time doesn't reveal whether we went
   * down a real branch or the early-return-on-unknown-email path.
   *
   * Per the security review:
   *   - never throws 429 (silently no-ops if per-user rate limit hit)
   *   - never reveals account existence or account type (Google vs password)
   *   - email-sending side-effects are deferred so timing is constant
   */
  async requestReset(email: string): Promise<{ ok: true }> {
    const normalized = email.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({
      where: { email: normalized },
    });

    // Defer all email-bound work so the HTTP response is constant-time
    // regardless of which branch we took.
    if (user) {
      void this.doSendReset(user);
    }

    return { ok: true };
  }

  /**
   * Internal helper: actually decides which email (if any) to send for a
   * known user, and quietly no-ops on rate-limit hits.
   */
  private async doSendReset(user: {
    id: string;
    email: string;
    name: string;
    passwordHash: string | null;
  }): Promise<void> {
    try {
      if (!user.passwordHash) {
        // Google-only account — there's no password to reset. Send a
        // friendly explainer pointing them back to the Google button.
        // Subject deliberately matches the regular reset email so inbox
        // metadata can't be used to enumerate account type.
        const signInUrl = this.appUrl('/login');
        const { subject, html } = useGoogleSigninTemplate({
          name: user.name,
          signInUrl,
        });
        await this.email.send({ to: user.email, subject, html });
        return;
      }

      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const recentSends = await this.prisma.passwordReset.count({
        where: { userId: user.id, createdAt: { gte: oneHourAgo } },
      });
      if (recentSends >= MAX_SENDS_PER_HOUR) {
        // Silently no-op rather than 429 — surfacing the limit to the
        // caller would leak account existence.
        this.logger.warn(
          `Password reset rate-limit hit for user ${user.id}; suppressing email send.`,
        );
        return;
      }

      const token = randomBytes(TOKEN_BYTES).toString('hex');
      const tokenHash = hashToken(token);
      const expiresAt = new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000);

      // Invalidate prior unconsumed tokens + insert the new one atomically.
      await this.prisma.$transaction([
        this.prisma.passwordReset.updateMany({
          where: { userId: user.id, consumedAt: null },
          data: { consumedAt: new Date() },
        }),
        this.prisma.passwordReset.create({
          data: { userId: user.id, tokenHash, expiresAt },
        }),
      ]);

      const resetUrl = this.appUrl(
        `/reset-password?token=${encodeURIComponent(token)}`,
      );
      const { subject, html } = passwordResetTemplate({
        name: user.name,
        resetUrl,
        expiresInMinutes: TOKEN_TTL_MINUTES,
      });
      await this.email.send({ to: user.email, subject, html });
    } catch (err) {
      // Never let errors bubble to the response — that would create a
      // timing/error oracle. Just log internally.
      this.logger.error(
        `Password reset side-effect failed for user ${user.id}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * Validate the token and apply the new password. Treats the reset as a
   * security event: invalidates pending email-verification codes, force-
   * logs-out all sessions, marks the user verified (inbox ownership is
   * proven by clicking the link), and notifies the user via email that
   * their password was changed.
   */
  async resetPassword(
    token: string,
    newPassword: string,
  ): Promise<{ ok: true }> {
    const tokenHash = hashToken(token);
    const record = await this.prisma.passwordReset.findUnique({
      where: { tokenHash },
    });
    if (
      !record ||
      record.consumedAt !== null ||
      record.expiresAt <= new Date()
    ) {
      throw new BadRequestException(
        'This reset link is invalid or has expired. Please request a new one.',
      );
    }

    // Conditional consume: only proceed if WE are the one that flipped
    // consumedAt. This prevents two concurrent requests both succeeding.
    const consumed = await this.prisma.passwordReset.updateMany({
      where: { id: record.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    if (consumed.count !== 1) {
      throw new BadRequestException(
        'This reset link is invalid or has expired. Please request a new one.',
      );
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    const now = new Date();
    let user: { id: string; email: string; name: string } | null = null;

    await this.prisma.$transaction(async (tx) => {
      user = await tx.user.update({
        where: { id: record.userId },
        data: {
          passwordHash,
          // Possession of the inbox is proven by clicking the link, so the
          // email counts as verified from here on.
          emailVerified: true,
          emailVerifiedAt: now,
          // Bumped so JwtStrategy can invalidate still-outstanding access
          // tokens issued before this reset.
          passwordChangedAt: now,
        },
        select: { id: true, email: true, name: true },
      });
      // Force-logout: revoke all refresh tokens.
      await tx.refreshToken.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: now },
      });
      // Invalidate any pending email-verification codes. Without this, an
      // attacker who initiated an email change pre-reset could complete the
      // verification post-reset with the code they already received.
      await tx.emailVerification.updateMany({
        where: { userId: record.userId, consumedAt: null },
        data: { consumedAt: now },
      });
    });

    // Send the password-changed notification fire-and-forget so a slow
    // SMTP doesn't block the API response.
    if (user) {
      void this.sendPasswordChangedEmail(user, now).catch((err: unknown) => {
        this.logger.error(
          `Password-changed notification failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      });
    }

    return { ok: true };
  }

  private async sendPasswordChangedEmail(
    user: { email: string; name: string },
    changedAt: Date,
  ): Promise<void> {
    const { subject, html } = passwordChangedTemplate({
      name: user.name,
      changedAt,
      contactUrl: this.appUrl('/forgot-password'),
    });
    await this.email.send({ to: user.email, subject, html });
  }

  private appUrl(path: string): string {
    const base = (this.config.get<string>('APP_URL') ?? '').replace(/\/$/, '');
    return `${base}${path}`;
  }
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
