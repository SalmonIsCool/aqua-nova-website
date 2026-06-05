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

export async function truckyFetch(path: string, searchParams?: URLSearchParams) {
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

  return response;
}

export { TRUCKY_BASE, USER_AGENT };
