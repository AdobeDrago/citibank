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

  if (document.body.classList.contains('credit-card-retail-pdp')) {
    decorateRetailApplyBand(block);
  }
}
