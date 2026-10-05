import { Module } from '@nestjs/common';
import { InfrastructureModule } from './infrastructure/modules/infrastructure.module';

@Module({
  imports: [InfrastructureModule],
})
export class AppModule {}
