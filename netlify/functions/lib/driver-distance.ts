import type { DriverRank } from "./ranks";
import { driverRanks } from "./ranks";
import { truckyFetch } from "./trucky";

const defaultRankColors = Object.fromEntries(driverRanks.map((rank) => [rank.name, rank.color]));

function mapApiRank(record: Record<string, unknown>): DriverRank | null {
  const name = String(record.name ?? record.title ?? "").trim();
  const minKm = Math.round(
    Number(record.min_distance_logged_km ?? record.min_distance_km ?? record.min_distance ?? record.distance ?? 0)
  );
  if (!name) return null;
  return {
    name,
    minKm: Number.isFinite(minKm) ? minKm : 0,
    color: String(record.color ?? defaultRankColors[name] ?? "#67e8f9")
  };
}

export async function fetchCompanyRanks(companyId: string): Promise<DriverRank[] | null> {
  const paths = [`/api/v1/company/${companyId}/ranks`, `/api/v2/company/${companyId}/ranks`];

  for (const path of paths) {
    const response = await truckyFetch(path);
    if (!response.ok) continue;

    const body = await response.json();
    const list = Array.isArray(body) ? body : Array.isArray(body?.data) ? body.data : [];
    const mapped = list
      .map((item: Record<string, unknown>) => mapApiRank(item))
      .filter((item: DriverRank | null): item is DriverRank => item !== null)
      .sort((a: DriverRank, b: DriverRank) => a.minKm - b.minKm);

    if (mapped.length) return mapped;
  }

  return null;
}

function readTotalKm(record: Record<string, unknown> | null | undefined) {
  if (!record) return 0;
  const raw = record.total_driven_distance;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? Math.round(value) : 0;
}

function memberMatches(record: Record<string, unknown>, truckyUserId: number) {
  return (
    Number(record.id) === truckyUserId ||
    Number(record.user_id) === truckyUserId
  );
}

export async function fetchDriverTotalDistanceKm(companyId: string, truckyUserId: number) {
  const membersResponse = await truckyFetch(`/api/v1/company/${companyId}/members`);
  if (membersResponse.ok) {
    const body = await membersResponse.json();
    const members = Array.isArray(body?.data) ? body.data : [];
    const match = members.find((member: Record<string, unknown>) =>
      memberMatches(member, truckyUserId)
    );
    if (match) return readTotalKm(match);
  }

  const userResponse = await truckyFetch(`/api/v2/user/${truckyUserId}`);
  if (userResponse.ok) {
    const body = await userResponse.json();
    return readTotalKm(body);
  }

  return 0;
}
