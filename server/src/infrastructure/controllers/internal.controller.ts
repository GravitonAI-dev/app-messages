import { Controller, Headers, HttpCode, NotFoundException, Post, UnauthorizedException } from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import { ContentPort } from '../../application/ports/content.port';
import { config } from '../../config';

const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

@Controller('internal')
export class InternalController {
  constructor(private readonly content: ContentPort) {}

  /** Vuelve a leer el contenido del disco (p. ej. tras montar uno nuevo). Sin RELOAD_TOKEN no existe. */
  @Post('reload')
  @HttpCode(200)
  async reload(@Headers('x-reload-token') token?: string) {
    if (!config.RELOAD_TOKEN) throw new NotFoundException();
    if (!token || !same(token, config.RELOAD_TOKEN)) throw new UnauthorizedException();
    await this.content.reload();
    return { status: 'ok', content_version: this.content.version };
  }
}
