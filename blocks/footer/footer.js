// Citi footer — content-first, generic (reads structure from /footer.plain.html).
// Fragment sections (top-level divs), in order:
//   [0..N] link columns: <h2> + <ul>  (grouped into the primary link band)
//   then a social/app band: two <p>s of image links (app badges, social icons)
//   then a copyright/legal band: <p>© + <ul> of legal links
//   then a legal-disclosures band: <h4> + <p>… + logo <p>
// footer.js READS this DOM; it never invents copy.

import { decorateBlock, loadBlock } from '../../scripts/aem.js';
import {
  getLocale, DEFAULT_LOCALE, fetchTranslationDictionary, applyTranslations,
} from '../../scripts/i18n.js';

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

// Cached across locale toggles so a rebuild re-reads the pristine authored
// fragment instead of an already-mutated DOM (mirrors blocks/header/header.js).
let cachedFooterFrag = null;
let localeListenerAttached = false;
let resizeListenerAttached = false;
const isDesktopMql = window.matchMedia('(min-width: 900px)');

/**
 * Mobile: column headings act as accordion toggles (collapsed by default).
 * On desktop the CSS keeps every list expanded and disables the toggle.
 * @param {Element} columnsBand
 */
function wireFooterAccordion(columnsBand) {
  columnsBand.querySelectorAll('.footer-column').forEach((col) => {
    const heading = col.querySelector('h2');
    const list = col.querySelector('ul');
    if (!heading || !list) return;
    heading.setAttribute('role', 'button');
    heading.setAttribute('tabindex', '0');
    heading.setAttribute('aria-expanded', 'false');
    const toggle = () => {
      if (isDesktopMql.matches) return;
      const open = col.getAttribute('aria-expanded') === 'true';
      col.setAttribute('aria-expanded', open ? 'false' : 'true');
      heading.setAttribute('aria-expanded', open ? 'false' : 'true');
    };
    heading.addEventListener('click', toggle);
    heading.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
    });
  });

  // Registered once and delegated against whatever `.footer-column`s are
  // currently live — a locale toggle replaces the footer content, so a
  // listener closed over this specific columnsBand would keep firing on a
  // detached element after the first switch.
  if (resizeListenerAttached) return;
  resizeListenerAttached = true;
  isDesktopMql.addEventListener('change', () => {
    document.querySelectorAll('.footer-column').forEach((col) => {
      col.setAttribute('aria-expanded', 'false');
      col.querySelector('h2')?.setAttribute('aria-expanded', 'false');
    });
  });
}

/**
 * Builds the full retail footer from a (never-mutated) parsed footer
 * fragment. Callable more than once against the same `frag` — safe to call
 * again after a locale switch to get back a clean, untranslated footer.
 * @param {Element} frag
 * @returns {DocumentFragment}
 */
function buildFooterContent(frag) {
  // The section-grouping logic below MOVES nodes out of each section (not
  // cloneNode) — clone the whole fragment up front so `frag` itself (cached
  // for a later locale-switch rebuild) is never consumed/emptied.
  const clone = frag.cloneNode(true);
  const sections = [...clone.children].filter((el) => el.tagName === 'DIV');
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
  let logoBand;
  let otherMainWrapper;
  let leftWrapper;
  let rightWrapper;
  for (; i < sections.length; i += 1) {
    const type = classify(sections[i]);
    const band = document.createElement('div');
    band.className = `footer-${type}`;
    while (sections[i].firstChild) band.append(sections[i].firstChild);
    const hasImage = band.querySelector(
      ':scope > picture, :scope > img, :scope > p > picture, :scope > p > img',
    );
    if (type === 'other' && hasImage) {
      band.classList.replace('footer-other', 'footer-logo');
      logoBand = band;
    } else if (type === 'other') {
      if (!otherMainWrapper) {
        otherMainWrapper = document.createElement('div');
        otherMainWrapper.className = 'footer-other-main-wrapper';

        leftWrapper = document.createElement('div');
        leftWrapper.className = 'footer-other-left-wrapper';

        rightWrapper = document.createElement('div');
        rightWrapper.className = 'footer-other-right-wrapper';

        otherMainWrapper.append(leftWrapper, rightWrapper);
        nav.append(otherMainWrapper);
      }

      if (!leftWrapper.firstElementChild) leftWrapper.append(band);
      else rightWrapper.append(band);
    } else {
      nav.append(band);
    }
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

  const content = document.createDocumentFragment();
  content.append(footer);
  if (logoBand) content.append(logoBand);

  wireFooterAccordion(columnsBand);
  return content;
}

/** Applies the current locale's translations to a freshly-built footer. */
async function applyCurrentLocale(root) {
  const locale = getLocale();
  const dict = locale !== DEFAULT_LOCALE ? await fetchTranslationDictionary() : {};
  applyTranslations(root, dict, locale);
}

/**
 * Once per page, reacts to a locale switch (fired by the header's toggle) by
 * rebuilding the footer from the cached pristine fragment and re-applying
 * translations for the new locale.
 * @param {Element} block
 */
function wireLocaleReactivity(block) {
  if (localeListenerAttached) return;
  localeListenerAttached = true;
  document.addEventListener('localechange', async () => {
    if (!cachedFooterFrag || isCbolPage()) return;
    block.replaceChildren(buildFooterContent(cachedFooterFrag));
    await applyCurrentLocale(block);
  });
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
  cachedFooterFrag = frag;

  block.append(buildFooterContent(frag));
  await applyCurrentLocale(block);
  wireLocaleReactivity(block);
}
