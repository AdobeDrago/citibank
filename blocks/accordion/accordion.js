/*
 * Accordion Block
 * Recreate an accordion
 * https://www.hlx.live/developer/block-collection/accordion
 */

/**
 * Retail co-brand PDP FAQ: inject Expand All / Collapse All beside the section H2
 * (matches app-faq-section .rightSide on citi.com).
 *
 * The FAQ H2 lives in the `.default-content-wrapper` immediately before
 * `.accordion-wrapper`. On the retail mega-section that also holds tabs /
 * apply / pricing, `:scope > .default-content-wrapper` would hit the benefits
 * header instead — so resolve via the accordion wrapper sibling.
 * @param {Element} block
 */
function decorateRetailExpandAll(block) {
  const accordionWrapper = block.closest('.accordion-wrapper');
  const headingWrapper = accordionWrapper?.previousElementSibling?.classList.contains('default-content-wrapper')
    ? accordionWrapper.previousElementSibling
    : null;
  if (!headingWrapper || headingWrapper.querySelector('.accordion-expand-all')) return;

  const toggle = document.createElement('a');
  toggle.href = '#';
  toggle.className = 'accordion-expand-all';
  toggle.setAttribute('aria-expanded', 'false');
  toggle.textContent = 'Expand All';

  const syncLabel = () => {
    const items = [...block.querySelectorAll('.accordion-item')];
    const allOpen = items.length > 0 && items.every((item) => item.open);
    toggle.setAttribute('aria-expanded', String(allOpen));
    toggle.textContent = allOpen ? 'Collapse All' : 'Expand All';
  };

  toggle.addEventListener('click', (event) => {
    event.preventDefault();
    const items = [...block.querySelectorAll('.accordion-item')];
    const expand = toggle.getAttribute('aria-expanded') !== 'true';
    items.forEach((item) => {
      item.open = expand;
    });
    syncLabel();
  });

  block.addEventListener('toggle', syncLabel, true);
  headingWrapper.append(toggle);
}

export default function decorate(block) {
  [...block.children].forEach((row) => {
    // decorate accordion item label
    const label = row.children[0];
    const summary = document.createElement('summary');
    summary.className = 'accordion-item-label';
    summary.append(...label.childNodes);
    // decorate accordion item body
    const body = row.children[1];
    body.className = 'accordion-item-body';
    // decorate accordion item
    const details = document.createElement('details');
    details.className = 'accordion-item';
    details.append(summary, body);
    row.replaceWith(details);
  });

  if (document.body.classList.contains('credit-card-retail-pdp')) {
    decorateRetailExpandAll(block);
  }
}
