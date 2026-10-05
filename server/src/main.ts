import 'dotenv/config';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { config } from './config';
import { logger } from './infrastructure/logging/logger';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['error', 'warn', 'log'],
    cors: { origin: '*' },
  });
  app.enableShutdownHooks();

  await app.listen(config.PORT);
  logger.info({ port: config.PORT, content: config.CONTENT_DIR }, 'app-messages-server arrancado');
}

bootstrap().catch((err) => {
  logger.error({ err }, 'No se pudo arrancar');
  process.exit(1);
});
