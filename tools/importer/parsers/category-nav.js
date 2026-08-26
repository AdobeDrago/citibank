/* eslint-disable */
/* global WebImporter */
/**
 * Parser for variant: category-nav (NEW block — blocks/category-nav)
 * Authoring contract (one row per link):
 *   cell 1 = icon image (OPTIONAL)
 *   cell 2 = linked label
 *
 * Source: Citi PDP tds-category-nav-bar -> ul.nav-bar > li > a.category_nav_v2_item.
 * Each item has an inline <svg> icon (rendered by <cds-icon>, self-contained — no
 * external href/<use>) and a label (span.nav-text). The seven categories are: Explore
 * Cards, Balance Transfer Cards (4), Travel Cards (8), Rewards Cards (12), No Annual Fee
 * Cards (19), Cash Back Cards (3), Retail Cards (11). The section H2 ("Find the right
 * card for you") is authored as default content above the block.
 *
 * The icons are inline SVG (not <img>), so this parser converts each <svg> to a data-URI
 * <img> so the icon survives markdown/HTML import and renders via the block's
 * .category-nav-icon img styling.
 *
 * Source hrefs are SPA "javascript:void(0)" handlers; we emit the label as a link so
 * the whole item is clickable per the block decoration (blocks/category-nav.js), using
 * the source href when it is a real URL and falling back to "#" otherwise.
 */

// Convert an inline <svg> node to an <img> with a UTF-8 data URI so it survives import.
function svgToImg(svg, document, alt) {
  const clone = svg.cloneNode(true);
  if (!clone.getAttribute('xmlns')) clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const markup = clone.outerHTML;
  const img = document.createElement('img');
  img.src = `data:image/svg+xml;utf8,${encodeURIComponent(markup)}`;
  img.alt = alt || '';
  return img;
}

export default function parse(element, { document }) {
  const cells = [];

  const items = element.querySelectorAll(':scope ul.nav-bar > li, ul.nav-bar > li, li');

  items.forEach((li) => {
    const anchor = li.querySelector('a.category_nav_v2_item, a');
    if (!anchor) return;

    // Label text (strip nested spans/whitespace)
    const labelText = (anchor.querySelector('.nav-text') || anchor).textContent.replace(/\s+/g, ' ').trim();

    // Icon: prefer an authored <img>, else lift the inline <svg> into a data-URI <img>.
    let icon = li.querySelector('.icon-wrapper img, cds-icon img, img');
    if (!icon) {
      const svg = li.querySelector('.icon-wrapper svg, cds-icon svg, svg');
      if (svg) icon = svgToImg(svg, document, labelText);
    }

    if (!labelText && !icon) return;

    // Resolve href: keep real URLs, otherwise use "#" (source uses javascript:void(0)).
    const rawHref = anchor.getAttribute('href') || '';
    const href = /^https?:|^\//.test(rawHref) ? rawHref : '#';

    const link = document.createElement('a');
    link.href = href;
    link.textContent = labelText;

    const iconCell = icon ? [icon.closest('picture') || icon] : '';

    cells.push([iconCell, [link]]);
  });

  // Empty-block guard
  if (cells.length === 0) {
    element.replaceWith(...element.childNodes);
    return;
  }

  const block = WebImporter.Blocks.createBlock(document, { name: 'category-nav', cells });

  // Preserve the section heading ("Find the right card for you") as default content
  // above the block — it lives inside the parsed element (see page-templates.json
  // defaultContent selector), so emit it as a sibling so it is not lost.
  const headline = element.querySelector('h2.headline, .nav-container > h2, h2');
  if (headline) {
    const h = document.createElement('h2');
    h.append(...headline.childNodes);
    element.replaceWith(h, block);
  } else {
    element.replaceWith(block);
  }
}
