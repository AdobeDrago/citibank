/*
 * Accordion Block
 * Recreate an accordion
 * https://www.hlx.live/developer/block-collection/accordion
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

function toBodyId(label, i) {
  const slug = (label || `item-${i}`)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return `accordion-panel-${slug || i}`;
}

/**
 * Sync aria-expanded / inert with <details open>, and wrap body content so the
 * CSS grid 0fr→1fr height animation has a single track (live max-height 0.6s).
 * @param {HTMLDetailsElement} details
 * @param {HTMLElement} summary
 * @param {HTMLElement} body
 * @param {number} index
 */
function decorateAccordionItem(details, summary, body, index) {
  const label = summary.textContent.trim();
  const bodyId = toBodyId(label, index);
  body.id = bodyId;
  summary.setAttribute('aria-controls', bodyId);
  summary.setAttribute('aria-expanded', String(details.open));

  const inner = document.createElement('div');
  inner.className = 'accordion-item-body-inner';
  inner.append(...body.childNodes);
  body.append(inner);

  const sync = () => {
    const expanded = details.open;
    summary.setAttribute('aria-expanded', String(expanded));
    if (expanded) body.removeAttribute('inert');
    else body.setAttribute('inert', '');
  };
  sync();
  details.addEventListener('toggle', sync);
}

export default function decorate(block) {
  [...block.children].forEach((row, i) => {
    const label = row.children[0];
    const summary = document.createElement('summary');
    summary.className = 'accordion-item-label';
    summary.append(...label.childNodes);
    const body = row.children[1];
    body.className = 'accordion-item-body';
    const details = document.createElement('details');
    details.className = 'accordion-item';
    details.append(summary, body);
    decorateAccordionItem(details, summary, body, i);
    row.replaceWith(details);
  });

  if (document.body.classList.contains('credit-card-retail-pdp')) {
    decorateRetailExpandAll(block);
  }
}
