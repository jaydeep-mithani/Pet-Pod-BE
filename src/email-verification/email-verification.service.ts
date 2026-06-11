import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomInt, createHash } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { verificationCodeTemplate } from '../email/templates/verification-code.template';

const CODE_LENGTH = 6;
const CODE_TTL_MINUTES = 10;
const MAX_ATTEMPTS_PER_CODE = 5;
const MAX_SENDS_PER_HOUR = 5;

@Injectable()
export class EmailVerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {}

  /** Generate + persist a fresh code and email it to the user. */
  async sendCode(userId: string): Promise<{ sent: true; expiresAt: Date }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.emailVerified) {
      throw new ConflictException('Email is already verified');
    }

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentSends = await this.prisma.emailVerification.count({
      where: { userId, createdAt: { gte: oneHourAgo } },
    });
    if (recentSends >= MAX_SENDS_PER_HOUR) {
      throw new HttpException(
        'Too many verification emails — try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Invalidate any previously-active codes so only the latest works.
    await this.prisma.emailVerification.updateMany({
      where: { userId, consumedAt: null },
      data: { consumedAt: new Date() },
    });

    const code = generateCode();
    const codeHash = hashCode(code);
    const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000);

    await this.prisma.emailVerification.create({
      data: { userId, codeHash, expiresAt },
    });

    const { subject, html } = verificationCodeTemplate({
      name: user.name,
      code,
      expiresInMinutes: CODE_TTL_MINUTES,
    });
    await this.email.send({ to: user.email, subject, html });

    return { sent: true, expiresAt };
  }

  /**
   * Replace an unverified user's email address (fixing a typo at signup,
   * e.g.) and send a fresh code to the new address. Refuses if the account
   * is already verified — verified users need a dedicated change-email flow
   * that notifies the old address.
   */
  async changeEmail(
    userId: string,
    newEmail: string,
  ): Promise<{ changed: true; email: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.emailVerified) {
      throw new ConflictException(
        'Email is already verified. Use profile settings to change it.',
      );
    }

    const normalized = newEmail.toLowerCase().trim();
    if (normalized === user.email) {
      throw new BadRequestException(
        'That is your current email — no change needed.',
      );
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        // Update the email + invalidate any pending codes (they were sent to
        // the old address and no longer apply).
        await tx.user.update({
          where: { id: userId },
          data: { email: normalized },
        });
        await tx.emailVerification.updateMany({
          where: { userId, consumedAt: null },
          data: { consumedAt: new Date() },
        });
      });
    } catch (err) {
      // Prisma uniqueness violation = email already in use by another user.
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException('That email is already in use.');
      }
      throw err;
    }

    // Send a code to the new address. If the email send fails, the email is
    // still changed — the user can hit "Resend" on the verify screen.
    await this.sendCode(userId);

    return { changed: true, email: normalized };
  }

  /** Validate a submitted code and mark the user verified on match. */
  async checkCode(userId: string, code: string): Promise<{ verified: true }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.emailVerified) return { verified: true };

    const active = await this.prisma.emailVerification.findFirst({
      where: {
        userId,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!active) {
      throw new BadRequestException(
        'No active verification code — please request a new one.',
      );
    }

    if (active.attempts >= MAX_ATTEMPTS_PER_CODE) {
      await this.prisma.emailVerification.update({
        where: { id: active.id },
        data: { consumedAt: new Date() },
      });
      throw new HttpException(
        'Too many wrong attempts — please request a new code.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (active.codeHash !== hashCode(code)) {
      await this.prisma.emailVerification.update({
        where: { id: active.id },
        data: { attempts: { increment: 1 } },
      });
      throw new BadRequestException('Invalid verification code.');
    }

    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.emailVerification.update({
        where: { id: active.id },
        data: { consumedAt: now },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { emailVerified: true, emailVerifiedAt: now },
      }),
    ]);

    return { verified: true };
  }
}

function generateCode(): string {
  // 6-digit code; randomInt is uniform across [min, max).
  const min = 10 ** (CODE_LENGTH - 1);
  const max = 10 ** CODE_LENGTH;
  return String(randomInt(min, max));
}

function hashCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}
