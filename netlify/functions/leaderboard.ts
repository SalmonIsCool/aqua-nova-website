import type { Handler, HandlerEvent } from "@netlify/functions";
import { fetchMemberAvatarMap } from "./lib/members";
import { readTruckyConfig, truckyFetch } from "./lib/trucky";

interface TruckyMemberStat {
  user_id: number;
  name: string;
  driven_distance: number;
  jobs: number;
  cargo_mass: number;
  revenue: number;
}

interface TruckyMemberStatsResponse {
  month?: number;
  year?: number;
  members?: TruckyMemberStat[];
}

interface LeaderboardEntry {
  rank: number;
  userId: number;
  name: string;
  avatarUrl: string | null;
  drivenDistanceKm: number;
  jobs: number;
  cargoMass: number;
  revenue: number;
}

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
    return jsonResponse(500, {
      error: "Trucky API is not configured.",
      missing: ["TRUCKY_ACCESS_TOKEN", "TRUCKY_COMPANY_ID"],
      hint:
        "In Netlify go to Site configuration → Environment variables. Add the missing variables and enable the Functions scope, then redeploy."
    });
  }

  const params = event.queryStringParameters ?? {};
  const period = params.period ?? "monthly";
  const now = new Date();
  const month = params.month ?? String(now.getMonth() + 1);
  const year = params.year ?? String(now.getFullYear());
  const sortBy = params.sort ?? "distance";

  const query = new URLSearchParams({ period, month, year });
  if (params.game_id) query.set("game_id", params.game_id);

  try {
    const [response, avatarMap] = await Promise.all([
      truckyFetch(`/api/v2/company/${companyId}/stats/members`, query),
      fetchMemberAvatarMap(companyId)
    ]);

    if (!response.ok) {
      const detail = await response.text();
      return jsonResponse(response.status, {
        error: "Trucky API request failed.",
        status: response.status,
        detail: detail.slice(0, 300)
      });
    }

    const data = (await response.json()) as TruckyMemberStatsResponse;
    const members = Array.isArray(data.members) ? data.members : [];

    const sorted = [...members].sort((a, b) => {
      if (sortBy === "jobs") return b.jobs - a.jobs;
      if (sortBy === "revenue") return b.revenue - a.revenue;
      return b.driven_distance - a.driven_distance;
    });

    const leaderboard: LeaderboardEntry[] = sorted.map((member, index) => ({
      rank: index + 1,
      userId: member.user_id,
      name: member.name,
      avatarUrl: avatarMap.get(member.user_id) ?? null,
      drivenDistanceKm: Math.round(member.driven_distance),
      jobs: member.jobs,
      cargoMass: Math.round(member.cargo_mass),
      revenue: Math.round(member.revenue)
    }));

    return jsonResponse(200, {
      period,
      month: Number(month),
      year: Number(year),
      sortBy,
      updatedAt: new Date().toISOString(),
      drivers: leaderboard
    });
  } catch (error) {
    return jsonResponse(500, {
      error: "Failed to load leaderboard data.",
      detail: error instanceof Error ? error.message : "Unknown error"
    });
  }
};
