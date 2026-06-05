export interface VtcRoleBadge {
  name: string;
  color: string;
}

export const vtcRoleColors = {
  owner: "#F59E0B",
  admin: "#8B5CF6",
  driver: "#64748B"
} as const;

export function normalizeVtcRole(role: Record<string, unknown> | null | undefined): VtcRoleBadge {
  if (!role) {
    return { name: "Driver", color: vtcRoleColors.driver };
  }

  if (role.owner === true) {
    return { name: "Owner", color: vtcRoleColors.owner };
  }

  if (role.management === true) {
    return { name: "Admin", color: vtcRoleColors.admin };
  }

  const roleName = typeof role.name === "string" ? role.name.trim().toLowerCase() : "";
  if (roleName.includes("owner")) {
    return { name: "Owner", color: vtcRoleColors.owner };
  }
  if (roleName.includes("admin") || roleName.includes("manager") || roleName.includes("staff")) {
    return { name: "Admin", color: vtcRoleColors.admin };
  }

  return { name: "Driver", color: vtcRoleColors.driver };
}
