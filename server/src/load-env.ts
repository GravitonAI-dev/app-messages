import { config as dotenvConfig } from 'dotenv';
import { existsSync } from 'fs';
import { join, resolve } from 'path';

/**
 * Perfiles de entorno con los que se puede arrancar (`APP_ENV`): el fichero
 * `.env.<APP_ENV>` junto al servicio. `prod.local` lo levanta todo en local,
 * compilado (`compose.prod.local.yaml`); `dev` queda para un modo local sin
 * compilar.
 */
export const APP_ENVS = ['prod.local', 'dev'] as const;

/**
 * Los ficheros de entorno, de mayor a menor prioridad: dotenv no sobrescribe
 * una variable que ya existe, así que gana el primero, y las variables del
 * proceso (las que Docker pasa al contenedor) ganan a todos.
 *
 *   1. variables del proceso o del contenedor
 *   2. `.env.<APP_ENV>`  el perfil elegido (APP_ENV, solo del proceso)
 *   3. `.env`            el comportamiento por defecto (el servidor)
 *   4. `.env.prod`       respaldo de producción
 *
 * Solo los que existen. La imagen no lleva ninguno: todo llega del `env_file`
 * del compose. La misma regla que Telemetry-IAM, la Smart Gateway y
 * Updates-Manager.
 */
export function envFilesFor(dir: string = resolve(process.cwd()), appEnv: string = process.env.APP_ENV ?? ''): string[] {
  const profile = appEnv.trim();
  if (profile && !(APP_ENVS as readonly string[]).includes(profile)) {
    throw new Error(`APP_ENV=${JSON.stringify(profile)} no es un perfil conocido: ${APP_ENVS.join(', ')}`);
  }
  const names = [...(profile ? [`.env.${profile}`] : []), '.env', '.env.prod'];
  return names.map((name) => join(dir, name)).filter((file) => existsSync(file));
}

/**
 * Se cargan al importar, antes de que `config.ts` lea `process.env`: `main.ts`
 * importa este módulo el primero.
 */
export const loadedEnvFiles = envFilesFor();
if (loadedEnvFiles.length > 0) dotenvConfig({ path: loadedEnvFiles, quiet: true });
