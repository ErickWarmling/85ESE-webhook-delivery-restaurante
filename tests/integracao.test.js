/**
 * Teste de integração (requisito 4): o cliente HTTP REAL do emissor envia eventos
 * gerados pelo emissor para a aplicação REAL do receptor, escutando numa porta TCP.
 * Verifica a resposta HTTP e se os dados que chegaram à cozinha correspondem aos enviados.
 */
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { after, before, describe, it } from 'node:test';
import { createInvalidOrderEvent, createOrderEvent } from '../emissor/src/orderFactory.js';
import { compareReceipt } from '../emissor/src/receiptCheck.js';
import { sendWebhook } from '../emissor/src/webhookClient.js';
import { createApp } from '../receptor/src/app.js';
import { validateOrderEvent } from '../receptor/src/validation/orderValidator.js';

const SECRET = 'segredo-compartilhado-de-teste';
const silentLogger = { debug() {}, info() {}, warn() {}, error() {} };
const config = {
  webhookSecret: SECRET,
  signatureToleranceSeconds: 300,
  kitchenStations: 2,
  bodyLimit: '100kb',
};

describe('integração emissor → receptor via webhook', () => {
  let server;
  let baseUrl;
  let webhookUrl;
  const send = (event, options = {}) =>
    sendWebhook(event, { url: webhookUrl, secret: SECRET, maxRetries: 0, ...options });

  before(async () => {
    server = createApp({ config, logger: silentLogger }).listen(0, '127.0.0.1');
    await once(server, 'listening');
    baseUrl = `http://127.0.0.1:${server.address().port}`;
    webhookUrl = `${baseUrl}/webhooks/pedidos`;
  });
  after(() => new Promise((resolve) => server.close(resolve)));

  it('entrega um pedido, recebe 201 e os dados recebidos correspondem aos enviados', async () => {
    const event = createOrderEvent();
    const result = await send(event);

    assert.equal(result.status, 201);
    assert.equal(result.body.status, 'aceito');
    assert.ok(result.body.tempoEstimadoPreparoMinutos > 0);
    assert.deepEqual(compareReceipt(event, result.body), []);

    // O que está na fila da cozinha é exatamente o que o emissor mandou.
    const fila = await (await fetch(`${baseUrl}/cozinha/fila`)).json();
    const naCozinha = fila.pedidos.find((p) => p.pedidoId === event.pedido.id);
    assert.ok(naCozinha, 'pedido deveria estar na fila da cozinha');
    assert.equal(naCozinha.cliente, event.pedido.cliente.nome);
    assert.equal(naCozinha.observacoes, event.pedido.observacoes);
    assert.deepEqual(
      naCozinha.itens.map(({ codigo, quantidade, observacoes }) => ({ codigo, quantidade, observacoes })),
      event.pedido.itens.map(({ codigo, quantidade, observacoes }) => ({ codigo, quantidade, observacoes })),
    );
  });

  it('pedidos seguintes entram atrás na fila e recebem tempo estimado maior', async () => {
    const primeiro = await send(createOrderEvent());
    const segundo = await send(createOrderEvent());
    assert.equal(segundo.body.posicaoFila, primeiro.body.posicaoFila + 1);
    assert.ok(segundo.body.tempoEstimadoPreparoMinutos >= primeiro.body.tempoEstimadoPreparoMinutos);
  });

  it('reenvio do mesmo evento é idempotente', async () => {
    const event = createOrderEvent();
    const primeiro = await send(event);
    const segundo = await send(event);
    assert.equal(segundo.status, 200);
    assert.equal(segundo.body.duplicado, true);
    assert.equal(segundo.body.posicaoFila, primeiro.body.posicaoFila);
  });

  it('pedido inválido gerado pelo emissor é recusado com 400 e a lista de erros', async () => {
    const result = await send(createInvalidOrderEvent());
    assert.equal(result.status, 400);
    const campos = result.body.erros.map((e) => e.campo);
    for (const campo of ['pedido.cliente.telefone', 'pedido.enderecoEntrega.cep', 'pedido.pagamento.forma']) {
      assert.ok(campos.includes(campo), `esperado erro em ${campo}`);
    }
  });

  it('emissor com segredo diferente é recusado com 401', async () => {
    const result = await send(createOrderEvent(), { secret: 'segredo-errado' });
    assert.equal(result.status, 401);
  });
});

describe('contrato do payload', () => {
  it('todo pedido gerado pelo emissor é aceito pelo validador do receptor', () => {
    for (let i = 0; i < 500; i += 1) {
      const event = createOrderEvent();
      const { valid, errors } = validateOrderEvent(event);
      assert.ok(valid, `evento inválido: ${JSON.stringify(errors)}\n${JSON.stringify(event)}`);
    }
  });
});
