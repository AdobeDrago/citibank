import { createOptimizedPicture } from '../../scripts/aem.js';

/**
 * cc-category — a Citi "Explore Credit Cards" category stack.
 *
 * Each source `.card-stack` section becomes one cc-category block. The block's
 * FIRST row is the category header (section heading + "View all …" link); every
 * later row is a card. Owning the header inside the block lets the `featured`
 * variant style the "View all …" link as a bordered button.
 *
 * Header row cell content:
 *   h1|h2   section heading ("Explore Citi Credit Cards", "Rewards Credit Cards", …)
 *   [p > a] optional "View all N …" link
 *
 * Card row cell content (in source order):
 *   [h4]      optional category badge ("Earn cash back", "No Annual Fee", …)
 *   picture   card art
 *   h3        card name (usually wrapping a link)
 *   [p]       optional short description (featured cards)
 *   ul        feature bullets
 *   p > a     "Card details" link
 *   p > a     "Apply now" primary CTA
 *
 * Rendered card structure (shared by both variants):
 *   li.cc-card
 *     h4.cc-card-badge
 *     div.cc-card-head  (card art + title)
 *     div.cc-card-body  (description, bullets, actions)
 */
export default function decorate(block) {
  const rows = [...block.children];

  // The header row is any row that has a heading (h1/h2) and no card name (h3).
  const headerRow = rows.find((row) => row.querySelector('h1, h2') && !row.querySelector('h3'));
  let header = null;
  if (headerRow) {
    header = document.createElement('div');
    header.className = 'cc-category-header';
    const cell = headerRow.querySelector(':scope > div') || headerRow;
    while (cell.firstChild) header.append(cell.firstChild);
    // The "View all …" link becomes a styled button.
    const viewAll = header.querySelector('p > a, a');
    if (viewAll) viewAll.classList.add('cc-view-all');
    headerRow.remove();
  }

  const ul = document.createElement('ul');

  rows.filter((row) => row !== headerRow).forEach((row) => {
    const li = document.createElement('li');
    li.className = 'cc-card';
    const cell = row.querySelector(':scope > div') || row;
    while (cell.firstChild) li.append(cell.firstChild);

    // Badge (h4) — the coloured category label bar.
    const badge = li.querySelector(':scope > h4');
    if (badge) badge.classList.add('cc-card-badge');

    // Card art: the first picture/img.
    const pic = li.querySelector(':scope > picture, :scope > p > picture, :scope > p > img, :scope > img');
    const media = document.createElement('div');
    media.className = 'cc-card-media';
    if (pic) {
      const holder = pic.closest('p');
      media.append(pic);
      // Drop the now-empty <p> that wrapped the picture so it doesn't render as
      // a blank paragraph in the card body.
      if (holder && !holder.textContent.trim() && !holder.querySelector('img, picture')) holder.remove();
    }

    // Title (h3) sits beside the card art in a head row.
    const title = li.querySelector(':scope > h3');
    const head = document.createElement('div');
    head.className = 'cc-card-head';
    head.append(media);
    if (title) head.append(title);

    // Body: everything else (description, bullets, CTAs).
    const body = document.createElement('div');
    body.className = 'cc-card-body';
    [...li.children].forEach((child) => {
      if (child === badge) return;
      body.append(child);
    });

    // Group the trailing CTA links ("Card details", "Apply now") into an actions row.
    const ctaParas = [...body.querySelectorAll(':scope > p')].filter((p) => {
      const a = p.querySelector('a');
      return a && p.textContent.trim() === a.textContent.trim();
    });
    if (ctaParas.length) {
      const actions = document.createElement('div');
      actions.className = 'cc-card-actions';
      ctaParas.forEach((p) => {
        const a = p.querySelector('a');
        if (/apply/i.test(a.textContent)) a.classList.add('cc-card-apply');
        else a.classList.add('cc-card-details');
        actions.append(a);
        p.remove();
      });
      body.append(actions);
    }

    // Assemble: badge, head (art + title), body.
    li.replaceChildren();
    if (badge) li.append(badge);
    li.append(head, body);
    ul.append(li);
  });

  // Optimize raster card art (skip inline-SVG data URIs — not servable via the pipeline).
  ul.querySelectorAll('picture > img, .cc-card-media > img').forEach((img) => {
    if (img.src.startsWith('data:')) return;
    const picture = createOptimizedPicture(img.src, img.alt, false, [{ width: '400' }]);
    (img.closest('picture') || img).replaceWith(picture);
  });

  block.replaceChildren();
  if (header) block.append(header);
  block.append(ul);
}
