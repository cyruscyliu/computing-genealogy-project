const FETCH_TIMEOUT_MS = 8000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchWithTimeout(url, options = {}, retryCount = 2) {
  let lastError = null;

  for (let attempt = 0; attempt <= retryCount; attempt += 1) {
    try {
      return await fetch(url, {
        ...options,
        headers: {
          "user-agent": "computing-genealogy-project/person-enrich",
          accept: "application/json,text/html,*/*",
          ...(options.headers ?? {}),
        },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
    } catch (error) {
      lastError = error;
      if (attempt >= retryCount) {
        throw error;
      }
      await sleep(250 * (attempt + 1));
    }
  }

  throw lastError;
}
