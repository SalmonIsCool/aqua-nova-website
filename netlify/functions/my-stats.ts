import type { Handler } from "@netlify/functions";
import { authenticateHubRequest } from "./lib/auth";
import {
  fetchDriverMonthlyStats,
  fetchDriverTruckyProfile
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

    const truckyProfile = await fetchDriverTruckyProfile(companyId, auth.driver.truckyUserId);
    const totalDistanceKm = truckyProfile.totalDistanceKm;

    const stats =
      period === "monthly"
        ? await fetchDriverMonthlyStats(companyId, auth.driver.truckyUserId, month, year)
        : {
            drivenDistanceKm: totalDistanceKm,
            jobs: truckyProfile.totalJobs,
            cargoMass: truckyProfile.totalCargoMass,
            revenue: truckyProfile.totalRevenue
          };

    return json(200, {
      driver: {
        ...auth.driver,
        avatarUrl: truckyProfile.avatarUrl
      },
      period,
      month: period === "monthly" ? month : undefined,
      year: period === "monthly" ? year : undefined,
      totalDistanceKm,
      stats,
      rank: getRankProgress(totalDistanceKm)
    });
  } catch {
    return json(500, { error: "Failed to load your stats." });
  }
};
