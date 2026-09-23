import { createOptimizedPicture } from '../../scripts/aem.js';

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

  if (block.classList.contains('card-holder')) decorateCardHolderExplore(block);
}
