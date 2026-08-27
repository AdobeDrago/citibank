/* eslint-disable */
/* global WebImporter */
/**
 * Parser for variant: retail-hero (credit-card-retail-pdp template)
 * Base block: hero (1 column; content cell with card art + headings + CTA).
 * Source: Citi RETAIL co-brand PDP — app-pdp section.pdp-section > app-header-section
 *
 * The retail header (app-header-section) contains:
 *   - app-header-section-box: H1 card name, card art <img> (in app-card-art),
 *     an H2 tagline, a "Sign On to manage" line, an Apply Now <button> and an
 *     "Important Pricing & Terms" link (which carries the real /apply/ URL).
 *   - .header-description: three ".bubble-section" offer blurbs (eyebrow + H3
 *     percentage + supporting <p>s). Emitted as LOOSE default content after the hero
 *     block so the multi-tier offer copy is preserved as plain flowing markdown.
 *
 * md2da NOTE: loose default content (plain <p>/<h3> nodes) is the SAFEST choice here
 * because it produces no grid table of its own to collapse, and html2md separates it
 * from the hero block table with a blank line. (Emitting the offers as their own
 * `columns` block was rejected: three offers with tall multi-paragraph body cells
 * form a 2-col grid table big enough for WebImporter.md2da to collapse.)
 *   - app-sticky-header: a duplicate sticky apply bar — ignored (noise).
 *
 * Apply Now is a <button> whose URL is injected client-side (renders as
 * applyNowUrl-undefined). We instead emit a real "Apply Now" link using the
 * /apply/ href found on the "Important Pricing & Terms" anchor.
 */
export default function parse(element, { document }) {
  const box = element.querySelector('app-header-section-box') || element;

  const cardArt = box.querySelector('app-card-art img, .header-cards img');
  const cardName = box.querySelector('h1.card-name, h1#headerSection, h1');
  const tagline = box.querySelector('.card-tagline h2, h2');
  // "Already have a Card? Sign On to manage your account." (manage-account line).
  const manageLine = box.querySelector('.card-tagline-desc');
  // Green promo ribbon pinned over the card art (e.g. "No annual fee¹"). Emitted as
  // a distinctly-classed paragraph so the CSS can render it as the ribbon overlay.
  const ribbon = box.querySelector('.green-tag-text, .green-tag, .header-feature-flag');

  // Real apply URL lives on the "Important Pricing & Terms" / any /apply/ anchor.
  const applyAnchor = box.querySelector('a[href*="/apply/"]');
  // The "Important Pricing & Terms Information +" link itself (shown under the CTA in
  // the source). Matched by its visible text so we get the labelled link, not the
  // ribbon's bare footnote marker (both point at the same /apply/…#tnc URL).
  const pricingLink = [...box.querySelectorAll('a[href]')]
    .find((a) => /important pricing/i.test(a.textContent));

  const contentCell = [];
  if (ribbon && ribbon.textContent.trim()) {
    const p = document.createElement('p');
    p.className = 'hero-ribbon';
    p.append(...ribbon.cloneNode(true).childNodes);
    contentCell.push(p);
  }
  if (cardArt) {
    const img = document.createElement('img');
    img.src = cardArt.getAttribute('src');
    img.alt = cardArt.getAttribute('alt') || '';
    contentCell.push(img);
  }
  if (cardName) {
    const h1 = document.createElement('h1');
    h1.append(...cardName.cloneNode(true).childNodes);
    contentCell.push(h1);
  }
  if (tagline) {
    const h2 = document.createElement('h2');
    h2.append(...tagline.cloneNode(true).childNodes);
    contentCell.push(h2);
  }
  if (applyAnchor) {
    const p = document.createElement('p');
    const a = document.createElement('a');
    a.href = applyAnchor.getAttribute('href').replace(/#.*$/, '');
    a.textContent = 'Apply Now';
    p.append(a);
    contentCell.push(p);
  }
  // "Important Pricing & Terms Information +" link, shown under the CTA in the source.
  if (pricingLink) {
    const p = document.createElement('p');
    p.className = 'hero-pricing-link';
    const a = document.createElement('a');
    a.href = pricingLink.getAttribute('href');
    a.append(...pricingLink.cloneNode(true).childNodes);
    p.append(a);
    contentCell.push(p);
  }
  if (manageLine && manageLine.textContent.trim()) {
    const p = document.createElement('p');
    p.append(...manageLine.cloneNode(true).childNodes);
    contentCell.push(p);
  }

  // Empty-block guard
  if (contentCell.length === 0) {
    element.replaceWith(...element.childNodes);
    return;
  }

  const block = WebImporter.Blocks.createBlock(document, { name: 'hero', cells: [[contentCell]] });

  // The three offer bubbles become a `cards` block (one card per .bubble-section) so
  // they render as the source's row of bordered white offer cards. Each card is a
  // single body cell holding: an optional bold eyebrow <p>, the <h3> percentage
  // headline, then the supporting <p>(s). Emitting them as a real block (rather than
  // loose default content) both matches the source's card layout and keeps them
  // cleanly separated from the following "REWARDS AND PROGRAM DETAILS" section.
  const cardRows = [];
  element.querySelectorAll('.header-description .bubble-section').forEach((bubble) => {
    const bodyCell = [];
    // eyebrow (e.g. "Limited Time" / "Everyday shopping at Best Buy") -> bold paragraph
    const eyebrow = bubble.querySelector(':scope > .bubble-body:first-child');
    const heading = bubble.querySelector('.bubble-header');
    // supporting body: the LAST .bubble-body holds the descriptive <p>s
    const bodies = bubble.querySelectorAll(':scope > .bubble-body');
    const bodyWrap = bodies.length ? bodies[bodies.length - 1] : null;

    if (eyebrow && eyebrow !== bodyWrap && eyebrow.textContent.trim()) {
      const p = document.createElement('p');
      const strong = document.createElement('strong');
      strong.append(...eyebrow.cloneNode(true).childNodes);
      p.append(strong);
      bodyCell.push(p);
    }
    if (heading) {
      const h3 = document.createElement('h3');
      h3.append(...heading.cloneNode(true).childNodes);
      bodyCell.push(h3);
    }
    if (bodyWrap && bodyWrap !== eyebrow) {
      const paras = bodyWrap.querySelectorAll(':scope > p');
      if (paras.length) {
        paras.forEach((p) => bodyCell.push(p.cloneNode(true)));
      } else {
        const p = document.createElement('p');
        p.append(...bodyWrap.cloneNode(true).childNodes);
        bodyCell.push(p);
      }
    }
    if (bodyCell.length) cardRows.push([bodyCell]);
  });

  const after = [];
  if (cardRows.length) {
    after.push(WebImporter.Blocks.createBlock(document, { name: 'cards', cells: cardRows }));
  }

  element.replaceWith(block, ...after);
}
