import { Module } from '@nestjs/common';
import { ContentPort } from '../../application/ports/content.port';
import { GetHomeUseCase } from '../../application/use-cases/get-home.use-case';
import { config } from '../../config';
import { FsContentStore } from '../adapters/fs-content-store.adapter';
import { HealthController } from '../controllers/health.controller';
import { HomeController } from '../controllers/home.controller';
import { InternalController } from '../controllers/internal.controller';
import { RawController } from '../controllers/raw.controller';

@Module({
  controllers: [HealthController, RawController, HomeController, InternalController],
  providers: [{ provide: ContentPort, useFactory: () => FsContentStore.load(config.CONTENT_DIR) }, GetHomeUseCase],
})
export class InfrastructureModule {}
