/* eslint-disable */
/* global WebImporter */
/**
 * Parser for variant: hero
 * Base block: hero (1 column: row2 = background image, row3 = title/subheading/CTA)
 * Source: Citi Double Cash PDP — #page-container > tds-hero-banner
 * Generated for the credit-card-pdp template.
 *
 * The Citi hero (tds-hero-banner) contains: a full-bleed background photo, the card
 * art image, an eyebrow/card-name H1, a "Earn cash back" flag, the dynamic offer H2
 * ("Earn $200 cash back bonus"), a supporting line ("after spending $1,500 ... 6 months"),
 * two stat pairs ($0 Annual Fee / No caps), an "Apply now" CTA and a legal disclaimer +
 * pricing links. All dynamic values are already rendered as literal text.
 */
export default function parse(element, { document }) {
  // --- Background image (row 2, optional) ---
  const bgImage = element.querySelector('img.hero-feature-grid__img, img[class*="hero-feature-grid__img"]');

  // --- Content pieces (row 3) ---
  const cardArt = element.querySelector('tds-card-art img');
  const eyebrow = element.querySelector('.feature-restatement__eyebrow h1, h1');
  const flag = element.querySelector('tds-flag .flag, .flag-wrapper-v2 .flag');
  const headline = element.querySelector('.feature-restatement__header h2, tds-feature-header h2, .feature-header h2, h2.header, h2');
  const support = element.querySelector('.feature-restatement__text .feature-text, tds-feature-text.feature-restatement__text .feature-text');
  const cta = element.querySelector('tds-cta-section a.cds-button, .cta-wrapper a');
  const disclaimer = element.querySelector('tds-pdp-pricing .pricing-section__text .feature-text, tds-pdp-pricing .feature-text');
  const pricingLinks = Array.from(element.querySelectorAll('.pricing-links-container a'));

  // --- Stat pairs (value + description), preserving footnote links ---
  const statParas = [];
  element.querySelectorAll('.feature-restatement__ratesfees tds-ratesfees, tds-ratesfees').forEach((item) => {
    const value = item.querySelector('.text');
    const desc = item.querySelector('.description');
    if (!value && !desc) return;
    const p = document.createElement('p');
    if (value) {
      const strong = document.createElement('strong');
      strong.append(...value.childNodes);
      p.append(strong);
    }
    if (desc) {
      if (value) p.append(document.createTextNode(' — '));
      p.append(...desc.childNodes);
    }
    statParas.push(p);
  });

  const cells = [];

  // Row 2: background image (optional)
  if (bgImage) cells.push([bgImage]);

  // Row 3: single content cell holding all copy/CTA
  const contentCell = [];
  if (cardArt) contentCell.push(cardArt);
  if (flag) {
    const flagP = document.createElement('p');
    flagP.textContent = flag.textContent.trim();
    contentCell.push(flagP);
  }
  if (eyebrow) contentCell.push(eyebrow);
  if (headline) contentCell.push(headline);
  if (support) {
    const p = document.createElement('p');
    p.append(...support.childNodes);
    contentCell.push(p);
  }
  contentCell.push(...statParas);
  if (cta) contentCell.push(cta);
  if (disclaimer) {
    const p = document.createElement('p');
    p.append(...disclaimer.childNodes);
    contentCell.push(p);
  }
  pricingLinks.forEach((a) => {
    const p = document.createElement('p');
    p.append(a);
    contentCell.push(p);
  });

  // Empty-block guard
  if (contentCell.length === 0 && !bgImage) {
    element.replaceWith(...element.childNodes);
    return;
  }
  cells.push([contentCell]);

  const block = WebImporter.Blocks.createBlock(document, { name: 'hero', cells });
  element.replaceWith(block);
}
