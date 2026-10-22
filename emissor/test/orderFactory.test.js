import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CATALOGO } from '../src/catalog.js';
import { createInvalidOrderEvent, createOrderEvent, TAXA_ENTREGA } from '../src/orderFactory.js';
import { seededRandom } from './helpers.js';

const cents = (v) => Math.round(v * 100);
const codigos = new Set(CATALOGO.map((p) => p.codigo));

describe('createOrderEvent', () => {
  it('gera o envelope do evento com identificadores únicos', () => {
    const now = new Date('2026-10-22T19:30:00.000Z');
    const a = createOrderEvent({ now });
    const b = createOrderEvent({ now });
    assert.equal(a.evento, 'pedido.criado');
    assert.equal(a.criadoEm, now.toISOString());
    assert.match(a.idEvento, /^evt_[0-9a-f-]{36}$/);
    assert.match(a.pedido.id, /^PED-20261022-\d{6}$/);
    assert.notEqual(a.idEvento, b.idEvento);
  });

  it('contém itens, endereço, pagamento, valores e observações coerentes', () => {
    for (let seed = 1; seed <= 200; seed += 1) {
      const { pedido } = createOrderEvent({ random: seededRandom(seed) });
      assert.ok(pedido.itens.length >= 1);
      for (const item of pedido.itens) assert.ok(codigos.has(item.codigo));
      assert.ok(pedido.enderecoEntrega.cep);

      const soma = pedido.itens.reduce((acc, i) => acc + cents(i.precoUnitario) * i.quantidade, 0);
      const { subtotal, taxaEntrega, desconto, total } = pedido.valores;
      assert.equal(cents(subtotal), soma);
      assert.equal(taxaEntrega, TAXA_ENTREGA);
      assert.equal(cents(total), cents(subtotal) + cents(taxaEntrega) - cents(desconto));

      const { forma, pagoOnline, trocoPara } = pedido.pagamento;
      if (forma === 'dinheiro') {
        assert.equal(pagoOnline, false);
        assert.ok(trocoPara >= total);
      } else {
        assert.equal(trocoPara, undefined);
      }
    }
  });

  it('é determinístico para a mesma semente (exceto ids)', () => {
    const a = createOrderEvent({ random: seededRandom(42) });
    const b = createOrderEvent({ random: seededRandom(42) });
    assert.deepEqual(a.pedido.itens, b.pedido.itens);
    assert.deepEqual(a.pedido.valores, b.pedido.valores);
  });
});

describe('createInvalidOrderEvent', () => {
  it('introduz erros conhecidos no pedido', () => {
    const { pedido } = createInvalidOrderEvent();
    assert.equal(pedido.cliente.telefone, undefined);
    assert.equal(pedido.enderecoEntrega.cep, '123');
    assert.equal(pedido.pagamento.forma, 'cheque');
    assert.equal(pedido.itens.at(-1).codigo, 'NAO-EXISTE');
  });
});
