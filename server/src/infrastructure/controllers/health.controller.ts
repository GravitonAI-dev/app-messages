import { Controller, Get } from '@nestjs/common';
import { ContentPort } from '../../application/ports/content.port';

@Controller('health')
export class HealthController {
  constructor(private readonly content: ContentPort) {}

  @Get()
  check() {
    return { status: 'ok', content_version: this.content.version, timestamp: new Date().toISOString() };
  }
}
