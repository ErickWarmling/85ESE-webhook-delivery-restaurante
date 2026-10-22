import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { IdempotencyStore } from '../src/services/idempotencyStore.js';
import { KitchenQueue } from '../src/services/kitchenQueue.js';
import { estimateOrderPrepMinutes, estimateQueueWaitMinutes } from '../src/services/prepTimeEstimator.js';
import { buildValidEvent } from './helpers.js';

const fixedClock = () => new Date('2026-10-22T20:00:00.000Z');
const pedido = (id) => ({ ...buildValidEvent().pedido, id });

describe('estimativa de tempo de preparo', () => {
  it('usa o item mais demorado + 1 min por unidade adicional', () => {
    // Pizza (25 min) + 2 refrigerantes: 3 unidades => 25 + 2
    assert.equal(estimateOrderPrepMinutes(pedido('P1').itens), 27);
  });

  it('distribui a fila entre as estações de preparo', () => {
    assert.equal(estimateQueueWaitMinutes([], 2), 0);
    assert.equal(estimateQueueWaitMinutes([27, 15], 2), 21);
    assert.equal(estimateQueueWaitMinutes([27, 15], 1), 42);
  });
});

describe('KitchenQueue', () => {
  it('enfileira em ordem FIFO e soma a espera dos pedidos à frente', () => {
    const fila = new KitchenQueue({ estacoes: 1, clock: fixedClock });
    const primeiro = fila.enqueue(pedido('P1'));
    const segundo = fila.enqueue(pedido('P2'));

    assert.equal(primeiro.posicao, 1);
    assert.equal(primeiro.tempoEstimadoMinutos, 27);
    assert.equal(primeiro.previsaoPronto, '2026-10-22T20:27:00.000Z');
    assert.equal(segundo.posicao, 2);
    assert.equal(segundo.esperaFilaMinutos, 27);
    assert.equal(segundo.tempoEstimadoMinutos, 54);
    assert.deepEqual(fila.list().map((p) => p.pedidoId), ['P1', 'P2']);
  });

  it('remove pedido pronto e atualiza as posições', () => {
    const fila = new KitchenQueue({ clock: fixedClock });
    fila.enqueue(pedido('P1'));
    fila.enqueue(pedido('P2'));
    assert.equal(fila.markReady('P1').pedidoId, 'P1');
    assert.equal(fila.markReady('P1'), null);
    assert.deepEqual(fila.list().map((p) => [p.pedidoId, p.posicao]), [['P2', 1]]);
    assert.equal(fila.has('P1'), false);
    assert.equal(fila.size, 1);
  });

  it('não permite alterar as entradas da fila por fora', () => {
    const fila = new KitchenQueue();
    fila.enqueue(pedido('P1'));
    fila.list()[0].pedidoId = 'HACK';
    assert.equal(fila.list()[0].pedidoId, 'P1');
  });

  it('valida a quantidade de estações', () => {
    assert.throws(() => new KitchenQueue({ estacoes: 0 }), RangeError);
  });
});

describe('IdempotencyStore', () => {
  it('guarda e expira respostas pelo TTL', () => {
    let now = 0;
    const store = new IdempotencyStore({ ttlMs: 1000, now: () => now });
    store.set('evt', { ok: true });
    assert.deepEqual(store.get('evt'), { ok: true });
    now = 1000;
    assert.equal(store.get('evt'), undefined);
  });

  it('descarta a entrada mais antiga ao atingir o limite', () => {
    const store = new IdempotencyStore({ maxEntries: 2 });
    store.set('a', 1);
    store.set('b', 2);
    store.set('c', 3);
    assert.equal(store.get('a'), undefined);
    assert.equal(store.get('c'), 3);
  });
});
