import { Controller, Get, Header, Query } from '@nestjs/common';
import { GetHomeUseCase } from '../../application/use-cases/get-home.use-case';
import { normalizeLang } from '../../core/i18n';

@Controller('v1/home')
export class HomeController {
  constructor(private readonly getHome: GetHomeUseCase) {}

  @Get()
  @Header('Cache-Control', 'public, max-age=60')
  @Header('Access-Control-Allow-Origin', '*')
  home(@Query('lang') lang?: string) {
    return this.getHome.execute(normalizeLang(lang));
  }
}
