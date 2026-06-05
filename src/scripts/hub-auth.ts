export function getIdentityUser() {
  return window.netlifyIdentity?.currentUser() ?? null;
}

export function getAuthHeaders() {
  const user = getIdentityUser();
  if (!user) return {};
  return { Authorization: `Bearer ${user.token.access_token}` };
}

export function onIdentityReady(callback: (user: NetlifyIdentityUser | null) => void) {
  if (!window.netlifyIdentity) {
    callback(null);
    return;
  }

  const run = () => callback(window.netlifyIdentity?.currentUser() ?? null);

  window.netlifyIdentity.on("init", run);
  window.netlifyIdentity.on("login", run);
  window.netlifyIdentity.on("logout", () => callback(null));

  if (window.netlifyIdentity.currentUser()) {
    run();
  }
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
