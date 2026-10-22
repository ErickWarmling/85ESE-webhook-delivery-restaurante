const DEV_SECRET = 'segredo-de-desenvolvimento-nao-use-em-producao';

function toPositiveInt(value, fallback, name) {
  if (value === undefined || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Variável de ambiente ${name} deve ser um inteiro positivo (recebido: "${value}")`);
  }
  return parsed;
}

/**
 * Lê e valida a configuração a partir das variáveis de ambiente.
 * Em produção o segredo do webhook é obrigatório; em desenvolvimento usa-se
 * um segredo padrão para facilitar a execução local (com aviso no log).
 */
export function loadConfig(env = process.env) {
  const secret = env.WEBHOOK_SECRET?.trim();
  if (!secret && env.NODE_ENV === 'production') {
    throw new Error('WEBHOOK_SECRET é obrigatório quando NODE_ENV=production');
  }

  return Object.freeze({
    port: toPositiveInt(env.PORT, 3000, 'PORT'),
    webhookSecret: secret || DEV_SECRET,
    usingDevSecret: !secret,
    signatureToleranceSeconds: toPositiveInt(env.SIGNATURE_TOLERANCE_SECONDS, 300, 'SIGNATURE_TOLERANCE_SECONDS'),
    kitchenStations: toPositiveInt(env.KITCHEN_STATIONS, 2, 'KITCHEN_STATIONS'),
    bodyLimit: env.BODY_LIMIT || '100kb',
    logLevel: env.LOG_LEVEL || 'info',
  });
}
