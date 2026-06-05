import { truckyFetch } from "./trucky";

export interface TruckyMemberProfile {
  totalDistanceKm: number;
  totalJobs: number;
  totalRevenue: number;
  totalCargoMass: number;
  avatarUrl: string | null;
  truckyName: string | null;
}

export interface CompanyAllTimeTotals {
  driverCount: number;
  totalJobs: number;
  totalDistanceKm: number;
  totalRevenue: number;
}

function unwrapRecord(body: unknown) {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  if (record.total_driven_distance !== undefined || record.avatar_url !== undefined) return record;
  if (record.data && typeof record.data === "object") return record.data as Record<string, unknown>;
  if (record.user && typeof record.user === "object") return record.user as Record<string, unknown>;
  return record;
}

function readTotalKm(record: Record<string, unknown> | null | undefined) {
  if (!record) return null;
  const value = Number(record.total_driven_distance);
  if (Number.isFinite(value) && value >= 0) return Math.round(value);
  return null;
}

function readAvatarUrl(record: Record<string, unknown> | null | undefined) {
  if (!record) return null;
  const url = record.avatar_url;
  return typeof url === "string" && url.trim() ? url.trim() : null;
}

function readName(record: Record<string, unknown> | null | undefined) {
  if (!record) return null;
  const name = record.name;
  return typeof name === "string" && name.trim() ? name.trim() : null;
}

function readRoundedNumber(record: Record<string, unknown> | null | undefined, key: string) {
  if (!record) return 0;
  const value = Number(record[key]);
  return Number.isFinite(value) && value >= 0 ? Math.round(value) : 0;
}

async function fetchDriverJobCount(companyId: string, truckyUserId: number) {
  const response = await truckyFetch(
    `/api/v1/company/${companyId}/jobs`,
    new URLSearchParams({ page: "1", user_id: String(truckyUserId) })
  );
  if (!response.ok) return 0;

  const body = await response.json();
  const total = Number(body?.total);
  if (Number.isFinite(total) && total >= 0) return total;

  return Array.isArray(body?.data) ? body.data.length : 0;
}

export function memberMatches(record: Record<string, unknown>, truckyUserId: number) {
  return Number(record.id) === truckyUserId || Number(record.user_id) === truckyUserId;
}

export async function fetchAllCompanyMembers(companyId: string) {
  const members: Record<string, unknown>[] = [];
  let page = 1;
  let lastPage = 1;

  do {
    const response = await truckyFetch(
      `/api/v1/company/${companyId}/members`,
      new URLSearchParams({ page: String(page) })
    );
    if (!response.ok) break;

    const body = await response.json();
    const pageMembers = Array.isArray(body?.data) ? body.data : [];
    members.push(...pageMembers);
    lastPage = Math.max(Number(body?.last_page) || 1, 1);
    page += 1;
  } while (page <= lastPage);

  return members;
}

export async function fetchCompanyMemberCount(companyId: string) {
  const response = await truckyFetch(
    `/api/v1/company/${companyId}/members`,
    new URLSearchParams({ page: "1" })
  );
  if (!response.ok) {
    const members = await fetchAllCompanyMembers(companyId);
    return members.length;
  }

  const body = await response.json();
  const total = Number(body?.total);
  if (Number.isFinite(total) && total > 0) return total;

  const firstPage = Array.isArray(body?.data) ? body.data.length : 0;
  if (Number(body?.last_page) > 1) {
    const members = await fetchAllCompanyMembers(companyId);
    return members.length;
  }

  return firstPage;
}

export async function fetchMemberAvatarMap(companyId: string) {
  const members = await fetchAllCompanyMembers(companyId);
  const map = new Map<number, string>();

  for (const member of members) {
    const userId = Number(member.id ?? member.user_id);
    const avatarUrl = readAvatarUrl(member);
    if (Number.isFinite(userId) && avatarUrl) {
      map.set(userId, avatarUrl);
    }
  }

  return map;
}

function buildProfileFromRecord(
  record: Record<string, unknown> | null | undefined,
  totalJobs: number
): TruckyMemberProfile | null {
  const totalDistanceKm = readTotalKm(record);
  if (totalDistanceKm === null && !record) return null;

  return {
    totalDistanceKm: totalDistanceKm ?? 0,
    totalJobs,
    totalRevenue: readRoundedNumber(record, "total_revenue"),
    totalCargoMass: readRoundedNumber(record, "total_cargo_mass"),
    avatarUrl: readAvatarUrl(record),
    truckyName: readName(record)
  };
}

export async function fetchDriverTruckyProfile(
  companyId: string,
  truckyUserId: number
): Promise<TruckyMemberProfile> {
  const totalJobs = await fetchDriverJobCount(companyId, truckyUserId);
  const userPaths = [`/api/v2/user/${truckyUserId}`, `/api/v1/user/${truckyUserId}`];

  for (const path of userPaths) {
    const response = await truckyFetch(path);
    if (!response.ok) continue;

    const body = await response.json();
    const profile = buildProfileFromRecord(unwrapRecord(body), totalJobs);
    if (profile) return profile;
  }

  const members = await fetchAllCompanyMembers(companyId);
  const match = members.find((member) => memberMatches(member, truckyUserId));

  return (
    buildProfileFromRecord(match, totalJobs) ?? {
      totalDistanceKm: 0,
      totalJobs,
      totalRevenue: 0,
      totalCargoMass: 0,
      avatarUrl: null,
      truckyName: null
    }
  );
}

export async function fetchCompanyAllTimeStats(companyId: string): Promise<CompanyAllTimeTotals> {
  const [allTimeResponse, members, aggregatedResponse] = await Promise.all([
    truckyFetch(`/api/v1/company/${companyId}/stats`),
    fetchAllCompanyMembers(companyId),
    truckyFetch(`/api/v1/company/${companyId}/stats/aggregated`)
  ]);

  let driverCount = members.length;
  let totalJobs = 0;
  let totalRevenue = 0;

  if (allTimeResponse.ok) {
    const data = await allTimeResponse.json();
    const membersCount = Number(data?.members);
    const jobsCount = Number(data?.jobs);
    const revenue = Number(data?.revenues);

    if (Number.isFinite(membersCount) && membersCount > 0) driverCount = membersCount;
    if (Number.isFinite(jobsCount) && jobsCount >= 0) totalJobs = jobsCount;
    if (Number.isFinite(revenue) && revenue >= 0) totalRevenue = Math.round(revenue);
  }

  let totalDistanceKm = members.reduce((sum, member) => sum + (readTotalKm(member) ?? 0), 0);

  if (aggregatedResponse.ok) {
    const aggregated = await aggregatedResponse.json();
    const aggregatedDistance = Number(aggregated?.distance_driven_on_job);
    const aggregatedJobs = Number(aggregated?.jobs_delivered);
    const aggregatedRevenue = Number(aggregated?.total_earned_money);

    if (totalDistanceKm === 0 && Number.isFinite(aggregatedDistance) && aggregatedDistance > 0) {
      totalDistanceKm = Math.round(aggregatedDistance);
    }
    if (totalJobs === 0 && Number.isFinite(aggregatedJobs) && aggregatedJobs > 0) {
      totalJobs = aggregatedJobs;
    }
    if (totalRevenue === 0 && Number.isFinite(aggregatedRevenue) && aggregatedRevenue > 0) {
      totalRevenue = Math.round(aggregatedRevenue);
    }
  }

  return {
    driverCount,
    totalJobs,
    totalDistanceKm,
    totalRevenue
  };
}

export interface DriverPeriodStats {
  drivenDistanceKm: number;
  jobs: number;
  cargoMass: number;
  revenue: number;
}

function currentMonthYear() {
  const now = new Date();
  return { month: now.getMonth() + 1, year: now.getFullYear() };
}

export async function fetchCompanyMonthlyStats(
  companyId: string,
  month?: number,
  year?: number
): Promise<CompanyAllTimeTotals> {
  const current = currentMonthYear();
  const query = new URLSearchParams({
    period: "monthly",
    month: String(month ?? current.month),
    year: String(year ?? current.year)
  });

  const [driverCount, statsResponse] = await Promise.all([
    fetchCompanyMemberCount(companyId),
    truckyFetch(`/api/v2/company/${companyId}/stats/members`, query)
  ]);

  if (!statsResponse.ok) {
    return { driverCount, totalJobs: 0, totalDistanceKm: 0, totalRevenue: 0 };
  }

  const data = await statsResponse.json();
  const members = Array.isArray(data.members) ? data.members : [];

  return {
    driverCount,
    totalJobs: members.reduce((sum: number, member: { jobs?: number }) => sum + (member.jobs ?? 0), 0),
    totalDistanceKm: Math.round(
      members.reduce(
        (sum: number, member: { driven_distance?: number }) => sum + (member.driven_distance ?? 0),
        0
      )
    ),
    totalRevenue: Math.round(
      members.reduce((sum: number, member: { revenue?: number }) => sum + (member.revenue ?? 0), 0)
    )
  };
}

export async function fetchDriverMonthlyStats(
  companyId: string,
  truckyUserId: number,
  month?: number,
  year?: number
): Promise<DriverPeriodStats> {
  const current = currentMonthYear();
  const query = new URLSearchParams({
    period: "monthly",
    month: String(month ?? current.month),
    year: String(year ?? current.year)
  });

  const response = await truckyFetch(`/api/v2/company/${companyId}/stats/members`, query);
  if (!response.ok) {
    return { drivenDistanceKm: 0, jobs: 0, cargoMass: 0, revenue: 0 };
  }

  const data = await response.json();
  const members = Array.isArray(data.members) ? data.members : [];
  const mine = members.find(
    (member: { user_id: number }) => Number(member.user_id) === truckyUserId
  );

  if (!mine) {
    return { drivenDistanceKm: 0, jobs: 0, cargoMass: 0, revenue: 0 };
  }

  return {
    drivenDistanceKm: Math.round(mine.driven_distance ?? 0),
    jobs: mine.jobs ?? 0,
    cargoMass: Math.round(mine.cargo_mass ?? 0),
    revenue: Math.round(mine.revenue ?? 0)
  };
}
