import { truckyFetch } from "./trucky";
import { normalizeVtcRole } from "./vtc-roles";

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
  const query = new URLSearchParams({
    page: "1",
    user_id: String(truckyUserId),
    status: "completed"
  });

  const response = await truckyFetch(`/api/v1/company/${companyId}/jobs`, query);
  if (!response.ok) return 0;

  const body = await response.json();
  const total = Number(body?.total);
  return Number.isFinite(total) && total >= 0 ? total : 0;
}

export function memberMatches(record: Record<string, unknown>, truckyUserId: number) {
  return Number(record.id) === truckyUserId || Number(record.user_id) === truckyUserId;
}

/** Trucky user id — must match stats/members `user_id` for lookups. */
export function resolveTruckyUserId(record: Record<string, unknown>) {
  const userId = Number(record.user_id);
  if (Number.isFinite(userId) && userId > 0) return userId;

  const id = Number(record.id);
  if (Number.isFinite(id) && id > 0) return id;

  return null;
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

export interface MemberLeaderboardMeta {
  avatarUrl: string | null;
  vtcRoleName: string;
  vtcRoleColor: string;
  lifetimeDistanceKm: number;
}

async function fetchCompanyYearlyDistanceByUser(companyId: string) {
  const now = new Date();
  const map = new Map<number, number>();

  for (let year = now.getFullYear(); year >= VTC_STATS_START_YEAR; year -= 1) {
    const query = new URLSearchParams({
      period: "yearly",
      year: String(year)
    });
    const response = await truckyFetch(`/api/v2/company/${companyId}/stats/members`, query);
    if (!response.ok) continue;

    const data = await response.json();
    const members = Array.isArray(data.members) ? data.members : [];

    for (const member of members) {
      const userId = Number(member.user_id);
      if (!Number.isFinite(userId)) continue;
      const distance = Math.round(member.driven_distance ?? 0);
      map.set(userId, (map.get(userId) ?? 0) + distance);
    }
  }

  return map;
}

/** VTC all-time km per driver — same sources as the Drivers Hub rank progress. */
export async function fetchVtcLifetimeKmMap(
  companyId: string,
  memberList?: Record<string, unknown>[]
) {
  const members = memberList ?? (await getCachedCompanyMembers(companyId));
  const yearlyByUser = await fetchCompanyYearlyDistanceByUser(companyId);
  const map = new Map<number, number>();
  const needsMonthly: number[] = [];
  const userIds = new Set<number>();

  for (const member of members) {
    const userId = resolveTruckyUserId(member);
    if (userId !== null) userIds.add(userId);
  }

  for (const userId of yearlyByUser.keys()) {
    userIds.add(userId);
  }

  for (const userId of userIds) {
    const yearlyKm = yearlyByUser.get(userId) ?? 0;
    if (yearlyKm > 0) {
      map.set(userId, yearlyKm);
      continue;
    }

    const member = members.find((record) => memberMatches(record, userId));
    const fromMember = readTotalKm(member);
    if (fromMember !== null && fromMember > 0) {
      map.set(userId, fromMember);
      continue;
    }

    needsMonthly.push(userId);
  }

  for (const userId of needsMonthly) {
    map.set(userId, await fetchDriverVtcLifetimeKmFromMonthlySum(companyId, userId));
  }

  return map;
}

export async function fetchMemberLeaderboardMetaMap(companyId: string) {
  const members = await getCachedCompanyMembers(companyId);
  const lifetimeKmMap = await fetchVtcLifetimeKmMap(companyId, members);
  const map = new Map<number, MemberLeaderboardMeta>();

  for (const member of members) {
    const userId = resolveTruckyUserId(member);
    if (userId === null) continue;

    const roleRecord =
      member.role && typeof member.role === "object"
        ? (member.role as Record<string, unknown>)
        : null;
    const vtcRole = normalizeVtcRole(roleRecord);

    map.set(userId, {
      avatarUrl: readAvatarUrl(member),
      vtcRoleName: vtcRole.name,
      vtcRoleColor: vtcRole.color,
      lifetimeDistanceKm: lifetimeKmMap.get(userId) ?? 0
    });
  }

  for (const [userId, lifetimeDistanceKm] of lifetimeKmMap) {
    if (map.has(userId)) continue;

    map.set(userId, {
      avatarUrl: null,
      vtcRoleName: "Driver",
      vtcRoleColor: "#64748B",
      lifetimeDistanceKm
    });
  }

  return map;
}

/** @deprecated Use fetchMemberLeaderboardMetaMap */
export async function fetchMemberAvatarMap(companyId: string) {
  const metaMap = await fetchMemberLeaderboardMetaMap(companyId);
  const map = new Map<number, string>();

  for (const [userId, meta] of metaMap) {
    if (meta.avatarUrl) map.set(userId, meta.avatarUrl);
  }

  return map;
}

const VTC_STATS_START_YEAR = 2025;
const MEMBERS_CACHE_MS = 60_000;

let membersCache: {
  companyId: string;
  members: Record<string, unknown>[];
  fetchedAt: number;
} | null = null;

async function getCachedCompanyMembers(companyId: string) {
  if (
    membersCache?.companyId === companyId &&
    Date.now() - membersCache.fetchedAt < MEMBERS_CACHE_MS
  ) {
    return membersCache.members;
  }

  const members = await fetchAllCompanyMembers(companyId);
  membersCache = { companyId, members, fetchedAt: Date.now() };
  return members;
}

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
    getCachedCompanyMembers(companyId),
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
  let total = 0;

  for (let year = VTC_STATS_START_YEAR; year <= now.getFullYear(); year += 1) {
    const endMonth = year === now.getFullYear() ? now.getMonth() + 1 : 12;
    for (let month = 1; month <= endMonth; month += 1) {
      const stats = await fetchDriverMonthlyStats(companyId, truckyUserId, month, year);
      total += stats.drivenDistanceKm;
    }
  }

  return total;
}

async function resolveDriverVtcLifetimeKm(
  companyId: string,
  truckyUserId: number,
  members: Record<string, unknown>[],
  yearlyTotals?: DriverPeriodStats
) {
  const yearly = yearlyTotals ?? (await fetchDriverVtcYearlyTotals(companyId, truckyUserId));
  if (yearly.drivenDistanceKm > 0) return yearly.drivenDistanceKm;

  const member = members.find((record) => memberMatches(record, truckyUserId));
  const fromMember = readTotalKm(member);
  if (fromMember !== null && fromMember > 0) return fromMember;

  return fetchDriverVtcLifetimeKmFromMonthlySum(companyId, truckyUserId);
}

/** VTC all-time km for rank progress — matched against the driver rank ladder. */
export async function fetchDriverVtcLifetimeKm(companyId: string, truckyUserId: number) {
  const members = await getCachedCompanyMembers(companyId);
  return resolveDriverVtcLifetimeKm(companyId, truckyUserId, members);
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
  const members = await getCachedCompanyMembers(companyId);
  const yearlyTotals = await fetchDriverVtcYearlyTotals(companyId, truckyUserId);
  const drivenDistanceKm = await resolveDriverVtcLifetimeKm(
    companyId,
    truckyUserId,
    members,
    yearlyTotals
  );
  const jobCount = await fetchDriverVtcJobCount(companyId, truckyUserId);

  return {
    drivenDistanceKm,
    jobs: yearlyTotals.jobs > 0 ? yearlyTotals.jobs : jobCount,
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
    getCachedCompanyMembers(companyId),
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
