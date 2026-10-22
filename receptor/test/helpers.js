import { once } from 'node:events';
import { computeSignature } from '../src/utils/signature.js';

export const TEST_SECRET = 'segredo-de-teste';

export const testConfig = Object.freeze({
  port: 0,
  webhookSecret: TEST_SECRET,
  usingDevSecret: false,
  signatureToleranceSeconds: 300,
  kitchenStations: 2,
  bodyLimit: '10kb',
  logLevel: 'silent',
});

export const silentLogger = Object.freeze({ debug() {}, info() {}, warn() {}, error() {} });

/** Evento válido de referência; `overrides` permite alterar o pedido em cada teste. */
export function buildValidEvent(overrides = {}) {
  return {
    evento: 'pedido.criado',
    idEvento: 'evt_teste_001',
    criadoEm: '2026-10-22T19:30:00.000Z',
    pedido: {
      id: 'PED-20261022-000001',
      cliente: { nome: 'Ana Souza', telefone: '+55 47 99876-5432' },
      itens: [
        { codigo: 'PIZZA-001', nome: 'Pizza Margherita (média)', quantidade: 1, precoUnitario: 49.9 },
        { codigo: 'BEB-001', nome: 'Refrigerante Lata 350ml', quantidade: 2, precoUnitario: 6.5, observacoes: 'sem gelo' },
      ],
      enderecoEntrega: {
        logradouro: 'Rua XV de Novembro', numero: '1200', complemento: 'Apto 302',
        bairro: 'Centro', cidade: 'Blumenau', uf: 'SC', cep: '89010-001',
      },
      pagamento: { forma: 'dinheiro', pagoOnline: false, trocoPara: 100 },
      valores: { subtotal: 62.9, taxaEntrega: 7.9, desconto: 0, total: 70.8 },
      observacoes: 'Interfone com defeito, ligar ao chegar.',
      ...overrides,
    },
  };
}

export async function startServer(app) {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();
  return { server, baseUrl: `http://127.0.0.1:${port}`, close: () => new Promise((r) => server.close(r)) };
}

/** POST assinado (ou com assinatura/headers alterados, para testar falhas). */
export function postWebhook(baseUrl, payload, {
  secret = TEST_SECRET,
  timestamp = String(Math.floor(Date.now() / 1000)),
  signature,
  contentType = 'application/json',
  rawBody = typeof payload === 'string' ? payload : JSON.stringify(payload),
} = {}) {
  return fetch(`${baseUrl}/webhooks/pedidos`, {
    method: 'POST',
    headers: {
      'Content-Type': contentType,
      'X-Webhook-Timestamp': timestamp,
      'X-Webhook-Signature': signature ?? computeSignature(secret, timestamp, rawBody),
    },
    body: rawBody,
  });
}
