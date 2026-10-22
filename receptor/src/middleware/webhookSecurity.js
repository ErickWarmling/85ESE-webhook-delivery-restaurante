import { SIGNATURE_HEADER, TIMESTAMP_HEADER, verifySignature } from '../utils/signature.js';
import { rejection } from '../services/orderService.js';

/** Recusa requisições que não declaram JSON (415 Unsupported Media Type). */
export function requireJsonContentType(req, res, next) {
  if (!req.is('application/json')) {
    return res.status(415).json(rejection('Content-Type deve ser application/json'));
  }
  return next();
}

/**
 * Autentica o emissor pela assinatura HMAC do corpo bruto.
 * Roda ANTES do JSON.parse, para que conteúdo não autenticado nunca seja interpretado.
 */
export function verifyWebhookSignature({ secret, toleranceSeconds, logger }) {
  return (req, res, next) => {
    const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : '';
    const result = verifySignature({
      secret,
      toleranceSeconds,
      rawBody,
      timestamp: req.get(TIMESTAMP_HEADER),
      signature: req.get(SIGNATURE_HEADER),
    });
    if (!result.valid) {
      logger.warn(`Webhook recusado (${req.ip}): ${result.reason}`);
      return res.status(401).json(rejection(result.reason));
    }
    req.rawBody = rawBody;
    return next();
  };
}

/** Converte o corpo bruto (já autenticado) em objeto. */
export function parseJsonBody(req, res, next) {
  if (!req.rawBody) return res.status(400).json(rejection('Corpo da requisição vazio'));
  try {
    req.body = JSON.parse(req.rawBody);
  } catch {
    return res.status(400).json(rejection('JSON malformado'));
  }
  return next();
}
