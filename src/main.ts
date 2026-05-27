import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const allowlist =
    config
      .get<string>('FRONTEND_ORIGINS')
      ?.split(',')
      .map((s) => s.trim())
      .filter(Boolean) ?? [];
  const isDev = config.get<string>('NODE_ENV') !== 'production';
  const localhostPattern = /^https?:\/\/localhost(?::\d+)?$/;

  type CorsCallback = (err: Error | null, allow?: boolean) => void;
  app.enableCors({
    origin: (origin: string | undefined, callback: CorsCallback) => {
      if (!origin) return callback(null, true);
      if (allowlist.includes(origin)) return callback(null, true);
      if (isDev && localhostPattern.test(origin)) return callback(null, true);
      callback(new Error(`CORS: origin ${origin} is not allowed`), false);
    },
    credentials: true,
  });

  const port = Number(config.get('PORT') ?? 4000);
  await app.listen(port);
  console.log(`Pet Pod API listening on http://localhost:${port}`);
}

void bootstrap();
