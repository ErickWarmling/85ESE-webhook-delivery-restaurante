import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createOrderEvent } from '../src/orderFactory.js';
import { compareReceipt } from '../src/receiptCheck.js';

function confirmationFor(event) {
  return {
    idEvento: event.idEvento,
    pedidoId: event.pedido.id,
    resumo: {
      quantidadeItens: event.pedido.itens.reduce((acc, i) => acc + i.quantidade, 0),
      valorTotal: event.pedido.valores.total,
      formaPagamento: event.pedido.pagamento.forma,
    },
  };
}

describe('compareReceipt', () => {
  it('não aponta divergências quando a confirmação corresponde ao pedido', () => {
    const event = createOrderEvent();
    assert.deepEqual(compareReceipt(event, confirmationFor(event)), []);
  });

  it('aponta cada campo divergente', () => {
    const event = createOrderEvent();
    const confirmation = confirmationFor(event);
    confirmation.pedidoId = 'OUTRO';
    confirmation.resumo.valorTotal += 1;
    assert.deepEqual(compareReceipt(event, confirmation).map((d) => d.campo), ['pedidoId', 'resumo.valorTotal']);
  });

  it('trata confirmação ausente', () => {
    assert.equal(compareReceipt(createOrderEvent(), null).length, 5);
  });
});
