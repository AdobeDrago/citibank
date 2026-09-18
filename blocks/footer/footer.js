// Citi footer — content-first, generic (reads structure from /footer.plain.html).
// Fragment sections (top-level divs), in order:
//   [0..N] link columns: <h2> + <ul>  (grouped into the primary link band)
//   then a social/app band: two <p>s of image links (app badges, social icons)
//   then a copyright/legal band: <p>© + <ul> of legal links
//   then a legal-disclosures band: <h4> + <p>… + logo <p>
// footer.js READS this DOM; it never invents copy.

import { decorateBlock, loadBlock } from '../../scripts/aem.js';

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
 * Fetch a footer fragment by base name. This project serves content under
 * `/content/` on localhost (`aem up`) but at the site ROOT on DA/EDS production
 * (see fstab.yaml, which mounts `/` → content.da.live). Pick the base
 * deterministically from the current page path — rather than always trying
 * `/content/` first and relying on a clean 404 — so production, where
 * `/content/…` does not resolve, works reliably. The other base is kept as a
 * fallback. Relative image srcs are rewritten to the resolved fragment base.
 */
async function loadFooterFragmentNamed(name) {
  const onContent = window.location.pathname.startsWith('/content/');
  const bases = onContent ? ['/content/', '/'] : ['/', '/content/'];
  let base = bases[0];
  let resp = await fetch(`${base}${name}.plain.html`);
  if (!resp.ok) { [, base] = bases; resp = await fetch(`${base}${name}.plain.html`); }
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
 * Classify a cbol footer fragment section by its content shape.
 * Mirrors banking.citi.com `.footer`: logo, legal links, social, then terms.
 */
function classifyCbolSection(sec) {
  if (sec.querySelector(':scope > h4')) return 'disclosures';
  if (sec.querySelector(':scope > ul')) return 'legal';
  const links = sec.querySelectorAll(':scope > p > a');
  // Use 'a img' (not 'a > img') so images inside <picture> wrappers also match.
  if (links.length === 1 && sec.querySelectorAll(':scope > p').length === 1
    && sec.querySelector(':scope > p > a img')) return 'brand';
  if (links.length >= 1 && sec.querySelector(':scope > p > a img')
    && sec.querySelectorAll(':scope > p').length > 1) return 'social';
  // Long-form T&C (with optional trailing FDIC / Equal Housing badge images).
  return 'disclosures';
}

/**
 * Pull trailing image-only paragraphs (FDIC + Equal Housing) out of a
 * disclosures section into a badges row. Live places these after all terms
 * (`.footer__icons`), not above them.
 */
function extractCbolBadges(disclosures) {
  const imgOnlyParas = [...disclosures.querySelectorAll(':scope > p')].filter(
    (p) => p.querySelector('img') && !p.textContent.trim(),
  );
  if (!imgOnlyParas.length) return null;
  const badges = document.createElement('div');
  badges.className = 'footer-cbol-badges';
  imgOnlyParas.forEach((p) => {
    [...p.childNodes].forEach((node) => badges.append(node));
    p.remove();
  });
  return badges;
}

/**
 * Convert DA `.deposit-account` fee grids into a live-matching table with
 * "Deposit Account" / "Monthly Service Fee" column headers.
 * @param {Element} disclosures
 */
function decorateDepositAccountTables(disclosures) {
  disclosures.querySelectorAll('.deposit-account').forEach((grid) => {
    const rows = [...grid.children].filter((el) => el.tagName === 'DIV');
    if (!rows.length) return;

    const table = document.createElement('table');
    table.className = 'fixed simple left';

    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');
    ['Deposit Account', 'Monthly Service Fee'].forEach((label) => {
      const th = document.createElement('th');
      th.scope = 'col';
      th.textContent = label;
      headRow.append(th);
    });
    thead.append(headRow);

    const tbody = document.createElement('tbody');
    rows.forEach((row) => {
      const cells = [...row.children];
      const tr = document.createElement('tr');
      const th = document.createElement('th');
      th.scope = 'row';
      th.textContent = cells[0]?.textContent?.trim() || '';
      const td = document.createElement('td');
      td.textContent = cells[1]?.textContent?.trim() || '';
      tr.append(th, td);
      tbody.append(tr);
    });

    table.append(thead, tbody);
    grid.replaceWith(table);
  });
}

/**
 * Render the compact cbol landing footer. Fragment sections, in order:
 *   [0] logo:        <p><a><img></a></p>
 *   [1] legal:       <ul> of legal links
 *   [2] social:      <p> of image links
 *   [3] disclosures: long-form legal T&C (+ optional trailing badge imgs)
 * Structure matches live: nav row (logo | links | social) → terms → badges.
 */
function renderCbolFooter(block, frag) {
  const sections = [...frag.children].filter((el) => el.tagName === 'DIV');
  const inner = document.createElement('div');
  inner.className = 'footer-cbol-inner';

  const nav = document.createElement('div');
  nav.className = 'footer-cbol-nav';

  sections.forEach((sec) => {
    const type = classifyCbolSection(sec);
    const band = document.createElement('div');
    band.className = `footer-cbol-${type}`;
    while (sec.firstChild) band.append(sec.firstChild);

    if (type === 'brand' || type === 'legal' || type === 'social') {
      nav.append(band);
      return;
    }

    decorateDepositAccountTables(band);
    const badges = extractCbolBadges(band);
    inner.append(band);
    if (badges) inner.append(badges);
  });

  if (nav.children.length) inner.prepend(nav);
  block.append(inner);

  // The disclosures carry an authored `deposit-account` fee schedule. Fragment
  // content never passes through decorateBlocks, so load that block here.
  inner.querySelectorAll('.deposit-account').forEach((fees) => {
    decorateBlock(fees);
    loadBlock(fees);
  });
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
