# AGENTS.md

AllyMailer NestJS — NestJS integration of the AllyMailer Node.js SDK (`@allymailer/allymailer-node-sdk`) for the AllyMailer transactional email Web API (Web API 1.90). How to integrate AllyMailer into a NestJS application comes first; the last section is about changing this package.

## Integrating AllyMailer with this package

NestJS integration of the [AllyMailer Node.js SDK](https://github.com/allymailer/allymailer-node-sdk) (`@allymailer/allymailer-node-sdk`): the API client in the NestJS DI container, a webhook endpoint with signature check, a Nodemailer transport that sends through `email/send`. Full guide: [README.md](README.md).

### Install

```bash
npm install @allymailer/nestjs nodemailer
```

Requirements: Node.js 20.19+ / 22.12+ (ESM package), NestJS 10–11.

### Configuration

The API key goes to `ALLYMAILER_API_KEY`.

```typescript
// .env: ALLYMAILER_API_KEY=YOUR_API_KEY, ALLYMAILER_HOST=cp.allymailer.com
import { Module } from "@nestjs/common";
import { AllyMailerModule } from "@allymailer/nestjs";

@Module({
  imports: [
    AllyMailerModule.forRoot(), // or forRoot({ apiKey, host, timeout, webhookKey, webhookPath })
    // AllyMailerModule.forRootAsync({ inject: [ConfigService], useFactory: (c: ConfigService) => ({ apiKey: c.get("ALLYMAILER_API_KEY") }) }),
  ],
})
export class AppModule {}

// main.ts: the webhook signature is checked over the raw body
const app = await NestFactory.create(AppModule, { rawBody: true });
```

| Option | Environment variable | Default | Description |
|---|---|---|---|
| `apiKey` | `ALLYMAILER_API_KEY` |  | User or project API key (required). |
| `host` | `ALLYMAILER_HOST` | `cp.allymailer.com` | API host (datacenter: `cp.allymailer.com`) or a full base URL. |
| `timeout` | `ALLYMAILER_TIMEOUT` | `30` | Request timeout, seconds. |
| `webhookKey` | `ALLYMAILER_WEBHOOK_KEY` |  | API key the webhooks are signed with (the key of the user/project of the webhook), if it differs from the API key. |
| `webhookPath` | `ALLYMAILER_WEBHOOK_PATH` | `/allymailer/webhook` | Path of the webhook endpoint. |

### Sending mail

Messages of the Nodemailer go through [email/send](https://docs.allymailer.com.ua/ua/web-api-ref#email-send): from, to/cc/bcc, reply-to, subject, HTML and text parts, attachments, inline images and `X-*` headers.

```typescript
import { MailerModule } from "@nestjs-modules/mailer";
import nodemailer from "nodemailer";
import { AllyMailerTransport } from "@allymailer/nestjs";

// @nestjs-modules/mailer
MailerModule.forRootAsync({
  inject: [AllyMailerTransport],
  useFactory: (transport: AllyMailerTransport) => ({ transport, defaults: { from: "Shop <shop@example.com>" } }),
});

// or plain Nodemailer
const transporter = nodemailer.createTransport(app.get(AllyMailerTransport));
await transporter.sendMail({ from: "shop@example.com", to: "user@example.com", subject: "Hi", html: "<b>Hi</b>" });
```

### API client

The client calls [email/send](https://docs.allymailer.com.ua/ua/web-api-ref#email-send) with all of its options: templates, substitutions, metadata, tracking. Fields of the request and other examples: [Node.js SDK docs](https://github.com/allymailer/allymailer-node-sdk/blob/HEAD/docs/Email.md#send).

```typescript
import { Injectable } from "@nestjs/common";
import { AllyMailerClient } from "@allymailer/allymailer-node-sdk";
import { MessageObjectRecipientsItem as Recipient } from "@allymailer/allymailer-node-sdk/api/email";

@Injectable()
export class MailService {
  constructor(private readonly client: AllyMailerClient) {}

  async send() {
    const { jobId } = await this.client.email.send({
      message: {
        recipients: [Recipient.fromAddress("Alex <alex@example.com>")],
        from_email: "shop@example.com",
        from_name: "Shop",
        subject: "Your order",
        body: { html: "<p>Hello, {{to_name}}! Your order has shipped.</p>" },
      },
    });
    console.log(jobId);
  }
}
```

### Webhooks

The endpoint answers `GET` with 200 OK (the URL check of [webhook/set](https://docs.allymailer.com.ua/ua/web-api-ref#webhook-set)) and accepts the `POST` notifications: it checks the `auth` field (MD5 of the request body in which the `auth` value is replaced by the API key), answers 401 to a wrong signature, and passes the notification and each of its events to the application.

```typescript
import { Injectable } from "@nestjs/common";
import { AllyMailerWebhooks } from "@allymailer/nestjs";

@Injectable()
export class DeliveryListener {
  constructor(webhooks: AllyMailerWebhooks) {
    webhooks.onEvent(async (event, user) => {
      console.log(event.eventName, event.eventData?.email, event.eventData?.status);
    });
  }
}
```

Register the URL of the endpoint with `webhook/set`, e.g. `https://example.com/allymailer/webhook`.

> **Answer 200 within 3 seconds** and process the events in the background (a queue): otherwise AllyMailer repeats the request every 10 minutes for 24 hours (`retry_count` grows), and a handler that failed every request for at least 10 events of a day is turned inactive. The handler must take at least **5 parallel requests of up to 100 events each**; deduplicate, a repeat delivers the same events again.

### Rules for generated code

- Server-side only. Read the API key from `ALLYMAILER_API_KEY`; never put it in browser or mobile code, never commit it.
- Base URL `https://cp.allymailer.com/ua/transactional/api/v1`; every method is POST with a JSON body; auth header `X-API-KEY`. The package does all of it.
- First email without DNS: `domain/get-sandbox-domain` → `confirmed-email/create` (the user clicks the link within 48 hours) → `email/send` from `noreply@<sandbox-domain>` to the confirmed address. Account API key only; up to 10 confirmed addresses, 100 emails a day. The domain is deleted 31 days after it was created: the next `domain/get-sandbox-domain` call creates a new one with another name, so read the name from the response, never hardcode it.
- Never ship a sandbox domain as the production sender (it is not in `domain/list`); read `from_email` from config. Production needs a verified domain: `domain/get-dns-records` → DNS records (verification TXT as is, DKIM TXT `v=DKIM1; k=rsa; p=<dkim>` on `<selector>._domainkey`, CNAME `_dmarc` → the `dmarc` field; SPF `include:spf.allymailer.com` is not in the response) → `domain/validate-verification-record`, `domain/validate-dkim` → `domain/list`.
- Set `message.idempotence_key` on retryable sends; retry network errors, `429` and `5xx` with backoff, not other errors unchanged. Up to 500 recipients and 10 MB per request with the attachments in base64 (a third larger than the files); always `body.html` or `body.plaintext`.
- Delivery events via webhook (`webhook/set`), not polling; the webhook endpoint of this package checks the `auth` signature (401 when wrong). Keep the listeners fast: answer 200 within 3 seconds and process the events from a queue, otherwise the request is repeated every 10 minutes for 24 hours; take at least 5 parallel requests of up to 100 events each; deduplicate.
- Keep the default unsubscribe and tracking behaviour; changes go through AllyMailer support.
- Do not invent methods or fields. Check the [README](README.md), the [API reference](https://docs.allymailer.com.ua/ua/web-api-ref) or [llms.txt](https://docs.allymailer.com.ua/llms.txt).

### Reference

- [AllyMailer Node.js SDK](https://github.com/allymailer/allymailer-node-sdk): every API method, models, errors ([AGENTS.md](https://github.com/allymailer/allymailer-node-sdk/blob/HEAD/AGENTS.md))
- [API reference](https://docs.allymailer.com.ua/ua/web-api-ref)
- [Full API reference for LLMs](https://docs.allymailer.com.ua/llms-full.txt)

## Working on this repository

- **Generated code.** The whole package is generated by the AllyMailer team from the AllyMailer Web API OpenAPI spec (Web API 1.90): sources, docs, README.md and this file. Do not hand-edit it: the next release replaces the content of this repository. Report problems and requests in the issues of this repository (https://github.com/allymailer/allymailer-nestjs).
- **Build and check:**

  ```bash
  npm install
  npm pack --dry-run
  ```

- **Source label.** Every request carries the query parameter `platform=nestjs.1.1.2,node-sdk.2.1.2` (this package, then the SDK it is built on).
- **Tests.** Before a release the generator installs the package into a test app of NestJS and checks the client, the webhook endpoint and the mailer against a mock of the API: no real API key, no real sends.
- **Release.** The version (1.1.2 in package.json) and the tag `v1.1.2` come from the generator; README.md states the Web API version the release was generated from.
- **Secrets.** Never commit API keys; the examples read `ALLYMAILER_API_KEY` from the environment.
