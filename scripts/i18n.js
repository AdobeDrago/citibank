/*
 * Header/footer chrome translation — cookie-driven locale + a DA-authored
 * dictionary sheet. Mirrors what citi.com itself does today: switching the
 * language sets a `locale` cookie (no URL change) and swaps only chrome
 * strings (nav labels, footer headings/legal links); anything not in the
 * dictionary silently stays in English rather than erroring or looking broken.
 */

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
 * @returns {string} the active locale — `en` or `es_US`
 */
export function getLocale() {
  return readCookie(LOCALE_COOKIE) || DEFAULT_LOCALE;
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
 * Fetches and parses the `/translations.json` DA sheet (columns: en, es).
 * Cached for the life of the page; any failure resolves to `{}` so callers
 * degrade to "leave everything in English" rather than throwing.
 * @returns {Promise<Record<string, string>>}
 */
export function fetchTranslationDictionary() {
  if (dictionaryPromise) return dictionaryPromise;
  dictionaryPromise = fetch(TRANSLATIONS_URL)
    .then((resp) => (resp.ok ? resp.json() : null))
    .then((json) => {
      const rows = Array.isArray(json?.data) ? json.data : [];
      const dict = {};
      rows.forEach((row) => {
        const en = String(row?.en ?? '').trim();
        const es = String(row?.es ?? '').trim();
        if (en && es) dict[en] = es;
      });
      return dict;
    })
    .catch(() => ({}));
  return dictionaryPromise;
}

/**
 * Replaces chrome text under `root` with its Spanish counterpart wherever the
 * exact (trimmed) English text is a key in `dict`. Leaves English untouched
 * when `locale` is the default — callers always pass a pristine, unmutated
 * DOM tree so re-running this after a locale switch never double-translates.
 * @param {Element} root
 * @param {Record<string, string>} dict
 * @param {string} locale
 */
export function applyTranslations(root, dict, locale) {
  if (!root || locale === DEFAULT_LOCALE || !dict) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);

  nodes.forEach((node) => {
    const text = node.textContent.trim();
    if (!text) return;
    const translated = dict[text];
    // Function replacer — a plain-string replacement would interpret `$&`,
    // `$1`, etc. in `translated` as special patterns (e.g. a fee amount like
    // "$100" written into the dictionary would otherwise get mangled).
    if (translated) node.textContent = node.textContent.replace(text, () => translated);
  });
}
