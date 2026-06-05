export async function liveFetch(input: string, init: RequestInit = {}) {
  const url = new URL(input, window.location.origin);
  url.searchParams.set("_", String(Date.now()));

  return fetch(url.toString(), {
    ...init,
    cache: "no-store"
  });
}

export function startLiveRefresh(callback: () => void, intervalMs = 120_000) {
  const timerId = window.setInterval(callback, intervalMs);
  return () => window.clearInterval(timerId);
}
