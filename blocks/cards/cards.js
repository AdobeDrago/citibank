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
 * Card-holder explore: keep authored h3 > a, group fan | list for CSS layout.
 * Selects the default-content sibling after the cards block (not by heading text).
 * @param {Element} block
 */
function decorateCardHolderExplore(block) {
  const wrapper = block.closest('.section')
    ?.querySelector(':scope > .cards-wrapper + .default-content-wrapper');
  if (!wrapper || wrapper.classList.contains('card-holder-explore')) return;

  wrapper.classList.add('card-holder-explore');

  const [fan, ...rest] = wrapper.children;
  if (fan?.querySelector('picture') && rest.length) {
    const panel = document.createElement('div');
    panel.append(...rest);
    wrapper.append(panel);
  }

  wrapper.querySelectorAll('h3').forEach((heading) => {
    const link = heading.querySelector(':scope > a');
    const eyebrow = heading.previousElementSibling;
    const media = eyebrow?.previousElementSibling;
    if (!link || eyebrow?.tagName !== 'P' || !media?.querySelector('picture')) return;

    // Thumb + eyebrow stay outside <a>; only the name is the link
    const text = document.createElement('span');
    text.append(eyebrow, link);
    heading.replaceChildren(media, text);
  });
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
  if (block.classList.contains('card-holder')) decorateCardHolderExplore(block);
}
