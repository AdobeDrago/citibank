const STORAGE_KEY = 'citi-zip';
const DEFAULT_ZIP = '10022';
const EVENT_NAME = 'bta:updated';

/** Authored DA workbook (same pattern as /credit-cards/offerpricingpositioning.json). */
export const BTA_SHEET_PATH = '/cbol/zipcode-bta.json';

let lastApplied = '';
let inFlight;
let workbookPromise;

/**
 * @param {unknown} value
 * @returns {string} digits only, at most 5
 */
export function normalizeZip(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 5);
}

/**
 * ZIP from ?zip=, then localStorage, then the default.
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
 * @returns {string[]}
 */
function sheetNames(json) {
  if (!json || typeof json !== 'object') return [];
  if (Array.isArray(json[':names'])) return json[':names'].map(String);
  return Object.keys(json).filter((key) => !key.startsWith(':'));
}

/**
 * Picks one tab from a multi-sheet workbook (case-insensitive).
 * A single-sheet payload is returned as-is when the name is `data`.
 * @param {object} json
 * @param {string} name
 * @returns {object|null}
 */
function getSheet(json, name) {
  if (!json || typeof json !== 'object') return null;
  const wanted = String(name || '').trim().toLowerCase();
  const isMulti = json[':type'] === 'multi-sheet' || Array.isArray(json[':names']);
  if (!isMulti) {
    return wanted === 'data' || !wanted ? json : null;
  }
  const match = sheetNames(json).find((n) => n.toLowerCase() === wanted);
  const sheet = match ? json[match] : null;
  return sheet && typeof sheet === 'object' ? sheet : null;
}

/**
 * @param {object|null} sheet
 * @returns {object[]}
 */
function sheetData(sheet) {
  return Array.isArray(sheet?.data) ? sheet.data.filter((row) => row && typeof row === 'object') : [];
}

/**
 * @param {object[]} rows
 * @returns {Map<string, { zip: string, outOfBTA: string, governingState: string }>}
 */
function rowsToIndex(rows) {
  const index = new Map();
  rows.forEach((row) => {
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
 * Loads the authored workbook once per page.
 * @returns {Promise<object>}
 */
async function loadWorkbook() {
  if (!workbookPromise) {
    workbookPromise = fetch(BTA_SHEET_PATH)
      .then(async (resp) => {
        if (!resp.ok) return {};
        const json = await resp.json();
        return json && typeof json === 'object' ? json : {};
      })
      .catch(() => ({}));
  }
  return workbookPromise;
}

/**
 * Looks up a ZIP in the authored `data` sheet. Unknown ZIPs are OUT.
 * @param {unknown} zip
 * @returns {Promise<{ zip: string, outOfBTA: string, governingState: string }>}
 */
export async function lookupZip(zip) {
  const normalized = normalizeZip(zip);
  const fallback = { zip: normalized, outOfBTA: 'OUT', governingState: '' };
  if (normalized.length !== 5) return fallback;
  const workbook = await loadWorkbook();
  const match = rowsToIndex(sheetData(getSheet(workbook, 'data'))).get(normalized);
  return match || fallback;
}

/**
 * @param {object} row
 * @returns {{ account: string, fee: string }|null}
 */
function feePair(row) {
  const account = String(cell(row, [
    'account', 'depositaccount', 'deposit account', 'name', 'product',
  ])).trim();
  const fee = String(cell(row, [
    'fee', 'monthlyservicefee', 'monthly service fee', 'price', 'amount',
  ])).trim();
  if (account && fee) return { account, fee };

  const values = Object.keys(row)
    .filter((key) => !key.startsWith(':'))
    .map((key) => String(row[key] ?? '').trim())
    .filter(Boolean);
  if (values.length >= 2) return { account: values[0], fee: values[1] };
  return null;
}

/**
 * Fee rows from the IN or OUT tab. If authors put the first product in the
 * header row (DA treats row 1 as column names), that pair is restored first.
 * @param {string} outOfBTA IN | OUT
 * @returns {Promise<{ account: string, fee: string }[]>}
 */
export async function getBtaFeeSchedule(outOfBTA) {
  const tab = String(outOfBTA).toUpperCase() === 'OUT' ? 'OUT' : 'IN';
  const sheet = getSheet(await loadWorkbook(), tab);
  const raw = sheetData(sheet);
  const fees = [];

  if (raw.length) {
    const keys = Object.keys(raw[0]).filter((key) => !key.startsWith(':'));
    const hasStandard = keys.some((key) => /account|fee|deposit|price|product|name/i.test(key));
    if (!hasStandard && keys.length >= 2) {
      fees.push({ account: keys[0], fee: keys[1] });
    }
  }

  raw.forEach((row) => {
    const pair = feePair(row);
    if (pair) fees.push(pair);
  });
  return fees;
}

/**
 * Keeps `?zip=` aligned with the applied ZIP so late callers of getZip()
 * (e.g. the footer fee table) do not re-apply a stale query value.
 * @param {string} zip
 */
function syncZipQuery(zip) {
  const url = new URL(window.location.href);
  if (url.searchParams.get('zip') === zip) return;
  url.searchParams.set('zip', zip);
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
}

/**
 * @param {unknown} zip
 * @returns {Promise<{ zip: string, outOfBTA: string, governingState: string }>}
 */
async function applyZipNow(zip) {
  const result = await lookupZip(zip);
  syncZipQuery(result.zip);
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
 * Persists ZIP, syncs `?zip=` in the URL, stamps body data attributes, and
 * notifies listeners (fee table, zip banner).
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
