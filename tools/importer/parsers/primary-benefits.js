/* eslint-disable */
/* global WebImporter */
/**
 * Parser for variant: primary-benefits (NEW block — blocks/primary-benefits)
 * Authoring contract (one row per tile):
 *   cell 1 = background image
 *   cell 2 = tile heading
 *   cell 3 = expandable detail (rich text, OPTIONAL)
 *
 * Source: Citi PDP tds-primary-benefits -> tds-primary-benefit tiles. Each tile's photo
 * is applied as a CSS background-image (a DAM .webp URL) on the .primaryBenefits-container
 * inline style — NOT an <img> element — behind a flat dark scrim, with an overlaid H3
 * heading ("$0 liability on unauthorized charges", "Extended warranty", "Citi® Merchant
 * Offers"). This parser lifts that background URL into a real <img> so the tile photo
 * survives the import (block CSS renders .primary-benefits-image img cover). The detail
 * body is not present in the SSR DOM, so the optional detail cell is emitted empty for
 * authors to fill in.
 *
 * Cell order and count match blocks/primary-benefits/primary-benefits.js decoration
 * (row.children -> [imageCell, headingCell, detailCell]).
 */

// Pull the first non-gradient url() out of a background / background-image value.
// Citi tiles use: linear-gradient(...54%), url("https://aemapi.citi.com/.../benefit-tile--x.webp") ...
function bgUrlFrom(styleValue) {
  if (!styleValue) return '';
  const matches = [...styleValue.matchAll(/url\((['"]?)([^'")]+)\1\)/g)];
  const hit = matches.find((m) => /^https?:|^\/\//.test(m[2]) || m[2].includes('/content/dam/'));
  return hit ? hit[2] : (matches[0] ? matches[0][2] : '');
}

export default function parse(element, { document }) {
  const cells = [];

  const tiles = element.querySelectorAll(':scope tds-primary-benefit, tds-primary-benefit');

  tiles.forEach((tile, i) => {
    // Background image: prefer an authored <img>, else lift the CSS background-image URL
    // from the tile container's inline style into a real <img>.
    let bgImg = tile.querySelector('.primaryBenefits-container > img, .main-pb-container img:not(.state-icon img)')
      || tile.querySelector('img');

    if (!bgImg) {
      const bgHost = tile.querySelector('.primaryBenefits-container, [style*="url("]');
      const url = bgHost ? bgUrlFrom(bgHost.getAttribute('style')) : '';
      if (url) {
        bgImg = document.createElement('img');
        bgImg.src = url;
        const h = tile.querySelector('h3');
        bgImg.alt = h ? h.textContent.trim() : `benefit ${i + 1}`;
      }
    }

    // Heading (overlaid tile title)
    const heading = tile.querySelector('.benefit-header h3, h3.item-heading, h3');

    if (!bgImg && !heading) return;

    const imageCell = bgImg ? [bgImg] : '';

    const headingCell = [];
    if (heading) {
      const h = document.createElement('h3');
      h.append(...heading.childNodes);
      headingCell.push(h);
    }

    // Optional detail: present if the tile exposes expandable body copy.
    const detail = tile.querySelector('.primaryBenefits-detail, .benefit-description, .body-text');
    const detailCell = [];
    if (detail && detail.textContent.trim() !== '') {
      const p = document.createElement('p');
      p.append(...detail.childNodes);
      detailCell.push(p);
    }

    // 3-column row; keep the optional detail cell present (empty string) for consistent width.
    cells.push([imageCell, headingCell.length ? headingCell : '', detailCell.length ? detailCell : '']);
  });

  // Empty-block guard
  if (cells.length === 0) {
    element.replaceWith(...element.childNodes);
    return;
  }

  const block = WebImporter.Blocks.createBlock(document, { name: 'primary-benefits', cells });
  element.replaceWith(block);
}
