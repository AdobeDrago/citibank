/* eslint-disable */
/* global WebImporter */
/**
 * Parser for variant: retail-accordion (credit-card-retail-pdp template)
 * Base block: accordion (2 columns: cell 1 = clickable title, cell 2 = body).
 * Source: Citi RETAIL co-brand PDP — app-pdp section.pdp-section > app-faq-section
 *
 * Each FAQ item is a `.matlist-section` with a `button.accordion-trigger` holding
 * an H3 question (`h3.category-title span`) and a sibling `section.category-content`
 * holding the answer body. The chevron `cds-icon` is decorative and dropped. The
 * final item is a "Read more ... FAQs" link-out (kept as a title-only row with the
 * link). The section H2 ("... FAQs") is lifted out and emitted as a default-content
 * heading above the block (the shared sections transformer does not emit template
 * defaultContent, so each retail parser lifts its own section heading).
 */
export default function parse(element, { document }) {
  const cells = [];

  // Section H2 ("... CREDIT CARD FAQs"), lifted out and emitted above the block.
  const sectionH2 = element.querySelector('h2');

  // Each FAQ item is a `.matlist-section`. Select ONLY that class — matching
  // `app-matlist` too would double every item (the wrapper contains a .matlist-section).
  const items = element.querySelectorAll('.matlist-section');

  items.forEach((item) => {
    const trigger = item.querySelector('.accordion-trigger, button');
    const titleSrc = trigger && (trigger.querySelector('.category-title span, .category-title, h3') || trigger);
    const body = item.querySelector('.category-content, section[role="region"]');

    if (!titleSrc && !body) return;

    // Title cell
    const titleCell = [];
    if (titleSrc) {
      const h3 = document.createElement('h3');
      // Drop the decorative icon; keep the question text/markup.
      const clone = titleSrc.cloneNode(true);
      clone.querySelectorAll('cds-icon, svg, .arrow-icon').forEach((n) => n.remove());
      h3.append(...clone.childNodes);
      // If the trigger itself is a link-out (Read more), preserve any anchor.
      const link = trigger && trigger.querySelector && trigger.querySelector('a[href]');
      if (link && !h3.querySelector('a')) h3.append(link.cloneNode(true));
      titleCell.push(h3);
    } else {
      titleCell.push('');
    }

    // Body cell
    const bodyCell = [];
    if (body) {
      const clone = body.cloneNode(true);
      clone.querySelectorAll('cds-icon, svg').forEach((n) => n.remove());
      const parts = clone.querySelectorAll('p, h4, ul, ol');
      if (parts.length) {
        parts.forEach((p) => bodyCell.push(p));
      } else {
        bodyCell.push(...clone.childNodes);
      }
    }
    if (bodyCell.length === 0) bodyCell.push('');

    cells.push([titleCell, bodyCell]);
  });

  // Empty-block guard
  if (cells.length === 0) {
    element.replaceWith(...element.childNodes);
    return;
  }

  const block = WebImporter.Blocks.createBlock(document, { name: 'accordion', cells });

  if (sectionH2 && sectionH2.textContent.trim()) {
    const h = document.createElement('h2');
    h.append(...sectionH2.cloneNode(true).childNodes);
    element.replaceWith(h, block);
  } else {
    element.replaceWith(block);
  }
}
