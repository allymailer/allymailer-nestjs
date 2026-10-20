# AllyMailer NestJS 1.0.0

Web API 1.90

Покроковий посібник: [Надсилання листів на Node.js](https://docs.allymailer.com.ua/ua/send-with-nodejs) · Документація для LLM: [llms.txt](https://docs.allymailer.com.ua/llms.txt) · [Довідник API](https://docs.allymailer.com.ua/ua/web-api-ref)

Інтеграція [Node.js SDK AllyMailer](https://github.com/allymailer/allymailer-node-sdk) (`@allymailer/allymailer-node-sdk`) з NestJS: клієнт API в NestJS DI container, ендпоінт вебхуків із перевіркою підпису, транспорт Nodemailer, що надсилає листи через `email/send`.

## Встановлення

```bash
npm install @allymailer/nestjs nodemailer
```

Вимоги: Node.js 20.19+ / 22.12+ (ESM package), NestJS 10–11.

## Отримайте API-ключ

1. Зареєструйтеся на [cp.allymailer.com](https://cp.allymailer.com).
2. Скопіюйте API-ключ у [панелі керування](https://cp.allymailer.com).
3. Покладіть його у змінну оточення:

```bash
export ALLYMAILER_API_KEY="your-api-key"
```

Пакет бере його з `ALLYMAILER_API_KEY` (див. налаштування нижче).

> **Лише на сервері.** Використовуйте цей пакет у серверному коді: API-маршрути, серверні функції, воркери.
> Ніколи не передавайте API-ключ у браузер чи мобільний застосунок і не комітьте його.

## Налаштування

За замовчуванням налаштування беруться зі змінних оточення:

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

| Параметр | Змінна оточення | За замовчуванням | Опис |
|---|---|---|---|
| `apiKey` | `ALLYMAILER_API_KEY` |  | API-ключ користувача або проєкту (обов'язковий). |
| `host` | `ALLYMAILER_HOST` | `cp.allymailer.com` | Хост API (датацентр: `cp.allymailer.com`) або повний базовий URL. |
| `timeout` | `ALLYMAILER_TIMEOUT` | `30` | Таймаут запиту, секунди. |
| `webhookKey` | `ALLYMAILER_WEBHOOK_KEY` |  | API-ключ, яким підписані вебхуки (ключ користувача/проєкту вебхука), якщо він відрізняється від API-ключа. |
| `webhookPath` | `ALLYMAILER_WEBHOOK_PATH` | `/allymailer/webhook` | Шлях ендпоінта вебхуків. |

Пакет у форматі ESM: застосунку на CommonJS (скомпільований TypeScript) потрібен Node.js 20.19+ / 22.12+, де `require()` завантажує ES-модулі. `timeout` задається в секундах.

## Перший лист — без налаштування DNS

Кожен обліковий запис може одразу надсилати тестові листи із **sandbox-домену**: він уже підтверджений, DKIM і SPF налаштовані.
Листи доставляються лише на підтверджені вами адреси.

У прикладах — клієнт API з пакета (див. налаштування вище).

**1. Отримайте sandbox-домен** (`domain/get-sandbox-domain`). Перший виклик створює домен, наступні повертають той самий.

```typescript
import { Injectable } from "@nestjs/common";
import { AllyMailerClient } from "@allymailer/allymailer-node-sdk";

@Injectable()
export class MailService {
  constructor(private readonly client: AllyMailerClient) {}

  async getSandboxDomain() {
    const response = await this.client.domain.getSandboxDomain();
    return response.domain;
  }
}
```

**2. Підтвердіть свою скриньку** (`confirmed-email/create`). AllyMailer надішле лист із підтвердженням; перейдіть за посиланням із нього протягом 48 годин.

```typescript
import { Injectable } from "@nestjs/common";
import { AllyMailerClient } from "@allymailer/allymailer-node-sdk";
import { ConfirmedEmailRequest } from "@allymailer/allymailer-node-sdk/api/confirmed-email";

@Injectable()
export class MailService {
  constructor(private readonly client: AllyMailerClient) {}

  async confirmEmail() {
    const response = await this.client.confirmedEmail.create(new ConfirmedEmailRequest({
      email: "you@example.com",
    }));
    return response.status;
  }
}
```

Статус перевірте через `confirmed-email/list` — у вашої адреси має бути `"status": "confirmed"`.

**3. Надішліть лист** (`email/send`) з будь-якої адреси sandbox-домену на підтверджену адресу.

```typescript
import { Injectable } from "@nestjs/common";
import { AllyMailerClient } from "@allymailer/allymailer-node-sdk";
import { EmailSendRequest, MessageObject, MessageObjectRecipientsItem } from "@allymailer/allymailer-node-sdk/api/email";
import { BodyObject } from "@allymailer/allymailer-node-sdk/common";

@Injectable()
export class MailService {
  constructor(private readonly client: AllyMailerClient) {}

  async send() {
    const response = await this.client.email.send(new EmailSendRequest({
      message: new MessageObject({
        recipients: [
          new MessageObjectRecipientsItem({
            email: "you@example.com",
          }),
        ],
        body: new BodyObject({
          html: "<p>Працює!</p>",
        }),
        subject: "Привіт від AllyMailer",
        fromEmail: "noreply@<sandbox-domain>",
      }),
    }));
    return response.jobId;
  }
}
```

### Що повертається

```json
{
  "status": "success",
  "job_id": "1ZymBc-00041N-9X",
  "emails": [
    "you@example.com"
  ]
}
```

У разі помилки API повертає `status: "error"`, `message` і числовий `code`:

```json
{
  "status": "error",
  "code": 102,
  "message": "Error ID:83274F98-C7D5-11F1-B221-6214FF8707B1. Can not decode key wrongkey"
}
```

### Те саме через curl

```bash
BASE=https://cp.allymailer.com/ua/transactional/api/v1

curl -s -X POST $BASE/domain/get-sandbox-domain.json \
  -H "Content-Type: application/json" -H "X-API-KEY: $ALLYMAILER_API_KEY" -d '{}'

curl -s -X POST $BASE/confirmed-email/create.json \
  -H "Content-Type: application/json" -H "X-API-KEY: $ALLYMAILER_API_KEY" \
  -d '{"email": "you@example.com"}'

curl -s -X POST $BASE/email/send.json \
  -H "Content-Type: application/json" -H "X-API-KEY: $ALLYMAILER_API_KEY" \
  -d '{
        "message": {
          "recipients": [
            {
              "email": "you@example.com"
            }
          ],
          "from_email": "noreply@<sandbox-domain>",
          "subject": "Привіт від AllyMailer",
          "body": {
            "html": "<p>Працює!</p>"
          }
        }
      }'
```

## Надсилання листів

Листи Nodemailer надсилаються через [email/send](https://docs.allymailer.com.ua/ua/web-api-ref#email-send): відправник, to/cc/bcc, reply-to, тема, HTML і текстова частини, вкладення, inline-зображення та заголовки `X-*`.

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

## Вебхуки

Ендпоінт відповідає 200 OK на `GET` (перевірка URL під час [webhook/set](https://docs.allymailer.com.ua/ua/web-api-ref#webhook-set)) і приймає `POST`-сповіщення: перевіряє поле `auth` (MD5 тіла запиту, у якому значення `auth` замінено на API-ключ), на неправильний підпис відповідає 401, а сповіщення і кожну його подію передає застосунку.

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

Зареєструйте URL ендпоінта методом `webhook/set`, наприклад `https://example.com/allymailer/webhook`.

## Клієнт API

Усі розділи API доступні через клієнт, див. [документацію SDK](https://github.com/allymailer/allymailer-node-sdk).

```typescript
import { Injectable } from "@nestjs/common";
import { AllyMailerClient } from "@allymailer/allymailer-node-sdk";

@Injectable()
export class UsageService {
  constructor(private readonly client: AllyMailerClient) {} // or @Inject(ALLYMAILER_CLIENT)

  async emailsSent() {
    return (await this.client.system.info()).accounting?.emailsSent;
  }
}
```

## Надсилання через API

Окрім Nodemailer, листи можна надсилати напряму через клієнт API. Клієнт викликає [email/send](https://docs.allymailer.com.ua/ua/web-api-ref#email-send) з усіма його параметрами: шаблони, підстановки, метадані, трекінг. Поля запиту та інші приклади — у [документації Node.js SDK](https://github.com/allymailer/allymailer-node-sdk/blob/HEAD/docs/Email.md#send).

```typescript
import { Injectable } from "@nestjs/common";
import { AllyMailerClient } from "@allymailer/allymailer-node-sdk";
import { EmailSendRequest, MessageObject, MessageObjectRecipientsItem } from "@allymailer/allymailer-node-sdk/api/email";
import { BodyObject } from "@allymailer/allymailer-node-sdk/common";

@Injectable()
export class MailService {
  constructor(private readonly client: AllyMailerClient) {}

  async send() {
    const response = await this.client.email.send(new EmailSendRequest({
      message: new MessageObject({
        recipients: [
          new MessageObjectRecipientsItem({
            email: "user@example.com",
            substitutions: {
              "CustomerId": "12452",
              "to_name": "John Smith",
            },
          }),
        ],
        body: new BodyObject({
          html: "<b>Hello, {{to_name}}</b>",
          plaintext: "Hello, {{to_name}}",
        }),
        subject: "AllyMailer test email ",
        fromEmail: "email@example.com",
        fromName: "John Smith",
      }),
    }));
    return response.jobId;
  }
}
```

## Обмеження sandbox

- Надсилання лише на підтверджені адреси: до 10 на обліковий запис.
- До 100 листів на день.
- Sandbox-домен спливає через 31 день; знову викличте `domain/get-sandbox-domain`, щоб отримати новий.
- Працює лише з API-ключем облікового запису, не з ключем проєкту.
- Не показується в `domain/list`; інші методи `domain/*` до нього не застосовуються.

Sandbox — для розробки та тестування. Не використовуйте sandbox-домен як відправника на проді.

## Перед продом: підтвердіть свій домен

1. `domain/get-dns-records` — повертає значення для DNS-записів.
2. Додайте ці записи у свого DNS-провайдера (їх також показує сторінка домену в панелі керування):

   | Тип | Хост | Значення |
   |---|---|---|
   | TXT | `@` | значення `verification-record` (`allymailer-validate-hash=…`) |
   | TXT | `<селектор>._domainkey` (селектор — на сторінці домену в панелі керування, наприклад `us`) | `v=DKIM1; k=rsa; p=<dkim>` |
   | TXT | `@` | `v=spf1 include:spf.allymailer.com ~all` |
   | CNAME | `_dmarc` | значення `dmarc` |

3. `domain/validate-verification-record`, потім `domain/validate-dkim`.
4. `domain/list` — дочекайтеся, поки запис підтвердження буде підтверджено, а DKIM — активний.
5. Беріть `from_email` з конфігурації, щоб перехід із sandbox не потребував змін у коді.

## Надійне надсилання

- **Повтори:** ставте `message.idempotence_key` у надсиланнях, які можуть повторюватися, щоб повторний запит не надіслав лист двічі.
- **Ліміти:** до 500 отримувачів і 10 МБ на запит; кожне вкладення до 7 МБ.
- **Тіло:** завжди передавайте `body.html` або `body.plaintext`.
- **Статус доставки:** зареєструйте вебхук (`webhook/set`) зі швидким ідемпотентним HTTPS-обробником замість опитування.
- **Типові налаштування:** не прибирайте стандартний блок відписки та трекінг; змінити їх можна через підтримку AllyMailer.
- **Помилки:** повторюйте `429` і `5xx` з backoff; інші помилки без змін не повторюйте.

## Посилання

- [Надсилання листів на Node.js](https://docs.allymailer.com.ua/ua/send-with-nodejs) та інші [посібники з інтеграції](https://docs.allymailer.com.ua/ua/integrations/)
- [Довідник Web API](https://docs.allymailer.com.ua/ua/web-api-ref)
- [llms.txt](https://docs.allymailer.com.ua/llms.txt) для AI-асистентів
- [Підтримка](https://cp.allymailer.com/ua/support)

## Для розробників пакета

Див. [AGENTS.md](AGENTS.md): як цей пакет генерується з OpenAPI-специфікації, збирається, перевіряється та випускається.
