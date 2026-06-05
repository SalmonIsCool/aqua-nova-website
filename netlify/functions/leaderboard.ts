import type { Handler, HandlerEvent } from "@netlify/functions";

const TRUCKY_BASE = "https://e.truckyapp.com";
const USER_AGENT = "Aqua Nova Transport Website";

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
  name: string;
  drivenDistanceKm: number;
  jobs: number;
  cargoMass: number;
  revenue: number;
}

function jsonResponse(statusCode: number, body: unknown, cacheSeconds = 300) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": `public, max-age=${cacheSeconds}`,
      "Access-Control-Allow-Origin": "*"
    },
    body: JSON.stringify(body)
  };
}

function readEnv(...keys: string[]) {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return undefined;
}

export const handler: Handler = async (event: HandlerEvent) => {
  const token = readEnv(
    "TRUCKY_ACCESS_TOKEN",
    "TRUCKY_TOKEN",
    "TRUCKY_API_TOKEN",
    "TRUCKY_COMPANY_ACCESS_TOKEN"
  );
  const companyId = readEnv("TRUCKY_COMPANY_ID", "TRUCKY_COMPANY");

  const missing: string[] = [];
  if (!token) missing.push("TRUCKY_ACCESS_TOKEN");
  if (!companyId) missing.push("TRUCKY_COMPANY_ID");

  if (missing.length > 0) {
    return jsonResponse(500, {
      error: "Trucky API is not configured.",
      missing,
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

  const query = new URLSearchParams({
    period,
    month,
    year
  });

  if (params.game_id) {
    query.set("game_id", params.game_id);
  }

  try {
    const response = await fetch(
      `${TRUCKY_BASE}/api/v2/company/${companyId}/stats/members?${query.toString()}`,
      {
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "User-Agent": USER_AGENT,
          "x-access-token": token
        }
      }
    );

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
      name: member.name,
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
