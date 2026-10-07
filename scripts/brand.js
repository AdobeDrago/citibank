/*
 * Brand resolution for the repoless multi-brand setup.
 *
 * One GitHub repository (AdobeDrago/citibank) serves N sites. Each site is a separate
 * configuration in the Admin Config Service, all pointing `code.source` at this
 * repository — that is the "code delivery" half of the pattern, and none of it lives
 * here. This module is the other half: per-brand variation. It resolves which brand the
 * current request belongs to and stamps it onto <html data-brand="...">, which every
 * per-brand stylesheet, script and block keys off.
 *
 * Sites served from this repository:
 *   citibank          -> brand `citibank` (www.citi.com)      exact match on site name
 *   banking-citibank  -> brand `banking`  (banking.citi.com)  `banking-` prefix match
 *
 * This is the ONLY place brand keys are declared. A brand missing from the registry is
 * never recognised, no matter what folders exist on disk.
 */

export const BRAND_REGISTRY = {
  citibank: './citibank/citibank.js',
  banking: './banking/banking.js',
};

const DEFAULT_BRAND = 'citibank';
const BRAND_KEYS = Object.keys(BRAND_REGISTRY);
const LOCAL_HOSTNAMES = ['localhost', '127.0.0.1'];
const BRAND_STORAGE_KEY = 'brand-override';

/*
 * Content paths that belong to a brand regardless of which hostname serves them.
 *
 * `/cbol/...` is the Citibank Online (banking.citi.com) experience. It is authored in the
 * main site's content tree, so it must resolve to the `banking` brand on the citibank
 * hostname too — both before the banking-citibank site exists, and afterwards for anyone
 * arriving by the original URL.
 *
 * This is why the map is consulted BEFORE the hostname: a hostname is a site's default
 * identity, but an explicit path mapping is a deliberate statement about the content.
 * Matched against the first path segment, ignoring a `/content/` prefix (the shape
 * `aem up` serves locally).
 */
const PATH_BRANDS = {
  cbol: 'banking',
};

/*
 * Custom production domains do not use the `{ref}--{site}--{org}` structure, so brand
 * resolution falls back to a substring test against the hostname. A domain that does not
 * contain its own brand key would render as the default brand, so any such domain needs
 * an explicit entry here. Checked in order, first match wins.
 */
const DOMAIN_BRANDS = [
  ['banking.citi.com', 'banking'],
  ['www.citi.com', 'citibank'],
];

/**
 * Matches one hostname segment against the registry: exact first, then `{key}-` prefix.
 *
 * Site `citibank`         -> brand `citibank` (exact)
 * Site `banking-citibank` -> brand `banking`  (prefix)
 * Site `citi-banking`     -> no match, silently falls back to DEFAULT_BRAND, because the
 *                            key is not at the START of the segment.
 *
 * @param {string} segment One `--`-delimited hostname segment
 * @returns {string|null} The resolved brand key, or null
 */
function matchBrandKey(segment) {
  if (!segment) return null;
  if (BRAND_KEYS.includes(segment)) return segment;
  return BRAND_KEYS.find((key) => segment.startsWith(`${key}-`)) || null;
}

/**
 * Returns the first path segment, ignoring a leading `/content/` prefix.
 * @returns {string} The segment, or '' at the root
 */
function firstPathSegment() {
  const segments = window.location.pathname.split('/').filter(Boolean);
  if (segments[0] === 'content') segments.shift();
  return segments[0] || '';
}

/**
 * Reads a `?brand=` override, but ONLY on local hostnames, so the override can never be
 * used to force a different brand on a real preview or production URL. Remembered for the
 * tab so it survives following links in proxied content.
 * @returns {string|null}
 */
function getLocalOverride() {
  if (!LOCAL_HOSTNAMES.includes(window.location.hostname)) return null;

  const requested = new URLSearchParams(window.location.search).get('brand');
  if (requested && BRAND_REGISTRY[requested]) {
    try {
      sessionStorage.setItem(BRAND_STORAGE_KEY, requested);
    } catch (e) {
      // sessionStorage unavailable - the override still applies to this page view
    }
    return requested;
  }

  try {
    const stored = sessionStorage.getItem(BRAND_STORAGE_KEY);
    if (stored && BRAND_REGISTRY[stored]) return stored;
  } catch (e) {
    // sessionStorage unavailable
  }
  return null;
}

/**
 * Resolves the brand from the explicit PATH_BRANDS map. Deliberately consulted before the
 * hostname - see the PATH_BRANDS comment.
 * @returns {string|null}
 */
function getBrandFromPathMap() {
  const brand = PATH_BRANDS[firstPathSegment()];
  return brand && BRAND_REGISTRY[brand] ? brand : null;
}

/**
 * Resolves the brand from the site segment of a `{ref}--{site}--{org}` hostname.
 * @returns {string|null}
 */
function getBrandFromHostname() {
  const [subdomain] = window.location.hostname.split('.');
  const segments = subdomain.split('--');
  if (segments.length < 3) return null;
  return matchBrandKey(segments[1]);
}

/**
 * Resolves the brand from a leading `/{key}/` path segment naming a brand directly.
 * @returns {string|null}
 */
function getBrandFromPath() {
  const first = firstPathSegment();
  return first && BRAND_REGISTRY[first] ? first : null;
}

/**
 * Resolves the brand for a custom production domain, by explicit mapping first and then
 * by substring, for domains that happen to contain their own key.
 * @returns {string|null}
 */
function getBrandFromCustomDomain() {
  const { hostname } = window.location;
  const mapped = DOMAIN_BRANDS.find(([domain]) => hostname === domain || hostname.endsWith(`.${domain}`));
  if (mapped && BRAND_REGISTRY[mapped[1]]) return mapped[1];
  return BRAND_KEYS.find((key) => hostname.includes(key)) || null;
}

/**
 * Resolves the active brand and stamps it onto the document element.
 * Must run before anything that depends on the brand.
 * @returns {string} The resolved brand key
 */
export function resolveBrand() {
  const brand = getLocalOverride()
    || getBrandFromPathMap()
    || getBrandFromHostname()
    || getBrandFromPath()
    || getBrandFromCustomDomain()
    || DEFAULT_BRAND;

  document.documentElement.dataset.brand = brand;
  return brand;
}

/**
 * Loads a brand's behaviour module.
 *
 * Deliberately fault-tolerant, which is a documented divergence from the reference
 * pattern: there, loadBrandModule() is awaited bare during eager load, so a registered
 * brand whose module file is missing rejects before the page is decorated, the body never
 * receives its `appear` class, and the result is a blank page with no useful error. Here
 * the failure is logged and the page renders with shared code.
 *
 * @param {string} brand The resolved brand key
 * @returns {Promise<object|null>} The brand's behaviour object, or null
 */
export async function loadBrandModule(brand) {
  const modulePath = BRAND_REGISTRY[brand];
  if (!modulePath) return null;
  try {
    const mod = await import(modulePath);
    return mod.default || mod;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`failed to load brand module for ${brand}`, error);
    return null;
  }
}
