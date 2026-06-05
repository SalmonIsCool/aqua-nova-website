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

  for (const key of ["total_driven_distance", "total_driven_distance_km", "total_distance_km"]) {
    const value = Number(record[key]);
    if (Number.isFinite(value) && value >= 0) return Math.round(value);
  }

  return null;
}

function mergeRecords(
  primary: Record<string, unknown> | null | undefined,
  secondary: Record<string, unknown> | null | undefined
) {
  if (!primary && !secondary) return null;
  return { ...(secondary ?? {}), ...(primary ?? {}) };
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

async function fetchDriverVtcJobCount(companyId: string, truckyUserId: number) {
  const queries = [
    new URLSearchParams({ page: "1", user_id: String(truckyUserId) }),
    new URLSearchParams({ page: "1", user_id: String(truckyUserId), status: "completed" })
  ];

  for (const query of queries) {
    const response = await truckyFetch(`/api/v1/company/${companyId}/jobs`, query);
    if (!response.ok) continue;

    const body = await response.json();
    const total = Number(body?.total);
    if (Number.isFinite(total) && total >= 0) return total;
  }

  return 0;
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

const VTC_STATS_START_YEAR = 2025;

async function fetchUserRecord(truckyUserId: number) {
  const userPaths = [`/api/v2/user/${truckyUserId}`, `/api/v1/user/${truckyUserId}`];

  for (const path of userPaths) {
    const response = await truckyFetch(path);
    if (!response.ok) continue;

    const body = await response.json();
    const record = unwrapRecord(body);
    if (record) return record;
  }

  return null;
}

export async function fetchDriverHubProfile(companyId: string, truckyUserId: number) {
  const [members, userRecord] = await Promise.all([
    fetchAllCompanyMembers(companyId),
    fetchUserRecord(truckyUserId)
  ]);

  const memberRecord = members.find((member) => memberMatches(member, truckyUserId)) ?? null;
  const displayRecord = mergeRecords(memberRecord, userRecord);

  return {
    avatarUrl: readAvatarUrl(displayRecord),
    truckyName: readName(displayRecord)
  };
}

function findMemberPeriodStats(
  members: Array<{
    user_id: number;
    driven_distance?: number;
    jobs?: number;
    cargo_mass?: number;
    revenue?: number;
  }>,
  truckyUserId: number
): DriverPeriodStats {
  const mine = members.find((member) => Number(member.user_id) === truckyUserId);
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

async function fetchDriverVtcLifetimeKmFromMonthlySum(companyId: string, truckyUserId: number) {
  const now = new Date();
  const tasks: Promise<DriverPeriodStats>[] = [];

  for (let year = VTC_STATS_START_YEAR; year <= now.getFullYear(); year += 1) {
    const endMonth = year === now.getFullYear() ? now.getMonth() + 1 : 12;
    for (let month = 1; month <= endMonth; month += 1) {
      tasks.push(fetchDriverMonthlyStats(companyId, truckyUserId, month, year));
    }
  }

  const results = await Promise.all(tasks);
  return results.reduce((sum, stats) => sum + stats.drivenDistanceKm, 0);
}

/** VTC all-time km for rank progress — matched against the driver rank ladder. */
export async function fetchDriverVtcLifetimeKm(companyId: string, truckyUserId: number) {
  const members = await fetchAllCompanyMembers(companyId);
  const member = members.find((record) => memberMatches(record, truckyUserId));
  const fromMember = readTotalKm(member);
  if (fromMember !== null && fromMember > 0) return fromMember;

  const yearly = await fetchDriverVtcYearlyTotals(companyId, truckyUserId);
  if (yearly.drivenDistanceKm > 0) return yearly.drivenDistanceKm;

  return fetchDriverVtcLifetimeKmFromMonthlySum(companyId, truckyUserId);
}

async function fetchDriverVtcYearlyTotals(companyId: string, truckyUserId: number) {
  const now = new Date();
  let drivenDistanceKm = 0;
  let jobs = 0;
  let cargoMass = 0;
  let revenue = 0;

  for (let year = now.getFullYear(); year >= VTC_STATS_START_YEAR; year -= 1) {
    const query = new URLSearchParams({
      period: "yearly",
      year: String(year)
    });
    const response = await truckyFetch(`/api/v2/company/${companyId}/stats/members`, query);
    if (!response.ok) continue;

    const data = await response.json();
    const members = Array.isArray(data.members) ? data.members : [];
    const mine = findMemberPeriodStats(members, truckyUserId);

    drivenDistanceKm += mine.drivenDistanceKm;
    jobs += mine.jobs;
    cargoMass += mine.cargoMass;
    revenue += mine.revenue;
  }

  return { drivenDistanceKm, jobs, cargoMass, revenue };
}

/** All-time stats logged for this driver within the VTC (not global Trucky totals). */
export async function fetchDriverVtcAllTimeStats(
  companyId: string,
  truckyUserId: number
): Promise<DriverPeriodStats> {
  const [jobCount, yearlyTotals, lifetimeKm] = await Promise.all([
    fetchDriverVtcJobCount(companyId, truckyUserId),
    fetchDriverVtcYearlyTotals(companyId, truckyUserId),
    fetchDriverVtcLifetimeKm(companyId, truckyUserId)
  ]);

  return {
    drivenDistanceKm: lifetimeKm,
    jobs: jobCount > 0 ? jobCount : yearlyTotals.jobs,
    cargoMass: yearlyTotals.cargoMass,
    revenue: yearlyTotals.revenue
  };
}

/** @deprecated Use fetchDriverHubProfile + fetchDriverVtcAllTimeStats */
export async function fetchDriverTruckyProfile(
  companyId: string,
  truckyUserId: number
): Promise<TruckyMemberProfile> {
  const [hubProfile, vtcStats] = await Promise.all([
    fetchDriverHubProfile(companyId, truckyUserId),
    fetchDriverVtcAllTimeStats(companyId, truckyUserId)
  ]);

  return {
    totalDistanceKm: vtcStats.drivenDistanceKm,
    totalJobs: vtcStats.jobs,
    totalRevenue: vtcStats.revenue,
    totalCargoMass: vtcStats.cargoMass,
    avatarUrl: hubProfile.avatarUrl,
    truckyName: hubProfile.truckyName
  };
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
  let totalDistanceKm = 0;

  if (aggregatedResponse.ok) {
    const aggregated = await aggregatedResponse.json();
    totalDistanceKm = Math.round(Number(aggregated?.distance_driven_on_job) || 0);
    totalJobs = Number(aggregated?.jobs_delivered) || 0;
    totalRevenue = Math.round(Number(aggregated?.total_earned_money) || 0);
  }

  if (allTimeResponse.ok) {
    const data = await allTimeResponse.json();
    const membersCount = Number(data?.members);
    const jobsCount = Number(data?.jobs);
    const revenue = Number(data?.revenues);

    if (Number.isFinite(membersCount) && membersCount > 0) driverCount = membersCount;
    if (totalJobs === 0 && Number.isFinite(jobsCount) && jobsCount >= 0) totalJobs = jobsCount;
    if (totalRevenue === 0 && Number.isFinite(revenue) && revenue >= 0) {
      totalRevenue = Math.round(revenue);
    }
  }

  const memberDistanceKm = members.reduce((sum, member) => sum + (readTotalKm(member) ?? 0), 0);
  if (totalDistanceKm === 0 && memberDistanceKm > 0) totalDistanceKm = memberDistanceKm;

  if (totalJobs === 0 || totalDistanceKm === 0 || totalRevenue === 0) {
    const yearlyTotals = await fetchCompanyYearlyTotals(companyId);
    if (totalJobs === 0 && yearlyTotals.totalJobs > 0) totalJobs = yearlyTotals.totalJobs;
    if (totalDistanceKm === 0 && yearlyTotals.totalDistanceKm > 0) {
      totalDistanceKm = yearlyTotals.totalDistanceKm;
    }
    if (totalRevenue === 0 && yearlyTotals.totalRevenue > 0) totalRevenue = yearlyTotals.totalRevenue;
  }

  return {
    driverCount,
    totalJobs,
    totalDistanceKm,
    totalRevenue
  };
}

async function fetchCompanyYearlyTotals(companyId: string) {
  const now = new Date();
  const years = [now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2];
  let totalJobs = 0;
  let totalDistanceKm = 0;
  let totalRevenue = 0;

  for (const year of years) {
    const query = new URLSearchParams({ period: "yearly", year: String(year) });
    const response = await truckyFetch(`/api/v2/company/${companyId}/stats/members`, query);
    if (!response.ok) continue;

    const data = await response.json();
    const members = Array.isArray(data.members) ? data.members : [];
    totalJobs += members.reduce((sum: number, member: { jobs?: number }) => sum + (member.jobs ?? 0), 0);
    totalDistanceKm += Math.round(
      members.reduce(
        (sum: number, member: { driven_distance?: number }) => sum + (member.driven_distance ?? 0),
        0
      )
    );
    totalRevenue += Math.round(
      members.reduce((sum: number, member: { revenue?: number }) => sum + (member.revenue ?? 0), 0)
    );
  }

  return { totalJobs, totalDistanceKm, totalRevenue };
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

/** Monthly stats logged for this driver within the VTC. */
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
  return findMemberPeriodStats(members, truckyUserId);
}
