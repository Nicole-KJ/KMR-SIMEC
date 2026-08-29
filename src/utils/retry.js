// Retries a failing async read with linear backoff. Only meant for
// side-effect-free reads -- never wrap a write with this.
export async function withRetry(fn, { retries = 2, delayMs = 600 } = {}) {
  let lastErr
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, delayMs * (attempt + 1)))
      }
    }
  }
  throw lastErr
}
