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
    // Fragment paths are authored ROOT-relative (e.g. /fragments/heroes/…) so
    // they resolve on DA/EDS production, where content is mounted at the site
    // root. On localhost (`aem up`) this project serves content under /content/,
    // so try that prefix first there; production fetches the root path directly.
    const onContent = window.location.pathname.startsWith('/content/');
    const candidates = onContent && !path.startsWith('/content/')
      ? [`/content${path}`, path]
      : [path];
    let resp;
    let resolvedPath = path;
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
