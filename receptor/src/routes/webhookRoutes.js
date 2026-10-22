import express from 'express';
import { parseJsonBody, requireJsonContentType, verifyWebhookSignature } from '../middleware/webhookSecurity.js';

export const WEBHOOK_PATH = '/webhooks/pedidos';

export function createWebhookRouter({ orderService, config, logger }) {
  const router = express.Router();

  router.post(
    WEBHOOK_PATH,
    requireJsonContentType,
    express.raw({ type: 'application/json', limit: config.bodyLimit }),
    verifyWebhookSignature({
      secret: config.webhookSecret,
      toleranceSeconds: config.signatureToleranceSeconds,
      logger,
    }),
    parseJsonBody,
    (req, res) => {
      const { statusCode, body } = orderService.receive(req.body);
      res.status(statusCode).json(body);
    },
  );

  return router;
}
