import { createApp } from './app.js';
import { loadConfig } from './config/index.js';
import { WEBHOOK_PATH } from './routes/webhookRoutes.js';
import { createLogger } from './utils/logger.js';

try {
  process.loadEnvFile();
} catch {
  // Arquivo .env é opcional: sem ele, valem as variáveis do ambiente e os padrões.
}

let config;
try {
  config = loadConfig();
} catch (error) {
  console.error(`Configuração inválida: ${error.message}`);
  process.exit(1);
}

const logger = createLogger(config.logLevel);
if (config.usingDevSecret) {
  logger.warn('WEBHOOK_SECRET não definido: usando segredo de desenvolvimento. NÃO use assim em produção.');
}

const app = createApp({ config, logger });
const server = app.listen(config.port, () => {
  logger.info(`Restaurante (receptor) ouvindo em http://localhost:${config.port}${WEBHOOK_PATH}`);
});

server.on('error', (error) => {
  logger.error(`Não foi possível iniciar o servidor: ${error.message}`);
  process.exit(1);
});

function shutdown(signal) {
  logger.info(`${signal} recebido, encerrando o receptor...`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
