import type { Handler } from "@netlify/functions";
import { authenticateHubRequest } from "./lib/auth";
import { readTruckyConfig, truckyFetch } from "./lib/trucky";

function json(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "private, no-store"
    },
    body: JSON.stringify(body)
  };
}

export const handler: Handler = async (event, context) => {
  const auth = await authenticateHubRequest(context, event.headers);
  if (!auth.ok) return json(auth.statusCode, { error: auth.error });

  const params = event.queryStringParameters ?? {};
  const page = params.page ?? "1";
  const status = params.status ?? "";

  const query = new URLSearchParams({
    page,
    user_id: String(auth.driver.truckyUserId)
  });

  if (status) query.set("status", status);

  try {
    const { companyId } = readTruckyConfig();
    if (!companyId) {
      return json(500, { error: "Trucky API is not configured on the server." });
    }

    const response = await truckyFetch(`/api/v1/company/${companyId}/jobs`, query);
    if (!response.ok) {
      return json(response.status, { error: "Could not load jobs from Trucky." });
    }

    const data = await response.json();
    const jobs = Array.isArray(data.data) ? data.data : Array.isArray(data) ? data : [];

    const simplified = jobs.map(
      (job: {
        id: number;
        status: string;
        source_city_name?: string;
        destination_city_name?: string;
        created_at?: string;
        driver?: { name?: string };
      }) => ({
        id: job.id,
        status: job.status,
        from: job.source_city_name ?? "Unknown",
        to: job.destination_city_name ?? "Unknown",
        date: job.created_at ?? null
      })
    );

    return json(200, {
      driver: auth.driver,
      page: Number(page),
      jobs: simplified
    });
  } catch {
    return json(500, { error: "Failed to load your jobs." });
  }
};
