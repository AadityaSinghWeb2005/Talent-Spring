export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  attempts = 5,
  initialDelayMs = 50,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt + 1 < attempts) {
        await new Promise((resolve) => setTimeout(resolve, initialDelayMs * (2 ** attempt)));
      }
    }
  }
  throw lastError;
}
