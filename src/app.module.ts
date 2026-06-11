import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { HealthController } from './health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { EmailModule } from './email/email.module';
import { EmailVerificationModule } from './email-verification/email-verification.module';
import { PasswordResetModule } from './password-reset/password-reset.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PetsModule } from './pets/pets.module';
import { CloudinaryModule } from './cloudinary/cloudinary.module';
import { UploadsModule } from './uploads/uploads.module';
import { ChatModule } from './chat/chat.module';
import { ConversationsModule } from './conversations/conversations.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Default per-IP throttler. Individual controllers opt into stricter
    // limits via @Throttle() (e.g. password-reset endpoints). The default
    // here exists so any future endpoint without an explicit limit still
    // has a sane ceiling against runaway clients.
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60_000,
        limit: 120,
      },
    ]),
    PrismaModule,
    EmailModule,
    EmailVerificationModule,
    PasswordResetModule,
    CloudinaryModule,
    AuthModule,
    UsersModule,
    PetsModule,
    UploadsModule,
    ChatModule,
    ConversationsModule,
  ],
  controllers: [HealthController],
  providers: [
    // Global IP-scoped throttling. Endpoints with @Throttle({ ... }) tighten
    // these defaults; @SkipThrottle() opts out where needed.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
