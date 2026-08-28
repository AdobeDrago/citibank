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
 * This decorator classifies those flat elements and groups them so the CSS
 * can lay them out as the source does (card + label header row, stat row,
 * footnote row) over the background image.
 */
export default function decorate(block) {
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

  // Link paragraphs, in document order: CTA first, then footnotes.
  if (links[0]) {
    links[0].classList.add('button-container');
    const cta = links[0].querySelector('a');
    if (cta) cta.classList.add('button', 'primary');
  }
  // The "Important Pricing & Terms Information +" link (retail) sits directly under
  // the CTA in the source; pull it out of the footnotes group so it can be placed
  // and styled on its own. Identified by its visible text.
  const rest = links.slice(1);
  const pricingLink = rest.find((p) => /important pricing/i.test(p.textContent));
  if (pricingLink) pricingLink.classList.add('hero-pricing-link');
  const footnotes = rest.filter((p) => p !== pricingLink);
  footnotes.forEach((p) => p.classList.add('hero-footnote'));
  if (footnotes.length) {
    const fnRow = document.createElement('div');
    fnRow.className = 'hero-footnotes';
    content.insertBefore(fnRow, footnotes[0]);
    fnRow.append(...footnotes);
  }

  // Retail credit-card PDP variant: no background image and a two-column white
  // band (card art on the left, text on the right). The shared decoration above
  // groups the card art and the h1 label together in `.hero-head`, which cannot
  // be split into separate columns with CSS alone, so restructure here. Guarded
  // by the template body class so tds-* PDP heroes are left untouched.
  if (document.body.classList.contains('credit-card-retail-pdp')) {
    const media = document.createElement('div');
    media.className = 'hero-media';
    const body = document.createElement('div');
    body.className = 'hero-body';
    if (ribbon) media.append(ribbon);
    if (cardArt) media.append(cardArt);
    if (h1) body.append(h1);
    [...content.children].forEach((child) => {
      if (child.classList.contains('hero-head')) {
        child.remove();
        return;
      }
      body.append(child);
    });
    content.append(media, body);
  }
}
