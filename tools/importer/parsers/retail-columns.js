/* eslint-disable */
/* global WebImporter */
/**
 * Parser for variant: retail-columns (credit-card-retail-pdp template)
 * Base block: columns (one row; each child element becomes a column).
 * Source: Citi RETAIL co-brand PDP — app-pdp section.pdp-section > app-review-section
 *
 * The review section is a secondary apply band: a card-art <img>, an H4 card name,
 * and an "Apply Now" <button>. Rendered as a 2-column row: [card art | name + CTA].
 * Apply Now is a <button> with a client-injected URL; we emit a real Apply link
 * using any /apply/ href present, else fall back to a plain "Apply Now" label.
 *
 * md2da COLLAPSE FIX (pricing sweep): the pdp-section ends with a sibling
 * <app-price-detail-section> (the legal "PRICING DETAILS" disclaimer + APR spans +
 * pricing/terms links). The template maps it as section default content, so NO parser
 * runs on it and it survives into markdown as a raw Angular element. html2md then
 * renders its "## PRICING DETAILS" heading IMMEDIATELY after this columns block's
 * closing "+----+" grid-table border with no blank line ("+----+---## ... PRICING
 * DETAILS ..."), leaving the grid table unterminated. WebImporter.md2da then collapses
 * the WHOLE document to one <p> of raw ASCII (verified: excluding app-price-detail-
 * section yields 7 clean block divs; including it -> 0 / collapsed). This is the same
 * "raw content jammed against a block table" failure the tds-* columns.js neutralises
 * with a recap-feature sweep. Here we rewrite app-price-detail-section in place into
 * clean, well-separated default-content nodes (an <h2> heading + flat <p> paragraphs),
 * dropping the Angular wrapper so html2md separates it from this block with a blank
 * line and no grid boundary is jammed. Guarded to run once, after the block is built.
 */
export default function parse(element, { document }) {
  const box = element.querySelector('.box, section') || element;

  const cardArt = box.querySelector('app-card-art img, .cardart img, img');
  const name = box.querySelector('h4, h3, h2');
  const applyAnchor = box.querySelector('a[href*="/apply/"]');

  const imgCol = [];
  if (cardArt) {
    const img = document.createElement('img');
    img.src = cardArt.getAttribute('src');
    img.alt = cardArt.getAttribute('alt') || '';
    imgCol.push(img);
  }

  const textCol = [];
  if (name) {
    const h = document.createElement('h3');
    h.append(...name.cloneNode(true).childNodes);
    textCol.push(h);
  }
  if (applyAnchor) {
    const p = document.createElement('p');
    const a = document.createElement('a');
    a.href = applyAnchor.getAttribute('href').replace(/#.*$/, '');
    a.textContent = 'Apply Now';
    p.append(a);
    textCol.push(p);
  } else {
    const p = document.createElement('p');
    const strong = document.createElement('strong');
    strong.textContent = 'Apply Now';
    p.append(strong);
    textCol.push(p);
  }

  const row = [];
  if (imgCol.length) row.push(imgCol);
  if (textCol.length) row.push(textCol);

  // Empty-block guard
  if (row.length === 0) {
    element.replaceWith(...element.childNodes);
    return;
  }

  const block = WebImporter.Blocks.createBlock(document, { name: 'columns', cells: [row] });
  element.replaceWith(block);

  // --- Pricing-details sweep (md2da COLLAPSE FIX, see header) ---------------------
  // Rewrite each sibling <app-price-detail-section> into clean default content so its
  // raw markup can't jam this block's closing grid-table border. Scoped to the
  // document (the section is a sibling of app-review-section, not a descendant) and
  // guarded so it runs at most once per element.
  document.querySelectorAll('app-price-detail-section').forEach((pd) => {
    if (!pd.parentNode) return;
    const nodes = [];

    const heading = pd.querySelector('h2, h3, .sub-heading');
    if (heading && heading.textContent.trim()) {
      const h = document.createElement('h2');
      h.append(...heading.cloneNode(true).childNodes);
      nodes.push(h);
    }

    // Body: flatten the .box children (the disclaimer .content paragraphs AND the
    // sibling .additonal-links block that holds "Important Pricing & Terms
    // Information +" / "Additional Information +") into top-level default content so
    // html2md emits blank-line-separated paragraphs (never a grid). Each <p> becomes
    // its own <p>; stray anchors are each wrapped in their own <p> so link copy + href
    // survive; the already-emitted heading is skipped. <style>/<script> are dropped.
    const body = pd.querySelector('.box') || pd.querySelector('.content') || pd;
    const seenLinks = new Set();
    const pushEl = (el) => {
      const tag = el.tagName;
      if (!tag || tag === 'STYLE' || tag === 'SCRIPT') return;
      if (el === heading || (heading && heading.contains(el))) return;
      if (tag === 'P') {
        const p = document.createElement('p');
        p.append(...el.cloneNode(true).childNodes);
        if (p.textContent.trim() || p.querySelector('a, img')) nodes.push(p);
      } else if (tag === 'A') {
        const href = (el.getAttribute('href') || '').trim();
        const key = `${el.textContent.replace(/\s+/g, ' ').trim()}|${href}`;
        if (seenLinks.has(key)) return;
        seenLinks.add(key);
        const p = document.createElement('p');
        const isPlaceholder = href === '' || href === '#' || /^javascript:/i.test(href);
        // Preserve the anchor's child nodes (keep the leading footnote <sup>1</sup>
        // marker as an element) rather than flattening to textContent — flattening
        // glues the marker to the label ("1Important Pricing…"). The shared
        // citi-cleanup footnote normalization then spaces the <sup> correctly.
        if (isPlaceholder) {
          // Placeholder/expand toggle (e.g. "Additional Information +", href=""):
          // emit as plain bold text, not a dead "[…]()" link.
          const strong = document.createElement('strong');
          strong.append(...el.cloneNode(true).childNodes);
          p.append(strong);
        } else {
          const link = document.createElement('a');
          link.href = href;
          link.append(...el.cloneNode(true).childNodes);
          p.append(link);
        }
        nodes.push(p);
      } else if (el.querySelector && el.querySelector('p, a')) {
        // A wrapper div (e.g. .content, .additonal-links): recurse into its children.
        [...el.children].forEach(pushEl);
      } else if (el.textContent.trim()) {
        const p = document.createElement('p');
        p.append(...el.cloneNode(true).childNodes);
        nodes.push(p);
      }
    };
    [...body.children].forEach(pushEl);

    if (nodes.length) {
      pd.replaceWith(...nodes);
    } else {
      pd.replaceWith(...pd.childNodes);
    }
  });
}
