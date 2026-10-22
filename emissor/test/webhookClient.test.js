import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { describe, it } from 'node:test';
import { createOrderEvent } from '../src/orderFactory.js';
import { isRetryableStatus, sendWebhook, WebhookDeliveryError } from '../src/webhookClient.js';
import { startStubServer } from './helpers.js';

const secret = 'segredo-de-teste';
const noSleep = async () => {};

describe('sendWebhook', () => {
  it('faz um POST real com JSON e cabeçalhos de assinatura válidos', async () => {
    const stub = await startStubServer(() => ({ status: 201, json: { status: 'aceito' } }));
    try {
      const event = createOrderEvent();
      const result = await sendWebhook(event, { url: stub.url, secret, sleep: noSleep });

      assert.deepEqual([result.ok, result.status, result.attempts], [true, 201, 1]);
      assert.deepEqual(result.body, { status: 'aceito' });

      const [req] = stub.requests;
      assert.equal(req.method, 'POST');
      assert.equal(req.headers['content-type'], 'application/json');
      assert.equal(req.headers['x-webhook-event'], 'pedido.criado');
      assert.equal(req.headers['x-webhook-id'], event.idEvento);
      assert.deepEqual(JSON.parse(req.body), event);

      const timestamp = req.headers['x-webhook-timestamp'];
      const esperado = `sha256=${crypto.createHmac('sha256', secret).update(`${timestamp}.${req.body}`).digest('hex')}`;
      assert.equal(req.headers['x-webhook-signature'], esperado);
    } finally {
      await stub.close();
    }
  });

  it('tenta novamente em 5xx e retorna quando o receptor se recupera', async () => {
    const stub = await startStubServer((req, i) => (i < 2 ? { status: 503 } : { status: 201, json: { ok: 1 } }));
    const delays = [];
    try {
      const result = await sendWebhook(createOrderEvent(), {
        url: stub.url, secret, retryBaseDelayMs: 100, sleep: async (ms) => delays.push(ms),
      });
      assert.equal(result.status, 201);
      assert.equal(result.attempts, 3);
      assert.deepEqual(delays, [100, 200]); // backoff exponencial
    } finally {
      await stub.close();
    }
  });

  it('não tenta novamente em erros 4xx (payload/autenticação)', async () => {
    const stub = await startStubServer(() => ({ status: 400, json: { status: 'rejeitado', erros: [] } }));
    try {
      const result = await sendWebhook(createOrderEvent(), { url: stub.url, secret, sleep: noSleep });
      assert.deepEqual([result.ok, result.status, result.attempts], [false, 400, 1]);
      assert.equal(stub.requests.length, 1);
    } finally {
      await stub.close();
    }
  });

  it('devolve a última resposta quando as tentativas se esgotam', async () => {
    const stub = await startStubServer(() => ({ status: 500 }));
    try {
      const result = await sendWebhook(createOrderEvent(), { url: stub.url, secret, maxRetries: 2, sleep: noSleep });
      assert.deepEqual([result.status, result.attempts, result.body], [500, 3, null]);
    } finally {
      await stub.close();
    }
  });

  it('lança WebhookDeliveryError quando o receptor está fora do ar', async () => {
    const stub = await startStubServer(() => ({}));
    const { url } = stub;
    await stub.close();
    await assert.rejects(
      sendWebhook(createOrderEvent(), { url, secret, maxRetries: 1, sleep: noSleep }),
      (error) => error instanceof WebhookDeliveryError && error.attempts === 2,
    );
  });

  it('aplica timeout por tentativa', async () => {
    const stub = await startStubServer(() => ({ status: 201, delayMs: 500 }));
    try {
      await assert.rejects(
        sendWebhook(createOrderEvent(), { url: stub.url, secret, timeoutMs: 50, maxRetries: 0, sleep: noSleep }),
        /timeout de 50 ms/,
      );
    } finally {
      await stub.close();
    }
  });
});

describe('isRetryableStatus', () => {
  it('considera transitórios apenas 408, 429 e 5xx', () => {
    assert.deepEqual([400, 401, 408, 409, 413, 429, 500, 503].map(isRetryableStatus),
      [false, false, true, false, false, true, true, true]);
  });
});
