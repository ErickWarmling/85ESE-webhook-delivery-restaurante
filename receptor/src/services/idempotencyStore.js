/**
 * Guarda a resposta já enviada para cada `idEvento`. Webhooks costumam ser entregues
 * "pelo menos uma vez": se o emissor reenviar o mesmo evento (ex.: após um timeout),
 * o receptor devolve a resposta original em vez de duplicar o pedido na cozinha.
 */
export class IdempotencyStore {
  #entries = new Map();
  #ttlMs;
  #maxEntries;
  #now;

  constructor({ ttlMs = 24 * 60 * 60 * 1000, maxEntries = 10_000, now = () => Date.now() } = {}) {
    this.#ttlMs = ttlMs;
    this.#maxEntries = maxEntries;
    this.#now = now;
  }

  get(key) {
    const entry = this.#entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= this.#now()) {
      this.#entries.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key, value) {
    this.#entries.delete(key);
    if (this.#entries.size >= this.#maxEntries) {
      // Map preserva a ordem de inserção: o primeiro é o mais antigo.
      this.#entries.delete(this.#entries.keys().next().value);
    }
    this.#entries.set(key, { value, expiresAt: this.#now() + this.#ttlMs });
  }
}
