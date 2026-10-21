import { AllyMailerClient } from "@allymailer/allymailer-node-sdk";

/** The package and its version in the "platform" query parameter of the requests, before the SDK one. */
export const PLATFORM = "nestjs.1.1.2";

/**
 * @typedef {object} AllyMailerOptions
 * @property {string} [apiKey] User or project API key, default: env ALLYMAILER_API_KEY.
 * @property {string} [host] API host (datacenter) or a full base URL, default: env ALLYMAILER_HOST or https://cp.allymailer.com/ua/transactional/api/v1.
 * @property {number} [timeout] Request timeout in seconds, default: env ALLYMAILER_TIMEOUT or 30.
 * @property {string} [webhookKey] API key the webhooks are signed with, default: env ALLYMAILER_WEBHOOK_KEY or apiKey.
 * @property {string} [webhookPath] Path of the webhook endpoint, default: env ALLYMAILER_WEBHOOK_PATH or "/allymailer/webhook".
 */

/**
 * Settings with the defaults from the environment.
 * @param {AllyMailerOptions} [options]
 * @returns {Required<AllyMailerOptions>}
 */
export function resolveOptions(options = {}) {
  const env = typeof process !== "undefined" ? process.env : {};
  const apiKey = options.apiKey ?? env.ALLYMAILER_API_KEY ?? "";
  return {
    apiKey,
    host: options.host ?? env.ALLYMAILER_HOST ?? "",
    timeout: Number(options.timeout ?? env.ALLYMAILER_TIMEOUT ?? 30),
    webhookKey: options.webhookKey || env.ALLYMAILER_WEBHOOK_KEY || apiKey,
    webhookPath: options.webhookPath ?? env.ALLYMAILER_WEBHOOK_PATH ?? "/allymailer/webhook",
  };
}

/**
 * AllyMailer API client from the options / environment.
 * @param {AllyMailerOptions} [options]
 * @returns {AllyMailerClient}
 */
export function createClient(options = {}) {
  const { apiKey, host, timeout } = resolveOptions(options);
  if (!apiKey) {
    throw new Error("AllyMailer: the API key is not set (apiKey option or ALLYMAILER_API_KEY).");
  }
  return new AllyMailerClient(apiKey, { ...(host ? { host } : {}), timeout: timeout * 1000, platform: PLATFORM });
}
