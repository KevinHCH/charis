export async function withRetry<T>(fn: () => Promise<T>, attempts = 3, baseMs = 500): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const backoff = baseMs * Math.pow(2, i) + Math.floor(Math.random() * 200);
      await new Promise(resolve => setTimeout(resolve, backoff));
    }
  }
  throw lastError;
}
