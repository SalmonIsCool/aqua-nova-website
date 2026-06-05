import type { Handler } from "@netlify/functions";
import { authenticateHubRequest } from "./lib/auth";
import {
  fetchDriverHubProfile,
  fetchDriverMonthlyStats,
  fetchDriverVtcAllTimeStats,
  fetchDriverVtcLifetimeKm
} from "./lib/members";
import { getRankProgress } from "./lib/ranks";

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
  const period = params.period === "monthly" ? "monthly" : "all-time";
  const now = new Date();
  const month = Number(params.month ?? now.getMonth() + 1);
  const year = Number(params.year ?? now.getFullYear());

  try {
    const { token, companyId } = (await import("./lib/trucky")).readTruckyConfig();
    if (!token || !companyId) {
      return json(500, { error: "Trucky API is not configured on the server." });
    }

    const truckyUserId = auth.driver.truckyUserId;

    const [hubProfile, vtcAllTime, rankKm, monthlyStats] = await Promise.all([
      fetchDriverHubProfile(companyId, truckyUserId),
      fetchDriverVtcAllTimeStats(companyId, truckyUserId),
      fetchDriverVtcLifetimeKm(companyId, truckyUserId),
      period === "monthly"
        ? fetchDriverMonthlyStats(companyId, truckyUserId, month, year)
        : Promise.resolve(null)
    ]);

    const stats = period === "monthly" ? monthlyStats! : vtcAllTime;
    const rank = getRankProgress(rankKm);

    return json(200, {
      driver: {
        ...auth.driver,
        avatarUrl: hubProfile.avatarUrl
      },
      period,
      scope: "vtc",
      month: period === "monthly" ? month : undefined,
      year: period === "monthly" ? year : undefined,
      rankKm,
      totalDistanceKm: rankKm,
      stats: {
        drivenDistanceKm: stats.drivenDistanceKm,
        jobs: stats.jobs,
        cargoMass: stats.cargoMass,
        revenue: stats.revenue
      },
      rank
    });
  } catch {
    return json(500, { error: "Failed to load your stats." });
  }
};
