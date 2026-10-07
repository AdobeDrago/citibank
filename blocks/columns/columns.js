import { buildBlock, decorateBlock, loadBlock } from '../../scripts/aem.js';

function decorateRetailApplyBand(block) {
  if (!block.querySelector('.columns-img-col')) return;

  const cta = [...block.querySelectorAll('p')].find((p) => {
    const strong = p.querySelector(':scope > strong');
    return strong && /^apply now$/i.test(strong.textContent.trim()) && !p.querySelector('a');
  });
  if (cta) {
    const heroApply = document.querySelector('.hero a.button[href], .hero a[href*="apply"]');
    const href = heroApply && heroApply.getAttribute('href');
    if (!href) return;

    const link = document.createElement('a');
    link.href = href.replace(/#.*$/, '');
    link.textContent = 'Apply Now';
    link.classList.add('button', 'primary');
    cta.replaceChildren(link);
    return;
  }

  const existing = [...block.querySelectorAll('p a')].find((a) => /^apply now$/i.test(a.textContent.trim()));
  if (existing) existing.classList.add('button', 'primary');
}

/**
 * Costco rewards (section style = costco-rewards).
 * Restructures 5 tile rows + disclaimer to match cards-marketing
 * tds-accelerator benefits-explainer layout:
 *   [5% | 4%] + bracket disclaimer  |  3%  |  2%  |  1%
 * @param {Element} block
 */
function decorateCostcoRewards(block) {
  const section = block.closest('.section.costco-rewards');
  if (!section || block.querySelector('.costco-rewards-tiles')) return;

  const rows = [...block.children];
  if (rows.length < 5) return;

  const disclaimer = [...section.querySelectorAll(':scope > .default-content-wrapper')]
    .reverse()
    .find((el) => el.querySelector('p') && !el.querySelector('h1, h2, h3, h4'));

  const tiles = document.createElement('div');
  tiles.className = 'costco-rewards-tiles';

  const pair = document.createElement('div');
  pair.className = 'costco-rewards-pair';

  const pairInner = document.createElement('div');
  pairInner.className = 'costco-rewards-pair-inner';
  pairInner.append(rows[0], rows[1]);
  pair.append(pairInner);

  if (disclaimer) {
    const text = disclaimer.querySelector('p')?.textContent?.trim() || '';
    const explainer = document.createElement('div');
    explainer.className = 'costco-rewards-explainer';

    const left = document.createElement('div');
    left.className = 'costco-rewards-explainer-left';
    left.setAttribute('aria-hidden', 'true');

    const center = document.createElement('div');
    center.className = 'costco-rewards-explainer-center';
    center.textContent = text;

    const right = document.createElement('div');
    right.className = 'costco-rewards-explainer-right';
    right.setAttribute('aria-hidden', 'true');

    explainer.append(left, center, right);
    pair.append(explainer);
    disclaimer.remove();
  }

  tiles.append(pair, rows[2], rows[3], rows[4]);
  block.replaceChildren(tiles);
}

/** @param {Element} link */
function unwrapLinkSup(link) {
  link.querySelectorAll('sup').forEach((sup) => {
    sup.replaceWith(...sup.childNodes);
  });
}

/** @param {ParentNode} root @returns {Element[]} */
function cardLinks(root) {
  return [...root.querySelectorAll('a')].filter((a) => {
    const label = a.textContent.replace(/\s+/g, ' ').trim();
    return label.length > 2;
  });
}

/**
 * Build <p><picture>+<a></p> rows from pictures + links (document order).
 * @param {Element[]} pictures
 * @param {Element[]} links
 * @param {Element|null} heading
 * @returns {Element[]}
 */
function buildCardRowElements(pictures, links, heading) {
  const elems = heading ? [heading] : [];
  const pairs = Math.min(pictures.length, links.length);
  for (let i = 0; i < pairs; i += 1) {
    unwrapLinkSup(links[i]);
    const row = document.createElement('p');
    row.append(pictures[i], links[i]);
    elems.push(row);
  }
  return elems;
}

/**
 * Ensure media-feature text cell card rows are p > picture + a.
 * No-op when already correct (Home Depot / Costco).
 * @param {Element} block
 */
function decorateMediaFeature(block) {
  if (!block.classList.contains('media-feature')) return;

  const textCol = [...block.querySelectorAll(':scope > div > div')]
    .find((col) => !col.classList.contains('columns-img-col'));
  if (!textCol) return;

  const ready = [...textCol.querySelectorAll(':scope > p')].filter(
    (p) => p.querySelector(':scope > picture') && p.querySelector(':scope > a'),
  );
  if (ready.length) {
    ready.forEach((row) => {
      const link = row.querySelector(':scope > a');
      if (link) unwrapLinkSup(link);
    });
    return;
  }

  const heading = [...textCol.children].find(
    (el) => /^H[1-6]$/.test(el.tagName) && !el.querySelector('picture'),
  );
  const pictures = [...textCol.querySelectorAll('picture')];
  const links = cardLinks(textCol);
  if (!pictures.length || !links.length) return;

  textCol.replaceChildren(...buildCardRowElements(pictures, links, heading));
}

/**
 * Section style `strata-other-balance-cards` (default content) → Columns media-feature.
 * Once per page; layout CSS is scoped to that section class.
 */
let strataOtherBalanceBuilt = false;

function buildStrataOtherBalanceCards() {
  if (strataOtherBalanceBuilt) return;

  const sections = [...document.querySelectorAll('.section.strata-other-balance-cards')];
  if (!sections.length) return;
  strataOtherBalanceBuilt = true;

  sections.forEach((section) => {
    if (section.querySelector('.columns')) return;
    const wrap = section.querySelector(':scope > .default-content-wrapper');
    if (!wrap) return;

    const mediaP = [...wrap.children].find((el) => el.tagName === 'P' && el.querySelector('picture'));
    const heading = [...wrap.querySelectorAll(':scope > h2')].find((h) => !h.querySelector('picture'));
    const mediaPic = mediaP?.querySelector('picture');
    if (!mediaPic || !heading) return;

    const pictures = [...wrap.querySelectorAll('picture')].filter((pic) => pic !== mediaPic);
    const links = cardLinks(wrap);
    const textElems = buildCardRowElements(pictures, links, heading);
    if (textElems.length < 2) return;

    const block = buildBlock('columns', [[{ elems: [mediaPic] }, { elems: textElems }]]);
    block.classList.add('media-feature');

    const wrapper = document.createElement('div');
    wrapper.append(block);
    wrap.replaceWith(wrapper);
    decorateBlock(block);
    loadBlock(block);
  });
}

export default function decorate(block) {
  const cols = [...block.firstElementChild.children];
  block.classList.add(`columns-${cols.length}-cols`);

  // setup image columns
  [...block.children].forEach((row) => {
    [...row.children].forEach((col) => {
      const pic = col.querySelector('picture');
      if (pic) {
        const wrap = pic.parentElement;
        if (wrap && wrap !== col && !wrap.textContent.trim() && wrap.children.length === 1) {
          wrap.replaceWith(pic);
        }
        const picWrapper = pic.closest('div');
        if (picWrapper && picWrapper.children.length === 1) {
          // picture is only content in column
          picWrapper.classList.add('columns-img-col');
        }
      }
    });
  });

  decorateCostcoRewards(block);
  decorateMediaFeature(block);
  buildStrataOtherBalanceCards();

  if (document.body.classList.contains('credit-card-retail-pdp')) {
    decorateRetailApplyBand(block);
  }
}
