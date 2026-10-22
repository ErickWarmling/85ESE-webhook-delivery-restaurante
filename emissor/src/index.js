#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { loadConfig } from './config.js';
import { createInvalidOrderEvent, createOrderEvent } from './orderFactory.js';
import { compareReceipt } from './receiptCheck.js';
import { sendWebhook } from './webhookClient.js';

const AJUDA = `
Uso: npm start -w emissor -- [opções]

Gera um evento "pedido.criado" e o envia por webhook ao restaurante.

Opções:
  -a, --arquivo <caminho>  Envia o JSON do arquivo em vez de gerar um pedido aleatório
  -i, --invalido           Gera um pedido com erros, para ver a validação do receptor
  -r, --repetir            Reenvia o mesmo evento (demonstra a idempotência do receptor)
  -h, --ajuda              Mostra esta ajuda

Variáveis de ambiente: RECEIVER_URL, WEBHOOK_SECRET, REQUEST_TIMEOUT_MS, MAX_RETRIES, RETRY_BASE_DELAY_MS
`;

const EXIT = Object.freeze({ OK: 0, REJEITADO: 1, FALHA: 2 });
const linha = (titulo) => console.log(`\n----- ${titulo} ${'-'.repeat(Math.max(0, 50 - titulo.length))}`);

async function buildEvent(options) {
  if (options.arquivo) return JSON.parse(await readFile(options.arquivo, 'utf8'));
  return options.invalido ? createInvalidOrderEvent() : createOrderEvent();
}

async function deliver(event, config) {
  linha(`Enviando POST ${config.receiverUrl}`);
  const result = await sendWebhook(event, {
    url: config.receiverUrl,
    secret: config.webhookSecret,
    timeoutMs: config.timeoutMs,
    maxRetries: config.maxRetries,
    retryBaseDelayMs: config.retryBaseDelayMs,
    onAttempt: ({ attempt, status, error }) =>
      console.log(`Tentativa ${attempt}: ${error ? `falhou (${error.message})` : `HTTP ${status}`}`),
  });

  linha('Resposta do restaurante');
  console.log(`Status HTTP: ${result.status} | tentativas: ${result.attempts} | tempo: ${result.durationMs} ms`);
  console.log(JSON.stringify(result.body, null, 2));

  if (!result.ok) {
    console.log(`\n✗ Pedido REJEITADO pelo restaurante (HTTP ${result.status}).`);
    return EXIT.REJEITADO;
  }

  const divergencias = compareReceipt(event, result.body);
  if (divergencias.length > 0) {
    console.log('\n✗ A confirmação NÃO corresponde ao pedido enviado:');
    console.table(divergencias);
    return EXIT.REJEITADO;
  }
  console.log(
    `\n✓ Pedido ${result.body.pedidoId} confirmado${result.body.duplicado ? ' (evento duplicado, confirmação original)' : ''}. ` +
      `Posição na fila: ${result.body.posicaoFila}. Tempo estimado: ${result.body.tempoEstimadoPreparoMinutos} min.`,
  );
  console.log('✓ Dados confirmados conferem com os enviados (id do evento, id do pedido, itens, total e pagamento).');
  return EXIT.OK;
}

async function main() {
  const { values: options } = parseArgs({
    options: {
      arquivo: { type: 'string', short: 'a' },
      invalido: { type: 'boolean', short: 'i', default: false },
      repetir: { type: 'boolean', short: 'r', default: false },
      ajuda: { type: 'boolean', short: 'h', default: false },
    },
  });
  if (options.ajuda) {
    console.log(AJUDA);
    return EXIT.OK;
  }

  try {
    process.loadEnvFile();
  } catch {
    // .env é opcional.
  }
  const config = loadConfig();
  if (config.usingDevSecret) console.warn('Aviso: WEBHOOK_SECRET não definido, usando segredo de desenvolvimento.');

  const event = await buildEvent(options);
  linha('Payload JSON do evento');
  console.log(JSON.stringify(event, null, 2));

  let exitCode = await deliver(event, config);
  if (options.repetir) {
    linha('Reenviando o MESMO evento');
    exitCode = Math.max(exitCode, await deliver(event, config));
  }
  return exitCode;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error) => {
    console.error(`\n✗ ${error.message}`);
    process.exitCode = EXIT.FALHA;
  });
