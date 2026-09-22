/**
 * Retail secondary apply band (app-review-section): turn a plain "Apply Now"
 * strong into a real CTA link, reusing the hero apply URL when present.
 * @param {Element} block
 */
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

  // Already-authored Apply link — still promote to primary button chrome.
  const existing = [...block.querySelectorAll('p a')].find((a) => /^apply now$/i.test(a.textContent.trim()));
  if (existing) existing.classList.add('button', 'primary');
}

export default function decorate(block) {
  const cols = [...block.firstElementChild.children];
  block.classList.add(`columns-${cols.length}-cols`);

  // setup image columns
  [...block.children].forEach((row) => {
    [...row.children].forEach((col) => {
      const pic = col.querySelector('picture');
      if (pic) {
        const picWrapper = pic.closest('div');
        if (picWrapper && picWrapper.children.length === 1) {
          // picture is only content in column
          picWrapper.classList.add('columns-img-col');
        }
      }
    });
  });

  if (document.body.classList.contains('credit-card-retail-pdp')) {
    decorateRetailApplyBand(block);
  }
}
