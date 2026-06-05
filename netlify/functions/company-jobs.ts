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
  const limit = params.limit ?? "";
  const status = params.status ?? "";

  const query = new URLSearchParams({ page });

  if (status) query.set("status", status);
  if (limit) query.set("limit", limit);

  try {
    const { companyId } = readTruckyConfig();
    if (!companyId) {
      return json(500, { error: "Trucky API is not configured on the server." });
    }

    const response = await truckyFetch(`/api/v1/company/${companyId}/jobs`, query);
    if (!response.ok) {
      const message =
        response.status === 429
          ? "Trucky is temporarily rate-limiting requests. Wait a few seconds and refresh."
          : "Could not load company jobs from Trucky.";
      return json(response.status, { error: message, status: response.status });
    }

    const data = await response.json();
    const jobs = Array.isArray(data.data) ? data.data : Array.isArray(data) ? data : [];

    const simplified = jobs
      .map(
        (job: {
          id: number;
          status: string;
          source_city_name?: string;
          destination_city_name?: string;
          created_at?: string;
          completed_at?: string;
          driven_distance_km?: number;
          planned_distance_km?: number;
          vehicle_damage?: number;
          income?: number;
          revenue?: number;
          driver?: { name?: string };
          user?: { name?: string };
        }) => ({
          id: job.id,
          status: job.status,
          driver: job.driver?.name ?? job.user?.name ?? "Unknown",
          from: job.source_city_name ?? "Unknown",
          to: job.destination_city_name ?? "Unknown",
          date: job.completed_at ?? job.created_at ?? null,
          distance: Math.round(job.driven_distance_km ?? job.planned_distance_km ?? 0),
          damage: Math.round(Number(job.vehicle_damage ?? 0)),
          income: Math.round(Number(job.income ?? job.revenue ?? 0))
        })
      )
      .sort((a, b) => {
        const aTime = a.date ? new Date(a.date).getTime() : 0;
        const bTime = b.date ? new Date(b.date).getTime() : 0;
        return bTime - aTime;
      });

    return json(200, {
      page: Number(page),
      jobs: simplified
    });
  } catch {
    return json(500, { error: "Failed to load company jobs." });
  }
};
