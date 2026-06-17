import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedRequestUser } from '../types';

/**
 * Guard that blocks unverified users from actions that require a trusted
 * email — listing a pet, opening a conversation, sending a message. Use
 * AFTER JwtAuthGuard. Returns 403 with `code: 'EMAIL_NOT_VERIFIED'` so the
 * FE can route to /verify-email on the response.
 */
@Injectable()
export class EmailVerifiedGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedRequestUser }>();
    const user = req.user;
    if (!user) {
      throw new ForbiddenException({
        message: 'Not authenticated.',
        code: 'NOT_AUTHENTICATED',
      });
    }

    const record = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { emailVerified: true },
    });
    if (!record?.emailVerified) {
      throw new ForbiddenException({
        message: 'Please verify your email to continue.',
        code: 'EMAIL_NOT_VERIFIED',
      });
    }
    return true;
  }
}
