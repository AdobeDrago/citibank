const STORAGE_KEY = 'citi-zip';
const DEFAULT_ZIP = '10022';
const EVENT_NAME = 'bta:updated';

/** Authored DA workbook (same pattern as /credit-cards/offerpricingpositioning.json). */
export const BTA_SHEET_PATH = '/cbol/zipcode-bta.json';

let lastApplied = '';
let inFlight;
let indexPromise;

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
 * @param {object} row
 * @param {string[]} names
 * @returns {unknown}
 */
function cell(row, names) {
  if (!row || typeof row !== 'object') return '';
  const wanted = new Set(names.map((name) => name.toLowerCase().replace(/\s+/g, '')));
  const key = Object.keys(row).find((name) => wanted.has(name.toLowerCase().replace(/\s+/g, '')));
  return key ? row[key] : '';
}

/**
 * @param {object} json
 * @returns {object[]}
 */
function sheetRows(json) {
  if (!json || typeof json !== 'object') return [];
  if (Array.isArray(json.data)) return json.data;
  const isMulti = json[':type'] === 'multi-sheet' || Array.isArray(json[':names']);
  if (!isMulti) return [];
  const names = Array.isArray(json[':names'])
    ? json[':names']
    : Object.keys(json).filter((key) => !key.startsWith(':'));
  const wanted = names.find((name) => String(name).toLowerCase() === 'data') || names[0];
  const sheet = wanted ? json[wanted] : null;
  return Array.isArray(sheet?.data) ? sheet.data : [];
}

/**
 * @param {object[]} rows
 * @returns {Map<string, { zip: string, outOfBTA: string, governingState: string }>}
 */
function rowsToIndex(rows) {
  const index = new Map();
  rows.forEach((row) => {
    if (!row || typeof row !== 'object') return;
    const zip = normalizeZip(cell(row, ['zip', 'zipcode', 'zip code']));
    if (zip.length !== 5 || index.has(zip)) return;
    const outOfBTA = String(cell(row, ['outOfBTA', 'outofbta', 'out of bta'])).trim().toUpperCase() === 'IN'
      ? 'IN'
      : 'OUT';
    index.set(zip, {
      zip,
      outOfBTA,
      governingState: String(cell(row, ['governingState', 'governing state'])).trim(),
    });
  });
  return index;
}

/**
 * Loads the DA ZIP sheet once per page.
 * @returns {Promise<Map<string, { zip: string, outOfBTA: string, governingState: string }>>}
 */
async function loadIndex() {
  if (!indexPromise) {
    indexPromise = fetch(BTA_SHEET_PATH)
      .then(async (resp) => {
        if (!resp.ok) return new Map();
        return rowsToIndex(sheetRows(await resp.json()));
      })
      .catch(() => new Map());
  }
  return indexPromise;
}

/**
 * Looks up a ZIP in the authored DA sheet. Unknown ZIPs still display and are OUT.
 * @param {unknown} zip
 * @returns {Promise<{ zip: string, outOfBTA: string, governingState: string }>}
 */
export async function lookupZip(zip) {
  const normalized = normalizeZip(zip);
  const fallback = { zip: normalized, outOfBTA: 'OUT', governingState: '' };
  if (normalized.length !== 5) return fallback;
  const match = (await loadIndex()).get(normalized);
  return match || fallback;
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
