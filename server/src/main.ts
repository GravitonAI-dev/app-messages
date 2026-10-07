// Lo primero: carga los ficheros de entorno antes de que config.ts lea process.env.
import { loadedEnvFiles } from './load-env';
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
  logger.info(
    {
      port: config.PORT,
      content: config.CONTENT_DIR,
      APP_ENV: process.env.APP_ENV || '-',
      files: loadedEnvFiles.map((f) => f.split('/').pop()),
      reload: config.RELOAD_TOKEN ? 'on' : 'off',
    },
    'app-messages-server arrancado',
  );
}

bootstrap().catch((err) => {
  logger.error({ err }, 'No se pudo arrancar');
  process.exit(1);
});
