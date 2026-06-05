export interface DriverRank {
  name: string;
  minKm: number;
}

export const driverRanks: DriverRank[] = [
  { name: "Trainee Driver", minKm: 0 },
  { name: "Novice Driver", minKm: 5_000 },
  { name: "Licensed Driver", minKm: 25_000 },
  { name: "Experienced Driver", minKm: 50_000 },
  { name: "Skilled Driver", minKm: 100_000 },
  { name: "Master Driver", minKm: 150_000 },
  { name: "Veteran Driver", minKm: 250_000 },
  { name: "Expert Driver", minKm: 500_000 },
  { name: "Legendary Driver", minKm: 750_000 },
  { name: "Professional Driver", minKm: 1_000_000 },
  { name: "Grandmaster Driver", minKm: 1_500_000 }
];

export function getRankProgress(totalDistanceKm: number) {
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
      currentName: current.name,
      nextName: null,
      totalDistanceKm: totalKm,
      progressPercent: 100,
      remainingKm: 0
    };
  }

  const span = next.minKm - current.minKm;
  const gained = totalKm - current.minKm;
  const progressPercent = span > 0 ? Math.min(Math.round((gained / span) * 100), 100) : 0;

  return {
    currentName: current.name,
    nextName: next.name,
    totalDistanceKm: totalKm,
    progressPercent,
    remainingKm: Math.max(next.minKm - totalKm, 0),
    nextRankAtKm: next.minKm
  };
}
