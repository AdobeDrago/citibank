/*
 * Simulated auth via a same-site `ecid` cookie — stands in for a real Citi
 * session/segment signal until identity integration lands (see the
 * Post-Login Pega Banners scenario in docs/index.html). The cookie is the
 * only source of truth, so it's read the same way on every page regardless
 * of how the visitor navigated there — no need to propagate anything through
 * links.
 */

/*
 * Not a security boundary — guarded content is still delivered, only hidden
 * with CSS. Imports nothing, so it's safe to use from any load phase.
 */

// Confined to dev/staging hosts — the nav Log In control only becomes an
// interactive toggle here; production keeps the authored login link as-is.
const SIMULATION_HOSTS = /(^localhost$|\.aem\.page$|\.aem\.live$)/;

/** Heading copy that marks a login-gated section (e.g. a Pega banner slot). */
const GATE_HEADINGS = ['log in to view content'];

// Stand-in for a real Adobe ECID/segment signal — lets a logged-in visitor be
// treated as segment B for Pega decisioning until real identity/ECID lands.
// Its presence is also the simulated session flag itself: no separate flag.
const SEGMENT_COOKIE = 'ecid';
const SEGMENT_VALUE = 'seg-b';

/**
 * @param {string} name the cookie to read
 * @returns {string|null} its value, or null when not set
 */
function readCookie(name) {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Sets or clears the segment cookie — this is what logs a visitor in or out.
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

/**
 * @returns {boolean} whether the cookie simulation is active on this host
 */
export function isSimulationEnabled() {
  return SIMULATION_HOSTS.test(window.location.hostname);
}

/**
 * @returns {boolean} whether the visitor is (simulated) authenticated
 */
export function isAuthenticated() {
  return isSimulationEnabled() && Boolean(readCookie(SEGMENT_COOKIE));
}

/**
 * Login destination from the authored href. No real login page exists yet,
 * so an empty/`#` authored href falls back to the current page rather than
 * navigating to a dead link.
 * @param {HTMLElement} control the Log In control
 * @returns {string} the href to navigate to
 */
function loginDestinationHref(control) {
  const authored = control.getAttribute('href');
  if (!authored || authored.startsWith('#')) {
    return `${window.location.pathname}${window.location.search}`;
  }
  return authored;
}

/**
 * Sets the body class before first paint, and wires one delegated Log In /
 * Log Out click handler. The click's own default navigation (to whatever
 * decorateAuthControl already set as the control's href) is left alone —
 * flipping the session cookie is the only thing that needs to happen here.
 */
export function initAuthState() {
  const authenticated = isAuthenticated();
  document.body.classList.add(authenticated ? 'auth-authenticated' : 'auth-anonymous');
  if (!isSimulationEnabled()) return;

  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-auth-action]');
    if (!trigger) return;
    syncSegmentCookie(trigger.dataset.authAction === 'login');
  });
}

// Known sign-on wordings paired with their sign-off counterpart, checked in
// order against the authored label. An unrecognized label (some future
// wording) falls back to the last, generic pair.
const SIGN_OFF_LABELS = [
  [/\bsign\s*(on|in)\b/i, 'Sign Out'],
  [/\blog\s*in\b/i, 'Log Out'],
];

/**
 * Derives the authenticated-state label from whatever the author typed for
 * the anonymous state, so renaming the authored control (e.g. "Log In" to
 * "Sign On") doesn't leave a mismatched "Log Out" behind.
 * @param {string} authoredLabel the anonymous-state label, as authored
 * @returns {string} the label to show once authenticated
 */
function signOffLabelFor(authoredLabel) {
  const match = SIGN_OFF_LABELS.find(([pattern]) => pattern.test(authoredLabel));
  return match ? match[1] : 'Log Out';
}

/**
 * Points a sign-on / sign-off control at the current state. Both labels
 * derive from whatever the author typed for the anonymous state (e.g.
 * "Log In", "Sign On") — nothing here is hardcoded to specific wording.
 * Login uses the authored href; logout returns to the current page.
 * @param {HTMLElement} control the authored login control
 */
export function decorateAuthControl(control) {
  const authenticated = isAuthenticated();
  const authoredLabel = control.textContent.trim();
  control.textContent = authenticated ? signOffLabelFor(authoredLabel) : authoredLabel;
  control.title = control.textContent;
  control.dataset.authAction = authenticated ? 'logout' : 'login';
  if (!('href' in control)) return;

  control.href = authenticated
    ? `${window.location.pathname}${window.location.search}`
    : loginDestinationHref(control);
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
