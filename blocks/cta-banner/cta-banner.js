import { createOptimizedPicture } from '../../scripts/aem.js';

/**
 * CTA Banner — the gradient promo band that closes the credit-cards Explore
 * page on citi.com ("Still not sure? … View All Cards").
 *
 * Authored as a single row of two cells:
 *   | CTA Banner | heading + supporting copy + CTA link | card art image |
 *
 * Neither cell is required and their order is not assumed — the image is taken
 * from wherever it was authored and everything else becomes the copy column, so
 * a single cell holding both also works.
 *
 * The image is the complete banner artwork: it covers the whole band and the
 * copy is laid over it (see cta-banner.css).
 */

// The CTA is a paragraph whose entire visible text IS the link. A paragraph
// that merely contains an inline link keeps its text styling instead.
function isLinkOnly(paragraph) {
  const link = paragraph.querySelector('a');
  if (!link) return false;
  const text = (node) => node.textContent.replace(/\s+/g, ' ').trim();
  return Boolean(text(link)) && text(paragraph) === text(link);
}

export default function decorate(block) {
  const content = document.createElement('div');
  content.className = 'cta-banner-content';
  block.querySelectorAll(':scope > div > div').forEach((cell) => {
    while (cell.firstChild) content.append(cell.firstChild);
  });

  const media = document.createElement('div');
  media.className = 'cta-banner-media';
  const art = content.querySelector('picture, img');
  if (art) {
    const holder = art.closest('p');
    media.append(art.closest('picture') || art);
    if (holder && !holder.textContent.trim()) holder.remove();
  }

  const heading = content.querySelector('h1, h2, h3, h4, h5, h6');
  if (heading) heading.classList.add('cta-banner-title');

  content.querySelectorAll('p').forEach((paragraph) => {
    if (isLinkOnly(paragraph)) {
      const link = paragraph.querySelector('a');
      // A bolded/italicised CTA is decorated into a global button variant before
      // blocks run; those paint their own navy fill, so drop them and let the
      // band's white-on-blue button rule stand alone.
      link.classList.remove('button', 'primary', 'secondary', 'accent', 'gold');
      link.classList.add('cta-banner-button');
      paragraph.replaceWith(link);
      return;
    }
    if (paragraph.textContent.trim()) paragraph.classList.add('cta-banner-text');
    else paragraph.remove();
  });

  // Raster art goes through the image pipeline; inline-SVG data URIs cannot.
  const img = media.querySelector('img');
  if (img && !img.src.startsWith('data:')) {
    (img.closest('picture') || img).replaceWith(
      createOptimizedPicture(img.src, img.alt, false, [
        { media: '(min-width: 992px)', width: '1600' },
        { width: '900' },
      ]),
    );
  }

  block.replaceChildren(content);
  if (media.children.length) block.append(media);
}
