import express from 'express';
import { CARDAPIO } from './data/cardapio.js';
import { createErrorHandler, notFoundHandler } from './middleware/errorHandlers.js';
import { createKitchenRouter } from './routes/kitchenRoutes.js';
import { createWebhookRouter } from './routes/webhookRoutes.js';
import { IdempotencyStore } from './services/idempotencyStore.js';
import { KitchenQueue } from './services/kitchenQueue.js';
import { createOrderService } from './services/orderService.js';

function securityHeaders(req, res, next) {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Cache-Control': 'no-store',
  });
  next();
}

/**
 * Monta a aplicação do restaurante. As dependências podem ser injetadas (testes);
 * caso contrário, são criadas com base na configuração.
 */
export function createApp({
  config,
  logger,
  cardapio = CARDAPIO,
  kitchenQueue = new KitchenQueue({ estacoes: config.kitchenStations, cardapio }),
  idempotencyStore = new IdempotencyStore(),
}) {
  const orderService = createOrderService({ kitchenQueue, idempotencyStore, cardapio, logger });
  const app = express();

  app.disable('x-powered-by');
  app.use(securityHeaders);

  app.get('/health', (req, res) => res.json({ status: 'ok', pedidosNaFila: kitchenQueue.size }));
  app.use(createWebhookRouter({ orderService, config, logger }));
  app.use(createKitchenRouter({ kitchenQueue }));

  app.use(notFoundHandler);
  app.use(createErrorHandler(logger));

  return app;
}
