import { Injectable } from '@nestjs/common';
import { AccountPort } from '../../application/ports/account.port';
import type { UserInfoResp, UserUsage } from '../../core/account-context';
import { config } from '../../config';

const PLANS_TTL_MS = 10 * 60_000;

/** billing y telemetría por HTTP, reenviando el ID token de Firebase del usuario. */
@Injectable()
export class HttpAccountAdapter extends AccountPort {
  private plans: { at: number; names: Record<string, string> } | null = null;

  async userInfo(idToken: string): Promise<UserInfoResp> {
    const res = await this.get(`${config.BILLING_URL}/userInfo`, idToken);
    if (!res.ok) throw new Error(`billing userInfo → HTTP ${res.status}`);
    return (await res.json()) as UserInfoResp;
  }

  async usage(idToken: string, uid: string): Promise<UserUsage | null> {
    const res = await this.get(`${config.TELEMETRY_URL}/api/user-usage/${encodeURIComponent(uid)}`, idToken);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`telemetría user-usage → HTTP ${res.status}`);
    return (await res.json()) as UserUsage;
  }

  async planNames(): Promise<Record<string, string>> {
    if (this.plans && Date.now() - this.plans.at < PLANS_TTL_MS) return this.plans.names;
    try {
      const res = await this.get(`${config.BILLING_URL}/getPlans`);
      if (!res.ok) throw new Error(`billing getPlans → HTTP ${res.status}`);
      const body = (await res.json()) as unknown;
      const list = Array.isArray(body) ? body : (body as { plans?: unknown })?.plans;
      const names: Record<string, string> = {};
      if (Array.isArray(list)) {
        for (const p of list) if (typeof p?.code_name === 'string' && typeof p?.display_name === 'string') names[p.code_name] = p.display_name;
      }
      this.plans = { at: Date.now(), names };
      return names;
    } catch (e) {
      // Mejor nombres de hace un rato que ninguno.
      if (this.plans) return this.plans.names;
      throw e;
    }
  }

  private get(url: string, idToken?: string) {
    return fetch(url, {
      headers: { Accept: 'application/json', ...(idToken && { Authorization: `Bearer ${idToken}` }) },
      signal: AbortSignal.timeout(config.UPSTREAM_TIMEOUT_MS),
    });
  }
}
