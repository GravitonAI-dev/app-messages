import { Controller, Get, Param, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ContentPort } from '../../application/ports/content.port';

/**
 * Los ficheros del repo tal cual, en las mismas rutas: la app que hoy lee de
 * raw.githubusercontent.com sólo tiene que cambiar el host.
 */
@Controller()
export class RawController {
  constructor(private readonly content: ContentPort) {}

  @Get('raw/*')
  raw(@Param('0') path: string, @Req() req: Request, @Res() res: Response) {
    const file = this.content.file(path.replace(/^\/+/, '') || 'index.json');
    if (!file) return res.status(404).json({ statusCode: 404, message: 'No existe' });

    res.setHeader('ETag', file.etag);
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (req.headers['if-none-match'] === file.etag) return res.status(304).end();
    res.setHeader('Content-Type', file.contentType);
    return res.send(file.body);
  }

  /** La vista previa pide `../index.json`: tiene que vivir bajo /raw. */
  @Get(['preview', 'preview/*'])
  preview(@Req() req: Request, @Res() res: Response) {
    const query = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
    const rest = req.path.replace(/^\/preview\/?/, '');
    return res.redirect(302, `/raw/preview/${rest || 'index.html'}${query}`);
  }
}
