// Citi header/nav — content-first, generic (reads structure from /nav.plain.html).
// The fragment has 3 sections: [0] brand/utility bar, [1] main nav (items with
// nested link lists + a "Quick Links" sub-list), [2] tools (Open an Account, help).

const isDesktop = window.matchMedia('(min-width: 900px)');

/**
 * cbol landing pages (banking.citi.com/cbol/…) ship a distinct minimal header
 * — just the Citi logo, an FDIC line and the Citigold brand mark, with no
 * mega-menu — unlike the retail credit-cards chrome. Detect those pages so we
 * can load a different fragment and render a different layout. The check covers
 * both the localhost/preview path (/content/cbol/…) and DA/EDS prod (/cbol/…).
 */
function isCbolPage() {
  return /(^|\/)(content\/)?cbol(\/|$)/i.test(window.location.pathname);
}

/**
 * Fetch a nav fragment by base name. This project serves content under
 * `/content/` on localhost (`aem up`) but at the site ROOT on DA/EDS production
 * (see fstab.yaml, which mounts `/` → content.da.live). Pick the base
 * deterministically from the current page path — rather than always trying
 * `/content/` first and relying on a clean 404 — so production, where
 * `/content/…` does not resolve, works reliably. The other base is kept as a
 * fallback. Relative image srcs are rewritten to the resolved fragment base.
 */
async function loadNavFragmentNamed(name) {
  const onContent = window.location.pathname.startsWith('/content/');
  const bases = onContent ? ['/content/', '/'] : ['/', '/content/'];
  let base = bases[0];
  let resp = await fetch(`${base}${name}.plain.html`);
  if (!resp.ok) { [, base] = bases; resp = await fetch(`${base}${name}.plain.html`); }
  if (!resp.ok) return null;
  const html = await resp.text();
  const tpl = document.createElement('div');
  tpl.innerHTML = html;
  // Image srcs in the fragment are relative (e.g. "images/citi-logo.svg"). They
  // must resolve against the fragment's own folder, not the host page — otherwise
  // a deep page (e.g. /content/credit-cards/…) resolves them to a 404. Rewrite
  // every relative src to an absolute path under the fragment base.
  tpl.querySelectorAll('img[src]').forEach((img) => {
    const src = img.getAttribute('src');
    if (src && !/^(https?:)?\/\//.test(src) && !src.startsWith('/') && !src.startsWith('data:')) {
      img.setAttribute('src', `${base}${src}`);
    }
  });
  return tpl;
}

/** Backwards-compatible loader for the default retail nav fragment. */
const loadNavFragment = () => loadNavFragmentNamed('nav');

/**
 * Render the minimal cbol landing header. Fragment shape (one section):
 *   <p><a><img Citi logo></a></p>          → brand
 *   <p><img FDIC>FDIC-Insured …</p>         → FDIC assurance line
 *   <p>Citibank, N.A.</p>                   → legal entity line
 *   <p><img Citigold></p>                   → Citigold brand mark (right)
 * No nav items / mega-menu — a static branded bar.
 */
function renderCbolHeader(block, frag) {
  const section = [...frag.children].find((el) => el.tagName === 'DIV') || frag;
  const paras = [...section.querySelectorAll(':scope > p')];

  const nav = document.createElement('nav');
  nav.id = 'nav';
  nav.className = 'nav-cbol';
  nav.setAttribute('aria-label', 'Citi');

  const brand = document.createElement('div');
  brand.className = 'nav-cbol-brand';
  const fdic = document.createElement('div');
  fdic.className = 'nav-cbol-fdic';
  const mark = document.createElement('div');
  mark.className = 'nav-cbol-mark';

  paras.forEach((p) => {
    if (p.querySelector('img[alt="Citi" i]')) brand.append(p);
    else if (p.querySelector('img[alt="Citigold" i]')) mark.append(p);
    else fdic.append(p);
  });

  nav.append(brand, fdic, mark);
  block.append(nav);
}

/** Close every open top-level menu within a nav-sections container. */
function closeAllMenus(scope) {
  if (!scope) return;
  scope.querySelectorAll('.nav-item[aria-expanded="true"]').forEach((li) => {
    li.setAttribute('aria-expanded', 'false');
    const btn = li.querySelector(':scope > .nav-item-toggle');
    if (btn) btn.setAttribute('aria-expanded', 'false');
  });
}

/** Build one top-level nav item (with optional dropdown panel) from a source <li>. */
function buildNavItem(sourceLi) {
  const li = document.createElement('li');
  li.className = 'nav-item';

  // Top-level label link. On localhost `aem up` the fragment keeps a bare
  // `<li><a>…</a><ul>…</ul></li>`, but Document Authoring / the aem.live plain-
  // html pipeline wraps a lone anchor in a paragraph (`<li><p><a>…</a></p>…`),
  // so match either a direct-child anchor OR one nested in a direct-child <p>.
  // Without this, `:scope > a` is null on production and the button label falls
  // back to `sourceLi.textContent` — the concatenated text of every submenu item.
  const topLink = sourceLi.querySelector(':scope > a, :scope > p > a');
  const sublists = [...sourceLi.querySelectorAll(':scope > ul')];
  // The "Quick Links" heading is a text-only paragraph. Exclude the paragraph
  // that merely wraps the top-level label link (see above) so we don't mistake
  // it for the heading.
  const quickHeading = [...sourceLi.querySelectorAll(':scope > p')]
    .find((p) => !p.querySelector('a'));
  const hasPanel = sublists.length > 0;

  if (hasPanel) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'nav-item-toggle';
    btn.textContent = topLink ? topLink.textContent.trim() : sourceLi.textContent.trim();
    btn.setAttribute('aria-expanded', 'false');
    li.append(btn);
    li.setAttribute('aria-expanded', 'false');

    const panel = document.createElement('div');
    panel.className = 'nav-panel';

    // Mobile slide-in sub-panel back header (category label doubles as "back").
    // Hidden on desktop via CSS; shown only when the mobile sub-panel is open.
    const back = document.createElement('button');
    back.type = 'button';
    back.className = 'nav-panel-back';
    back.textContent = topLink ? topLink.textContent.trim() : sourceLi.textContent.trim();
    panel.append(back);

    const primary = document.createElement('ul');
    primary.className = 'nav-panel-links';
    [...sublists[0].children].forEach((childLi) => {
      const a = childLi.querySelector('a');
      if (!a) return;
      const item = document.createElement('li');
      const link = document.createElement('a');
      link.href = a.getAttribute('href') || '#';
      link.innerHTML = a.innerHTML;
      item.append(link);
      primary.append(item);
    });
    panel.append(primary);

    if (quickHeading && sublists[1]) {
      const ql = document.createElement('div');
      ql.className = 'nav-panel-quicklinks';
      const h = document.createElement('p');
      h.className = 'nav-panel-quicklinks-heading';
      h.textContent = quickHeading.textContent.trim();
      ql.append(h);
      const qul = document.createElement('ul');
      [...sublists[1].children].forEach((childLi) => {
        const a = childLi.querySelector('a');
        if (!a) return;
        const item = document.createElement('li');
        const link = document.createElement('a');
        link.href = a.getAttribute('href') || '#';
        link.innerHTML = a.innerHTML;
        item.append(link);
        qul.append(item);
      });
      ql.append(qul);
      panel.append(ql);
    }

    li.append(panel);

    // Mobile: the back header closes the open sub-panel and returns to the list.
    back.addEventListener('click', (e) => {
      if (isDesktop.matches) return;
      e.stopPropagation();
      li.setAttribute('aria-expanded', 'false');
      btn.setAttribute('aria-expanded', 'false');
      const nav = li.closest('nav');
      if (nav) nav.classList.remove('nav-subpanel-open');
    });

    li.addEventListener('mouseenter', () => {
      if (!isDesktop.matches) return;
      closeAllMenus(li.closest('.nav-sections'));
      li.setAttribute('aria-expanded', 'true');
      btn.setAttribute('aria-expanded', 'true');
    });
    li.addEventListener('mouseleave', () => {
      if (!isDesktop.matches) return;
      li.setAttribute('aria-expanded', 'false');
      btn.setAttribute('aria-expanded', 'false');
    });
    btn.addEventListener('click', () => {
      // Desktop only: click toggles the hover dropdown. On mobile the delegated
      // navList handler owns click (slide-in sub-panel), so skip here to avoid a
      // double toggle that cancels itself out.
      if (!isDesktop.matches) return;
      const open = li.getAttribute('aria-expanded') === 'true';
      closeAllMenus(li.closest('.nav-sections'));
      li.setAttribute('aria-expanded', open ? 'false' : 'true');
      btn.setAttribute('aria-expanded', open ? 'false' : 'true');
    });
  } else if (topLink) {
    const link = document.createElement('a');
    link.href = topLink.getAttribute('href') || '#';
    link.innerHTML = topLink.innerHTML;
    li.append(link);
  }
  return li;
}

/**
 * loads and decorates the header
 * @param {Element} block The header block element
 */
export default async function decorate(block) {
  block.textContent = '';

  // cbol landing pages get a distinct minimal header from their own fragment.
  if (isCbolPage()) {
    const cbolFrag = await loadNavFragmentNamed('cbol-nav');
    if (cbolFrag) {
      block.classList.add('header-cbol');
      renderCbolHeader(block, cbolFrag);
      return;
    }
    // fall through to the default nav if the cbol fragment is unavailable
  }

  const frag = await loadNavFragment();
  if (!frag) return;

  const sections = [...frag.children].filter((el) => el.tagName === 'DIV');
  const [brandSec, navSec, toolsSec] = sections;

  const nav = document.createElement('nav');
  nav.id = 'nav';
  nav.setAttribute('aria-label', 'Main navigation');

  // --- Row 1: utility bar (brand + utility links) ---
  const util = document.createElement('div');
  util.className = 'nav-utility';
  if (brandSec) {
    const brand = document.createElement('div');
    brand.className = 'nav-brand';
    brandSec.querySelectorAll(':scope > p').forEach((p) => brand.append(p.cloneNode(true)));
    const utilLinks = brandSec.querySelector(':scope > ul');
    const tools = document.createElement('ul');
    tools.className = 'nav-utility-links';
    if (utilLinks) [...utilLinks.children].forEach((li) => tools.append(li.cloneNode(true)));
    util.append(brand, tools);
  }

  // --- Row 2: main nav ---
  const main = document.createElement('div');
  main.className = 'nav-main';

  const hamburger = document.createElement('button');
  hamburger.type = 'button';
  hamburger.className = 'nav-hamburger';
  hamburger.setAttribute('aria-label', 'Menu');
  hamburger.setAttribute('aria-expanded', 'false');
  hamburger.innerHTML = '<span class="nav-hamburger-icon"></span>';

  const sectionsWrap = document.createElement('div');
  sectionsWrap.className = 'nav-sections';
  const navList = document.createElement('ul');
  navList.className = 'nav-list';
  if (navSec) {
    const topUl = navSec.querySelector(':scope > ul');
    if (topUl) [...topUl.children].forEach((li) => navList.append(buildNavItem(li)));
  }
  if (toolsSec) {
    const toolsUl = toolsSec.querySelector(':scope > ul');
    if (toolsUl) {
      [...toolsUl.children].forEach((li) => {
        const a = li.querySelector('a');
        if (!a) return;
        const item = document.createElement('li');
        item.className = 'nav-tool';
        const link = document.createElement('a');
        link.href = a.getAttribute('href') || '#';
        link.innerHTML = a.innerHTML;
        item.append(link);
        navList.append(item);
      });
    }
  }
  sectionsWrap.append(navList);
  main.append(hamburger, sectionsWrap);

  hamburger.addEventListener('click', () => {
    const open = hamburger.getAttribute('aria-expanded') === 'true';
    hamburger.setAttribute('aria-expanded', open ? 'false' : 'true');
    nav.classList.toggle('nav-open', !open);
    if (open) {
      closeAllMenus(navList);
      nav.classList.remove('nav-subpanel-open');
    }
  });

  // Mobile: tapping a category slides in its sub-panel (replacing the list);
  // the panel's back header returns to the list. nav-subpanel-open lets CSS
  // hide the top-level list while a sub-panel is showing.
  navList.addEventListener('click', (e) => {
    if (isDesktop.matches) return;
    const btn = e.target.closest('.nav-item-toggle');
    if (!btn) return;
    const li = btn.closest('.nav-item');
    const open = li.getAttribute('aria-expanded') === 'true';
    closeAllMenus(navList);
    li.setAttribute('aria-expanded', open ? 'false' : 'true');
    btn.setAttribute('aria-expanded', open ? 'false' : 'true');
    nav.classList.toggle('nav-subpanel-open', !open);
  });

  // Close desktop dropdowns on outside click / escape.
  document.addEventListener('click', (e) => {
    if (!nav.contains(e.target)) closeAllMenus(navList);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeAllMenus(navList);
      hamburger.setAttribute('aria-expanded', 'false');
      nav.classList.remove('nav-open', 'nav-subpanel-open');
    }
  });

  // Viewport resize handling: reset menus/hamburger when crossing the breakpoint.
  isDesktop.addEventListener('change', () => {
    closeAllMenus(navList);
    hamburger.setAttribute('aria-expanded', 'false');
    nav.classList.remove('nav-open', 'nav-subpanel-open');
  });

  nav.append(util, main);
  block.append(nav);
}
