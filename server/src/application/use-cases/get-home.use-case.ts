import { Injectable } from '@nestjs/common';
import { ContentPort } from '../ports/content.port';
import { resolveLang } from '../../core/i18n';

/** La portada con los textos ya en el idioma pedido. */
@Injectable()
export class GetHomeUseCase {
  constructor(private readonly content: ContentPort) {}

  execute(lang: string) {
    return {
      schema_version: 1,
      content_version: this.content.version,
      lang,
      home: resolveLang(this.content.home(), lang),
    };
  }
}
