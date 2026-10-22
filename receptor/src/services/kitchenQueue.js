import { CARDAPIO } from '../data/cardapio.js';
import { estimateOrderPrepMinutes, estimateQueueWaitMinutes } from './prepTimeEstimator.js';

const MS_POR_MINUTO = 60_000;

/**
 * Fila FIFO (em memória) dos pedidos aguardando preparo na cozinha.
 */
export class KitchenQueue {
  #pedidos = [];
  #estacoes;
  #cardapio;
  #clock;

  constructor({ estacoes = 2, cardapio = CARDAPIO, clock = () => new Date() } = {}) {
    if (!Number.isInteger(estacoes) || estacoes < 1) throw new RangeError('estacoes deve ser um inteiro >= 1');
    this.#estacoes = estacoes;
    this.#cardapio = cardapio;
    this.#clock = clock;
  }

  get size() {
    return this.#pedidos.length;
  }

  has(pedidoId) {
    return this.#pedidos.some((entrada) => entrada.pedidoId === pedidoId);
  }

  /** Adiciona o pedido ao fim da fila e devolve a entrada com o tempo estimado. */
  enqueue(pedido) {
    const tempoPreparoMinutos = estimateOrderPrepMinutes(pedido.itens, this.#cardapio);
    const esperaFilaMinutos = estimateQueueWaitMinutes(
      this.#pedidos.map((entrada) => entrada.tempoPreparoMinutos),
      this.#estacoes,
    );
    const tempoEstimadoMinutos = tempoPreparoMinutos + esperaFilaMinutos;
    const agora = this.#clock();

    const entrada = Object.freeze({
      pedidoId: pedido.id,
      cliente: pedido.cliente.nome,
      itens: pedido.itens.map(({ codigo, nome, quantidade, observacoes }) => ({ codigo, nome, quantidade, observacoes })),
      observacoes: pedido.observacoes,
      tempoPreparoMinutos,
      esperaFilaMinutos,
      tempoEstimadoMinutos,
      entrouEm: agora.toISOString(),
      previsaoPronto: new Date(agora.getTime() + tempoEstimadoMinutos * MS_POR_MINUTO).toISOString(),
    });
    this.#pedidos.push(entrada);
    return { ...entrada, posicao: this.#pedidos.length };
  }

  /** Lista os pedidos na ordem de preparo, com a posição atual de cada um. */
  list() {
    return this.#pedidos.map((entrada, index) => ({ ...entrada, posicao: index + 1 }));
  }

  /** Remove o pedido da fila (pedido pronto). Retorna a entrada removida ou null. */
  markReady(pedidoId) {
    const index = this.#pedidos.findIndex((entrada) => entrada.pedidoId === pedidoId);
    if (index === -1) return null;
    const [removida] = this.#pedidos.splice(index, 1);
    return removida;
  }
}
