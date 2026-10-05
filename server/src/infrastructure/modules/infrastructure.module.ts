import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { AccountPort } from '../../application/ports/account.port';
import { ContentPort } from '../../application/ports/content.port';
import { TokenVerifierPort } from '../../application/ports/token-verifier.port';
import { GetHomeUseCase } from '../../application/use-cases/get-home.use-case';
import { GetMessagesUseCase } from '../../application/use-cases/get-messages.use-case';
import { config } from '../../config';
import { FirebaseTokenVerifier } from '../adapters/firebase-token-verifier.adapter';
import { FsContentStore } from '../adapters/fs-content-store.adapter';
import { HttpAccountAdapter } from '../adapters/http-account.adapter';
import { HealthController } from '../controllers/health.controller';
import { HomeController } from '../controllers/home.controller';
import { InternalController } from '../controllers/internal.controller';
import { MessagesController } from '../controllers/messages.controller';
import { RawController } from '../controllers/raw.controller';

@Module({
  imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }])],
  controllers: [HealthController, RawController, HomeController, MessagesController, InternalController],
  providers: [
    { provide: ContentPort, useFactory: () => FsContentStore.load(config.CONTENT_DIR) },
    { provide: AccountPort, useClass: HttpAccountAdapter },
    { provide: TokenVerifierPort, useClass: FirebaseTokenVerifier },
    GetHomeUseCase,
    GetMessagesUseCase,
  ],
})
export class InfrastructureModule {}
