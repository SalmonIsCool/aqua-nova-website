import { liveFetch, startLiveRefresh } from "./live-fetch";

export interface LeaderboardPageOptions {
  statusId: string;
  bodyId: string;
  periodId: string;
  monthId: string;
  yearId: string;
  sortId: string;
  refreshId?: string;
  autoRefresh?: boolean;
}

interface LeaderboardDriver {
  rank: number;
  name: string;
  avatarUrl?: string | null;
  vtcRole?: { name: string; color: string };
  driverRank?: { name: string; color: string };
  drivenDistanceKm: number;
  jobs: number;
  revenue: number;
}

const formatter = new Intl.NumberFormat("en-GB");

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDistance(km: number) {
  return `${formatter.format(km)} km`;
}

function formatRevenue(value: number) {
  return `€${formatter.format(value)}`;
}

function renderBadge(label: string, color: string, modifier: "role" | "rank") {
  return `<span class="leaderboard-badge leaderboard-badge--${modifier}" style="color:${color};border-color:${color}55;background:${color}20">${escapeHtml(label)}</span>`;
}

function renderDriverCell(driver: LeaderboardDriver) {
  const avatar = driver.avatarUrl
    ? `<img src="${escapeHtml(driver.avatarUrl)}" alt="" width="32" height="32" class="h-8 w-8 shrink-0 rounded-full object-cover bg-slate-800" loading="lazy" referrerpolicy="no-referrer" />`
    : `<span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cyan-500/20 text-xs font-bold text-cyan-200">${escapeHtml(driver.name.charAt(0).toUpperCase())}</span>`;

  const vtcRole = driver.vtcRole ?? { name: "Driver", color: "#64748B" };
  const driverRank = driver.driverRank ?? { name: "Trainee Driver", color: "#C0CA33" };

  return `
    <span class="inline-flex min-w-0 items-center gap-3">
      ${avatar}
      <span class="min-w-0">
        <span class="block font-medium text-white">${escapeHtml(driver.name)}</span>
        <span class="mt-1 flex flex-wrap gap-1.5">
          ${renderBadge(vtcRole.name, vtcRole.color, "role")}
          ${renderBadge(driverRank.name, driverRank.color, "rank")}
        </span>
      </span>
    </span>`;
}

function renderLeaderboardRow(driver: LeaderboardDriver, rankClass: string) {
  return `
    <tr class="hover:bg-white/5">
      <td class="px-4 py-3 font-semibold text-cyan-300 ${rankClass}">#${driver.rank}</td>
      <td class="px-4 py-3 ${rankClass}">${renderDriverCell(driver)}</td>
      <td class="px-4 py-3 text-slate-200 ${rankClass}">${formatDistance(driver.drivenDistanceKm)}</td>
      <td class="px-4 py-3 text-slate-200 ${rankClass}">${formatter.format(driver.jobs)}</td>
      <td class="px-4 py-3 text-slate-200 ${rankClass}">${formatRevenue(driver.revenue)}</td>
    </tr>`;
}

export function initLeaderboardPage(options: LeaderboardPageOptions) {
  const statusEl = document.getElementById(options.statusId);
  const bodyEl = document.getElementById(options.bodyId);
  const periodEl = document.getElementById(options.periodId) as HTMLSelectElement | null;
  const monthEl = document.getElementById(options.monthId) as HTMLSelectElement | null;
  const yearEl = document.getElementById(options.yearId) as HTMLSelectElement | null;
  const sortEl = document.getElementById(options.sortId) as HTMLSelectElement | null;
  const refreshEl = options.refreshId ? document.getElementById(options.refreshId) : null;
  const rankClass = bodyEl?.closest(".hub-table-wrap") ? "" : "";

  async function loadLeaderboard() {
    if (!statusEl || !bodyEl || !periodEl || !monthEl || !yearEl || !sortEl) return;

    statusEl.textContent = "Loading leaderboard…";
    bodyEl.innerHTML = "";

    const query = new URLSearchParams({
      period: periodEl.value,
      month: monthEl.value,
      year: yearEl.value,
      sort: sortEl.value
    });

    try {
      const response = await liveFetch(`/api/leaderboard?${query.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        const missing = Array.isArray(data.missing) ? ` Missing: ${data.missing.join(", ")}.` : "";
        const hint = data.hint ? ` ${data.hint}` : "";
        statusEl.textContent = `${data.error ?? "Failed to load leaderboard."}${missing}${hint}`;
        return;
      }

      const drivers = Array.isArray(data.drivers) ? (data.drivers as LeaderboardDriver[]) : [];

      if (!drivers.length) {
        statusEl.textContent = "No driver stats for this period yet.";
        return;
      }

      const updatedAt = data.updatedAt ? new Date(data.updatedAt).toLocaleTimeString() : "just now";
      statusEl.textContent = `Showing ${drivers.length} drivers — ${data.period} ${data.month}/${data.year} · Updated ${updatedAt}`;

      bodyEl.innerHTML = drivers.map((driver) => renderLeaderboardRow(driver, rankClass)).join("");
    } catch {
      statusEl.textContent = "Could not reach the leaderboard API. Try again shortly.";
    }
  }

  refreshEl?.addEventListener("click", loadLeaderboard);
  periodEl?.addEventListener("change", loadLeaderboard);
  monthEl?.addEventListener("change", loadLeaderboard);
  yearEl?.addEventListener("change", loadLeaderboard);
  sortEl?.addEventListener("change", loadLeaderboard);

  loadLeaderboard();

  if (options.autoRefresh !== false) {
    startLiveRefresh(loadLeaderboard);
  }
}
