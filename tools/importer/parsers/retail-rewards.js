/* eslint-disable */
/* global WebImporter */
/**
 * Parser for variant: retail-rewards (credit-card-retail-pdp template)
 * Base block: columns (one row; each child element becomes a column).
 * Source: Citi RETAIL co-brand PDP — app-pdp section.pdp-section > app-rewards-section
 *
 * "REWARDS AND PROGRAM DETAILS" is a two-column layout:
 *   LEFT  (.text-container): a list of `.rw-content` reward items, each an
 *          `h3.rw-title` (bold) + a supporting `<p>`.
 *   RIGHT (.reward-feature): a short list of `.reward-feature-item` benefit lines
 *          (each a `<p>`), separated from the left column by a vertical divider.
 *
 * Emitted as a 2-column `columns` block so it renders side-by-side like the source.
 * A `.columns-rewards-feature` marker is added to the right column's first element so
 * the CSS can draw the divider (columns.css retail variant). The section H2 is lifted
 * out and emitted as a default-content heading above the block (the shared sections
 * transformer does not emit template defaultContent).
 */
export default function parse(element, { document }) {
  const sectionH2 = element.querySelector('h2.sub-heading, h2');

  // LEFT column: reward items (h3 + p), in document order.
  const leftCol = [];
  const rwItems = element.querySelectorAll('.text-container .rw-content, .rw-content');
  if (rwItems.length) {
    // Structured variant: each .rw-content = h3.rw-title + <p>(s).
    rwItems.forEach((item) => {
      const h = item.querySelector('h3, .rw-title');
      if (h) {
        const h3 = document.createElement('h3');
        h3.append(...h.cloneNode(true).childNodes);
        leftCol.push(h3);
      }
      item.querySelectorAll(':scope > p').forEach((p) => leftCol.push(p.cloneNode(true)));
    });
  } else {
    // Fallback variant (e.g. Goodyear): the left column is a `.text-description`
    // of bare <p>s where each item's lead line is a <b>/<strong> paragraph. Promote
    // those lead paragraphs to <h3> so they style like the reward-item titles.
    // Prefer the innermost `.text-description` (its direct children are the <p>s);
    // `.text-container` is an ancestor wrapper, so querying it for `:scope > p`
    // would match nothing.
    const src = element.querySelector('.text-description')
      || element.querySelector('.text-container');
    if (src) {
      src.querySelectorAll(':scope > p').forEach((p) => {
        const clone = p.cloneNode(true);
        const lead = clone.querySelector(':scope > b, :scope > strong');
        const onlyLead = lead && clone.textContent.trim() === lead.textContent.trim();
        if (onlyLead) {
          const h3 = document.createElement('h3');
          h3.append(...lead.childNodes);
          leftCol.push(h3);
        } else {
          leftCol.push(clone);
        }
      });
    }
  }

  // RIGHT column: benefit lines (each a <p>).
  const rightCol = [];
  element.querySelectorAll('.reward-feature .reward-feature-item, .reward-feature-item').forEach((item) => {
    const p = item.querySelector('p') || item;
    const el = document.createElement('p');
    el.append(...p.cloneNode(true).childNodes);
    rightCol.push(el);
  });

  // Nothing to lay out — leave the section as-is (unwrap).
  if (leftCol.length === 0 && rightCol.length === 0) {
    element.replaceWith(...element.childNodes);
    return;
  }

  const row = [];
  row.push(leftCol.length ? leftCol : '');
  if (rightCol.length) row.push(rightCol);

  const block = WebImporter.Blocks.createBlock(document, { name: 'columns', cells: [row] });

  if (sectionH2 && sectionH2.textContent.trim()) {
    const h = document.createElement('h2');
    h.append(...sectionH2.cloneNode(true).childNodes);
    element.replaceWith(h, block);
  } else {
    element.replaceWith(block);
  }
}
