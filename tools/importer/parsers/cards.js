/* eslint-disable */
/* global WebImporter */
/**
 * Parser for variant: cards
 * Base block: cards (2 columns: cell 1 = image/icon, cell 2 = title + description + optional CTA).
 * Each source item becomes one row.
 *
 * Handles THREE Citi PDP instances (union selectors from page-templates.json):
 *   1. tds-content-grid nth(1) "Your points. Your way" -> icon (inline SVG) + H3 + paragraph
 *   2. tds-drawer .benefits-container                  -> icon (inline SVG) + H3 + paragraph
 *   3. tds-content-grid nth(2) "You may also like"     -> card-art image + H3 + "Card details" link
 *
 * The section H2 ("Your points. Your way" / "You may also like") lives in a
 * .grid-header-container column; it is lifted out and emitted as default-content
 * heading above the block (see element.replaceWith at the end).
 *
 * Icons in the "Your points. Your way" grid and the drawer benefits are inline
 * <svg> (rendered by <cds-icon>), not <img>. They are converted to data-URI <img>
 * so they survive the import and render via the block's image cell.
 */

// Convert an inline <svg> to an <img> with a UTF-8 data URI so it survives import.
function svgToImg(svg, document, alt) {
  const clone = svg.cloneNode(true);
  if (!clone.getAttribute('xmlns')) clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const img = document.createElement('img');
  img.src = `data:image/svg+xml;utf8,${encodeURIComponent(clone.outerHTML)}`;
  img.alt = alt || '';
  return img;
}

export default function parse(element, { document }) {
  const cells = [];

  // Move an <img>/<picture> into a fresh cell, preserving alt/src (incl. data-URI SVG icons)
  const imageCell = (imgOrPic) => {
    if (!imgOrPic) return '';
    const pic = imgOrPic.closest && imgOrPic.closest('picture');
    return [pic || imgOrPic];
  };

  const buildBodyCell = (heading, description, link) => {
    const cell = [];
    if (heading) cell.push(heading);
    if (description) {
      const p = document.createElement('p');
      p.append(...description.childNodes);
      cell.push(p);
    }
    if (link) {
      const a = document.createElement('a');
      a.href = link.getAttribute('href') || '';
      a.textContent = link.textContent.replace(/\s+/g, ' ').trim();
      cell.push(a);
    }
    return cell.length ? cell : '';
  };

  const tag = element.tagName.toLowerCase();

  // Section H2 ("Your points. Your way" / "You may also like"): lives in a
  // .grid-header-container column, emitted as default content above the block.
  const sectionH2 = element.querySelector('.grid-header-container h2, .heading h2, h2.feature-text, h2');

  if (tag === 'tds-content-grid') {
    // Instances 1 & 3: grid columns (skip the header column that holds the H2).
    element.querySelectorAll(':scope cds-column.grid-items-3, :scope .grid-items-container cds-column').forEach((col) => {
      if (col.classList.contains('grid-header-container') || col.querySelector(':scope > .heading, :scope > div.heading')) return;
      // Prefer a real card-art image; fall back to an <img>, else the inline SVG icon.
      let cardImg = col.querySelector('.icon-wrapper img.img-recommended-cards')
        || col.querySelector('.icon-wrapper > img')
        || col.querySelector('cds-icon img')
        || col.querySelector('img');
      const heading = col.querySelector('.item-heading h3, h3');
      let img = imageCell(cardImg);
      if (img === '') {
        const svg = col.querySelector('.icon-wrapper svg, cds-icon svg, svg');
        if (svg) img = [svgToImg(svg, document, heading ? heading.textContent.trim() : '')];
      }
      const description = col.querySelector('p.item-description, p');
      const link = col.querySelector('tds-cta-section a.cds-button, tds-cta-section a, a.cds-button-inline-link');
      const body = buildBodyCell(heading, description, link);
      if (img === '' && body === '') return;
      cells.push([img, body]);
    });
  } else {
    // Instance 2: benefits-container of tds-drawer -> tds-benefit items
    const scope = element.classList.contains('benefits-container')
      ? element
      : element.querySelector('.benefits-container') || element;
    scope.querySelectorAll(':scope tds-benefit, tds-benefit').forEach((benefit) => {
      const icon = benefit.querySelector('.benefit-icon-container img, cds-icon img, img');
      const heading = benefit.querySelector('.benefit-header h3, h3, .item-heading');
      let img = imageCell(icon);
      if (img === '') {
        const svg = benefit.querySelector('.benefit-icon-container svg, cds-icon svg, svg');
        if (svg) img = [svgToImg(svg, document, heading ? heading.textContent.trim() : '')];
      }
      const description = benefit.querySelector('p.benefit-description, p');
      const body = buildBodyCell(heading, description, null);
      if (img === '' && body === '') return;
      cells.push([img, body]);
    });
  }

  // Empty-block guard
  if (cells.length === 0) {
    element.replaceWith(...element.childNodes);
    return;
  }

  const block = WebImporter.Blocks.createBlock(document, { name: 'cards', cells });

  // Emit the section H2 ("Your points. Your way" / "You may also like") as a
  // default-content heading immediately above the block so it is not lost.
  if (sectionH2 && sectionH2.textContent.trim()) {
    const h = document.createElement('h2');
    h.textContent = sectionH2.textContent.trim();
    element.replaceWith(h, block);
  } else {
    element.replaceWith(block);
  }
}
