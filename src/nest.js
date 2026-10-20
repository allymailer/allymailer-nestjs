import {
  BadRequestException, Controller, Get, HttpCode, Inject, Injectable, Module, Post, Req, UnauthorizedException,
} from "@nestjs/common";
import { AllyMailerClient } from "@allymailer/allymailer-node-sdk";
import { createClient, resolveOptions } from "./options.js";
import { AllyMailerTransport } from "./transport.js";
import { handleWebhook } from "./webhook.js";

/** Injection token of the options given to forRoot() / forRootAsync(). */
export const ALLYMAILER_OPTIONS = "ALLYMAILER_OPTIONS";
/** Injection token of the API client (the client is injectable by its class AllyMailerClient too). */
export const ALLYMAILER_CLIENT = "ALLYMAILER_CLIENT";

/**
 * Handlers of the webhook notifications, register them in a service:
 *
 *     constructor(webhooks) { webhooks.onEvent(async (event, user) => ...); }
 */
export class AllyMailerWebhooks {
  constructor() {
    this.notificationHandlers = [];
    this.eventHandlers = [];
  }

  /** @param {(callback: object, payload: object, request: any) => any} handler the whole notification */
  onNotification(handler) {
    this.notificationHandlers.push(handler);
    return this;
  }

  /** @param {(event: object, user: object, request: any) => any} handler each event with its user/project */
  onEvent(handler) {
    this.eventHandlers.push(handler);
    return this;
  }

  /** @returns {import("./webhook.js").WebhookHandlers} */
  handlers(options = {}) {
    return {
      onNotification: async (...args) => {
        await options.onNotification?.(...args);
        for (const handler of this.notificationHandlers) {
          await handler(...args);
        }
      },
      onEvent: async (...args) => {
        await options.onEvent?.(...args);
        for (const handler of this.eventHandlers) {
          await handler(...args);
        }
      },
    };
  }
}
Injectable()(AllyMailerWebhooks);

function method(cls, name, ...decorators) {
  const descriptor = Object.getOwnPropertyDescriptor(cls.prototype, name);
  for (const decorator of decorators) {
    decorator(cls.prototype, name, descriptor);
  }
}

/**
 * Webhook controller at `path`: GET/HEAD -> 200 (URL check of webhook/set), POST -> signature check (401 when
 * wrong) and the handlers. Needs the raw body: NestFactory.create(AppModule, { rawBody: true }).
 */
function webhookController(path) {
  class WebhookController {
    constructor(options, webhooks) {
      this.options = options ?? {};
      this.key = resolveOptions(this.options).webhookKey;
      this.webhooks = webhooks;
    }

    check() {
      return "OK";
    }

    async receive(request) {
      const body = request.rawBody ?? (Buffer.isBuffer(request.body) || typeof request.body === "string"
        ? request.body : undefined);
      const { status, text } = await handleWebhook(body, this.key, this.webhooks.handlers(this.options), request);
      if (status === 401) {
        throw new UnauthorizedException(text);
      }
      if (status !== 200) {
        throw new BadRequestException(text);
      }
      return text;
    }
  }
  Controller(path)(WebhookController);
  Inject(ALLYMAILER_OPTIONS)(WebhookController, undefined, 0);
  Inject(AllyMailerWebhooks)(WebhookController, undefined, 1);
  method(WebhookController, "check", Get(), HttpCode(200));
  method(WebhookController, "receive", Post(), HttpCode(200));
  Req()(WebhookController.prototype, "receive", 0);
  return WebhookController;
}

/**
 * Global module: AllyMailerClient (also ALLYMAILER_CLIENT), AllyMailerWebhooks, AllyMailerTransport (Nodemailer) and the webhook
 * controller.
 */
export class AllyMailerModule {
  /**
   * @param {import("./options.js").AllyMailerOptions & import("./webhook.js").WebhookHandlers & {client?: AllyMailerClient, webhook?: boolean}} [options]
   *   webhook: false - no webhook controller
   */
  static forRoot(options = {}) {
    return this.build({ provide: ALLYMAILER_OPTIONS, useValue: options }, [], options);
  }

  /**
   * @param {{imports?: any[], inject?: any[], useFactory: (...args: any[]) => object|Promise<object>, webhookPath?: string, webhook?: boolean}} options
   *   webhookPath and webhook are static: the route is known before the factory runs
   */
  static forRootAsync({ imports = [], inject = [], useFactory, ...rest }) {
    return this.build({ provide: ALLYMAILER_OPTIONS, useFactory, inject }, imports, rest);
  }

  static build(optionsProvider, imports, options) {
    const path = resolveOptions({ webhookPath: options.webhookPath }).webhookPath;
    return {
      module: AllyMailerModule,
      global: true,
      imports,
      controllers: options.webhook === false ? [] : [webhookController(path)],
      providers: [
        optionsProvider,
        AllyMailerWebhooks,
        { provide: AllyMailerClient, useFactory: (o) => o?.client ?? createClient(o ?? {}), inject: [ALLYMAILER_OPTIONS] },
        { provide: ALLYMAILER_CLIENT, useExisting: AllyMailerClient },
        { provide: AllyMailerTransport, useFactory: (client) => new AllyMailerTransport({ client }), inject: [AllyMailerClient] },
      ],
      exports: [ALLYMAILER_OPTIONS, AllyMailerClient, ALLYMAILER_CLIENT, AllyMailerWebhooks, AllyMailerTransport],
    };
  }
}
Module({})(AllyMailerModule);
