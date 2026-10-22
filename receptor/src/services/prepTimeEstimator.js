import { CARDAPIO } from '../data/cardapio.js';

/** Minutos adicionais por unidade além da primeira (montagem/finalização de cada porção). */
export const MINUTOS_POR_UNIDADE_ADICIONAL = 1;

/**
 * Tempo de preparo do próprio pedido: os itens são preparados em paralelo,
 * então o item mais demorado define a base; cada unidade extra acrescenta um pequeno tempo.
 */
export function estimateOrderPrepMinutes(itens, cardapio = CARDAPIO) {
  const maisDemorado = Math.max(...itens.map((item) => cardapio[item.codigo].tempoPreparoMinutos));
  const unidades = itens.reduce((acc, item) => acc + item.quantidade, 0);
  return maisDemorado + (unidades - 1) * MINUTOS_POR_UNIDADE_ADICIONAL;
}

/**
 * Espera causada pelos pedidos que já estão na fila, distribuídos entre as estações de preparo.
 */
export function estimateQueueWaitMinutes(temposDosPedidosAFrente, estacoes) {
  const total = temposDosPedidosAFrente.reduce((acc, minutos) => acc + minutos, 0);
  return Math.ceil(total / estacoes);
}
