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

  kids.forEach((el) => {
    if (/^H[1-6]$/.test(el.tagName)) {
      headings.push(el);
      return;
    }
    if (el.tagName !== 'P') return;
    if (el.querySelector('picture')) {
      cardArt = el;
    } else if (el.querySelector('strong')) {
      stats.push(el);
    } else if (el.querySelector('a')) {
      links.push(el);
    } else {
      texts.push(el);
    }
  });

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
  const footnotes = links.slice(1);
  footnotes.forEach((p) => p.classList.add('hero-footnote'));
  if (footnotes.length) {
    const fnRow = document.createElement('div');
    fnRow.className = 'hero-footnotes';
    content.insertBefore(fnRow, footnotes[0]);
    fnRow.append(...footnotes);
  }
}
