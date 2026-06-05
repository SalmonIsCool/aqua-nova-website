export interface DriverRank {
  name: string;
  minKm: number;
  color: string;
}

/** Aqua Nova ranks from Trucky VTC Hub — colours match the Ranks admin table. */
export const driverRanks: DriverRank[] = [
  { name: "Trainee Driver", minKm: 0, color: "#C0CA33" },
  { name: "Novice Driver", minKm: 5_000, color: "#26A69A" },
  { name: "Licensed Driver", minKm: 25_000, color: "#4CAF50" },
  { name: "Experienced Driver", minKm: 50_000, color: "#76FF03" },
  { name: "Skilled Driver", minKm: 100_000, color: "#00BCD4" },
  { name: "Master Driver", minKm: 150_000, color: "#2196F3" },
  { name: "Veteran Driver", minKm: 250_000, color: "#3F51B5" },
  { name: "Expert Driver", minKm: 500_000, color: "#9C27B0" },
  { name: "Legendary Driver", minKm: 750_000, color: "#E91E63" },
  { name: "Professional Driver", minKm: 1_000_000, color: "#B71C1C" },
  { name: "Grandmaster Driver", minKm: 1_500_000, color: "#F44336" }
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
  const progressPercent = span > 0 ? Math.min(Math.floor((gained / span) * 100), 100) : 0;
  const remainingKm = Math.max(next.minKm - totalKm, 0);

  return {
    current,
    next,
    totalDistanceKm: totalKm,
    progressPercent,
    remainingKm
  };
}
