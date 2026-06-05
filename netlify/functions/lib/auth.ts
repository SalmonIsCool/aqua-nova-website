import { getUser } from "@netlify/identity";
import type { HandlerContext } from "@netlify/functions";
import { findDriverByEmail } from "./drivers";

type RequestHeaders = Record<string, string | undefined>;

function readBearerToken(headers?: RequestHeaders) {
  const raw = headers?.authorization ?? headers?.Authorization;
  if (!raw?.startsWith("Bearer ")) return null;
  const token = raw.slice(7).trim();
  return token || null;
}

function emailFromJwt(token: string) {
  try {
    const payload = token.split(".")[1];
    if (!payload) return undefined;
    const json = Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    const claims = JSON.parse(json) as { email?: string };
    return typeof claims.email === "string" ? claims.email : undefined;
  } catch {
    return undefined;
  }
}

async function resolveRequestEmail(context?: HandlerContext, headers?: RequestHeaders) {
  const legacyUser = context?.clientContext?.user;
  if (legacyUser?.email) return legacyUser.email;

  const bearer = readBearerToken(headers);
  if (bearer) {
    const email = emailFromJwt(bearer);
    if (email) return email;
  }

  try {
    const user = await getUser();
    return user?.email ?? undefined;
  } catch {
    return undefined;
  }
}

export async function authenticateHubRequest(
  context?: HandlerContext,
  headers?: RequestHeaders
) {
  const email = await resolveRequestEmail(context, headers);

  if (!email) {
    return {
      ok: false as const,
      statusCode: 401,
      error: "You must be logged in to access the Drivers Hub."
    };
  }

  const driver = findDriverByEmail(email);
  if (!driver) {
    return {
      ok: false as const,
      statusCode: 403,
      error:
        "Your account is not linked to a driver profile yet. Staff will link your hub account after your application is approved."
    };
  }

  return { ok: true as const, email, driver };
}
