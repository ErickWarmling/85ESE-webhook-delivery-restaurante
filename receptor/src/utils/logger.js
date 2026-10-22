const LEVELS = Object.freeze({ debug: 10, info: 20, warn: 30, error: 40, silent: 100 });

/**
 * Logger mínimo com níveis. `sink` permite redirecionar a saída (ex.: em testes).
 */
export function createLogger(level = 'info', sink = console) {
  const threshold = LEVELS[level] ?? LEVELS.info;
  const write = (name, method) => (...args) => {
    if (LEVELS[name] < threshold) return;
    sink[method](`[${new Date().toISOString()}] ${name.toUpperCase()}`, ...args);
  };

  return Object.freeze({
    debug: write('debug', 'log'),
    info: write('info', 'log'),
    warn: write('warn', 'warn'),
    error: write('error', 'error'),
  });
}
