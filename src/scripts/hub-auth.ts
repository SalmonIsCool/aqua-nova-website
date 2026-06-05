type IdentityCallback = (user: NetlifyIdentityUser | null) => void;

let identityAttached = false;
let identityInitialized = false;
const readyCallbacks: IdentityCallback[] = [];

function notifyIdentityReady(user: NetlifyIdentityUser | null) {
  readyCallbacks.forEach((callback) => callback(user));
}

function attachIdentityOnce() {
  if (identityAttached) return !!window.netlifyIdentity;

  const identity = window.netlifyIdentity;
  if (!identity) return false;

  identityAttached = true;

  identity.on("init", () => {
    identityInitialized = true;
    notifyIdentityReady(identity.currentUser() ?? null);
  });

  identity.on("login", () => {
    notifyIdentityReady(identity.currentUser() ?? null);
  });

  identity.on("logout", () => {
    notifyIdentityReady(null);
  });

  return true;
}

function waitForIdentityWidget() {
  if (attachIdentityOnce()) return;

  const started = Date.now();
  const timer = window.setInterval(() => {
    if (attachIdentityOnce()) {
      window.clearInterval(timer);
      return;
    }

    if (Date.now() - started > 15_000) {
      window.clearInterval(timer);
      identityInitialized = true;
      notifyIdentityReady(null);
    }
  }, 50);
}

waitForIdentityWidget();

export function getIdentityUser() {
  return window.netlifyIdentity?.currentUser() ?? null;
}

export function getAuthHeaders() {
  const user = getIdentityUser();
  if (!user) return {};
  return { Authorization: `Bearer ${user.token.access_token}` };
}

export function onIdentityReady(callback: IdentityCallback) {
  readyCallbacks.push(callback);

  if (identityInitialized) {
    callback(getIdentityUser());
  }
}

export function setupHubRouteGuard(requireAuth: boolean) {
  let handled = false;

  const isLoginPage = () => {
    const path = window.location.pathname;
    return path === "/hub/login" || path === "/hub/login/";
  };

  onIdentityReady((user) => {
    if (handled) return;

    if (requireAuth && !user && !isLoginPage()) {
      handled = true;
      window.location.replace("/hub/login");
      return;
    }

    if (user && isLoginPage()) {
      handled = true;
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
