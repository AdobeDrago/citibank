// Citi footer — content-first, generic (reads structure from /footer.plain.html).
// Fragment sections (top-level divs), in order:
//   [0..N] link columns: <h2> + <ul>  (grouped into the primary link band)
//   then a social/app band: two <p>s of image links (app badges, social icons)
//   then a copyright/legal band: <p>© + <ul> of legal links
//   then a legal-disclosures band: <h4> + <p>… + logo <p>
// footer.js READS this DOM; it never invents copy.

/** Fetch the footer fragment: /content first (localhost/aem up), then root (DA/EDS prod). */
async function loadFooterFragment() {
  let base = '/content/';
  let resp = await fetch('/content/footer.plain.html');
  if (!resp.ok) { base = '/'; resp = await fetch('/footer.plain.html'); }
  if (!resp.ok) return null;
  const html = await resp.text();
  const tpl = document.createElement('div');
  tpl.innerHTML = html;
  // Relative image srcs (e.g. "images/icon.svg") must resolve against the
  // fragment's own folder, not the host page — otherwise a deep page resolves
  // them to a 404. Rewrite each relative src to an absolute path under the base.
  tpl.querySelectorAll('img[src]').forEach((img) => {
    const src = img.getAttribute('src');
    if (src && !/^(https?:)?\/\//.test(src) && !src.startsWith('/') && !src.startsWith('data:')) {
      img.setAttribute('src', `${base}${src}`);
    }
  });
  return tpl;
}

/** Classify a top-level fragment section by its content shape. */
function classify(section) {
  if (section.querySelector(':scope > h2')) return 'column';
  if (section.querySelector(':scope > h4')) return 'disclosures';
  if (section.querySelector(':scope > p > a > img')) return 'social';
  if (section.querySelector(':scope > ul')) return 'legal';
  return 'other';
}

/**
 * loads and decorates the footer
 * @param {Element} block The footer block element
 */
export default async function decorate(block) {
  block.textContent = '';
  const frag = await loadFooterFragment();
  if (!frag) return;

  const sections = [...frag.children].filter((el) => el.tagName === 'DIV');
  const nav = document.createElement('div');
  nav.className = 'footer-nav';

  // Group the leading run of column sections into a single link-columns band.
  const columnsBand = document.createElement('div');
  columnsBand.className = 'footer-columns';
  let i = 0;
  while (i < sections.length && classify(sections[i]) === 'column') {
    const col = document.createElement('div');
    col.className = 'footer-column';
    while (sections[i].firstChild) col.append(sections[i].firstChild);
    columnsBand.append(col);
    i += 1;
  }
  if (columnsBand.children.length) nav.append(columnsBand);

  // Remaining sections: social/app, legal (copyright + links), disclosures.
  for (; i < sections.length; i += 1) {
    const type = classify(sections[i]);
    const band = document.createElement('div');
    band.className = `footer-${type}`;
    while (sections[i].firstChild) band.append(sections[i].firstChild);
    nav.append(band);
  }

  // Source ships a responsive-duplicate logo node (two logo images) for content
  // parity. Keep the first visible and hide the rest with a dedicated class
  // (never a positional selector) so exactly one logo renders.
  const disclosures = nav.querySelector('.footer-disclosures');
  if (disclosures) {
    const logoParas = [...disclosures.querySelectorAll(':scope > p')]
      .filter((p) => p.querySelector('img'));
    logoParas.slice(1).forEach((p) => p.classList.add('footer-logo-duplicate'));
  }

  const footer = document.createElement('div');
  footer.className = 'footer-inner';
  footer.append(nav);
  block.append(footer);

  // Mobile: column headings act as accordion toggles (collapsed by default).
  // On desktop the CSS keeps every list expanded and disables the toggle.
  const isDesktop = window.matchMedia('(min-width: 900px)');
  columnsBand.querySelectorAll('.footer-column').forEach((col) => {
    const heading = col.querySelector('h2');
    const list = col.querySelector('ul');
    if (!heading || !list) return;
    heading.setAttribute('role', 'button');
    heading.setAttribute('tabindex', '0');
    heading.setAttribute('aria-expanded', 'false');
    const toggle = () => {
      if (isDesktop.matches) return;
      const open = col.getAttribute('aria-expanded') === 'true';
      col.setAttribute('aria-expanded', open ? 'false' : 'true');
      heading.setAttribute('aria-expanded', open ? 'false' : 'true');
    };
    heading.addEventListener('click', toggle);
    heading.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
    });
  });

  // Reset accordion state when crossing the breakpoint so desktop is never left collapsed.
  isDesktop.addEventListener('change', () => {
    columnsBand.querySelectorAll('.footer-column').forEach((col) => {
      col.setAttribute('aria-expanded', 'false');
      const h = col.querySelector('h2');
      if (h) h.setAttribute('aria-expanded', 'false');
    });
  });
}
