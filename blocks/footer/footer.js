// Citi footer — content-first, generic (reads structure from /footer.plain.html).
// Fragment sections (top-level divs), in order:
//   [0..N] link columns: <h2> + <ul>  (grouped into the primary link band)
//   then a social/app band: two <p>s of image links (app badges, social icons)
//   then a copyright/legal band: <p>© + <ul> of legal links
//   then a legal-disclosures band: <h4> + <p>… + logo <p>
// footer.js READS this DOM; it never invents copy.

/**
 * cbol landing pages (banking.citi.com/cbol/…) ship a distinct compact legal
 * footer — logo, a single row of legal links, social icons, and FDIC/Equal
 * Housing badges — rather than the retail mega-footer with link columns.
 * Detect those pages (localhost preview /content/cbol/… and DA/EDS prod /cbol/…).
 */
function isCbolPage() {
  return /(^|\/)(content\/)?cbol(\/|$)/i.test(window.location.pathname);
}

/**
 * Fetch a footer fragment by base name: /content first (localhost / aem up),
 * then root (DA/EDS prod). Relative image srcs are rewritten to the base.
 */
async function loadFooterFragmentNamed(name) {
  let base = '/content/';
  let resp = await fetch(`/content/${name}.plain.html`);
  if (!resp.ok) { base = '/'; resp = await fetch(`/${name}.plain.html`); }
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

/** Backwards-compatible loader for the default retail footer fragment. */
const loadFooterFragment = () => loadFooterFragmentNamed('footer');

/**
 * Render the compact cbol landing footer. Fragment sections, in order:
 *   [0] logo:        <p><a><img></a></p>
 *   [1] legal:       <ul> of legal links
 *   [2] social:      <p> of image links
 *   [3] disclosures: <h4> + long-form legal T&C (incl. the fee-schedule table)
 *   [4] band:        badges <p>(imgs) + legal <p> + copyright <p>
 * A single navy bar — no accordion columns.
 */
function renderCbolFooter(block, frag) {
  const sections = [...frag.children].filter((el) => el.tagName === 'DIV');
  const inner = document.createElement('div');
  inner.className = 'footer-cbol-inner';

  const classFor = (sec) => {
    // disclosures = the long-form "Important Legal Disclosures" T&C block (h4)
    if (sec.querySelector(':scope > h4')) return 'footer-cbol-disclosures';
    if (sec.querySelector(':scope > ul')) return 'footer-cbol-legal';
    const links = sec.querySelectorAll(':scope > p > a');
    // brand = a single linked logo image in a single paragraph
    if (links.length === 1 && sec.querySelectorAll(':scope > p').length === 1
      && sec.querySelector(':scope > p > a > img')) return 'footer-cbol-brand';
    // social = a row of multiple linked icons
    if (links.length > 1 && sec.querySelector(':scope > p > a > img')) return 'footer-cbol-social';
    return 'footer-cbol-band';
  };

  sections.forEach((sec) => {
    const band = document.createElement('div');
    band.className = classFor(sec);
    while (sec.firstChild) band.append(sec.firstChild);
    inner.append(band);
  });

  block.append(inner);
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

  // cbol landing pages get a distinct compact legal footer from their fragment.
  if (isCbolPage()) {
    const cbolFrag = await loadFooterFragmentNamed('cbol-footer');
    if (cbolFrag) {
      block.classList.add('footer-cbol');
      renderCbolFooter(block, cbolFrag);
      return;
    }
    // fall through to the default footer if the cbol fragment is unavailable
  }

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
