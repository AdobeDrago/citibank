/* eslint-disable */
/* global WebImporter */
/**
 * Capture the credit-cards Explore page's rotating promo hero (#hero-banner) as
 * a reusable FRAGMENT under content/fragments/heroes/.
 *
 * The source banner rotates per session between structurally different variants
 * (a single-card "offer" and a product-family "brand" banner) and, within each,
 * between different cards. This script builds a `hero` block for whichever
 * variant is live and writes it to a variant-specific path:
 *   fragments/heroes/<offer|brand>-<card-slug>
 * so that re-running the import against the live URL (each run re-fetches, so a
 * refresh serves a new rotation) accumulates one fragment per distinct hero.
 *
 * Injected as raw page text by run-bulk-import.js, so it is flat and
 * self-contained and exposes window.CustomImportScript.default.transform(...).
 */
(function () {
  const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();

  const slugify = (s) => norm(s)
    .toLowerCase()
    .replace(/[®™℠]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'hero';

  function heading(document, level, text) {
    const h = document.createElement(`h${level}`);
    h.textContent = norm(text);
    return h;
  }

  function para(document, text) {
    const p = document.createElement('p');
    p.textContent = norm(text);
    return p;
  }

  // Keep trailing footnote markers (source wraps them in <sup>) as real <sup>.
  function appendWithFootnotes(document, target, sourceEl) {
    [...sourceEl.childNodes].forEach((node) => {
      if (node.nodeType === 3) {
        const t = node.textContent.replace(/\s+/g, ' ');
        if (t) target.append(document.createTextNode(t));
      } else if (node.tagName === 'SUP') {
        const marker = norm(node.textContent);
        if (marker) {
          const sup = document.createElement('sup');
          sup.textContent = marker;
          target.append(sup);
        }
      } else {
        appendWithFootnotes(document, target, node);
      }
    });
  }

  // The source ships a hidden responsive-duplicate <img>; take the rendered one.
  function visibleImg(imgs) {
    const shown = imgs.filter((i) => i.getClientRects && i.getClientRects().length
      && i.getBoundingClientRect().width > 1);
    return shown[shown.length - 1] || imgs[imgs.length - 1] || null;
  }

  function cloneImg(document, src, alt) {
    const im = document.createElement('img');
    im.src = src;
    im.alt = alt || '';
    return im;
  }

  // Build the hero block + resolve its variant + slug. Returns { nodes, slug }.
  function buildHero(document) {
    const hero = document.querySelector('#hero-banner');
    if (!hero) return null;

    const imgs = [...hero.querySelectorAll('img')];
    const bgImg = imgs.find((i) => /bg-img/.test(i.getAttribute('src') || ''));
    const cardImg = visibleImg(imgs.filter((i) => i !== bgImg));

    const learnMore = [...hero.querySelectorAll('a, button')].find((a) => /learn more/i.test(a.textContent));
    const apply = [...hero.querySelectorAll('a, button')].find((a) => /apply now/i.test(a.textContent));
    const details = [...hero.querySelectorAll('a')].find((a) => /card details/i.test(a.textContent));

    const bgCell = [];
    if (bgImg) bgCell.push(cloneImg(document, bgImg.getAttribute('src'), bgImg.getAttribute('alt')));

    const content = [];
    let variant = 'offer';
    let slugSource = '';

    const titleEl = hero.querySelector('.hero-copy');
    const taglineEl = hero.querySelector('.hero-subcopy');

    if (learnMore && (titleEl || taglineEl)) {
      // --- Brand family banner ---
      variant = 'brand';
      slugSource = titleEl ? norm(titleEl.textContent) : 'brand';
      if (cardImg) content.push(cloneImg(document, cardImg.getAttribute('src'), cardImg.getAttribute('alt') || slugSource));
      if (titleEl && norm(titleEl.textContent)) {
        const h = document.createElement('h2');
        appendWithFootnotes(document, h, titleEl);
        content.push(h);
      }
      if (taglineEl && norm(taglineEl.textContent)) {
        const p = document.createElement('p');
        appendWithFootnotes(document, p, taglineEl);
        content.push(p);
      }
      if (learnMore.getAttribute('href')) {
        const a = document.createElement('a');
        a.href = learnMore.getAttribute('href');
        a.textContent = 'Learn More';
        const p = document.createElement('p');
        p.append(a);
        content.push(p);
      }
    } else {
      // --- Single-card offer ---
      const eyebrowEl = hero.querySelector('.eyebrow-copy');
      const eyebrow = eyebrowEl ? norm(eyebrowEl.textContent) : '';
      slugSource = eyebrow || (cardImg && cardImg.getAttribute('alt')) || 'offer';
      const isNoise = (t) => !t || /fill:|color:|hero-banner|apply now|card details/i.test(t) || t === eyebrow;
      let bodyEls = [...hero.querySelectorAll('.text-black')]
        .filter((e) => !isNoise(norm(e.textContent)) && norm(e.textContent).length > 8);
      if (!bodyEls.length) {
        bodyEls = [...hero.querySelectorAll('p, span, div, h1, h2, h3')]
          .filter((e) => e.children.length <= 2
            && !isNoise(norm(e.textContent))
            && norm(e.textContent).length > 8
            && !e.querySelector('img, a, button, style, script'));
      }
      bodyEls.sort((a, b) => a.textContent.length - b.textContent.length);
      const headlineEl = bodyEls[0];
      const supportEl = bodyEls.length > 1 ? bodyEls[bodyEls.length - 1] : null;

      if (cardImg) content.push(cloneImg(document, cardImg.getAttribute('src'), cardImg.getAttribute('alt') || eyebrow));
      if (eyebrow) content.push(para(document, eyebrow));
      if (headlineEl && norm(headlineEl.textContent)) {
        const h = document.createElement('h2');
        appendWithFootnotes(document, h, headlineEl);
        content.push(h);
      }
      if (supportEl && norm(supportEl.textContent)) {
        const p = document.createElement('p');
        appendWithFootnotes(document, p, supportEl);
        content.push(p);
      }
      if (apply && apply.getAttribute('href')) {
        const a = document.createElement('a');
        a.href = apply.getAttribute('href');
        a.textContent = 'Apply Now';
        const p = document.createElement('p');
        p.append(a);
        content.push(p);
      }
      if (details && details.getAttribute('href')) {
        const a = document.createElement('a');
        a.href = details.getAttribute('href');
        a.textContent = 'Card details';
        const p = document.createElement('p');
        p.append(a);
        content.push(p);
      }
    }

    if (!content.length) return null;

    const style = variant === 'brand' ? 'explore-hero-brand' : 'explore-hero-offer';
    const block = WebImporter.Blocks.createBlock(document, {
      name: 'hero',
      cells: [[bgCell.length ? bgCell : ''], [content]],
    });
    const meta = WebImporter.Blocks.createBlock(document, {
      name: 'Section Metadata',
      cells: [['Style', style]],
    });
    return { nodes: [block, meta], slug: `${variant}-${slugify(slugSource)}` };
  }

  window.CustomImportScript = {
    default: {
      transform: (payload) => {
        const { document, url, params } = payload;
        const sourceUrl = (params && params.originalURL) || url;
        const built = buildHero(document);
        if (!built) return []; // no hero on this load — skip

        const main = document.createElement('main');
        built.nodes.forEach((n) => main.append(n));

        WebImporter.rules.adjustImageUrls(main, sourceUrl, sourceUrl);

        const path = WebImporter.FileUtils.sanitizePath(`/fragments/heroes/${built.slug}`);
        return [{
          element: main,
          path,
          report: { title: `Hero fragment: ${built.slug}` },
        }];
      },
    },
  };
})();
