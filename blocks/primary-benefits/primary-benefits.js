/*
 * Primary Benefits Block
 * A row of image tiles, each showing a background photo with an overlaid heading
 * and a "+" control that expands to reveal additional detail (progressive disclosure).
 * Mirrors the Citi PDP "primary benefits" pattern
 * (e.g. "$0 liability on unauthorized charges", "Extended warranty", "Citi Merchant Offers").
 *
 * Authoring model: one row per tile.
 *   | Primary Benefits |                    |                              |
 *   | ---------------- | ------------------ | ---------------------------- |
 *   | (image)          | Tile heading       | Expandable detail (rich text)|
 *
 * The detail cell is optional. When present, a "+" toggle button is rendered and
 * the detail is hidden until expanded (accessible via keyboard + aria-expanded).
 */

import { createOptimizedPicture } from '../../scripts/aem.js';

function toId(text, i) {
  const slug = (text || `tile-${i}`)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return `primary-benefits-detail-${slug || i}`;
}

export default function decorate(block) {
  const ul = document.createElement('ul');
  ul.className = 'primary-benefits-list';

  [...block.children].forEach((row, i) => {
    const [imageCell, headingCell, detailCell] = row.children;

    const li = document.createElement('li');
    li.className = 'primary-benefits-tile';

    // image (background photo)
    if (imageCell) {
      imageCell.className = 'primary-benefits-image';
      li.append(imageCell);
    }

    // overlaid content (heading + optional toggle + detail)
    const content = document.createElement('div');
    content.className = 'primary-benefits-content';

    if (headingCell) {
      headingCell.className = 'primary-benefits-heading';
      content.append(headingCell);
    }

    const label = headingCell ? headingCell.textContent.trim() : `benefit ${i + 1}`;
    const hasDetail = detailCell && detailCell.textContent.trim() !== '';
    if (hasDetail) {
      // Interactive "+" toggle that expands the detail (progressive disclosure).
      const detailId = toId(headingCell ? headingCell.textContent : '', i);

      const toggle = document.createElement('button');
      toggle.className = 'primary-benefits-toggle';
      toggle.type = 'button';
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-controls', detailId);
      toggle.setAttribute('aria-label', `View additional information about ${label}`);

      detailCell.className = 'primary-benefits-detail';
      detailCell.id = detailId;
      detailCell.hidden = true;

      toggle.addEventListener('click', () => {
        const expanded = toggle.getAttribute('aria-expanded') === 'true';
        toggle.setAttribute('aria-expanded', String(!expanded));
        detailCell.hidden = expanded;
        li.classList.toggle('primary-benefits-tile--open', !expanded);
      });

      content.append(toggle);
      content.append(detailCell);
    } else {
      // No expandable detail authored — render the "+" as a static decorative
      // marker (matches the source, which shows the circle on every tile).
      const marker = document.createElement('span');
      marker.className = 'primary-benefits-toggle primary-benefits-marker';
      marker.setAttribute('aria-hidden', 'true');
      content.append(marker);
    }

    li.append(content);
    ul.append(li);
  });

  // optimize any authored images
  ul.querySelectorAll('picture > img').forEach((img) => {
    img.closest('picture').replaceWith(
      createOptimizedPicture(img.src, img.alt, false, [{ width: '750' }]),
    );
  });

  block.replaceChildren(ul);
}
