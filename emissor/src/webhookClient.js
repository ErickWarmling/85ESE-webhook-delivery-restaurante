import { computeSignature, SIGNATURE_HEADER, TIMESTAMP_HEADER } from './signature.js';

/** Falha definitiva de entrega (rede indisponível ou timeout em todas as tentativas). */
export class WebhookDeliveryError extends Error {
  constructor(message, { attempts, cause } = {}) {
    super(message, { cause });
    this.name = 'WebhookDeliveryError';
    this.attempts = attempts;
  }
}

/** 4xx indica erro no payload ou na autenticação: reenviar não resolve, exceto 408 e 429. */
export const isRetryableStatus = (status) => status === 408 || status === 429 || status >= 500;

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function readBody(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * Envia o evento ao receptor via HTTP POST com assinatura HMAC, timeout por tentativa
 * e novas tentativas com backoff exponencial para falhas transitórias.
 *
 * @returns {Promise<{ ok: boolean, status: number, body: unknown, attempts: number, durationMs: number }>}
 * @throws {WebhookDeliveryError} quando nenhuma tentativa obtém resposta HTTP
 */
export async function sendWebhook(event, {
  url,
  secret,
  timeoutMs = 5000,
  maxRetries = 3,
  retryBaseDelayMs = 500,
  fetchImpl = globalThis.fetch,
  sleep = defaultSleep,
  onAttempt = () => {},
}) {
  const body = JSON.stringify(event);
  const totalAttempts = maxRetries + 1;
  const startedAt = Date.now();

  for (let attempt = 1; attempt <= totalAttempts; attempt += 1) {
    const isLast = attempt === totalAttempts;
    // Assina a cada tentativa: o timestamp precisa estar dentro da janela aceita pelo receptor.
    const timestamp = String(Math.floor(Date.now() / 1000));

    try {
      const response = await fetchImpl(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'User-Agent': 'delivery-app-webhook/1.0',
          'X-Webhook-Event': event.evento,
          'X-Webhook-Id': event.idEvento,
          [TIMESTAMP_HEADER]: timestamp,
          [SIGNATURE_HEADER]: computeSignature(secret, timestamp, body),
        },
        body,
        signal: AbortSignal.timeout(timeoutMs),
      });
      const result = {
        ok: response.ok,
        status: response.status,
        body: await readBody(response),
        attempts: attempt,
        durationMs: Date.now() - startedAt,
      };
      onAttempt({ attempt, status: response.status });
      if (!isRetryableStatus(response.status) || isLast) return result;
    } catch (error) {
      onAttempt({ attempt, error });
      if (isLast) {
        const reason = error.name === 'TimeoutError' ? `timeout de ${timeoutMs} ms` : error.message;
        throw new WebhookDeliveryError(`Não foi possível entregar o webhook após ${attempt} tentativa(s): ${reason}`, {
          attempts: attempt,
          cause: error,
        });
      }
    }

    await sleep(retryBaseDelayMs * 2 ** (attempt - 1));
  }
  throw new Error('unreachable');
}
