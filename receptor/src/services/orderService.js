import { validateOrderEvent } from '../validation/orderValidator.js';
import { formatKitchenTicket } from '../utils/kitchenTicket.js';

export const rejection = (mensagem, erros = []) => ({ status: 'rejeitado', mensagem, erros });

/**
 * Regra de negócio do recebimento: valida, garante idempotência, enfileira na cozinha
 * e monta a confirmação. Independe do HTTP, o que facilita os testes.
 * @returns {{ statusCode: number, body: object }}
 */
export function createOrderService({ kitchenQueue, idempotencyStore, cardapio, logger, clock = () => new Date() }) {
  function receive(event) {
    const { valid, errors } = validateOrderEvent(event, { cardapio });
    if (!valid) {
      logger.warn(`Pedido rejeitado na validação (${errors.length} erro(s))`, JSON.stringify(errors));
      return { statusCode: 400, body: rejection('Payload do pedido inválido', errors) };
    }

    const respostaAnterior = idempotencyStore.get(event.idEvento);
    if (respostaAnterior) {
      logger.info(`Evento ${event.idEvento} já processado; reenviando a confirmação original`);
      return { statusCode: 200, body: { ...respostaAnterior, duplicado: true } };
    }

    const { pedido } = event;
    if (kitchenQueue.has(pedido.id)) {
      return {
        statusCode: 409,
        body: rejection('Pedido já está na fila da cozinha', [
          { campo: 'pedido.id', mensagem: `O pedido ${pedido.id} já foi recebido em outro evento` },
        ]),
      };
    }

    const entrada = kitchenQueue.enqueue(pedido);
    const body = {
      status: 'aceito',
      mensagem: 'Pedido recebido e adicionado à fila da cozinha',
      idEvento: event.idEvento,
      pedidoId: pedido.id,
      posicaoFila: entrada.posicao,
      tempoEstimadoPreparoMinutos: entrada.tempoEstimadoMinutos,
      previsaoPronto: entrada.previsaoPronto,
      recebidoEm: clock().toISOString(),
      resumo: {
        quantidadeItens: pedido.itens.reduce((acc, item) => acc + item.quantidade, 0),
        valorTotal: pedido.valores.total,
        formaPagamento: pedido.pagamento.forma,
      },
      duplicado: false,
    };
    idempotencyStore.set(event.idEvento, body);
    logger.info(formatKitchenTicket(pedido, entrada));
    return { statusCode: 201, body };
  }

  return Object.freeze({ receive });
}
