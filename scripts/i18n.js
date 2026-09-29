/*
 * Header/footer chrome translation — cookie-driven locale + a DA-authored
 * key/value dictionary sheet. Chrome content is authored as `{{key}}`
 * placeholders (same token convention as scripts/offer-sheet.js); the value
 * shown for each key is whichever locale's column is filled in for the
 * active cookie, falling back to English when a translation is missing, and
 * left as the raw `{{key}}` text when the key itself has no row at all —
 * that visible fallback is deliberate: a broken/missing key should be
 * obvious to authors and QA, not silently blank.
 */

import { replaceOfferTokens } from './offer-sheet.js';

export const LOCALE_COOKIE = 'locale';
export const DEFAULT_LOCALE = 'en_US';
export const SPANISH_LOCALE = 'es_US';

const TRANSLATIONS_URL = '/translations.json';

/**
 * @param {string} name
 * @returns {string|null}
 */
function readCookie(name) {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Resolves the active locale from the cookie. Anything other than the exact
 * recognized Spanish value — missing, malformed, or some unrecognized
 * third value — resolves to the default (English) rather than passing
 * through, so a stale/garbage cookie can never accidentally trigger
 * translation.
 * @returns {string} `DEFAULT_LOCALE` or `SPANISH_LOCALE`
 */
export function getLocale() {
  return readCookie(LOCALE_COOKIE) === SPANISH_LOCALE ? SPANISH_LOCALE : DEFAULT_LOCALE;
}

/**
 * Reflects a locale onto `<html lang>`. `scripts.js`'s eager phase always
 * hardcodes `lang="en"` before any block runs, so a persisted `es_US` cookie
 * needs this re-applied on every page load, not just when the cookie changes.
 * @param {string} [locale]
 */
export function syncDocumentLang(locale = getLocale()) {
  document.documentElement.lang = locale.startsWith('es') ? 'es' : 'en';
}

/**
 * Persists the locale (10-year cookie, matching citi.com's own), flips
 * `<html lang>`, and notifies any block that needs to react (header owns the
 * toggle; footer reacts independently) — same `document`-event pattern
 * `scripts/auth.js` already uses for `authchange`.
 * @param {string} locale
 */
export function setLocale(locale) {
  const secure = window.location.protocol === 'https:' ? '; secure' : '';
  const maxAge = 10 * 365 * 24 * 60 * 60;
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${maxAge}; samesite=lax${secure}`;
  syncDocumentLang(locale);
  document.dispatchEvent(new CustomEvent('localechange', {
    bubbles: true,
    detail: { locale },
  }));
}

let dictionaryPromise = null;

/**
 * Fetches and parses the `/translations.json` DA sheet (columns: key, en,
 * es) into `{ [key]: { en_US: '...', es_US: '...' } }`. Cached for the life
 * of the page; any failure resolves to `{}` so callers degrade to "leave
 * every {{key}} as-authored" rather than throwing.
 * @returns {Promise<Record<string, Record<string, string>>>}
 */
export function fetchTranslationDictionary() {
  if (dictionaryPromise) return dictionaryPromise;
  dictionaryPromise = fetch(TRANSLATIONS_URL)
    .then((resp) => (resp.ok ? resp.json() : null))
    .then((json) => {
      const rows = Array.isArray(json?.data) ? json.data : [];
      const dict = {};
      rows.forEach((row) => {
        const key = String(row?.key ?? '').trim();
        if (!key) return;
        const en = String(row?.en ?? '').trim();
        const es = String(row?.es ?? '').trim();
        dict[key] = { [DEFAULT_LOCALE]: en, [SPANISH_LOCALE]: es };
      });
      return dict;
    })
    .catch(() => ({}));
  return dictionaryPromise;
}

/**
 * Flattens the nested per-key dictionary to one value per key for a given
 * locale, falling back to English when that locale's column is blank for a
 * key that does have a row. A key with no row at all is left out entirely,
 * so `replaceOfferTokens` leaves its `{{key}}` visible as-authored.
 * @param {Record<string, Record<string, string>>} dict
 * @param {string} locale
 * @returns {Record<string, string>}
 */
function resolveValuesForLocale(dict, locale) {
  const values = {};
  Object.entries(dict).forEach(([key, byLocale]) => {
    const value = byLocale[locale] || byLocale[DEFAULT_LOCALE];
    if (value) values[key] = value;
  });
  return values;
}

/**
 * Replaces `{{key}}` placeholders under `root` with the dictionary's value
 * for the active locale. Reuses `replaceOfferTokens`'s TreeWalker/token
 * matching (same `{{token}}` convention this codebase already uses for
 * offer-sheet values) — callers always pass a pristine, unmutated DOM tree
 * so re-running this after a locale switch never double-resolves.
 * @param {Element} root
 * @param {Record<string, Record<string, string>>} dict
 * @param {string} locale
 */
export function applyTranslations(root, dict, locale) {
  if (!root || !dict) return;
  replaceOfferTokens(root, resolveValuesForLocale(dict, locale));
}
