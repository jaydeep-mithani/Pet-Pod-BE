import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticatedRequestUser } from '../types';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedRequestUser => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return request.user as AuthenticatedRequestUser;
  },
);
