import { getOfferSheetUrl, hydrateOfferValues } from '../../scripts/offer-sheet.js';

/**
 * Hero block (credit-cards PDP feature hero).
 *
 * Authored structure: 2 rows.
 *   Row 1 = full-bleed lifestyle background image.
 *   Row 2 = a single cell holding a flat list of paragraphs/headings:
 *     card-art image, eyebrow, h1 label, h2 offer headline, supporting line,
 *     two stat paragraphs (<strong> + label), CTA link, legal disclaimer,
 *     and two footnote links.
 *
 * Dynamic offer values (bonus miles, spend requirement, annual fee) are
 * authored as {{token}} placeholders and filled via scripts/offer-sheet.js
 * from the shared /credit-cards/offerpricingpositioning workbook. The ecid
 * cookie (or ?ecid=seg-a|seg-b) picks the tab; Page Name picks the current
 * card (first tab if ecid is missing).
 *
 * This decorator classifies those flat elements and groups them so the CSS
 * can lay them out as the source does (card + label header row, stat row,
 * footnote row) over the background image.
 */
export default function decorate(block) {
  const sheetUrl = getOfferSheetUrl(block);
  const rows = [...block.children];
  const bgRow = rows[0];
  const contentRow = rows[rows.length - 1];
  if (bgRow) bgRow.classList.add('hero-bg');
  if (!contentRow) return;
  contentRow.classList.add('hero-content-row');

  const content = contentRow.querySelector(':scope > div') || contentRow;
  content.classList.add('hero-content');

  const kids = [...content.children];
  let cardArt = null;
  const headings = [];
  const stats = [];
  const links = [];
  const texts = [];

  // Retail promo ribbon (e.g. "No annual fee¹"): a short paragraph authored BEFORE
  // the card-art image. It carries a footnote <a>, so without this it would be
  // misclassified as the CTA. Identify it as any <p> that precedes the card-art
  // picture and pull it out so it can overlay the card art (retail branch below).
  const cardArtIdx = kids.findIndex((el) => el.tagName === 'P' && el.querySelector('picture'));
  const ribbon = cardArtIdx > 0
    ? kids.find((el, i) => i < cardArtIdx && el.tagName === 'P' && !el.querySelector('picture'))
    : null;

  kids.forEach((el) => {
    if (el === ribbon) return;
    if (/^H[1-6]$/.test(el.tagName)) {
      headings.push(el);
      return;
    }
    if (el.tagName !== 'P') return;
    if (el.querySelector('picture')) {
      cardArt = el;
      return;
    }
    if (el.querySelector('strong')) {
      stats.push(el);
      return;
    }
    // A "link paragraph" (the CTA, or a standalone footnote/pricing link) is one
    // whose entire visible text IS the link — e.g. <p><a>Apply now</a></p>. A
    // paragraph that merely CONTAINS an inline footnote marker (e.g. the
    // supporting line "after spending $1,000 in the first 3 months<a><sup>2</sup></a>")
    // has text beyond the link, so it is treated as a text paragraph — otherwise
    // the offer's footnote superscript would be misread as the primary CTA.
    const anchor = el.querySelector('a');
    const pText = el.textContent.replace(/\s+/g, ' ').trim();
    const aText = anchor ? anchor.textContent.replace(/\s+/g, ' ').trim() : '';
    if (anchor && aText && pText === aText) {
      links.push(el);
    } else {
      texts.push(el);
    }
  });
  if (ribbon) ribbon.classList.add('hero-ribbon');

  // Card art + h1 label share a header row.
  const h1 = headings.find((h) => h.tagName === 'H1');
  if (cardArt) cardArt.classList.add('hero-card-art');
  if (h1) h1.classList.add('hero-title');
  if (cardArt && h1) {
    const head = document.createElement('div');
    head.className = 'hero-head';
    content.insertBefore(head, cardArt);
    head.append(cardArt, h1);
  }

  // Text-only paragraphs, in document order: eyebrow, supporting, disclaimer.
  if (texts[0]) texts[0].classList.add('hero-eyebrow');
  if (texts[1]) texts[1].classList.add('hero-supporting');
  const disclaimer = texts[texts.length - 1];
  if (disclaimer && disclaimer !== texts[0]) disclaimer.classList.add('hero-disclaimer');

  // Stat paragraphs: <strong>value</strong> — label<sup>n</sup>.
  stats.forEach((p) => {
    p.classList.add('hero-stat');
    const value = p.querySelector('strong');
    if (value) value.classList.add('hero-stat-value');
    // Strip the leading " — " separator from the first text node.
    [...p.childNodes].forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        node.textContent = node.textContent.replace(/^\s*[—–-]\s*/, ' ');
      }
    });
  });
  if (stats.length) {
    const statsRow = document.createElement('div');
    statsRow.className = 'hero-stats';
    content.insertBefore(statsRow, stats[0]);
    statsRow.append(...stats);
  }

  // The value callout can be authored before the CTA, so classify each link by
  // its visible role instead of relying on document order.
  const valueCallout = links.find((p) => /over\s+\$[\d,]+\s+in\s+value/i.test(p.textContent));
  const ctaParagraph = links.find((p) => /^apply\s+now$/i.test(p.textContent.trim())) || links[0];
  if (valueCallout) valueCallout.classList.add('hero-value-callout');

  // Link paragraphs: the Apply now link is the CTA; remaining links are footnotes.
  if (ctaParagraph) {
    ctaParagraph.classList.add('button-container');
    const cta = ctaParagraph.querySelector('a');
    if (cta) cta.classList.add('button', 'primary');
  }
  // The "Important Pricing & Terms Information +" link (retail) sits directly under
  // the CTA in the source; pull it out of the footnotes group so it can be placed
  // and styled on its own. Identified by its visible text.
  const rest = links.filter((p) => p !== ctaParagraph && p !== valueCallout);
  const pricingLink = document.body.classList.contains('credit-card-retail-pdp')
    ? rest.find((p) => /important pricing/i.test(p.textContent))
    : null;
  if (pricingLink) pricingLink.classList.add('hero-pricing-link');
  const footnotes = rest.filter((p) => p !== pricingLink);
  footnotes.forEach((p) => p.classList.add('hero-footnote'));
  if (footnotes.length) {
    const fnRow = document.createElement('div');
    fnRow.className = 'hero-footnotes';
    content.insertBefore(fnRow, footnotes[0]);
    fnRow.append(...footnotes);
  }

  if (valueCallout && stats.length) {
    content.querySelector('.hero-stats').append(valueCallout);
  }

  // Retail credit-card PDP variant: no background image and a two-column white
  // band (card art on the left, text on the right). The shared decoration above
  // groups the card art and the h1 label together in `.hero-head`, which cannot
  // be split into separate columns with CSS alone, so restructure here. Guarded
  // by the template body class so tds-* PDP heroes are left untouched.
  // Source order: full-width card-name title, then media (ribbon + card art) and
  // body (headline / sign-on / CTA) side-by-side on desktop.
  if (document.body.classList.contains('credit-card-retail-pdp')) {
    const media = document.createElement('div');
    media.className = 'hero-media';
    const body = document.createElement('div');
    body.className = 'hero-body';
    if (ribbon) media.append(ribbon);
    if (cardArt) media.append(cardArt);
    [...content.children].forEach((child) => {
      if (child.classList.contains('hero-head')) {
        child.remove();
        return;
      }
      if (child === h1) return;
      body.append(child);
    });
    content.replaceChildren(...[h1, media, body].filter(Boolean));
  }

  hydrateOfferValues(block, sheetUrl);

  if (!document.body.classList.contains('credit-card-retail-pdp')) return;
  const ctaEl = block.querySelector('.button-container a');
  const cardArtEl = block.querySelector('.hero-card-art picture');
  if (ctaEl && cardArtEl) {
    const bar = document.createElement('div');
    bar.className = 'hero-sticky-bar';

    const imgWrap = document.createElement('div');
    imgWrap.className = 'hero-sticky-bar-image';
    imgWrap.append(cardArtEl.cloneNode(true));

    const stickyBtn = document.createElement('a');
    stickyBtn.href = ctaEl.href;
    stickyBtn.textContent = ctaEl.textContent;
    stickyBtn.className = 'hero-sticky-bar-cta';

    bar.append(imgWrap, stickyBtn);
    document.body.append(bar);

    const observer = new IntersectionObserver(
      ([entry]) => bar.classList.toggle('is-visible', !entry.isIntersecting),
      { threshold: 0 },
    );
    observer.observe(ctaEl);
  }
}
