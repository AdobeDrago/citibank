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

function headingId(text, i) {
  const slug = (text || `tile-${i}`)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return `primary-benefits-heading-${slug || i}`;
}

function setToggleLabel(toggle, label, expanded) {
  const verb = expanded ? 'Close' : 'View';
  toggle.setAttribute('aria-label', `${verb} additional information about ${label}`);
}

function setExpanded(tile, toggle, detail, label, expanded) {
  toggle.setAttribute('aria-expanded', String(expanded));
  setToggleLabel(toggle, label, expanded);
  detail.setAttribute('aria-hidden', String(!expanded));
  if (expanded) detail.removeAttribute('inert');
  else detail.setAttribute('inert', '');
  tile.classList.toggle('primary-benefits-tile-open', expanded);
}

function ensureHeadingId(headingCell, label, i) {
  const heading = headingCell?.querySelector('h1, h2, h3, h4, h5, h6') || headingCell;
  if (!heading) return null;
  if (!heading.id) heading.id = headingId(label, i);
  return heading.id;
}

export default function decorate(block) {
  const ul = document.createElement('ul');
  ul.className = 'primary-benefits-list';

  [...block.children].forEach((row, i) => {
    const [imageCell, headingCell, detailCell] = row.children;

    const li = document.createElement('li');
    li.className = 'primary-benefits-tile';

    // image (background photo) — omit empty cells; solid blue fallback when no photo
    const hasImage = imageCell && imageCell.querySelector('img, picture');
    if (hasImage) {
      imageCell.className = 'primary-benefits-image';
      li.append(imageCell);
    } else {
      li.classList.add('primary-benefits-tile-no-image');
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
      const detailId = toId(headingCell ? headingCell.textContent : '', i);
      const labelledBy = ensureHeadingId(headingCell, label, i);

      const toggle = document.createElement('button');
      toggle.className = 'primary-benefits-toggle';
      toggle.type = 'button';
      toggle.setAttribute('aria-controls', detailId);

      detailCell.className = 'primary-benefits-detail';
      detailCell.id = detailId;
      detailCell.setAttribute('role', 'region');
      if (labelledBy) detailCell.setAttribute('aria-labelledby', labelledBy);

      // Wrap children so grid 0fr/1fr height animation has a single track.
      const inner = document.createElement('div');
      inner.className = 'primary-benefits-detail-inner';
      inner.append(...detailCell.childNodes);
      detailCell.append(inner);

      setExpanded(li, toggle, detailCell, label, false);

      toggle.addEventListener('click', () => {
        const expanded = toggle.getAttribute('aria-expanded') === 'true';
        setExpanded(li, toggle, detailCell, label, !expanded);
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

  // Escape closes the tile that owns focus (live dismiss pattern).
  ul.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    const openToggle = event.target.closest?.('.primary-benefits-tile-open .primary-benefits-toggle');
    if (!openToggle || openToggle.getAttribute('aria-expanded') !== 'true') return;
    const tile = openToggle.closest('.primary-benefits-tile');
    const detail = tile?.querySelector('.primary-benefits-detail');
    const label = tile?.querySelector('.primary-benefits-heading')?.textContent?.trim() || 'benefit';
    if (!tile || !detail) return;
    setExpanded(tile, openToggle, detail, label, false);
    openToggle.focus();
  });

  // optimize any authored images
  ul.querySelectorAll('picture > img').forEach((img) => {
    img.closest('picture').replaceWith(
      createOptimizedPicture(img.src, img.alt, false, [{ width: '750' }]),
    );
  });

  block.replaceChildren(ul);
}
