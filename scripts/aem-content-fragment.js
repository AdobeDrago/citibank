/**
 * AEM Content Fragment GraphQL client (browser).
 *
 * Uses the same publish endpoints as app-builder/byom-cc:
 * - Persisted GET:  /graphql/execute.json/cf-services/ccbypath;path=…
 * - Raw POST:       /content/_cq_graphql/cf-services/endpoint.json (heroByPath)
 *
 * AEM publish must allow CORS for the site origin (localhost:3000, *.aem.page,
 * *.aem.live). Without Access-Control-Allow-Origin, the browser blocks the response.
 */

export const AEM_PUBLISH_ORIGIN = 'https://publish-p199056-e2062160.adobeaemcloud.com';

/** Credit-card persisted query (GET). */
export const CREDIT_CARD_BY_PATH_URL = `${AEM_PUBLISH_ORIGIN}/graphql/execute.json/cf-services/ccbypath;path=`;

/** Raw GraphQL endpoint for models without a persisted GET (e.g. Hero). */
export const GRAPHQL_ENDPOINT = `${AEM_PUBLISH_ORIGIN}/content/_cq_graphql/cf-services/endpoint.json`;

export const HERO_BY_PATH_QUERY = `
query HeroByPath($path: String!) {
  heroByPath(_path: $path) {
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
 * Hero fragments (…-hero) use heroByPath POST; other DAM paths use ccbypath GET.
 * @param {string} cfPath
 * @returns {'hero'|'credit-card'}
 */
export function resolveQueryKind(cfPath) {
  return /-hero$/i.test(cfPath.split('/').pop() || '') ? 'hero' : 'credit-card';
}

/**
 * @param {string} cfPath
 * @param {AbortSignal} [signal]
 * @returns {Promise<object>}
 */
async function fetchHeroByPath(cfPath, signal) {
  const response = await fetch(GRAPHQL_ENDPOINT, {
    method: 'POST',
    signal,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      query: HERO_BY_PATH_QUERY,
      variables: { path: cfPath },
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`AEM GraphQL HTTP ${response.status}`);
  }

  const gqlError = graphqlErrorMessage(payload);
  const item = extractTopmostItem(payload);
  if (!item) {
    throw new Error(gqlError || `No Content Fragment found for path: ${cfPath}`);
  }
  return item;
}

/**
 * @param {string} cfPath
 * @param {AbortSignal} [signal]
 * @returns {Promise<object>}
 */
async function fetchCreditCardByPath(cfPath, signal) {
  const response = await fetch(`${CREDIT_CARD_BY_PATH_URL}${cfPath}`, { signal });
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
 * @param {AbortSignal} [signal]
 * @returns {Promise<object>}
 */
export async function getContentFragmentByPath(cfPath, signal) {
  if (!isValidCfPath(cfPath)) {
    throw new Error('Invalid Content Fragment path. Use a /content/dam/… path.');
  }

  if (resolveQueryKind(cfPath) === 'hero') {
    return fetchHeroByPath(cfPath, signal);
  }
  return fetchCreditCardByPath(cfPath, signal);
}
