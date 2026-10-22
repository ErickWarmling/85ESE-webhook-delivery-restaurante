import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { createApp } from '../src/app.js';
import { KitchenQueue } from '../src/services/kitchenQueue.js';
import { buildValidEvent, postWebhook, silentLogger, startServer, testConfig } from './helpers.js';

describe('API HTTP do receptor', () => {
  let ctx;
  let kitchenQueue;

  before(async () => {
    kitchenQueue = new KitchenQueue({ estacoes: 2 });
    ctx = await startServer(createApp({ config: testConfig, logger: silentLogger, kitchenQueue }));
  });
  after(() => ctx.close());
  beforeEach(() => {
    for (const { pedidoId } of kitchenQueue.list()) kitchenQueue.markReady(pedidoId);
  });

  it('GET /health responde 200', async () => {
    const res = await fetch(`${ctx.baseUrl}/health`);
    assert.equal(res.status, 200);
    assert.equal((await res.json()).status, 'ok');
    assert.equal(res.headers.get('x-powered-by'), null);
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  });

  it('201: aceita pedido válido, adiciona à fila e devolve o tempo estimado', async () => {
    const event = buildValidEvent();
    const res = await postWebhook(ctx.baseUrl, event);
    const body = await res.json();

    assert.equal(res.status, 201);
    assert.equal(body.status, 'aceito');
    assert.equal(body.pedidoId, event.pedido.id);
    assert.equal(body.idEvento, event.idEvento);
    assert.equal(body.posicaoFila, 1);
    assert.equal(body.tempoEstimadoPreparoMinutos, 27);
    assert.ok(Date.parse(body.previsaoPronto) > Date.parse(body.recebidoEm));
    assert.deepEqual(body.resumo, { quantidadeItens: 3, valorTotal: 70.8, formaPagamento: 'dinheiro' });
    assert.equal(kitchenQueue.has(event.pedido.id), true);
  });

  it('200: reenvio do mesmo idEvento devolve a confirmação original sem duplicar o pedido', async () => {
    const event = buildValidEvent();
    event.idEvento = 'evt_duplicado';
    const primeira = await (await postWebhook(ctx.baseUrl, event)).json();
    const res = await postWebhook(ctx.baseUrl, event);
    const segunda = await res.json();

    assert.equal(res.status, 200);
    assert.equal(segunda.duplicado, true);
    assert.equal(segunda.posicaoFila, primeira.posicaoFila);
    assert.equal(kitchenQueue.size, 1);
  });

  it('409: mesmo pedido enviado em outro evento', async () => {
    await postWebhook(ctx.baseUrl, { ...buildValidEvent(), idEvento: 'evt_a' });
    const res = await postWebhook(ctx.baseUrl, { ...buildValidEvent(), idEvento: 'evt_b' });
    assert.equal(res.status, 409);
    assert.equal((await res.json()).erros[0].campo, 'pedido.id');
  });

  it('400: payload inválido devolve a lista de erros e não entra na fila', async () => {
    const event = buildValidEvent({ itens: [] });
    event.idEvento = 'evt_invalido';
    const res = await postWebhook(ctx.baseUrl, event);
    const body = await res.json();

    assert.equal(res.status, 400);
    assert.equal(body.status, 'rejeitado');
    assert.ok(body.erros.some((e) => e.campo === 'pedido.itens'));
    assert.equal(kitchenQueue.size, 0);
  });

  it('400: JSON malformado (com assinatura válida)', async () => {
    const res = await postWebhook(ctx.baseUrl, '{"evento": ');
    assert.equal(res.status, 400);
    assert.equal((await res.json()).mensagem, 'JSON malformado');
  });

  it('401: assinatura inválida', async () => {
    const res = await postWebhook(ctx.baseUrl, buildValidEvent(), { secret: 'segredo-errado' });
    assert.equal(res.status, 401);
    assert.equal(kitchenQueue.size, 0);
  });

  it('401: sem cabeçalhos de assinatura', async () => {
    const res = await fetch(`${ctx.baseUrl}/webhooks/pedidos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildValidEvent()),
    });
    assert.equal(res.status, 401);
  });

  it('401: timestamp antigo (replay)', async () => {
    const timestamp = String(Math.floor(Date.now() / 1000) - 3600);
    const res = await postWebhook(ctx.baseUrl, buildValidEvent(), { timestamp });
    assert.equal(res.status, 401);
  });

  it('415: Content-Type diferente de JSON', async () => {
    const res = await postWebhook(ctx.baseUrl, 'evento=pedido.criado', { contentType: 'text/plain' });
    assert.equal(res.status, 415);
  });

  it('413: payload acima do limite', async () => {
    const res = await postWebhook(ctx.baseUrl, buildValidEvent({ observacoes: 'x'.repeat(20_000) }));
    assert.equal(res.status, 413);
  });

  it('404: rota inexistente', async () => {
    const res = await fetch(`${ctx.baseUrl}/nao-existe`);
    assert.equal(res.status, 404);
  });

  it('GET /cozinha/fila lista os pedidos e POST .../pronto os remove', async () => {
    await postWebhook(ctx.baseUrl, { ...buildValidEvent(), idEvento: 'evt_fila' });
    const fila = await (await fetch(`${ctx.baseUrl}/cozinha/fila`)).json();
    assert.equal(fila.total, 1);
    assert.equal(fila.pedidos[0].pedidoId, 'PED-20261022-000001');

    const pronto = await fetch(`${ctx.baseUrl}/cozinha/pedidos/PED-20261022-000001/pronto`, { method: 'POST' });
    assert.equal(pronto.status, 200);
    assert.equal((await pronto.json()).restantesNaFila, 0);

    const repetido = await fetch(`${ctx.baseUrl}/cozinha/pedidos/PED-20261022-000001/pronto`, { method: 'POST' });
    assert.equal(repetido.status, 404);
  });

  it('500: erro inesperado não expõe detalhes internos', async () => {
    const quebrada = new KitchenQueue();
    quebrada.enqueue = () => {
      throw new Error('falha interna secreta');
    };
    const local = await startServer(createApp({ config: testConfig, logger: silentLogger, kitchenQueue: quebrada }));
    try {
      const res = await postWebhook(local.baseUrl, buildValidEvent());
      const body = await res.json();
      assert.equal(res.status, 500);
      assert.doesNotMatch(JSON.stringify(body), /secreta/);
    } finally {
      await local.close();
    }
  });
});
