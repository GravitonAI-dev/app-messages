// Tipos de scripts/core para el microservicio (TypeScript).

export type Context = Record<string, unknown>;

export interface MessageAction {
  label: string;
  action: string;
  url?: string;
  plan?: string;
  interval?: string;
  variant?: string;
}

export interface Message {
  schema_version: number;
  id: string;
  enabled?: boolean;
  when: Record<string, unknown>;
  size: string | number;
  position: string;
  backdrop: string;
  dismissible: boolean;
  persistent: boolean;
  auto_close?: number;
  priority: number;
  title?: string;
  tone?: string;
  actions?: MessageAction[];
  footer_link?: MessageAction;
  html_file?: string;
  html?: string;
}

export interface Evaluation<M extends Message = Message> {
  forced_block: boolean;
  visible_now: string[];
  queue: string[];
  shown: M[];
}

export function matches(value: unknown, cond: unknown): boolean;
export function whenMatches(when: Record<string, unknown>, context: Context): boolean;
export function evaluateMessages<M extends Message>(messages: M[], context: Context, options?: { dismissed?: string[] }): Evaluation<M>;

export const SIZES: string[];
export const POSITIONS: string[];
export const BACKDROPS: string[];
export const OPERATORS: string[];
export const CONTEXT_FIELDS: string[];
export const COLOR_ROLES: string[];
export const PLAN_CODES: string[];
export const VARIABLES: string[];
export const TEXT_VARIABLES: string[];
export const ACTIONS: string[];
export const VARIANTS: string[];
export const TONES: string[];
export const CORNER: string[];
export const TAGS: string[];
export const ATTRS: string[];
export const STYLE_PROPS: string[];
export const HOME_CONTAINERS: string[];
export const HOME_ACTIONS: string[];
export const HOME_ICONS: string[];

export interface Filter { name: string; arg?: string }
export const VARIABLE_ALIASES: Record<string, string>;
export const DATA_VARIABLES: string[];
export const APP_VARIABLE_RE: RegExp;
export const FILTERS: Record<string, string[] | null>;
export const VARIABLE_RE: RegExp;
export function parseFilters(tail: string | undefined): Filter[];
export function checkVariable(name: string, filters: Filter[], options: { allowColors: boolean }): string[];
