/*
 * Credit Cards Fragment Block
 * Like the standard Fragment block, but resolves to a segment-specific child
 * page first (e.g. .../aadvantage-mile-up-credit-card-seg-b, or -default
 * when no ecid cookie is set) before falling back to the authored path.
 */

import {
  decorateMain,
} from '../../scripts/scripts.js';

import {
  loadSections,
} from '../../scripts/aem.js';

import { getEcid } from '../../scripts/offer-sheet.js';

// A fragment's content is decorated the same way a real page is — including
// any fragment block nested inside it — so a page that (by authoring
// mistake) embeds itself, directly or through a longer chain, would
// otherwise recurse until the browser gives up. Tracks root paths currently
// being resolved, up the call stack, so a repeat mid-recursion is refused.
const loadingPaths = new Set();

/**
 * Loads a fragment, preferring a segment-specific variant of the authored path.
 * @param {string} path The path to the fragment
 * @returns {HTMLElement} The root element of the fragment
 */
export async function loadCcFragment(path) {
  // Document Authoring stores a pasted link as a fully-qualified URL (its own
  // preview/live host), not a root-relative path — resolve to just the
  // pathname first so both forms work, the same normalization the
  // `/fragments/` auto-block already does via `new URL(fragment.href)`.
  let pathname;
  try {
    pathname = path ? new URL(path, window.location.href).pathname : null;
  } catch (e) {
    pathname = null;
  }
  if (!pathname || !pathname.startsWith('/') || pathname.startsWith('//')) return null;

  // The site ROOT is the canonical fragment location: on DA/EDS production the
  // content is mounted at `/`, so `/content` must NOT be assumed. Normalize any
  // authored `/content` prefix away to get the root-relative path, then resolve:
  //   - production (page NOT under /content/): fetch the root path only.
  //   - localhost `aem up` (page under /content/): try the `/content` copy
  //     first, then fall back to the root path.
  // This works whether the link was authored root-relative (/fragments/…) or
  // with a stray /content prefix, and never breaks production on a /content path.
  const rootPath = pathname.replace(/^\/content(?=\/)/, '');
  if (loadingPaths.has(rootPath)) {
    // eslint-disable-next-line no-console
    console.warn('[cc-fragment] refusing to load a fragment already being resolved (self/cyclic reference):', rootPath);
    return null;
  }

  const onContent = window.location.pathname.startsWith('/content/');
  const candidatesFor = (aPath) => (onContent ? [`/content${aPath}`, aPath] : [aPath]);

  // Segment-specific variant, e.g. .../aadvantage-mile-up-credit-card ->
  // .../aadvantage-mile-up-credit-card/aadvantage-mile-up-credit-card-seg-b
  // — an authored child page named after the segment, or "-default" when
  // no ecid cookie is set. Tried first so it wins when authored; falls
  // back to the base path candidates otherwise.
  const lastSegment = rootPath.split('/').filter(Boolean).pop();
  const segmentSuffix = getEcid() || 'default';
  const variantPath = lastSegment ? `${rootPath}/${lastSegment}-${segmentSuffix}` : null;

  const candidates = [
    ...(variantPath ? candidatesFor(variantPath) : []),
    ...candidatesFor(rootPath),
  ];
  let resp;
  let resolvedPath = rootPath;
  // eslint-disable-next-line no-restricted-syntax
  for (const candidate of candidates) {
    // eslint-disable-next-line no-await-in-loop
    const r = await fetch(`${candidate}.plain.html`);
    if (r.ok) { resp = r; resolvedPath = candidate; break; }
  }
  if (!resp || !resp.ok) return null;

  loadingPaths.add(rootPath);
  try {
    const main = document.createElement('main');
    main.innerHTML = await resp.text();

    // reset base path for media to fragment base
    const resetAttributeBase = (tag, attr) => {
      main.querySelectorAll(`${tag}[${attr}^="./media_"]`).forEach((elem) => {
        const fragBase = new URL(resolvedPath, window.location);
        elem[attr] = new URL(elem.getAttribute(attr), fragBase).href;
      });
    };
    resetAttributeBase('img', 'src');
    resetAttributeBase('source', 'srcset');

    decorateMain(main);
    await loadSections(main);
    return main;
  } finally {
    loadingPaths.delete(rootPath);
  }
}

export default async function decorate(block) {
  const link = block.querySelector('a');
  const path = link ? link.getAttribute('href') : block.textContent.trim();
  const fragment = await loadCcFragment(path);
  if (fragment) block.replaceChildren(...fragment.childNodes);
}
