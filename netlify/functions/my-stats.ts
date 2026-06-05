import type { Handler } from "@netlify/functions";
import { authenticateHubRequest } from "./lib/auth";
import { fetchCompanyRanks, fetchDriverTotalDistanceKm } from "./lib/driver-distance";
import { getRankProgress } from "./lib/ranks";
import { truckyFetch } from "./lib/trucky";

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
  const now = new Date();
  const period = params.period ?? "monthly";
  const month = params.month ?? String(now.getMonth() + 1);
  const year = params.year ?? String(now.getFullYear());

  const query = new URLSearchParams({ period, month, year });

  try {
    const { token, companyId } = (await import("./lib/trucky")).readTruckyConfig();
    if (!token || !companyId) {
      return json(500, { error: "Trucky API is not configured on the server." });
    }

    const [statsResponse, totalDistanceKm, companyRanks] = await Promise.all([
      truckyFetch(`/api/v2/company/${companyId}/stats/members`, query),
      fetchDriverTotalDistanceKm(companyId, auth.driver.truckyUserId),
      fetchCompanyRanks(companyId)
    ]);

    if (!statsResponse.ok) {
      return json(statsResponse.status, { error: "Could not load stats from Trucky." });
    }

    const data = await statsResponse.json();
    const members = Array.isArray(data.members) ? data.members : [];
    const mine = members.find(
      (member: { user_id: number }) => Number(member.user_id) === auth.driver.truckyUserId
    );

    return json(200, {
      driver: auth.driver,
      period,
      month: Number(month),
      year: Number(year),
      totalDistanceKm,
      stats: mine
        ? {
            drivenDistanceKm: Math.round(mine.driven_distance),
            jobs: mine.jobs,
            cargoMass: Math.round(mine.cargo_mass),
            revenue: Math.round(mine.revenue)
          }
        : {
            drivenDistanceKm: 0,
            jobs: 0,
            cargoMass: 0,
            revenue: 0
          },
      rank: getRankProgress(totalDistanceKm, companyRanks ?? undefined)
    });
  } catch {
    return json(500, { error: "Failed to load your stats." });
  }
};
