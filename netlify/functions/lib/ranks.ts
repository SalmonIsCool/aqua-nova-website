export interface DriverRank {
  name: string;
  minKm: number;
  color: string;
}

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

export function getRankProgress(totalDistanceKm: number, ranks: DriverRank[] = driverRanks) {
  const totalKm = Math.max(0, Math.round(totalDistanceKm));
  const ladder = ranks.length ? ranks : driverRanks;

  let currentIndex = 0;
  for (let index = ladder.length - 1; index >= 0; index -= 1) {
    if (totalKm >= ladder[index].minKm) {
      currentIndex = index;
      break;
    }
  }

  const current = ladder[currentIndex];
  const next = ladder[currentIndex + 1] ?? null;

  if (!next) {
    return {
      currentName: current.name,
      currentColor: current.color,
      currentMinKm: current.minKm,
      nextName: null,
      nextColor: null,
      nextMinKm: null,
      totalDistanceKm: totalKm,
      progressPercent: 100,
      remainingKm: 0
    };
  }

  const span = next.minKm - current.minKm;
  const gained = totalKm - current.minKm;
  const progressPercent = span > 0 ? Math.min(Math.floor((gained / span) * 100), 100) : 0;

  return {
    currentName: current.name,
    currentColor: current.color,
    currentMinKm: current.minKm,
    nextName: next.name,
    nextColor: next.color,
    nextMinKm: next.minKm,
    totalDistanceKm: totalKm,
    progressPercent,
    remainingKm: Math.max(next.minKm - totalKm, 0)
  };
}
