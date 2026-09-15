const INDEX_URL = '/bta-zips.json';
const STORAGE_KEY = 'citi-zip';
const DEFAULT_ZIP = '10022';
const EVENT_NAME = 'bta:updated';

let indexPromise;
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
 * @returns {Promise<object[]>}
 */
function loadIndex() {
  if (!indexPromise) {
    indexPromise = fetch(INDEX_URL)
      .then((resp) => (resp.ok ? resp.json() : { data: [] }))
      .then((json) => (Array.isArray(json.data) ? json.data : []))
      .catch(() => []);
  }
  return indexPromise;
}

/**
 * Looks up a ZIP in the mock index. Unknown ZIPs still display and are OUT.
 * `outOfBTA` matches the Citi lookup payload: IN = inside territory, OUT = outside.
 * @param {unknown} zip
 * @returns {Promise<{ zip: string, outOfBTA: string, governingState: string }>}
 */
export async function lookupZip(zip) {
  const normalized = normalizeZip(zip);
  const rows = await loadIndex();
  const match = rows.find((row) => normalizeZip(row.zip) === normalized);
  return {
    zip: normalized,
    outOfBTA: match?.outOfBTA === 'IN' ? 'IN' : 'OUT',
    governingState: match?.governingState || '',
  };
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
