/*
 * Fragment Block
 * Include content on a page as a fragment.
 * https://www.aem.live/developer/block-collection/fragment
 */

// eslint-disable-next-line import/no-cycle
import {
  decorateMain,
} from '../../scripts/scripts.js';

import {
  loadSections,
} from '../../scripts/aem.js';

/**
 * Loads a fragment.
 * @param {string} path The path to the fragment
 * @returns {HTMLElement} The root element of the fragment
 */
export async function loadFragment(path) {
  if (path && path.startsWith('/') && !path.startsWith('//')) {
    // The site ROOT is the canonical fragment location: on DA/EDS production the
    // content is mounted at `/`, so `/content` must NOT be assumed. Normalize any
    // authored `/content` prefix away to get the root-relative path, then resolve:
    //   - production (page NOT under /content/): fetch the root path only.
    //   - localhost `aem up` (page under /content/): try the `/content` copy
    //     first, then fall back to the root path.
    // This works whether the link was authored root-relative (/fragments/…) or
    // with a stray /content prefix, and never breaks production on a /content path.
    const rootPath = path.replace(/^\/content(?=\/)/, '');
    const onContent = window.location.pathname.startsWith('/content/');
    const candidates = onContent
      ? [`/content${rootPath}`, rootPath]
      : [rootPath];
    let resp;
    let resolvedPath = rootPath;
    // eslint-disable-next-line no-restricted-syntax
    for (const candidate of candidates) {
      // eslint-disable-next-line no-await-in-loop
      const r = await fetch(`${candidate}.plain.html`);
      if (r.ok) { resp = r; resolvedPath = candidate; break; }
    }
    if (resp && resp.ok) {
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
    }
  }
  return null;
}

export default async function decorate(block) {
  const link = block.querySelector('a');
  const path = link ? link.getAttribute('href') : block.textContent.trim();
  const fragment = await loadFragment(path);
  if (fragment) block.replaceChildren(...fragment.childNodes);
}
