import { Injectable } from '@nestjs/common';
import { evaluateMessages, type MessageAction } from '@app-messages/contract';
import { AccountPort } from '../ports/account.port';
import { ContentPort, type LoadedMessage } from '../ports/content.port';
import type { VerifiedUser } from '../ports/token-verifier.port';
import { buildContext, type UserInfoResp, type UserUsage } from '../../core/account-context';
import { renderText, type RenderScope } from '../../core/render';
import { sanitizeMessageHtml } from '../../core/sanitize';
import { config } from '../../config';
import { createLogger } from '../../infrastructure/logging/logger';

const log = createLogger('GetMessagesUseCase');

/** Último recurso para {{plan.<code>.name}} si billing no responde (los de la siembra). */
const SEED_PLAN_NAMES: Record<string, string> = {
  basic_plan: 'Confidential',
  pro_plan: 'Extended',
  lex_pro_plan: 'Abogados',
};

/** Los HTML antiguos apuntan al repo en crudo; servidos desde aquí, a /raw del servicio. */
const GITHUB_RAW = 'https://raw.githubusercontent.com/GravitonAI-dev/app-messages/main/';

export interface GetMessagesInput {
  user: VerifiedUser;
  idToken: string;
  lang: string;
  timeZone: string;
  app: { version?: string; platform?: string };
  dismissed: string[];
  vars: Record<string, string>;
  now?: Date;
}

type SourceStatus = 'ok' | 'error';

@Injectable()
export class GetMessagesUseCase {
  constructor(
    private readonly content: ContentPort,
    private readonly account: AccountPort,
  ) {}

  async execute(input: GetMessagesInput) {
    const [info, usage, plans] = await Promise.all([
      settle(() => this.account.userInfo(input.idToken)),
      settle(() => this.account.usage(input.idToken, input.user.uid)),
      settle(() => this.account.planNames()),
    ]);
    for (const [what, r] of Object.entries({ billing: info, telemetry: usage, plans })) {
      if (r.error) log.warn({ uid: input.user.uid, err: String(r.error) }, `${what} no disponible`);
    }

    const context = buildContext(
      { info: info.value as UserInfoResp | undefined, usage: usage.value as UserUsage | null | undefined, app: input.app },
      input.now,
    );
    const { shown, ...evaluation } = evaluateMessages(this.content.messages(), context, { dismissed: input.dismissed });

    const scope: RenderScope = {
      lang: input.lang,
      timeZone: input.timeZone,
      values: this.values(context, input, info.value as UserInfoResp | undefined, plans.value as Record<string, string> | undefined),
    };

    return {
      schema_version: 1,
      content_version: this.content.version,
      ...evaluation,
      sources: {
        billing: (info.error ? 'error' : 'ok') as SourceStatus,
        telemetry: (usage.error ? 'error' : 'ok') as SourceStatus,
      },
      messages: shown.map((m) => this.render(m, scope)),
    };
  }

  private values(
    context: Record<string, unknown>,
    input: GetMessagesInput,
    info: UserInfoResp | undefined,
    plans: Record<string, string> | undefined,
  ): Record<string, unknown> {
    const planNames = { ...SEED_PLAN_NAMES, ...(plans ?? {}) };
    // El mismo orden que la app: billing primero, la sesión (el token) después.
    const name = info?.user_info?.display_name || input.user.name || input.user.email;
    return {
      ...input.vars,
      ...context,
      'user.name': name,
      'user.email': info?.user_info?.email || input.user.email,
      asset_url: `${config.PUBLIC_BASE_URL}/raw/assets`,
      ...Object.fromEntries(Object.entries(planNames).map(([code, n]) => [`plan.${code}.name`, n])),
    };
  }

  private render(m: LoadedMessage, scope: RenderScope) {
    // `when` se devuelve: la app reutiliza su parser del contrato y puede
    // volver a evaluarlo sin conexión.
    const { html_file, html, enabled, schema_version, ...props } = m;
    const text = (t: string) => renderText(t, scope, { html: false });
    const action = (a: MessageAction) => ({ ...a, label: text(a.label) });
    return {
      ...props,
      ...(props.title !== undefined && { title: text(props.title) }),
      ...(props.actions && { actions: props.actions.map(action) }),
      ...(props.footer_link && { footer_link: action(props.footer_link) }),
      html: sanitizeMessageHtml(renderText(html, scope, { html: true })).replaceAll(GITHUB_RAW, `${config.PUBLIC_BASE_URL}/raw/`),
    };
  }
}

async function settle<T>(fn: () => Promise<T>): Promise<{ value?: T; error?: unknown }> {
  try {
    return { value: await fn() };
  } catch (error) {
    return { error };
  }
}
