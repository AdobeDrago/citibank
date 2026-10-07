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
      const next = node.nextSibling;
      if (next?.nodeType === Node.TEXT_NODE && next.textContent && !/^\s/.test(next.textContent)) {
        next.textContent = ` ${next.textContent}`;
      }
    }
  });
}

/**
 * Explore-cards section: the default content after the cards block is
 *   [collage picture] h2 ( [thumb picture] p(eyebrow) h3 > a )*
 * Group it into collage | panel, and each thumb/eyebrow/h3 triple into a list item.
 * @param {Element} block
 */
function decorateExploreCards(block) {
  const wrapper = block.closest('.section.explore-cards')
    ?.querySelector(':scope > .cards-wrapper + .default-content-wrapper');
  if (!wrapper || wrapper.classList.contains('explore-cards-explore')) return;
  wrapper.classList.add('explore-cards-explore');

  const panel = document.createElement('div');
  panel.className = 'explore-cards-panel';
  const [first, ...rest] = wrapper.children;
  if (first?.tagName === 'P' && first.querySelector('picture')) {
    first.className = 'explore-cards-media';
    panel.append(...rest);
  } else {
    panel.append(...wrapper.children);
  }
  wrapper.append(panel);

  const list = document.createElement('ul');
  list.className = 'explore-cards-list';
  panel.querySelectorAll(':scope > h3').forEach((heading) => {
    const li = document.createElement('li');
    const text = document.createElement('div');
    text.className = 'explore-cards-text';
    const eyebrow = heading.previousElementSibling;
    const thumb = eyebrow?.tagName === 'P' && !eyebrow.querySelector('picture')
      ? eyebrow.previousElementSibling : eyebrow;
    if (thumb?.tagName === 'P' && thumb.querySelector('picture')) {
      thumb.className = 'explore-cards-thumb';
      li.append(thumb);
    }
    if (eyebrow && eyebrow !== thumb) {
      eyebrow.className = 'explore-cards-eyebrow';
      text.append(eyebrow);
    }
    text.append(heading);
    li.append(text);
    list.append(li);
  });
  if (list.children.length) panel.append(list);
}

export default function decorate(block) {
  const ul = document.createElement('ul');
  [...block.children].forEach((row) => {
    const li = document.createElement('li');
    while (row.firstElementChild) li.append(row.firstElementChild);
    [...li.children].forEach((div) => {
      if (div.children.length === 1 && div.querySelector('picture, img')) div.className = 'cards-card-image';
      else div.className = 'cards-card-body';
    });
    ul.append(li);
  });
  ul.querySelectorAll('picture > img').forEach((img) => {
    if (img.src.startsWith('data:')) return;
    img.closest('picture').replaceWith(createOptimizedPicture(img.src, img.alt, false, [{ width: '750' }]));
  });
  block.replaceChildren(ul);
  decorateRetailNumberHeadings(block);
  decorateExploreCards(block);
}
