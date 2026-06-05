import { getUser } from "@netlify/identity";
import type { HandlerContext } from "@netlify/functions";
import { findDriverByEmail } from "./drivers";

export async function authenticateHubRequest(context?: HandlerContext) {
  let email: string | undefined;

  const legacyUser = context?.clientContext?.user;
  if (legacyUser?.email) {
    email = legacyUser.email;
  } else {
    try {
      const user = await getUser();
      email = user?.email ?? undefined;
    } catch {
      email = undefined;
    }
  }

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
