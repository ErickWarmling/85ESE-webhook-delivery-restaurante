import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { computeSignature, verifySignature } from '../src/utils/signature.js';

const secret = 'segredo';
const rawBody = '{"a":1}';
const nowMs = 1_800_000_000_000;
const timestamp = String(nowMs / 1000);
const base = { secret, rawBody, timestamp, toleranceSeconds: 300, nowMs };

describe('assinatura HMAC do webhook', () => {
  it('gera assinatura determinística no formato sha256=<hex>', () => {
    const signature = computeSignature(secret, timestamp, rawBody);
    assert.match(signature, /^sha256=[0-9a-f]{64}$/);
    assert.equal(signature, computeSignature(secret, timestamp, rawBody));
  });

  it('aceita assinatura correta', () => {
    const signature = computeSignature(secret, timestamp, rawBody);
    assert.deepEqual(verifySignature({ ...base, signature }), { valid: true });
  });

  it('recusa quando o corpo foi alterado', () => {
    const signature = computeSignature(secret, timestamp, rawBody);
    assert.equal(verifySignature({ ...base, rawBody: '{"a":2}', signature }).valid, false);
  });

  it('recusa quando o segredo é outro', () => {
    const signature = computeSignature('outro', timestamp, rawBody);
    assert.equal(verifySignature({ ...base, signature }).reason, 'Assinatura inválida');
  });

  it('recusa assinatura de tamanho diferente sem lançar exceção', () => {
    assert.equal(verifySignature({ ...base, signature: 'sha256=abc' }).valid, false);
  });

  it('recusa cabeçalhos ausentes ou timestamp malformado', () => {
    assert.equal(verifySignature({ ...base, signature: undefined }).reason, 'Cabeçalhos de assinatura ausentes');
    assert.equal(verifySignature({ ...base, timestamp: 'abc', signature: 'x' }).reason, 'Timestamp da assinatura inválido');
  });

  it('recusa timestamp fora da janela de tolerância (proteção contra replay)', () => {
    const antigo = String(nowMs / 1000 - 301);
    const signature = computeSignature(secret, antigo, rawBody);
    const result = verifySignature({ ...base, timestamp: antigo, signature });
    assert.equal(result.reason, 'Timestamp da assinatura fora da janela de tolerância');
  });
});
