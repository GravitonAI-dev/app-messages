import { Body, Controller, Headers, HttpCode, Post, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { TokenVerifierPort } from '../../application/ports/token-verifier.port';
import { GetMessagesUseCase } from '../../application/use-cases/get-messages.use-case';
import { normalizeLang } from '../../core/i18n';
import { clientVars } from '../../core/render';

interface MessagesBody {
  lang?: string;
  time_zone?: string;
  app?: { version?: unknown; platform?: unknown };
  dismissed?: unknown;
  vars?: unknown;
}

const shortString = (v: unknown) => (typeof v === 'string' && v.length <= 64 ? v : undefined);

/** Los mensajes que tocan a la cuenta del token, evaluados y con las variables puestas. */
@Controller('v1/messages')
@UseGuards(ThrottlerGuard)
export class MessagesController {
  constructor(
    private readonly verifier: TokenVerifierPort,
    private readonly getMessages: GetMessagesUseCase,
  ) {}

  @Post()
  @HttpCode(200)
  async messages(@Headers('authorization') authorization: string | undefined, @Body() body: MessagesBody = {}) {
    const idToken = /^Bearer\s+(.+)$/i.exec(authorization ?? '')?.[1]?.trim();
    if (!idToken) throw new UnauthorizedException('Falta el ID token');
    const user = await this.verifier.verify(idToken).catch(() => {
      throw new UnauthorizedException('ID token no válido');
    });

    return this.getMessages.execute({
      user,
      idToken,
      lang: normalizeLang(body.lang),
      timeZone: shortString(body.time_zone) ?? 'Europe/Madrid',
      app: { version: shortString(body.app?.version), platform: shortString(body.app?.platform) },
      dismissed: Array.isArray(body.dismissed) ? body.dismissed.filter((d): d is string => typeof d === 'string').slice(0, 100) : [],
      vars: clientVars(body.vars),
    });
  }
}
