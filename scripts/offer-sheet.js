import { toCamelCase } from './aem.js';

const TOKEN_RE = /\{\{\s*([A-Za-z0-9 _-]+)\s*\}\}/g;

/** Default Franklin/DA workbook for credit-card offer / pricing tokens. */
export const SHARED_SHEET_PATH = '/credit-cards/offerpricingpositioning.json';

/**
 * Reads an authored sheet URL from a block (if present) and removes that
 * link so it is not treated as a CTA. Falls back to the shared credit-cards
 * offerpricingpositioning workbook.
 * @param {Element} block
 * @returns {string}
 */
export function getOfferSheetUrl(block) {
  const authored = [...block.querySelectorAll('a[href]')].find((anchor) => {
    const href = anchor.getAttribute('href') || '';
    return /offerpricingpositioning/i.test(href);
  });

  if (authored) {
    const isSheetOnly = authored.parentElement
      && authored.parentElement.tagName === 'P'
      && authored.parentElement.textContent.replace(/\s+/g, ' ').trim()
        === authored.textContent.replace(/\s+/g, ' ').trim();
    const { pathname } = new URL(authored.href, window.location.href);
    if (isSheetOnly) authored.parentElement.remove();
    return pathname.endsWith('.json') ? pathname : `${pathname.replace(/\/$/, '')}.json`;
  }

  return SHARED_SHEET_PATH;
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function normalizeName(value) {
  return String(value || '').trim().toLowerCase();
}

/**
 * Reads a cookie by name from a cookie header string.
 * @param {string} name
 * @param {string} cookieSource
 * @returns {string}
 */
function readCookie(name, cookieSource) {
  const source = `; ${cookieSource || ''}`;
  const parts = source.split(`; ${name}=`);
  if (parts.length < 2) return '';
  return decodeURIComponent(parts.pop().split(';').shift() || '').trim();
}

/**
 * Reads the offer segment tab from the ecid cookie (e.g. ecid=seg-a).
 * Falls back to ?ecid= when the cookie is not set.
 * @returns {string}
 */
export function getEcid() {
  const fromCookie = readCookie('ecid', document.cookie);
  if (fromCookie) return fromCookie;
  return new URLSearchParams(window.location.search).get('ecid') || '';
}

/**
 * Current credit-card page slug (e.g. citi-aadvantage-globe-mastercard).
 * @returns {string}
 */
export function getPageSlug() {
  const path = window.location.pathname.replace(/\.html$/, '').replace(/\/$/, '');
  return path.split('/').filter(Boolean).pop() || '';
}

/**
 * @param {object} row
 * @returns {string}
 */
function pageNameOf(row) {
  return row?.['Page Name'] ?? row?.pageName ?? row?.pagename ?? row?.['page-name'] ?? '';
}

/**
 * Picks the workbook tab for the ecid cookie / ?ecid= (seg-a, seg-b).
 * First tab if missing.
 * @param {object} json
 * @param {string} ecid
 * @returns {object}
 */
function getSegmentSheet(json, ecid) {
  if (!json || typeof json !== 'object') return json;
  const isMulti = json[':type'] === 'multi-sheet' || Array.isArray(json[':names']);
  if (!isMulti) return json;

  const names = Array.isArray(json[':names'])
    ? json[':names']
    : Object.keys(json).filter((key) => !key.startsWith(':'));
  const wanted = normalizeName(ecid);
  const match = wanted ? names.find((name) => normalizeName(name) === wanted) : null;
  const name = match || names[0];
  return (name && json[name] && typeof json[name] === 'object') ? json[name] : json;
}

/**
 * Returns the row whose Page Name matches the current card page.
 * @param {object[]} rows
 * @param {string} slug
 * @returns {object|null}
 */
function findPageRow(rows, slug) {
  const wanted = normalizeName(slug);
  if (!wanted) return null;
  return rows.find((row) => {
    const raw = String(pageNameOf(row)).trim().replace(/\.html$/i, '').replace(/\/$/, '');
    return normalizeName(raw.split('/').pop()) === wanted;
  }) || null;
}

/**
 * Legacy: row whose Ecid column matches the URL, or the first row.
 * @param {object[]} rows
 * @param {string} ecid
 * @returns {object|null}
 */
function findOfferRow(rows, ecid) {
  const wanted = normalizeName(ecid);
  if (wanted) {
    const match = rows.find((row) => {
      const value = row?.Ecid ?? row?.ecid ?? row?.ECID ?? '';
      return normalizeName(value) === wanted;
    });
    if (match) return match;
  }
  return rows[0] || null;
}

/**
 * Maps one sheet row's columns to camelCase tokens (bonusMiles, etc.).
 * @param {object} row
 * @returns {Record<string, string>}
 */
function rowToValues(row) {
  const values = {};
  if (!row || typeof row !== 'object') return values;
  Object.entries(row).forEach(([key, value]) => {
    if (key.startsWith(':') || value == null || !String(value).trim()) return;
    values[toCamelCase(key)] = String(value).trim();
  });
  return values;
}

/**
 * Maps a Franklin/DA sheet payload to camelCase keys.
 * Shared workbook: the ecid cookie (or ?ecid=) selects the tab (seg-a, seg-b);
 * Page Name selects the current card. Also supports a legacy Ecid column,
 * Key/Value rows, and a single row of named columns.
 * @param {object} json
 * @returns {Record<string, string>}
 */
export function sheetToValues(json) {
  const segment = getSegmentSheet(json, getEcid());
  const rows = Array.isArray(segment?.data)
    ? segment.data.filter((row) => row && typeof row === 'object')
    : [];
  if (rows.some((row) => pageNameOf(row))) {
    return rowToValues(findPageRow(rows, getPageSlug()));
  }
  if (rows.some((row) => row.Ecid || row.ecid || row.ECID)) {
    return rowToValues(findOfferRow(rows, getEcid()));
  }

  const values = {};
  rows.forEach((row) => {
    const key = row.Key || row.key || row.Name || row.name;
    const value = row.Value ?? row.value ?? row.Text ?? row.text;
    if (key && value != null && String(value).trim()) {
      values[toCamelCase(String(key))] = String(value).trim();
    }
  });
  if (Object.keys(values).length) return values;
  return rowToValues(rows[0]);
}

/**
 * Resolves a {{token}} against sheet values.
 * Authored tokens are already camelCase (bonusMiles). toCamelCase() lowercases
 * those first, so "bonusMiles" becomes "bonusmiles" and would miss the sheet key.
 * Prefer the authored key, then camelCase (for "Bonus Miles"), then ignore-case.
 * @param {Record<string, string>} values
 * @param {string} rawKey
 * @returns {string|null}
 */
function lookupOfferValue(values, rawKey) {
  const trimmed = String(rawKey).trim();
  if (!trimmed) return null;
  if (values[trimmed] != null) return values[trimmed];
  const camel = toCamelCase(trimmed);
  if (values[camel] != null) return values[camel];
  const lower = trimmed.toLowerCase();
  const match = Object.keys(values).find((key) => key.toLowerCase() === lower);
  return match != null ? values[match] : null;
}

/**
 * Replaces {{token}} placeholders under a root with values from the offer sheet.
 * @param {Element} root
 * @param {Record<string, string>} values
 */
export function replaceOfferTokens(root, values) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);

  nodes.forEach((node) => {
    const { textContent } = node;
    if (!textContent || !textContent.includes('{{')) return;
    node.textContent = textContent.replace(TOKEN_RE, (match, rawKey) => {
      const value = lookupOfferValue(values, rawKey);
      return value != null ? value : match;
    });
  });
}

/**
 * Fetches and maps offer / pricing values from a sheet URL.
 * @param {string} [sheetUrl]
 * @returns {Promise<Record<string, string>>}
 */
export async function fetchOfferValues(sheetUrl = SHARED_SHEET_PATH) {
  const resp = await fetch(sheetUrl);
  if (!resp.ok) return {};
  const json = await resp.json();
  if (!json || typeof json !== 'object') return {};
  return sheetToValues(json);
}

/**
 * Loads offer / pricing values from the page sheet and fills authored tokens.
 * Safe to call from any block that authors {{token}} placeholders.
 * @param {Element} root
 * @param {string} [sheetUrl]
 */
export async function hydrateOfferValues(root, sheetUrl = SHARED_SHEET_PATH) {
  if (!root?.textContent?.includes('{{')) return;
  try {
    const values = await fetchOfferValues(sheetUrl);
    if (!Object.keys(values).length) return;
    replaceOfferTokens(root, values);
  } catch {
    // Keep authored tokens if the sheet is unavailable.
  }
}
