const TRUCKY_BASE = "https://e.truckyapp.com";
const USER_AGENT = "Aqua Nova Transport Website";

export function readTruckyConfig() {
  const token =
    process.env.TRUCKY_ACCESS_TOKEN?.trim() ||
    process.env.TRUCKY_TOKEN?.trim() ||
    process.env.TRUCKY_API_TOKEN?.trim();
  const companyId =
    process.env.TRUCKY_COMPANY_ID?.trim() || process.env.TRUCKY_COMPANY?.trim();

  return { token, companyId };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function retryDelayMs(response: Response) {
  const header = response.headers.get("retry-after");
  if (header) {
    const seconds = Number(header);
    if (Number.isFinite(seconds) && seconds > 0) return seconds * 1000;
  }

  try {
    const body = (await response.clone().json()) as { retry_after?: number };
    const seconds = Number(body.retry_after);
    if (Number.isFinite(seconds) && seconds > 0) return seconds * 1000;
  } catch {
    /* ignore */
  }

  return 2000;
}

export async function truckyFetch(path: string, searchParams?: URLSearchParams, attempt = 0) {
  const { token, companyId } = readTruckyConfig();
  if (!token || !companyId) {
    throw new Error("TRUCKY_NOT_CONFIGURED");
  }

  const query = searchParams?.toString();
  const url = `${TRUCKY_BASE}${path}${query ? `?${query}` : ""}`;

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": USER_AGENT,
      "x-access-token": token
    }
  });

  if (response.status === 429 && attempt < 3) {
    await sleep(await retryDelayMs(response));
    return truckyFetch(path, searchParams, attempt + 1);
  }

  return response;
}

export { TRUCKY_BASE, USER_AGENT };
