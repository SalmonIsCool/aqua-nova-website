import type { Handler, HandlerEvent } from "@netlify/functions";
import { fetchCompanyAllTimeStats, fetchCompanyMonthlyStats } from "./lib/members";
import { readTruckyConfig } from "./lib/trucky";

function jsonResponse(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "Access-Control-Allow-Origin": "*"
    },
    body: JSON.stringify(body)
  };
}

export const handler: Handler = async (event: HandlerEvent) => {
  const { token, companyId } = readTruckyConfig();

  if (!token || !companyId) {
    return jsonResponse(500, { error: "Trucky API is not configured." });
  }

  const params = event.queryStringParameters ?? {};
  const period = params.period === "monthly" ? "monthly" : "all-time";
  const now = new Date();
  const month = Number(params.month ?? now.getMonth() + 1);
  const year = Number(params.year ?? now.getFullYear());

  try {
    const stats =
      period === "monthly"
        ? await fetchCompanyMonthlyStats(companyId, month, year)
        : await fetchCompanyAllTimeStats(companyId);

    return jsonResponse(200, {
      period,
      month: period === "monthly" ? month : undefined,
      year: period === "monthly" ? year : undefined,
      driverCount: stats.driverCount,
      totalJobs: stats.totalJobs,
      totalDistanceKm: stats.totalDistanceKm,
      totalRevenue: stats.totalRevenue,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    return jsonResponse(500, {
      error: "Failed to load company stats.",
      detail: error instanceof Error ? error.message : "Unknown error"
    });
  }
};
