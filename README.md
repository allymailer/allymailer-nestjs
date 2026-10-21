# AllyMailer NestJS

[![NestJS](https://img.shields.io/npm/v/@allymailer/nestjs)](https://www.npmjs.com/package/@allymailer/nestjs) [![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

Інтеграція [Node.js SDK AllyMailer](https://github.com/allymailer/allymailer-node-sdk) (`@allymailer/allymailer-node-sdk`) з NestJS: клієнт API в NestJS DI container, ендпоінт вебхуків із перевіркою підпису, транспорт Nodemailer, що надсилає листи через `email/send`.

[Довідник API](https://docs.allymailer.com.ua/ua/web-api-ref) · Документація для LLM: [llms.txt](https://docs.allymailer.com.ua/llms.txt)

## Встановлення

```bash
npm install @allymailer/nestjs nodemailer
```

Вимоги: Node.js 20.19+ / 22.12+ (ESM package), NestJS 10–11.

## Налаштування

Отримайте API-ключ у [панелі керування](https://cp.allymailer.com) і зберігайте його у змінній оточення, а не в коді:

```bash
export ALLYMAILER_API_KEY="your-api-key"
```

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

Домену ще немає? Надсилайте з [тестового sandbox-домену](#без-свого-домену-тестовий-sandbox-домен).

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

> **Відповідайте 200 протягом 3 секунд**, а події обробляйте у фоні (через чергу): інакше AllyMailer повторює запит кожні 10 хвилин протягом доби (зростає `retry_count`), а обробник, на якому за добу не пройшов жоден запит хоча б для 10 подій, вимикається. Обробник має витримувати **щонайменше 5 паралельних запитів до 100 подій у кожному**; повтор надсилає ті самі події ще раз — прибирайте дублікати.

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

### Надсилання через API

Окрім Nodemailer, листи можна надсилати напряму через клієнт API. Клієнт викликає [email/send](https://docs.allymailer.com.ua/ua/web-api-ref#email-send) з усіма його параметрами: шаблони, підстановки, метадані, трекінг. Поля запиту та інші приклади — у [документації Node.js SDK](https://github.com/allymailer/allymailer-node-sdk/blob/HEAD/docs/Email.md#send).

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
        recipients: [Recipient.fromAddress("Олексій <alex@example.com>")],
        from_email: "shop@example.com",
        from_name: "Магазин",
        subject: "Ваше замовлення",
        body: { html: "<p>Вітаємо, {{to_name}}! Ваше замовлення надіслано.</p>" },
      },
    });
    console.log(jobId);
  }
}
```

## Без свого домену: тестовий sandbox-домен

Поки ваш домен не підтверджено, листи можна надсилати із **sandbox-домену** — тестового домену, який є в кожного облікового запису: він уже підтверджений, DKIM і SPF налаштовані. Листи з нього доставляються лише на підтверджені вами адреси (посилання для підтвердження приходить листом і діє 48 годин), до 100 на день. Через 31 день після створення sandbox-домен видаляється, але його можна отримати знову: наступний виклик `domain/get-sandbox-domain` створить новий (з іншою назвою, тому беріть її з відповіді, а не прописуйте в коді).

У прикладах — клієнт API з пакета (див. налаштування вище).

```typescript
import { Injectable } from "@nestjs/common";
import { AllyMailerClient } from "@allymailer/allymailer-node-sdk";
import { MessageObjectRecipientsItem as Recipient } from "@allymailer/allymailer-node-sdk/api/email";

@Injectable()
export class SandboxService {
  constructor(private readonly client: AllyMailerClient) {}

  async send() {
    // 1. Ваш sandbox-домен: створюється під час першого виклику, далі повертається той самий
    const { domain } = await this.client.domain.getSandboxDomain();

    // 2. Підтвердіть свою скриньку: AllyMailer надішле посилання, перейдіть за ним протягом 48 годин
    await this.client.confirmedEmail.create({ email: "you@example.com" });

    // 3. Надішліть із будь-якої адреси sandbox-домену на підтверджену адресу
    await this.client.email.send({
      message: {
        recipients: [Recipient.fromAddress("you@example.com")],
        from_email: `noreply@${domain}`,
        subject: "Привіт від AllyMailer",
        body: { html: "<p>Працює!</p>" },
      },
    });
  }
}
```

<details>
<summary>Обмеження sandbox</summary>

- Надсилання лише на підтверджені адреси: до 10 на обліковий запис.
- До 100 листів на день.
- Sandbox-домен спливає через 31 день; знову викличте `domain/get-sandbox-domain`, щоб отримати новий.
- Працює лише з API-ключем облікового запису, не з ключем проєкту.
- Не показується в `domain/list`; інші методи `domain/*` до нього не застосовуються.

Sandbox — для розробки та тестування. Не використовуйте sandbox-домен як відправника на проді.

</details>

<details>
<summary>Те саме через curl</summary>

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

</details>

## Запуск у продакшен

**1. Підтвердіть домен надсилання.** `domain/get-dns-records` повертає запис підтвердження, DKIM-ключ і адресу для DMARC; додайте записи у свого DNS-провайдера, потім `domain/validate-verification-record` і `domain/validate-dkim`.

| Тип | Хост | Значення | Звідки взяти |
|---|---|---|---|
| TXT | `@` | `allymailer-validate-hash=…` | поле `verification-record` відповіді, як є |
| TXT | `<селектор>._domainkey` (селектор — на сторінці домену в панелі керування, наприклад `us`) | `v=DKIM1; k=rsa; p=<dkim>` | поле `dkim` відповіді після `v=DKIM1; k=rsa; p=` |
| TXT | `@` | `v=spf1 include:spf.allymailer.com ~all` | у відповіді немає; якщо SPF-запис уже є, додайте include до нього |
| CNAME | `_dmarc` | `<домен>.dmarc.…` | поле `dmarc` відповіді (DMARC-політику публікує AllyMailer); якщо в домену вже є свій TXT-запис DMARC, залиште його |

**2. Надійне надсилання.**

| | |
|---|---|
| Повтори | `429` і `5xx` з backoff і тим самим `idempotence_key`; інші помилки виправляйте, а не повторюйте |
| Ліміти | 500 одержувачів і 10 МБ на запит разом із вкладеннями: у base64 файл стає приблизно на третину більшим |
| Тіло | завжди `html` або `plaintext` (або із шаблону) |
| Статус доставки | вебхук, а не опитування |
| Черга | надсилайте з фонового завдання, а не всередині веб-запиту |
| Налаштування | `from_email` з конфігурації: перехід із sandbox на продакшен без змін у коді |
| Типові налаштування | не прибирайте блок відписки та трекінг; змінити їх можна через підтримку AllyMailer |

## Допомога

- [Node.js SDK](https://github.com/allymailer/allymailer-node-sdk)
- Для ШІ-агентів: [llms.txt](https://docs.allymailer.com.ua/llms.txt), скіли: `npx skills add https://github.com/allymailer/allymailer-skills.git`
- [Підтримка](https://cp.allymailer.com/ua/support) · [Задачі](https://github.com/allymailer/allymailer-nestjs/issues)
- Розробникам: [AGENTS.md](AGENTS.md) — пакет генерується з OpenAPI-специфікації.
