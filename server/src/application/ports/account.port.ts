import type { UserInfoResp, UserUsage } from '../../core/account-context';

/** billing (userInfo, getPlans) y telemetría (user-usage), con el token del usuario. */
export abstract class AccountPort {
  abstract userInfo(idToken: string): Promise<UserInfoResp>;
  /** null = telemetría aún no tiene métricas de la cuenta (404). */
  abstract usage(idToken: string, uid: string): Promise<UserUsage | null>;
  /** `code_name` → `display_name`. */
  abstract planNames(): Promise<Record<string, string>>;
}
