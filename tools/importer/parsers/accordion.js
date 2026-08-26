/* eslint-disable */
/* global WebImporter */
/**
 * Parser for variant: accordion
 * Base block: accordion (2 columns: cell 1 = clickable title, cell 2 = body content).
 * Each accordion item becomes one row.
 *
 * Handles TWO Citi PDP instances (union selectors from page-templates.json):
 *   1. tds-drawer .faq-container -> 4 topic rows (Security and protection, Card management,
 *      Convenience, Lifestyle) with body-header + body-text sub-sections.
 *   2. tds-faq                   -> 4 Q&A rows; final "Read more..." row links to the full
 *      FAQ page. The section H2 ("FAQs") is authored as default content above the block.
 *
 * Inline links (citi.com, mastercardidps..., See Pricing Details) and footnote references
 * are preserved inside the body cell.
 */
export default function parse(element, { document }) {
  const cells = [];

  // Section H2 ("FAQs") lives in a .headline above the accordion (tds-faq instance
  // only; the drawer instance has no such heading). Lifted out and emitted as
  // default-content heading above the block (see element.replaceWith at the end).
  const sectionH2 = element.querySelector(':scope > section .headline h2, .headline h2, h2.faq-title, h2');

  const sections = element.querySelectorAll(':scope cds-accordion2-section, cds-accordion2-section');

  sections.forEach((section) => {
    // Title: the accordion heading in the button header.
    const heading = section.querySelector('.faq-headline h3, h3.faq-heading, .faq-heading, h3');

    // Body: everything inside the expandable submenu / faq-content.
    const bodySource = section.querySelector('.faq-content, .faq-content-wrapper, .cds-accordion2-submenu');

    if (!heading && !bodySource) return;

    // Title cell
    const titleCell = [];
    if (heading) {
      const h = document.createElement('h3');
      h.append(...heading.childNodes);
      titleCell.push(h);
    } else {
      titleCell.push('');
    }

    // Body cell: preserve body-header (as subheadings) and body-text (as paragraphs).
    const bodyCell = [];
    if (bodySource) {
      const parts = bodySource.querySelectorAll(':scope > .body-header, :scope > .body-text, :scope .body-header, :scope .body-text');
      if (parts.length) {
        parts.forEach((part) => {
          if (part.classList.contains('body-header')) {
            const h = document.createElement('h4');
            h.append(...part.childNodes);
            bodyCell.push(h);
          } else {
            const p = document.createElement('p');
            p.append(...part.childNodes);
            bodyCell.push(p);
          }
        });
      } else {
        // Fallback: keep the raw submenu content
        bodyCell.push(...bodySource.childNodes);
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

  // Emit the section H2 ("FAQs") as a default-content heading above the block so
  // it is not lost (tds-faq instance only; the drawer instance has no .headline).
  if (sectionH2 && sectionH2.textContent.trim()) {
    const h = document.createElement('h2');
    h.textContent = sectionH2.textContent.trim();
    element.replaceWith(h, block);
  } else {
    element.replaceWith(block);
  }
}
