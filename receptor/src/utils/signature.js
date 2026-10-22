import crypto from 'node:crypto';

export const SIGNATURE_HEADER = 'x-webhook-signature';
export const TIMESTAMP_HEADER = 'x-webhook-timestamp';
const SIGNATURE_PREFIX = 'sha256=';

/**
 * Assinatura HMAC-SHA256 de `${timestamp}.${corpoBruto}`.
 * Incluir o timestamp na mensagem assinada impede que um atacante reaproveite
 * uma assinatura antiga trocando apenas o cabeçalho de horário.
 */
export function computeSignature(secret, timestamp, rawBody) {
  const digest = crypto.createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
  return `${SIGNATURE_PREFIX}${digest}`;
}

/**
 * Verifica assinatura e janela de tempo. Retorna `{ valid, reason }`.
 */
export function verifySignature({ secret, timestamp, signature, rawBody, toleranceSeconds, nowMs = Date.now() }) {
  if (!timestamp || !signature) {
    return { valid: false, reason: 'Cabeçalhos de assinatura ausentes' };
  }
  if (!/^\d{1,12}$/.test(timestamp)) {
    return { valid: false, reason: 'Timestamp da assinatura inválido' };
  }
  const ageSeconds = Math.abs(nowMs / 1000 - Number(timestamp));
  if (ageSeconds > toleranceSeconds) {
    return { valid: false, reason: 'Timestamp da assinatura fora da janela de tolerância' };
  }

  const expected = Buffer.from(computeSignature(secret, timestamp, rawBody));
  const received = Buffer.from(String(signature));
  // timingSafeEqual exige buffers de mesmo tamanho; a comparação em tempo constante evita ataques de temporização.
  if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) {
    return { valid: false, reason: 'Assinatura inválida' };
  }
  return { valid: true };
}
