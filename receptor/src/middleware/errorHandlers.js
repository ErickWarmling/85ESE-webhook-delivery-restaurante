import { rejection } from '../services/orderService.js';

export function notFoundHandler(req, res) {
  res.status(404).json(rejection(`Rota não encontrada: ${req.method} ${req.path}`));
}

/**
 * Tratamento centralizado de erros. Erros de cliente (4xx) do body-parser são
 * traduzidos; qualquer outro erro vira 500 sem expor detalhes internos.
 */
export function createErrorHandler(logger) {
  // `next` não é usado, mas precisa existir: o Express identifica handlers de erro pela aridade 4.
  return (err, req, res, next) => {
    if (err.type === 'entity.too.large') {
      return res.status(413).json(rejection('Payload excede o tamanho máximo permitido'));
    }
    if (err.type === 'encoding.unsupported' || err.type === 'charset.unsupported') {
      return res.status(415).json(rejection('Codificação do corpo não suportada'));
    }
    if (Number.isInteger(err.status) && err.status >= 400 && err.status < 500 && err.expose) {
      return res.status(err.status).json(rejection(err.message));
    }
    logger.error('Erro inesperado ao processar requisição:', err);
    return res.status(500).json({ status: 'erro', mensagem: 'Erro interno no servidor do restaurante' });
  };
}
