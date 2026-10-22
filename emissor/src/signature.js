import crypto from 'node:crypto';

export const SIGNATURE_HEADER = 'X-Webhook-Signature';
export const TIMESTAMP_HEADER = 'X-Webhook-Timestamp';

/**
 * Assinatura HMAC-SHA256 de `${timestamp}.${corpo}` — o mesmo algoritmo verificado pelo receptor.
 * (Duplicado de propósito: emissor e receptor são sistemas independentes e só compartilham o contrato.)
 */
export function computeSignature(secret, timestamp, rawBody) {
  return `sha256=${crypto.createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex')}`;
}
