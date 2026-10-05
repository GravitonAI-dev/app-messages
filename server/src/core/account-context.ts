// El contexto de la cuenta contra el que se evalúa el `when` de cada mensaje.
// Misma semántica que `AccountContext.build` de la app (GPT-UI,
// data/services/remote_messages/account_context.dart): un campo que no se
// conoce NO está en el mapa, que no es lo mismo que valer null.

/** Respuesta de telemetría `GET /api/user-usage/{uid}`; null = 404 (sin métricas). */
export interface UserUsage {
  payment_status?: string | null;
  usage_percentage?: number | null;
  has_constraints?: boolean | null;
  used?: number | null;
  limit?: number | null;
}

interface Constraint {
  code_name?: string;
  limit?: number | null;
  is_active?: boolean | null;
}

/** Respuesta de billing `userInfo`. */
export interface UserInfoResp {
  user_info?: { display_name?: string | null; email?: string | null } | null;
  membership_info?: {
    payment_status?: string | null;
    created_at?: string | null;
    expires_at?: string | null;
    plan_snapshot?: { code_name?: string; display_name?: string; constraints?: Constraint[] | null } | null;
  } | null;
}

export interface AccountData {
  usage?: UserUsage | null;
  info?: UserInfoResp | null;
  app?: { version?: string; platform?: string };
}

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

/** Días enteros hasta [expiresAt], truncando hacia cero (lo que asumen los fixtures). */
export const daysLeft = (expiresAt: Date, now: Date) => Math.trunc((expiresAt.getTime() - now.getTime()) / DAY_MS);

const parseDate = (value: unknown) => {
  if (typeof value !== 'string' || !value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

/** `max_days` activo del plan; null si no caduca por días. */
export function maxDays(info?: UserInfoResp | null): number | null {
  const c = info?.membership_info?.plan_snapshot?.constraints?.find(
    (x) => x.code_name === 'max_days' && x.is_active !== false && x.limit != null,
  );
  return c?.limit ?? null;
}

/** Cuándo acaba el plan: manda el `expires_at` del servidor si viene; si no, alta + max_days. */
export function expiresAt(info?: UserInfoResp | null): Date | null {
  const m = info?.membership_info;
  if (!m) return null;
  if ('expires_at' in m) return parseDate(m.expires_at);
  const start = parseDate(m.created_at);
  const days = maxDays(info);
  return start && days != null ? new Date(start.getTime() + days * DAY_MS) : null;
}

export function buildContext({ usage, info, app }: AccountData, now = new Date()): Record<string, unknown> {
  const context: Record<string, unknown> = {};

  if (usage) {
    context['usage.payment_status'] = usage.payment_status ?? null;
    context['usage.usage_percentage'] = usage.usage_percentage ?? null;
    context['usage.has_constraints'] = usage.has_constraints ?? null;
    if (usage.used != null) context['usage.used'] = usage.used;
    if (usage.limit != null) context['usage.limit'] = usage.limit;
  }

  const m = info?.membership_info;
  if (m) {
    const created = parseDate(m.created_at);
    const expires = expiresAt(info);
    context['membership.payment_status'] = m.payment_status ?? null;
    context['membership.plan_code'] = m.plan_snapshot?.code_name ?? null;
    context['membership.plan_name'] = m.plan_snapshot?.display_name ?? null;
    context['membership.created_at'] = created?.toISOString() ?? null;
    context['membership.max_days'] = maxDays(info);
    context['membership.expires_at'] = expires?.toISOString() ?? null;
    context['membership.days_left'] = expires ? daysLeft(expires, now) : null;
    context['membership.hours_since_start'] = created ? Math.trunc((now.getTime() - created.getTime()) / HOUR_MS) : null;
  }

  if (app?.version) context['app.version'] = app.version;
  if (app?.platform) context['app.platform'] = app.platform;
  return context;
}
