import { readdirSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { AccountPort } from '../src/application/ports/account.port';
import { TokenVerifierPort, type VerifiedUser } from '../src/application/ports/token-verifier.port';
import type { UserInfoResp, UserUsage } from '../src/core/account-context';

// dist-test/test → raíz del repo
export const REPO = resolve(__dirname, '..', '..', '..');

export interface Fixture {
  file: string;
  description: string;
  dismissed?: string[];
  context: Record<string, any>;
  expected: { forced_block: boolean; visible_now: string[]; queue: string[] };
}

export const fixtures = (): Fixture[] => {
  const dir = resolve(REPO, 'fixtures/contexts');
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => ({ file: f, ...JSON.parse(readFileSync(resolve(dir, f), 'utf8')) }));
};

const DAY = 86_400_000;
const HOUR = 3_600_000;

/**
 * Las respuestas de billing y telemetría que dan el contexto del fixture, y
 * el momento en que hay que evaluarlo para que salga su `days_left`.
 */
export function upstreamFor(ctx: Record<string, any>) {
  const hasUsage = Object.keys(ctx).some((k) => k.startsWith('usage.'));
  const usage: UserUsage | null = hasUsage
    ? {
        payment_status: ctx['usage.payment_status'],
        usage_percentage: ctx['usage.usage_percentage'],
        has_constraints: ctx['usage.has_constraints'],
        used: ctx['usage.used'],
        limit: ctx['usage.limit'],
      }
    : null;

  const hasMembership = Object.keys(ctx).some((k) => k.startsWith('membership.'));
  const maxDays = ctx['membership.max_days'];
  const info: UserInfoResp = hasMembership
    ? {
        user_info: { display_name: 'Ana <b>Pérez</b>', email: 'ana@example.com' },
        membership_info: {
          payment_status: ctx['membership.payment_status'],
          created_at: ctx['membership.created_at'],
          expires_at: ctx['membership.expires_at'],
          plan_snapshot: {
            code_name: ctx['membership.plan_code'],
            display_name: ctx['membership.plan_name'],
            constraints: maxDays == null ? [] : [{ code_name: 'max_days', limit: maxDays, is_active: true }],
          },
        },
      }
    : {};

  let now: Date;
  const expires = ctx['membership.expires_at'];
  const d = ctx['membership.days_left'];
  if (expires && typeof d === 'number') {
    // trunc((exp - now) / día) = d
    now = new Date(new Date(expires).getTime() - d * DAY + (d >= 0 ? -HOUR : HOUR));
  } else {
    now = new Date(new Date(ctx['membership.created_at'] ?? '2026-10-01T00:00:00Z').getTime() + (ctx['membership.hours_since_start'] ?? 0) * HOUR);
  }
  return { usage, info, now };
}

export class FakeAccount extends AccountPort {
  constructor(
    public info: UserInfoResp | Error = {},
    public usageResp: UserUsage | null | Error = null,
    public plans: Record<string, string> = { basic_plan: 'Confidential', pro_plan: 'Extended', lex_pro_plan: 'Abogados' },
  ) {
    super();
  }
  lastToken?: string;
  async userInfo(idToken: string) {
    this.lastToken = idToken;
    if (this.info instanceof Error) throw this.info;
    return this.info;
  }
  async usage() {
    if (this.usageResp instanceof Error) throw this.usageResp;
    return this.usageResp;
  }
  async planNames() {
    return this.plans;
  }
}

export class FakeVerifier extends TokenVerifierPort {
  async verify(idToken: string): Promise<VerifiedUser> {
    if (idToken !== 'good-token') throw new Error('bad token');
    return { uid: 'uid-1', email: 'ana@example.com', name: 'Ana' };
  }
}
