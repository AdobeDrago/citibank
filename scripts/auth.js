/*
 * Simulated auth via `?loggedIn=true` — stands in for a real Citi session
 * until identity integration lands (see the Post-Login Pega Banners scenario
 * in docs/index.html). The URL is the only source of truth; nothing is
 * persisted.
 */

/*
 * Not a security boundary — guarded content is still delivered, only hidden
 * with CSS. Imports nothing, so it's safe to use from any load phase.
 */

const PARAM = 'loggedIn';

/** Parameter values that count as authenticated; anything else is public. */
const TRUTHY = ['true', '1', 'yes'];

// Confined to dev/staging hosts — the nav Log In control only becomes an
// interactive toggle here; production keeps the authored login link as-is.
const SIMULATION_HOSTS = /(^localhost$|\.aem\.page$|\.aem\.live$)/;

/** Heading copy that marks a login-gated section (e.g. a Pega banner slot). */
const GATE_HEADINGS = ['log in to view content'];

// Stand-in for a real Adobe ECID/segment signal — lets a logged-in visitor be
// treated as segment B for Pega decisioning until real identity/ECID lands.
const SEGMENT_COOKIE = 'ecid';
const SEGMENT_VALUE = 'seg-b';

/**
 * Sets or clears the simulated segment cookie to match auth state.
 * @param {boolean} authenticated the state to sync the cookie to
 */
function syncSegmentCookie(authenticated) {
  const secure = window.location.protocol === 'https:' ? '; secure' : '';
  if (authenticated) {
    document.cookie = `${SEGMENT_COOKIE}=${SEGMENT_VALUE}; path=/; samesite=lax${secure}`;
  } else {
    document.cookie = `${SEGMENT_COOKIE}=; path=/; max-age=0; samesite=lax${secure}`;
  }
}

/* ---- link propagation ---- */

/** Path roots that hold files, never pages. */
const ASSET_ROOT = /^\/(content\/dam|media_|icons)\//i;

/** A trailing extension marks an asset; `.html` is the one navigable form. */
const FILE_EXTENSION = /\.[a-z0-9]{1,8}$/i;

// The Log In/Log Out control sets its own parameter explicitly, so it's opted
// out of the generic link rewrite below.
const REWRITE_OPT_OUT = '[data-auth-action]';

/**
 * @returns {boolean} whether the URL-parameter simulation is active on this host
 */
export function isSimulationEnabled() {
  return SIMULATION_HOSTS.test(window.location.hostname);
}

/**
 * Resolves auth state from the URL — `loggedIn=true` is authenticated, else public.
 * TODO: swap for the real session check once auth integration lands.
 * @returns {boolean} true when the visitor is (simulated) authenticated
 */
function resolveAuthState() {
  const param = new URLSearchParams(window.location.search).get(PARAM);
  return param !== null && TRUTHY.includes(param.trim().toLowerCase());
}

/**
 * @returns {boolean} whether the visitor is authenticated
 */
export function isAuthenticated() {
  return isSimulationEnabled() && resolveAuthState();
}

/**
 * The current page's URL in a given state — login adds the parameter, logout
 * removes it. Used for logout and address-bar sync.
 * @param {boolean} authenticated the state to switch to
 * @returns {string} a path-relative href
 */
function authActionHref(authenticated) {
  const url = new URL(window.location.href);
  if (authenticated) url.searchParams.set(PARAM, 'true');
  else url.searchParams.delete(PARAM);
  url.hash = '';
  return `${url.pathname}${url.search}`;
}

/**
 * Login destination from the authored href, plus the simulation flag. No
 * real login page exists yet, so an empty/`#` authored href falls back to
 * the current page — the same behavior logout already uses — rather than
 * navigating to a dead link.
 * @param {HTMLElement} control the Log In control
 * @returns {string} the href to navigate to
 */
function loginDestinationHref(control) {
  const authored = control.getAttribute('href');
  if (!authored || authored.startsWith('#')) return authActionHref(true);

  const url = new URL(authored, window.location.origin);
  if (url.origin !== window.location.origin) return authored;
  url.searchParams.set(PARAM, 'true');
  url.hash = '';
  return `${url.pathname}${url.search}`;
}

/**
 * Sets the body class before first paint, syncs the address bar to the
 * state, and wires one delegated Log In / Log Out click handler.
 */
export function initAuthState() {
  const authenticated = isAuthenticated();
  document.body.classList.add(authenticated ? 'auth-authenticated' : 'auth-anonymous');
  if (!isSimulationEnabled()) return;

  // Covers every path that lands here authenticated — a Log In click, a
  // propagated link, or a shared ?loggedIn=true URL — not just the click.
  syncSegmentCookie(authenticated);

  const { pathname, search, hash } = window.location;
  const next = `${authActionHref(authenticated)}${hash}`;
  if (next !== `${pathname}${search}${hash}`) window.history.replaceState(null, '', next);

  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-auth-action]');
    // decorateAuthControl always sets a real href (login destination or
    // logout URL) on any control it decorates.
    const href = trigger?.getAttribute('href');
    if (!href) return;
    event.preventDefault();
    window.location.replace(href);
  });
}

/**
 * Adds the parameter to one anchor if it navigates to another page of this site.
 * Classifies on a parsed URL, not string prefixes, and is idempotent.
 * @param {HTMLAnchorElement} a the anchor to consider
 */
function propagateParam(a) {
  const raw = a.getAttribute('href');
  if (!raw || raw.startsWith('#')) return;
  if (a.matches(REWRITE_OPT_OUT)) return;

  let url;
  try {
    url = new URL(raw, window.location.href);
  } catch (e) {
    return; // malformed authored href
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
  if (url.origin !== window.location.origin) return;
  if (ASSET_ROOT.test(url.pathname)) return;
  if (FILE_EXTENSION.test(url.pathname) && !url.pathname.endsWith('.html')) return;

  url.searchParams.set(PARAM, 'true');
  a.setAttribute('href', `${url.pathname}${url.search}${url.hash}`);
}

/**
 * Writes the parameter into every eligible link so the session survives
 * navigation. Blocks that inject anchors after decoration must call this too.
 * @param {Element} main the container to rewrite
 */
export function decorateAuthLinks(main) {
  if (!isAuthenticated()) return;
  main.querySelectorAll('a[href]').forEach(propagateParam);
}

/**
 * Points a Log In / Log Out control at the current state.
 * Login uses the authored href; logout clears `loggedIn` on the current page.
 * @param {HTMLElement} control the authored Log In link
 */
export function decorateAuthControl(control) {
  const authenticated = isAuthenticated();
  control.textContent = authenticated ? 'Log Out' : 'Log In';
  control.title = control.textContent;
  control.dataset.authAction = authenticated ? 'logout' : 'login';
  if (!('href' in control)) return;

  if (authenticated) {
    control.href = authActionHref(false);
    return;
  }

  control.href = loginDestinationHref(control);
}

const normalize = (el) => el.textContent.replace(/\s+/g, ' ').trim().toLowerCase();

/** Authored "Log In" / "Log Out" control sitting with the gate prompt. */
const isGateLoginParagraph = (el) => el?.tagName === 'P'
  && /^log\s*(in|out)$/i.test(el.textContent.replace(/\s+/g, ' ').trim());

/**
 * Tags the gate heading and everything it guards so CSS can hide/show them.
 * Matches an exact heading whitelist, never an H1, to avoid false gates.
 * @param {Element} main The main element
 */
export function decorateAuthGate(main) {
  if (!isSimulationEnabled()) return;

  const gate = [...main.querySelectorAll('h2, h3, h4, h5, h6')]
    .find((heading) => GATE_HEADINGS.includes(normalize(heading)));
  if (!gate) return;

  const wrapper = gate.parentElement;
  if (!wrapper) return;

  // Gate prompt stays visible when logged out: heading + an authored Log In link.
  const gateNodes = [gate];
  let next = gate.nextElementSibling;
  while (isGateLoginParagraph(next)) {
    gateNodes.push(next);
    next = next.nextElementSibling;
  }

  // the guarded range: rest of this wrapper, then every following wrapper in
  // the section (a block like `cards` isn't a sibling of the gate heading)
  const guarded = [];
  for (let el = next; el; el = el.nextElementSibling) guarded.push(el);
  for (let el = wrapper.nextElementSibling; el; el = el.nextElementSibling) guarded.push(el);
  if (guarded.length === 0) return;

  gateNodes.forEach((el) => { el.dataset.auth = 'anonymous'; });
  guarded.forEach((el) => { el.dataset.auth = 'authenticated'; });
}
