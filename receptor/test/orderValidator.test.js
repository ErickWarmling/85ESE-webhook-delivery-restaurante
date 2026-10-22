import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { validateOrderEvent } from '../src/validation/orderValidator.js';
import { buildValidEvent } from './helpers.js';

const camposComErro = (payload) => validateOrderEvent(payload).errors.map((e) => e.campo);

describe('validateOrderEvent', () => {
  it('aceita um evento completo e coerente', () => {
    assert.deepEqual(validateOrderEvent(buildValidEvent()), { valid: true, errors: [] });
  });

  it('aceita campos opcionais ausentes (observações, complemento, desconto, troco)', () => {
    const event = buildValidEvent({
      pagamento: { forma: 'pix', pagoOnline: true },
      valores: { subtotal: 62.9, taxaEntrega: 7.9, total: 70.8 },
    });
    delete event.pedido.observacoes;
    delete event.pedido.enderecoEntrega.complemento;
    assert.equal(validateOrderEvent(event).valid, true);
  });

  it('rejeita corpo que não é objeto', () => {
    for (const payload of [null, [], 'texto', 42]) {
      assert.deepEqual(camposComErro(payload), ['(raiz)']);
    }
  });

  it('exige os campos do envelope do evento', () => {
    assert.deepEqual(camposComErro({ evento: 'pedido.cancelado' }), ['evento', 'idEvento', 'criadoEm', 'pedido']);
  });

  it('reporta todos os campos obrigatórios ausentes do pedido de uma só vez', () => {
    const event = buildValidEvent();
    event.pedido = {};
    assert.deepEqual(camposComErro(event), [
      'pedido.id', 'pedido.cliente', 'pedido.itens', 'pedido.enderecoEntrega', 'pedido.valores', 'pedido.pagamento',
    ]);
  });

  it('valida cliente: nome e telefone com DDD', () => {
    const event = buildValidEvent({ cliente: { nome: '   ', telefone: '1234' } });
    assert.deepEqual(camposComErro(event), ['pedido.cliente.nome', 'pedido.cliente.telefone']);
  });

  it('rejeita lista de itens vazia', () => {
    assert.ok(camposComErro(buildValidEvent({ itens: [] })).includes('pedido.itens'));
  });

  it('rejeita item fora do cardápio, quantidade inválida e preço negativo', () => {
    const event = buildValidEvent();
    event.pedido.itens.push({ codigo: 'XYZ-999', nome: 'Desconhecido', quantidade: 1.5, precoUnitario: -2 });
    const campos = camposComErro(event);
    assert.deepEqual(campos, ['pedido.itens[2].codigo', 'pedido.itens[2].quantidade', 'pedido.itens[2].precoUnitario']);
  });

  it('não confunde propriedades herdadas de Object com itens do cardápio', () => {
    const event = buildValidEvent();
    event.pedido.itens[0].codigo = 'toString';
    assert.ok(camposComErro(event).includes('pedido.itens[0].codigo'));
  });

  it('valida endereço: UF e CEP', () => {
    const event = buildValidEvent();
    Object.assign(event.pedido.enderecoEntrega, { uf: 'XX', cep: '8901' });
    assert.deepEqual(camposComErro(event), ['pedido.enderecoEntrega.uf', 'pedido.enderecoEntrega.cep']);
  });

  it('confere subtotal com a soma dos itens e total com subtotal + taxa - desconto', () => {
    const event = buildValidEvent({ valores: { subtotal: 60, taxaEntrega: 7.9, desconto: 0, total: 99 } });
    assert.deepEqual(camposComErro(event), ['pedido.valores.subtotal', 'pedido.valores.total']);
  });

  it('rejeita valores com mais de duas casas decimais', () => {
    const event = buildValidEvent({ valores: { subtotal: 62.9, taxaEntrega: 7.901, desconto: 0, total: 70.8 } });
    assert.ok(camposComErro(event).includes('pedido.valores.taxaEntrega'));
  });

  it('valida forma de pagamento e flag pagoOnline', () => {
    const event = buildValidEvent({ pagamento: { forma: 'cheque' } });
    assert.deepEqual(camposComErro(event), ['pedido.pagamento.forma', 'pedido.pagamento.pagoOnline']);
  });

  it('rejeita dinheiro marcado como pago online', () => {
    const event = buildValidEvent({ pagamento: { forma: 'dinheiro', pagoOnline: true } });
    assert.deepEqual(camposComErro(event), ['pedido.pagamento.pagoOnline']);
  });

  it('só aceita troco para pagamento em dinheiro e com valor >= total', () => {
    const comPix = buildValidEvent({ pagamento: { forma: 'pix', pagoOnline: true, trocoPara: 100 } });
    assert.deepEqual(camposComErro(comPix), ['pedido.pagamento.trocoPara']);
    const trocoBaixo = buildValidEvent({ pagamento: { forma: 'dinheiro', pagoOnline: false, trocoPara: 50 } });
    assert.deepEqual(camposComErro(trocoBaixo), ['pedido.pagamento.trocoPara']);
  });

  it('limita o tamanho das observações', () => {
    const event = buildValidEvent({ observacoes: 'x'.repeat(501) });
    assert.deepEqual(camposComErro(event), ['pedido.observacoes']);
  });

  it('rejeita data de criação inválida', () => {
    const event = buildValidEvent();
    event.criadoEm = '22/10/2026';
    assert.deepEqual(camposComErro(event), ['criadoEm']);
  });
});
