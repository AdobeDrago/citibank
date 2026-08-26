/*
 * Category Nav Block
 * A compact horizontal bar of icon + label category links, e.g. the Citi PDP
 * "Find the right card for you" navigation (Explore Cards, Balance Transfer Cards,
 * Travel Cards, Rewards Cards, ...).
 *
 * Authoring model: one row per category link.
 *   | Category Nav |                                  |
 *   | ------------ | -------------------------------- |
 *   | (icon image) | [Explore Cards](/credit-cards)   |
 *   | (icon image) | [Travel Cards (8)](/travel)      |
 *
 * Cell 1 = icon image (optional). Cell 2 = label; if it contains a link the whole
 * item becomes clickable, otherwise it renders as plain text.
 */

import { createOptimizedPicture } from '../../scripts/aem.js';

export default function decorate(block) {
  const nav = document.createElement('nav');
  nav.className = 'category-nav-bar';
  nav.setAttribute('aria-label', 'Card categories');

  const ul = document.createElement('ul');
  ul.className = 'category-nav-list';

  [...block.children].forEach((row) => {
    const [iconCell, labelCell] = row.children;

    const li = document.createElement('li');
    li.className = 'category-nav-item';

    const link = labelCell ? labelCell.querySelector('a') : null;
    // Container is an anchor when a link is authored, otherwise a span.
    const item = link ? document.createElement('a') : document.createElement('span');
    item.className = 'category-nav-link';
    if (link) {
      item.href = link.getAttribute('href');
      if (link.getAttribute('target')) item.target = link.getAttribute('target');
    }

    if (iconCell) {
      const icon = iconCell.querySelector('picture, img');
      if (icon) {
        const iconWrap = document.createElement('span');
        iconWrap.className = 'category-nav-icon';
        iconWrap.append(icon.closest('picture') || icon);
        item.append(iconWrap);
      }
    }

    const label = document.createElement('span');
    label.className = 'category-nav-label';
    label.textContent = (link ? link.textContent : (labelCell && labelCell.textContent) || '').trim();
    item.append(label);

    li.append(item);
    ul.append(li);
  });

  ul.querySelectorAll('picture > img').forEach((img) => {
    // Skip inline-SVG data-URI icons — createOptimizedPicture appends query params
    // that corrupt the data URI. Only raster images go through the image pipeline.
    if (img.src.startsWith('data:')) return;
    img.closest('picture').replaceWith(
      createOptimizedPicture(img.src, img.alt, false, [{ width: '100' }]),
    );
  });

  nav.append(ul);
  block.replaceChildren(nav);
}
