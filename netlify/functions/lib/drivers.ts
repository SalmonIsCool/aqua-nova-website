import { readFileSync } from "node:fs";
import { join } from "node:path";

export interface HubDriver {
  email: string;
  truckyUserId: number;
  name: string;
}

interface HubDriversFile {
  drivers?: HubDriver[];
}

let cachedDrivers: HubDriver[] | null = null;

export function loadHubDrivers(): HubDriver[] {
  if (cachedDrivers) return cachedDrivers;

  const candidates = [
    join(process.cwd(), "public/data/hub-drivers.json"),
    join(process.cwd(), "data/hub-drivers.json"),
    join(__dirname, "../../public/data/hub-drivers.json")
  ];

  for (const filePath of candidates) {
    try {
      const raw = readFileSync(filePath, "utf8");
      const parsed = JSON.parse(raw) as HubDriversFile;
      cachedDrivers = (parsed.drivers ?? []).map((driver) => ({
        email: driver.email.trim().toLowerCase(),
        truckyUserId: Number(driver.truckyUserId),
        name: driver.name
      }));
      return cachedDrivers;
    } catch {
      // try next path
    }
  }

  cachedDrivers = [];
  return cachedDrivers;
}

export function findDriverByEmail(email: string): HubDriver | undefined {
  const normalized = email.trim().toLowerCase();
  return loadHubDrivers().find((driver) => driver.email === normalized);
}
