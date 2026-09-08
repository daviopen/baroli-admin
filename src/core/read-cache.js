const entries = new Map();
const inFlight = new Map();

function now() {
  return Date.now();
}

/**
 * Cache de leitura em memória por aba/sessão de SPA.
 * - deduplica chamadas concorrentes para a mesma chave;
 * - reutiliza resultados somente durante TTL curto;
 * - nunca persiste dados no localStorage/sessionStorage;
 * - deve ser invalidado após mutações que alterem a fonte.
 */
export async function cachedRead(key, loader, { ttlMs = 60_000, force = false } = {}) {
  if (!key || typeof loader !== 'function') throw new Error('Leitura cacheada inválida.');

  const cached = entries.get(key);
  if (!force && cached && cached.expiresAt > now()) return cached.value;
  if (!force && inFlight.has(key)) return inFlight.get(key);

  const request = Promise.resolve()
    .then(loader)
    .then((value) => {
      entries.set(key, { value, expiresAt: now() + Math.max(0, Number(ttlMs) || 0) });
      return value;
    })
    .finally(() => inFlight.delete(key));

  inFlight.set(key, request);
  return request;
}

export function invalidateReadCache(...keysOrPrefixes) {
  const targets = keysOrPrefixes.flat().filter(Boolean);
  if (!targets.length) {
    entries.clear();
    inFlight.clear();
    return;
  }

  for (const key of [...entries.keys()]) {
    if (targets.some((target) => key === target || key.startsWith(`${target}:`))) entries.delete(key);
  }
}

export function getReadCacheStats() {
  return { entries: entries.size, inFlight: inFlight.size };
}
