import { fetchDriverTruckyProfile } from "./members";

export async function fetchDriverTotalDistanceKm(companyId: string, truckyUserId: number) {
  const profile = await fetchDriverTruckyProfile(companyId, truckyUserId);
  return profile.totalDistanceKm;
}
