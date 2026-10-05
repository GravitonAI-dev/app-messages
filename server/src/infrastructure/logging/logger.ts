import pino from 'pino';
import { config } from '../../config';

// JSON por stdout: en el VPS lo recoge `docker logs`.
export const createLogger = (source: string) =>
  pino({
    level: config.LOG_LEVEL,
    timestamp: pino.stdTimeFunctions.isoTime,
    base: { source },
  });

export const logger = createLogger('main');
