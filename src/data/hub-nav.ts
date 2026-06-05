export interface HubNavItem {
  label: string;
  href?: string;
  children?: { label: string; href: string }[];
}

export const hubNav: HubNavItem[] = [
  { label: "Dashboard", href: "/hub/" },
  { label: "News", href: "/hub/news" },
  {
    label: "Jobs",
    children: [
      { label: "View jobs", href: "/hub/jobs/all" },
      { label: "View your jobs", href: "/hub/jobs/mine" }
    ]
  },
  { label: "Map", href: "/hub/map" },
  {
    label: "Training",
    children: [
      { label: "Getting Started", href: "/hub/training/getting-started" },
      { label: "VTC Rules", href: "/hub/training/vtc-rules" },
      { label: "Driver Ranks", href: "/hub/training/driver-ranks" }
    ]
  },
  {
    label: "Events",
    children: [
      { label: "Latest Events", href: "/hub/events" },
      { label: "Attendance", href: "/hub/events/attendance" }
    ]
  },
  { label: "Gallery", href: "/hub/gallery" },
  { label: "Apply for staff", href: "/hub/staff" }
];

export function isHubNavActive(pathname: string, item: HubNavItem): boolean {
  if (item.href) {
    return item.href === "/hub/" ? pathname === "/hub/" || pathname === "/hub" : pathname.startsWith(item.href);
  }
  return item.children?.some((child) => pathname.startsWith(child.href)) ?? false;
}

export function isHubChildActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
