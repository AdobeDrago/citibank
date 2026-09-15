const STORAGE_KEY = 'citi-zip';
const DEFAULT_ZIP = '10022';
const EVENT_NAME = 'bta:updated';

/** Same path shape as banking.citi.com/api/zipcode/CBOL/{zip}; EDS needs .json. */
const zipLookupUrl = (zip) => `/api/zipcode/CBOL/${zip}.json`;

let lastApplied = '';
let inFlight;

/**
 * @param {unknown} value
 * @returns {string} digits only, at most 5
 */
export function normalizeZip(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 5);
}

/**
 * ZIP from ?zip=, then localStorage, then the IN-territory default.
 * @returns {string}
 */
export function getZip() {
  const fromQuery = normalizeZip(new URLSearchParams(window.location.search).get('zip'));
  if (fromQuery.length === 5) return fromQuery;
  try {
    const stored = normalizeZip(localStorage.getItem(STORAGE_KEY));
    if (stored.length === 5) return stored;
  } catch {
    // private mode
  }
  return DEFAULT_ZIP;
}

/**
 * @returns {string} IN | OUT
 */
export function getBta() {
  return document.body.dataset.bta === 'OUT' ? 'OUT' : 'IN';
}

/**
 * Looks up a ZIP against the mock Citi ZIP API. Unknown ZIPs still display
 * and are OUT. Live Citi uses GET /api/zipcode/CBOL/{zip} (no .json).
 * @param {unknown} zip
 * @returns {Promise<{ zip: string, outOfBTA: string, governingState: string }>}
 */
export async function lookupZip(zip) {
  const normalized = normalizeZip(zip);
  const fallback = { zip: normalized, outOfBTA: 'OUT', governingState: '' };
  if (normalized.length !== 5) return fallback;

  try {
    const resp = await fetch(zipLookupUrl(normalized));
    if (!resp.ok) return fallback;
    const data = await resp.json();
    if (!data || data.status !== 'success') return fallback;
    return {
      zip: normalizeZip(data.zip) || normalized,
      outOfBTA: data.outOfBTA === 'IN' ? 'IN' : 'OUT',
      governingState: String(data.governingState || ''),
    };
  } catch {
    return fallback;
  }
}

/**
 * @param {unknown} zip
 * @returns {Promise<{ zip: string, outOfBTA: string, governingState: string }>}
 */
async function applyZipNow(zip) {
  const result = await lookupZip(zip);
  const key = `${result.zip}|${result.outOfBTA}`;
  if (key === lastApplied) return result;

  try {
    localStorage.setItem(STORAGE_KEY, result.zip);
  } catch {
    // private mode
  }
  lastApplied = key;
  document.body.dataset.zip = result.zip;
  document.body.dataset.bta = result.outOfBTA;
  document.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: result }));
  return result;
}

/**
 * Persists ZIP, stamps body data attributes, notifies listeners.
 * @param {unknown} zip
 * @returns {Promise<{ zip: string, outOfBTA: string, governingState: string }>}
 */
export async function applyZip(zip) {
  if (inFlight) await inFlight;
  inFlight = applyZipNow(zip);
  try {
    return await inFlight;
  } finally {
    inFlight = undefined;
  }
}

/**
 * @param {(event: CustomEvent) => void} listener
 */
export function onBtaUpdated(listener) {
  document.addEventListener(EVENT_NAME, listener);
}

/**
 * Hides `data-bta="in"` descendants while the visitor is outside the BTA and
 * keeps them in sync with later ZIP changes.
 * @param {Element} root
 */
export function syncBtaRows(root) {
  const update = (outOfBTA) => {
    root.querySelectorAll('[data-bta="in"]').forEach((el) => {
      const hide = outOfBTA === 'OUT';
      el.hidden = hide;
      if (hide) el.setAttribute('aria-hidden', 'true');
      else el.removeAttribute('aria-hidden');
    });
  };

  update(getBta());
  onBtaUpdated((event) => update(event.detail.outOfBTA));
}
