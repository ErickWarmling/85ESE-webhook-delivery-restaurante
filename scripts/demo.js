/**
 * Demonstração ponta a ponta com DOIS PROCESSOS independentes:
 * sobe o receptor, aguarda ficar saudável, executa o emissor (pedido válido,
 * reenvio idempotente e pedido inválido) e encerra o receptor.
 *
 * Uso: npm run demo
 */
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const PORT = process.env.DEMO_PORT || '3999';
const env = {
  ...process.env,
  PORT,
  RECEIVER_URL: `http://localhost:${PORT}/webhooks/pedidos`,
  WEBHOOK_SECRET: process.env.WEBHOOK_SECRET || 'segredo-da-demonstracao',
};

async function waitForHealth(url, attempts = 50) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // ainda subindo
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Receptor não respondeu em ${url}`);
}

async function runEmitter(args, titulo) {
  console.log(`\n\n######## EMISSOR: ${titulo} ########`);
  const child = spawn(process.execPath, ['emissor/src/index.js', ...args], { cwd: root, env, stdio: 'inherit' });
  const [code] = await once(child, 'exit');
  console.log(`######## emissor terminou com código ${code} ########`);
  return code;
}

const receptor = spawn(process.execPath, ['receptor/src/server.js'], { cwd: root, env, stdio: 'inherit' });
try {
  await waitForHealth(`http://localhost:${PORT}/health`);
  const codes = [
    await runEmitter(['--repetir'], 'pedido válido + reenvio do mesmo evento'),
    await runEmitter(['--invalido'], 'pedido inválido'),
  ];
  const fila = await (await fetch(`http://localhost:${PORT}/cozinha/fila`)).json();
  console.log(`\nFila da cozinha agora tem ${fila.total} pedido(s).`);
  process.exitCode = codes[0] === 0 && codes[1] === 1 ? 0 : 1;
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  receptor.kill('SIGTERM');
}
