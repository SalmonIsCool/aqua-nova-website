export function getIdentityUser() {
  return window.netlifyIdentity?.currentUser() ?? null;
}

export function getAuthHeaders() {
  const user = getIdentityUser();
  if (!user) return {};
  return { Authorization: `Bearer ${user.token.access_token}` };
}

function attachIdentityListeners(callback: (user: NetlifyIdentityUser | null) => void) {
  const identity = window.netlifyIdentity;
  if (!identity) return false;

  const run = () => callback(identity.currentUser() ?? null);

  identity.on("init", run);
  identity.on("login", run);
  identity.on("logout", () => callback(null));

  if (identity.currentUser()) {
    run();
  } else {
    run();
  }

  return true;
}

export function onIdentityReady(callback: (user: NetlifyIdentityUser | null) => void) {
  if (attachIdentityListeners(callback)) return;

  const started = Date.now();
  const timer = window.setInterval(() => {
    if (attachIdentityListeners(callback)) {
      window.clearInterval(timer);
      return;
    }

    if (Date.now() - started > 10_000) {
      window.clearInterval(timer);
      callback(null);
    }
  }, 100);
}

export function setupHubRouteGuard(requireAuth: boolean) {
  const isLoginPage = () => {
    const path = window.location.pathname;
    return path === "/hub/login" || path === "/hub/login/";
  };

  onIdentityReady((user) => {
    if (requireAuth && !user && !isLoginPage()) {
      window.location.replace("/hub/login");
      return;
    }

    if (user && isLoginPage()) {
      window.location.replace("/hub/");
    }
  });
}

interface NetlifyIdentityUser {
  email: string;
  token: { access_token: string };
  user_metadata?: { full_name?: string };
}

declare global {
  interface Window {
    netlifyIdentity?: {
      currentUser: () => NetlifyIdentityUser | null;
      on: (event: string, cb: (user?: NetlifyIdentityUser | null) => void) => void;
      open: (mode: string) => void;
      logout: () => void;
    };
  }
}
