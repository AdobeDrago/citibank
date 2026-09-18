/**
 * AEM Content Fragment GraphQL client (browser).
 *
 * Default host: Drago publish. Override with `?aemOrigin=` (e.g. local proxy)
 * for optional trials — does not auto-switch on localhost.
 *
 * - Credit cards: GET persisted query cf-services/ccbypathandvariation (path + variation)
 * - Hero (-hero paths): POST heroByPath(_path, variation)
 *
 * Expand persisted query `ccbypathandvariation` on publish to include the full CF field set
 * (hero, feerates, accelerate, features, primaryBenefits) for complete JSON.
 *
 * AEM publish must allow CORS for the site origin (localhost:3000, *.aem.page,
 * *.aem.live). Without Access-Control-Allow-Origin, the browser blocks the response.
 */

export const AEM_PUBLISH_ORIGIN = 'https://publish-p199056-e2062160.adobeaemcloud.com';

/** Persisted query name on cf-services (path + variation). */
export const CREDIT_CARD_PERSISTED_QUERY = 'ccbypathandvariation';

/**
 * Bump when the persisted query definition changes on AEM so CDN
 * (s-maxage ~2h) does not keep serving a stale short response.
 */
export const CREDIT_CARD_PERSISTED_QUERY_VERSION = 'rename-1';

const SEGMENT_COOKIE = 'ecid';
const LOGGED_IN_VARIATION = 'seg-a';
const DEFAULT_VARIATION = 'master';

/** @deprecated Prefer getGraphqlEndpoint() — kept for callers that expect a constant. */
export const GRAPHQL_ENDPOINT = `${AEM_PUBLISH_ORIGIN}/content/_cq_graphql/cf-services/endpoint.json`;

/** Full Credit Card model selection (path + variation). */
export const CREDIT_CARD_BY_PATH_QUERY = `
query CreditCardByPath($path: String!, $variation: String) {
  creditCardByPath(_path: $path, variation: $variation) {
    item {
      _path
      _id
      _variation
      eyeBrow
      title { plaintext html }
      image {
        ... on ImageRef { _path _publishUrl _dynamicUrl }
      }
      hero {
        body { html plaintext }
        backgroundImage {
          ... on ImageRef { _path _publishUrl _dynamicUrl }
        }
        copyImage {
          ... on ImageRef { _path _publishUrl _dynamicUrl }
        }
      }
      feerates {
        headline { html plaintext }
        body { html plaintext }
      }
      accelerate {
        headline { html plaintext }
        body { html plaintext }
      }
      features {
        title { html plaintext }
        body { html plaintext }
        image {
          ... on ImageRef { _path _publishUrl _dynamicUrl }
        }
      }
      primaryBenefits {
        title { html plaintext }
        body { html plaintext }
        image {
          ... on ImageRef { _path _publishUrl _dynamicUrl }
        }
      }
    }
  }
}
`;

export const HERO_BY_PATH_QUERY = `
query HeroByPath($path: String!, $variation: String) {
  heroByPath(_path: $path, variation: $variation) {
    item {
      _path
      _id
      _variation
      body { html plaintext }
      backgroundImage {
        ... on ImageRef { _path _publishUrl _dynamicUrl }
      }
      copyImage {
        ... on ImageRef { _path _publishUrl _dynamicUrl }
      }
    }
  }
}
`;

const DAM_PATH_RE = /^\/content\/dam\/[A-Za-z0-9/_-]+$/;
const ALLOWED_ORIGIN_RE = /^https?:\/\/[A-Za-z0-9.-]+(?::\d+)?$/;

/**
 * GraphQL origin: Drago publish by default; `?aemOrigin=` for optional local proxy.
 * @returns {string}
 */
export function getAemOrigin() {
  try {
    const override = new URLSearchParams(window.location.search).get('aemOrigin');
    if (override && ALLOWED_ORIGIN_RE.test(override)) {
      return new URL(override).origin;
    }
  } catch {
    /* ignore invalid override */
  }
  return AEM_PUBLISH_ORIGIN;
}

/**
 * @returns {string}
 */
export function getGraphqlEndpoint() {
  return `${getAemOrigin()}/content/_cq_graphql/cf-services/endpoint.json`;
}

/**
 * Persisted credit-card query URL (AEM execute.json + semicolon variables).
 * Appends ?v= so Fastly/CDN does not reuse a stale cached body after the
 * persisted query definition is updated on publish.
 * @param {string} cfPath
 * @param {string} variation
 * @returns {string}
 */
export function getCreditCardPersistedQueryUrl(cfPath, variation) {
  return `${getAemOrigin()}/graphql/execute.json/cf-services/${CREDIT_CARD_PERSISTED_QUERY};path=${cfPath};variation=${variation}?v=${CREDIT_CARD_PERSISTED_QUERY_VERSION}`;
}

/**
 * CF variation for the current visitor: `seg-a` when the simulated `ecid`
 * cookie is `seg-a` (same signal as `auth.js`); otherwise `master`.
 * @returns {string}
 */
export function resolveContentFragmentVariation() {
  const match = document.cookie.match(new RegExp(`(?:^|; )${SEGMENT_COOKIE}=([^;]*)`));
  const ecid = match ? decodeURIComponent(match[1]) : '';
  return ecid === LOGGED_IN_VARIATION ? LOGGED_IN_VARIATION : DEFAULT_VARIATION;
}

/**
 * @param {string} cfPath
 * @returns {boolean}
 */
export function isValidCfPath(cfPath) {
  return typeof cfPath === 'string'
    && cfPath.length > 0
    && cfPath.length <= 512
    && !cfPath.includes('..')
    && DAM_PATH_RE.test(cfPath);
}

/**
 * Breadth-first search for the shallowest `item` on an AEM GraphQL payload.
 * @param {*} root
 * @returns {object|null}
 */
export function extractTopmostItem(root) {
  if (!root || typeof root !== 'object') return null;
  const queue = [root];
  while (queue.length) {
    const node = queue.shift();
    if (
      node
      && typeof node === 'object'
      && !Array.isArray(node)
      && Object.prototype.hasOwnProperty.call(node, 'item')
    ) {
      return node.item;
    }
    const children = Array.isArray(node) ? node : Object.values(node);
    children.forEach((value) => {
      if (value && typeof value === 'object') queue.push(value);
    });
  }
  return null;
}

function graphqlErrorMessage(payload) {
  const first = Array.isArray(payload?.errors) ? payload.errors[0] : null;
  return first?.message || '';
}

/**
 * Hero fragments (…-hero) use heroByPath; other DAM paths use creditCardByPath.
 * @param {string} cfPath
 * @returns {'hero'|'credit-card'}
 */
export function resolveQueryKind(cfPath) {
  return /-hero$/i.test(cfPath.split('/').pop() || '') ? 'hero' : 'credit-card';
}

/**
 * @param {string} query
 * @param {object} variables
 * @param {AbortSignal} [signal]
 * @returns {Promise<object>}
 */
async function postGraphql(query, variables, signal) {
  const response = await fetch(getGraphqlEndpoint(), {
    method: 'POST',
    signal,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`AEM GraphQL HTTP ${response.status}`);
  }
  return payload;
}

/**
 * @param {string} cfPath
 * @param {string} variation
 * @param {AbortSignal} [signal]
 * @returns {Promise<object>}
 */
async function fetchHeroByPath(cfPath, variation, signal) {
  const payload = await postGraphql(
    HERO_BY_PATH_QUERY,
    { path: cfPath, variation },
    signal,
  );
  const gqlError = graphqlErrorMessage(payload);
  const item = extractTopmostItem(payload);
  if (!item) {
    throw new Error(gqlError || `No Content Fragment found for path: ${cfPath}`);
  }
  return item;
}

/**
 * Credit card CF via persisted query GET (cf-services/ccbypathandvariation).
 * @param {string} cfPath
 * @param {string} variation
 * @param {AbortSignal} [signal]
 * @returns {Promise<object>}
 */
async function fetchCreditCardByPath(cfPath, variation, signal) {
  const response = await fetch(getCreditCardPersistedQueryUrl(cfPath, variation), { signal });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`AEM GraphQL HTTP ${response.status}`);
  }

  const gqlError = graphqlErrorMessage(payload);
  const item = extractTopmostItem(payload);
  if (!item || !Object.values(item).some((v) => v != null)) {
    throw new Error(gqlError || `No Content Fragment found for path: ${cfPath}`);
  }
  return item;
}

/**
 * Load a published Content Fragment by DAM path via AEM GraphQL.
 * @param {string} cfPath
 * @param {{ variation?: string, signal?: AbortSignal }|AbortSignal} [options]
 * @returns {Promise<object>}
 */
export async function getContentFragmentByPath(cfPath, options = {}) {
  if (!isValidCfPath(cfPath)) {
    throw new Error('Invalid Content Fragment path. Use a /content/dam/… path.');
  }

  const signal = options instanceof AbortSignal ? options : options.signal;
  const variation = options instanceof AbortSignal
    ? DEFAULT_VARIATION
    : (options.variation || DEFAULT_VARIATION);

  if (resolveQueryKind(cfPath) === 'hero') {
    return fetchHeroByPath(cfPath, variation, signal);
  }
  return fetchCreditCardByPath(cfPath, variation, signal);
}
