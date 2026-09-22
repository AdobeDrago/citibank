import { createOptimizedPicture } from '../../scripts/aem.js';

function decorateRetailNumberHeadings(block) {
  if (!document.body.classList.contains('credit-card-retail-pdp')) return;
  block.querySelectorAll('.cards-card-body h3').forEach((heading) => {
    let node = heading.firstChild;
    while (node && node.nodeType === Node.TEXT_NODE && !node.textContent.trim()) {
      node = node.nextSibling;
    }
    if (node?.nodeType === Node.ELEMENT_NODE && node.tagName === 'STRONG') {
      node.classList.add('cards-card-number');
    }
  });
}

export default function decorate(block) {
  /* change to ul, li */
  const ul = document.createElement('ul');
  [...block.children].forEach((row) => {
    const li = document.createElement('li');
    while (row.firstElementChild) li.append(row.firstElementChild);
    [...li.children].forEach((div) => {
      // Image cell = a lone image (either a <picture> or a bare <img>, e.g. an
      // inline-SVG data-URI icon that isn't wrapped in a <picture>).
      if (div.children.length === 1 && div.querySelector('picture, img')) div.className = 'cards-card-image';
      else div.className = 'cards-card-body';
    });
    ul.append(li);
  });
  // Optimize raster images only. createOptimizedPicture appends IS/rendition query
  // params to the src, which corrupts inline-SVG data-URI icons (they are not
  // servable through the image pipeline) — leave those as-is.
  ul.querySelectorAll('picture > img').forEach((img) => {
    if (img.src.startsWith('data:')) return;
    img.closest('picture').replaceWith(createOptimizedPicture(img.src, img.alt, false, [{ width: '750' }]));
  });
  block.replaceChildren(ul);
  decorateRetailNumberHeadings(block);
}
