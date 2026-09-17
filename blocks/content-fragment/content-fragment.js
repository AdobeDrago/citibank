/**
 * Content Fragment block — fetches a published AEM CF via GraphQL.
 *
 * Authored structure (DA table):
 *   Two-column rows (preferred):
 *     Heading | <display title>
 *     Content fragment path | /content/dam/...
 *   Or one cell per row: heading, then DAM path.
 *
 * GraphQL (Drago publish by default; `?aemOrigin=` optional override):
 *   - Paths ending in -hero → POST heroByPath(_path, variation)
 *   - Other paths → POST creditCardByPath(_path, variation)
 *   - Logged out → variation `master`; logged in (`ecid=seg-a`) → `seg-a`
 *
 * AEM publish must send CORS headers for the page origin, or the browser blocks
 * the GraphQL response.
 *
 * Drago prerequisite: publish a `seg-a` variation on the authored CF (e.g.
 * /content/dam/cf-services/ccc-cf/citi-double-cash) so login visibly changes
 * the card; without it AEM may return master for both states.
 */

import {
  getContentFragmentByPath,
  resolveContentFragmentVariation,
} from '../../scripts/aem-content-fragment.js';

const DEFAULT_TITLE = 'Content fragment';
const DAM_PATH_PREFIX = '/content/dam/';
const PATH_LABEL_RE = /path/;
const TITLE_LABEL_RE = /heading|title/;
const CELL_WS_RE = /\s+/g;

function isAuthoringHost() {
  const { hostname } = window.location;
  return /aem\.(page|live)$/.test(hostname)
    || /da\.live$/.test(hostname)
    || /enablementadobe\.com$/.test(hostname);
}

function cellText(el) {
  return (el?.textContent || '').replace(CELL_WS_RE, ' ').trim();
}

function isPathLabel(label) {
  return PATH_LABEL_RE.test(String(label || '').toLowerCase());
}

function isTitleLabel(label) {
  return TITLE_LABEL_RE.test(String(label || '').toLowerCase());
}

function readBlockContent(block) {
  let title = '';
  let cfPath = '';
  const unlabeled = [];

  [...block.children].forEach((row) => {
    const cells = [...row.children].map((cell) => cellText(cell));
    if (cells.length >= 2 && (isPathLabel(cells[0]) || isTitleLabel(cells[0]))) {
      const [label, value] = cells;
      if (isPathLabel(label)) cfPath = value;
      else title = value;
      return;
    }
    unlabeled.push(cells[cells.length - 1] || '');
  });

  if (!cfPath) {
    cfPath = unlabeled.find((value) => value.startsWith(DAM_PATH_PREFIX)) || unlabeled[1] || '';
  }
  if (!title) {
    title = unlabeled.find((value) => value && !value.startsWith(DAM_PATH_PREFIX)) || '';
  }

  return {
    title: title || DEFAULT_TITLE,
    cfPath,
  };
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatError(err) {
  const message = err?.message || '';

  if (message === 'Failed to fetch' || err?.name === 'TypeError') {
    return {
      title: 'Content service unavailable',
      message: 'The browser could not reach AEM GraphQL (often a CORS block).',
      hint: isAuthoringHost() || window.location.hostname === 'localhost'
        ? 'Enable CORS on the AEM publish GraphQL endpoint for this origin (localhost:3000 / *.aem.page / *.aem.live).'
        : null,
    };
  }

  return {
    title: 'Unable to load content',
    message: message || 'Something went wrong. Please try again.',
    hint: null,
  };
}

function stripTags(html) {
  return String(html || '')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .trim();
}

function fragmentTitle(item) {
  if (!item || typeof item !== 'object') return '';
  const html = item.body?.html || '';
  const heading = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (heading) return stripTags(heading[1]);
  if (typeof item.title === 'string') return item.title;
  return item.title?.plaintext || '';
}

function fragmentEyebrow(item) {
  if (!item || typeof item !== 'object') return '';
  if (item.eyeBrow) return item.eyeBrow;
  if (item.eyebrow) return item.eyebrow;
  const html = (item.body?.html || '').replace(/<p>\s*<img[\s\S]*?<\/p>/i, '');
  const paragraph = html.match(/<p>([\s\S]*?)<\/p>/i);
  if (paragraph && !paragraph[1].includes('<')) return stripTags(paragraph[1]);
  return '';
}

function fragmentImageUrl(item) {
  /* AEM GraphQL image refs use _publishUrl */
  const copyImage = item?.copyImage;
  const image = item?.image;
  // eslint-disable-next-line no-underscore-dangle
  return copyImage?._publishUrl || image?._publishUrl || '';
}

function renderError(container, error) {
  const { title, message, hint } = typeof error === 'string'
    ? { title: 'Unable to load content', message: error, hint: null }
    : error;

  container.innerHTML = `
    <div class="content-fragment-alert" role="alert">
      <p class="content-fragment-alert-title">${escapeHtml(title)}</p>
      <p class="content-fragment-alert-message">${escapeHtml(message)}</p>
      ${hint ? `<p class="content-fragment-alert-hint">${escapeHtml(hint)}</p>` : ''}
    </div>
  `;
}

function renderLoading(container) {
  container.innerHTML = `
    <div class="content-fragment-loading" role="status">
      <span class="content-fragment-spinner" aria-hidden="true"></span>
      <p>Loading content fragment...</p>
    </div>
  `;
}

function renderItem(container, item, variation) {
  const title = fragmentTitle(item);
  const eyebrow = fragmentEyebrow(item);
  const imageUrl = fragmentImageUrl(item);
  // eslint-disable-next-line no-underscore-dangle
  const resolvedVariation = item?._variation || variation;

  if (!title) {
    renderError(container, {
      title: 'Content fragment incomplete',
      message: 'The fragment loaded but did not include a title field.',
      hint: null,
    });
    return;
  }

  container.innerHTML = `
    <article class="content-fragment-card">
      ${imageUrl ? `<img class="content-fragment-card-art" src="${escapeHtml(imageUrl)}" alt="">` : ''}
      ${eyebrow ? `<p class="content-fragment-eyebrow">${escapeHtml(eyebrow)}</p>` : ''}
      <h4 class="content-fragment-card-title">${escapeHtml(title)}</h4>
      ${isAuthoringHost() || window.location.hostname === 'localhost'
    ? `<p class="content-fragment-variation">Variation: ${escapeHtml(resolvedVariation)}</p>`
    : ''}
    </article>
  `;
}

/**
 * @param {Element} result
 * @param {string} cfPath
 * @param {AbortController} [controller]
 */
async function loadFragment(result, cfPath, controller) {
  const variation = resolveContentFragmentVariation();
  renderLoading(result);

  try {
    const item = await getContentFragmentByPath(cfPath, {
      variation,
      signal: controller?.signal,
    });
    renderItem(result, item, variation);
  } catch (err) {
    if (err?.name === 'AbortError') return;
    renderError(result, formatError(err));
  }
}

/**
 * loads and decorates the block
 * @param {Element} block The block element
 */
export default async function decorate(block) {
  const { title, cfPath } = readBlockContent(block);

  block.innerHTML = `
    <div class="content-fragment-intro">
      <p class="content-fragment-kicker">AEM Content Fragment</p>
      <h3 class="content-fragment-title">${escapeHtml(title)}</h3>
      <p class="content-fragment-subtitle">Loaded from AEM GraphQL by Content Fragment path (master anonymous, seg-a after login).</p>
    </div>
    <div class="content-fragment-result" aria-live="polite"></div>
  `;

  const result = block.querySelector('.content-fragment-result');

  if (!cfPath) {
    renderError(result, {
      title: 'Content fragment path required',
      message: 'Author a DAM path in this block (row labeled Content fragment path).',
      hint: isAuthoringHost()
        ? 'Example: /content/dam/cf-services/ccc-cf/citi-double-cash'
        : null,
    });
    return;
  }

  let controller = new AbortController();
  const refetch = () => {
    controller.abort();
    controller = new AbortController();
    loadFragment(result, cfPath, controller).catch(() => { /* errors rendered in loadFragment */ });
  };

  document.addEventListener('authchange', refetch);
  await loadFragment(result, cfPath, controller);
}
