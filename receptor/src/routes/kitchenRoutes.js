import express from 'express';
import { rejection } from '../services/orderService.js';

/** Rotas de consulta/operação da cozinha (uso interno do restaurante). */
export function createKitchenRouter({ kitchenQueue }) {
  const router = express.Router();

  router.get('/cozinha/fila', (req, res) => {
    res.json({ total: kitchenQueue.size, pedidos: kitchenQueue.list() });
  });

  router.post('/cozinha/pedidos/:pedidoId/pronto', (req, res) => {
    const removido = kitchenQueue.markReady(req.params.pedidoId);
    if (!removido) return res.status(404).json(rejection('Pedido não encontrado na fila da cozinha'));
    return res.json({ status: 'pronto', pedidoId: removido.pedidoId, restantesNaFila: kitchenQueue.size });
  });

  return router;
}
