export interface DriverRank {
  name: string;
  minKm: number;
  color: string;
  textColor: string;
}

/** Aqua Nova ranks from Trucky VTC Hub (min distance logged in km). */
export const driverRanks: DriverRank[] = [
  { name: "Trainee Driver", minKm: 0, color: "bg-lime-700", textColor: "text-lime-200" },
  { name: "Novice Driver", minKm: 5_000, color: "bg-teal-700", textColor: "text-teal-200" },
  { name: "Licensed Driver", minKm: 25_000, color: "bg-green-700", textColor: "text-green-200" },
  { name: "Experienced Driver", minKm: 50_000, color: "bg-emerald-600", textColor: "text-emerald-100" },
  { name: "Skilled Driver", minKm: 100_000, color: "bg-cyan-700", textColor: "text-cyan-100" },
  { name: "Master Driver", minKm: 150_000, color: "bg-sky-600", textColor: "text-sky-100" },
  { name: "Veteran Driver", minKm: 250_000, color: "bg-blue-600", textColor: "text-blue-100" },
  { name: "Expert Driver", minKm: 500_000, color: "bg-indigo-600", textColor: "text-indigo-100" },
  { name: "Legendary Driver", minKm: 750_000, color: "bg-purple-600", textColor: "text-purple-100" },
  { name: "Professional Driver", minKm: 1_000_000, color: "bg-pink-600", textColor: "text-pink-100" },
  { name: "Grandmaster Driver", minKm: 1_500_000, color: "bg-rose-600", textColor: "text-rose-100" }
];

export interface RankProgress {
  current: DriverRank;
  next: DriverRank | null;
  totalDistanceKm: number;
  progressPercent: number;
  remainingKm: number;
}

export function getRankProgress(totalDistanceKm: number): RankProgress {
  const totalKm = Math.max(0, Math.round(totalDistanceKm));

  let currentIndex = 0;
  for (let index = driverRanks.length - 1; index >= 0; index -= 1) {
    if (totalKm >= driverRanks[index].minKm) {
      currentIndex = index;
      break;
    }
  }

  const current = driverRanks[currentIndex];
  const next = driverRanks[currentIndex + 1] ?? null;

  if (!next) {
    return {
      current,
      next: null,
      totalDistanceKm: totalKm,
      progressPercent: 100,
      remainingKm: 0
    };
  }

  const span = next.minKm - current.minKm;
  const gained = totalKm - current.minKm;
  const progressPercent = span > 0 ? Math.min(Math.round((gained / span) * 100), 100) : 0;
  const remainingKm = Math.max(next.minKm - totalKm, 0);

  return {
    current,
    next,
    totalDistanceKm: totalKm,
    progressPercent,
    remainingKm
  };
}
