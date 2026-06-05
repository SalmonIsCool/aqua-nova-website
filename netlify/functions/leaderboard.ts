import type { Handler, HandlerEvent } from "@netlify/functions";
import { fetchMemberLeaderboardMetaMap } from "./lib/members";
import { getRankProgress } from "./lib/ranks";
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
  vtcRole: { name: string; color: string };
  driverRank: { name: string; color: string };
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
    const [response, memberMeta] = await Promise.all([
      truckyFetch(`/api/v2/company/${companyId}/stats/members`, query),
      fetchMemberLeaderboardMetaMap(companyId)
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

    const leaderboard: LeaderboardEntry[] = sorted.map((member, index) => {
      const userId = Number(member.user_id);
      const meta = memberMeta.get(userId);
      const vtcLifetimeKm = meta?.lifetimeDistanceKm ?? 0;
      const rankProgress = getRankProgress(vtcLifetimeKm);

      return {
        rank: index + 1,
        userId: member.user_id,
        name: member.name,
        avatarUrl: meta?.avatarUrl ?? null,
        vtcRole: {
          name: meta?.vtcRoleName ?? "Driver",
          color: meta?.vtcRoleColor ?? "#64748B"
        },
        driverRank: {
          name: rankProgress.currentName,
          color: rankProgress.currentColor
        },
        drivenDistanceKm: Math.round(member.driven_distance),
        jobs: member.jobs,
        cargoMass: Math.round(member.cargo_mass),
        revenue: Math.round(member.revenue)
      };
    });

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
