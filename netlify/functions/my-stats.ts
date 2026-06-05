import type { Handler } from "@netlify/functions";
import { authenticateHubRequest } from "./lib/auth";
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
  const auth = await authenticateHubRequest(context);
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

    const response = await truckyFetch(`/api/v2/company/${companyId}/stats/members`, query);
    if (!response.ok) {
      return json(response.status, { error: "Could not load stats from Trucky." });
    }

    const data = await response.json();
    const members = Array.isArray(data.members) ? data.members : [];
    const mine = members.find(
      (member: { user_id: number }) => Number(member.user_id) === auth.driver.truckyUserId
    );

    return json(200, {
      driver: auth.driver,
      period,
      month: Number(month),
      year: Number(year),
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
          }
    });
  } catch {
    return json(500, { error: "Failed to load your stats." });
  }
};
