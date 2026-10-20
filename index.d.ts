import type { DynamicModule } from "@nestjs/common";
import type { AllyMailerClient } from "@allymailer/allymailer-node-sdk";

export interface AllyMailerOptions {
  /** User or project API key, default: env ALLYMAILER_API_KEY. */
  apiKey?: string;
  /** API host (datacenter) or a full base URL, default: env ALLYMAILER_HOST. */
  host?: string;
  /** Request timeout in seconds, default: env ALLYMAILER_TIMEOUT or 30. */
  timeout?: number;
  /** API key the webhooks are signed with, default: env ALLYMAILER_WEBHOOK_KEY or apiKey. */
  webhookKey?: string;
  /** Path of the webhook endpoint, default: env ALLYMAILER_WEBHOOK_PATH or "/allymailer/webhook". */
  webhookPath?: string;
}

export interface WebhookHandlers {
  /** The whole notification: parsed SDK model and decoded JSON. */
  onNotification?: (callback: any, payload: Record<string, any>, request?: any) => unknown;
  /** Each event of the notification with its user/project. */
  onEvent?: (event: any, user: any, request?: any) => unknown;
}

export interface AllyMailerModuleOptions extends AllyMailerOptions, WebhookHandlers {
  /** An existing client instead of a new one. */
  client?: AllyMailerClient;
  /** false: no webhook controller. */
  webhook?: boolean;
}

export interface AllyMailerModuleAsyncOptions {
  imports?: any[];
  inject?: any[];
  useFactory: (...args: any[]) => AllyMailerModuleOptions | Promise<AllyMailerModuleOptions>;
  /** Static: the route is registered before the factory runs. */
  webhookPath?: string;
  webhook?: boolean;
}

export declare const ALLYMAILER_OPTIONS: string;
export declare const ALLYMAILER_CLIENT: string;

export declare class AllyMailerModule {
  static forRoot(options?: AllyMailerModuleOptions): DynamicModule;
  static forRootAsync(options: AllyMailerModuleAsyncOptions): DynamicModule;
}

export declare class AllyMailerWebhooks {
  onNotification(handler: NonNullable<WebhookHandlers["onNotification"]>): this;
  onEvent(handler: NonNullable<WebhookHandlers["onEvent"]>): this;
}

/** Nodemailer transport: nodemailer.createTransport(transport), injectable by this class. */
export declare class AllyMailerTransport {
  constructor(options?: AllyMailerOptions & { client?: AllyMailerClient });
  name: string;
  version: string;
  client: AllyMailerClient;
  send(mail: any, callback: (err: Error | null, info?: any) => void): void;
}

export function resolveOptions(options?: AllyMailerOptions): Required<AllyMailerOptions>;
export function createClient(options?: AllyMailerOptions): AllyMailerClient;
export function verifySignature(body: string | Buffer, apiKey: string): boolean;
export function signBody(body: string, apiKey: string): string;
export function handleWebhook(body: string | Buffer, key: string, handlers?: WebhookHandlers, context?: any): Promise<{ status: number; text: string }>;
export function toMessage(data: Record<string, any>, envelope?: { from: string; to: string[] }): Record<string, any>;
