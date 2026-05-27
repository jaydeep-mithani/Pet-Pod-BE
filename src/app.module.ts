import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health.controller';
import { PrismaModule } from './prisma/prisma.module';
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
    PrismaModule,
    CloudinaryModule,
    AuthModule,
    UsersModule,
    PetsModule,
    UploadsModule,
    ChatModule,
    ConversationsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
