import { once } from 'node:events';
import http from 'node:http';

/** Gerador pseudoaleatório determinístico (mulberry32) para pedidos reproduzíveis. */
export function seededRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Servidor HTTP de teste que registra as requisições recebidas e responde
 * conforme `responder(requisição, índice)`.
 */
export async function startStubServer(responder) {
  const requests = [];
  const server = http.createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    const request = { method: req.method, url: req.url, headers: req.headers, body };
    requests.push(request);
    const { status = 200, json, delayMs = 0 } = (await responder(request, requests.length - 1)) ?? {};
    setTimeout(() => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(json === undefined ? '' : JSON.stringify(json));
    }, delayMs);
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return {
    url: `http://127.0.0.1:${server.address().port}/webhooks/pedidos`,
    requests,
    close: () => new Promise((resolve) => {
      server.closeAllConnections();
      server.close(resolve);
    }),
  };
}
