const DEV_SECRET = 'segredo-de-desenvolvimento-nao-use-em-producao';

function toNonNegativeInt(value, fallback, name) {
  if (value === undefined || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`Variável de ambiente ${name} deve ser um inteiro não negativo (recebido: "${value}")`);
  }
  return parsed;
}

export function loadConfig(env = process.env) {
  const secret = env.WEBHOOK_SECRET?.trim();
  if (!secret && env.NODE_ENV === 'production') {
    throw new Error('WEBHOOK_SECRET é obrigatório quando NODE_ENV=production');
  }

  const receiverUrl = env.RECEIVER_URL || 'http://localhost:3000/webhooks/pedidos';
  try {
    new URL(receiverUrl);
  } catch {
    throw new Error(`RECEIVER_URL inválida: "${receiverUrl}"`);
  }

  return Object.freeze({
    receiverUrl,
    webhookSecret: secret || DEV_SECRET,
    usingDevSecret: !secret,
    timeoutMs: toNonNegativeInt(env.REQUEST_TIMEOUT_MS, 5000, 'REQUEST_TIMEOUT_MS'),
    maxRetries: toNonNegativeInt(env.MAX_RETRIES, 3, 'MAX_RETRIES'),
    retryBaseDelayMs: toNonNegativeInt(env.RETRY_BASE_DELAY_MS, 500, 'RETRY_BASE_DELAY_MS'),
  });
}
