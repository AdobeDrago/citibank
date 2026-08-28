/* eslint-disable */
/* global WebImporter */
/**
 * Self-contained import script for the credit-cards EXPLORE landing page.
 *
 * Source: https://www.citi.com/credit-cards/?intc=citihpmenu~creditcards~explore
 * Output: content/credit-cards/index.plain.html
 *
 * The page is an Angular SSR page whose main content is a series of `.card-stack`
 * category sections. The FIRST stack is a single wide "featured" card; the rest
 * are category rows (heading + "View all …" link + a slider of card tiles). Each
 * stack becomes one `cc-category` block; the section heading + view-all link are
 * emitted as default content above the block. The first stack uses the
 * `cc-category (featured)` variant.
 *
 * Injected as raw page text by run-bulk-import.js, so it must be flat and
 * self-contained (no ES imports) and expose window.CustomImportScript.default
 * with a transform(...) returning [{ element, path, report }].
 */
(function () {
  const TEMPLATE_NAME = 'credit-card-explore';

  const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();

  function sectionMetadata(document, style) {
    return WebImporter.Blocks.createBlock(document, {
      name: 'Section Metadata',
      cells: [['Style', style]],
    });
  }

  function heading(document, level, text) {
    const h = document.createElement(`h${level}`);
    h.textContent = norm(text);
    return h;
  }

  function para(document, text) {
    const p = document.createElement('p');
    p.textContent = norm(text);
    return p;
  }

  // Append an element's text to `target`, keeping trailing footnote markers
  // (source wraps them in <sup>, e.g. "purchases" + <sup>2</sup>) as real <sup>
  // so they render raised instead of gluing onto the copy ("purchases2").
  function appendWithFootnotes(document, target, sourceEl) {
    [...sourceEl.childNodes].forEach((node) => {
      if (node.nodeType === 3) {
        const t = node.textContent.replace(/\s+/g, ' ');
        if (t) target.append(document.createTextNode(t));
      } else if (node.tagName === 'SUP') {
        const marker = norm(node.textContent);
        if (marker) {
          const sup = document.createElement('sup');
          sup.textContent = marker;
          target.append(sup);
        }
      } else {
        appendWithFootnotes(document, target, node);
      }
    });
  }

  // Resolve the card-art image element inside a tile.
  function findCardImg(tile) {
    return tile.querySelector('img[src*="/cards/"], img[src*="_306x192"], img');
  }

  // Build the cells (one row per card tile) for a `.card-stack`.
  function buildCards(document, stack) {
    // Each card is a `.cds-tile-component` — the featured stack wraps all its
    // cards in a single container child, so we must select the real tile roots,
    // not the container's direct children (which would merge every card's copy).
    let tiles = [...stack.querySelectorAll('.cds-tile-component')];
    if (!tiles.length) {
      // Fallback: any descendant carrying a card name (h3) whose bullets it owns.
      const container = stack.children[1] || stack;
      tiles = [...container.children].filter((c) => c.querySelector('h3'));
    }
    const cells = [];

    tiles.forEach((tile) => {
      const cell = [];

      // Badge (category label): an <h2> inside the tile ("Earn cash back",
      // "No Annual Fee", "Limited time offer" …). Emit as an <h4> so it is
      // clearly the card badge, not a section heading.
      const badgeEl = tile.querySelector('h2');
      if (badgeEl && norm(badgeEl.textContent)) {
        const h4 = document.createElement('h4');
        appendWithFootnotes(document, h4, badgeEl);
        cell.push(h4);
      }

      // Card art image.
      const img = findCardImg(tile);
      if (img) {
        const clone = document.createElement('img');
        clone.src = img.getAttribute('src');
        clone.alt = img.getAttribute('alt') || (tile.querySelector('h3') ? norm(tile.querySelector('h3').textContent) : '');
        cell.push(clone);
      }

      // Card name (h3), linked to the PDP.
      const h3 = tile.querySelector('h3');
      if (h3) {
        const nameLink = h3.querySelector('a');
        const h = document.createElement('h3');
        if (nameLink && nameLink.getAttribute('href')) {
          const a = document.createElement('a');
          a.href = nameLink.getAttribute('href');
          appendWithFootnotes(document, a, h3);
          h.append(a);
        } else {
          appendWithFootnotes(document, h, h3);
        }
        cell.push(h);
      }

      // Short description (featured cards only). Source puts it in a
      // `.text-description` div, not a <p>; fall back to any element that looks
      // like a tagline. Only emit when it holds real copy.
      const descEl = tile.querySelector('.text-description, [class*="description"], [class*="tagline"]');
      if (descEl && norm(descEl.textContent) && !descEl.querySelector('li')) {
        const p = document.createElement('p');
        appendWithFootnotes(document, p, descEl);
        if (norm(p.textContent)) cell.push(p);
      }

      // Feature bullets. Drop the pricing/info footnote list-items (their text
      // is just "Important Pricing & Information +" / "Additional Information +")
      // — those are legal jump-links, not product features.
      const bulletItems = [...tile.querySelectorAll('li')].filter((li) => {
        // Strip a leading footnote marker ("1", "2", "§") so the jump-link items
        // ("1Important Pricing & Information +") are matched and dropped.
        const t = norm(li.textContent).replace(/^[\d§†*]+\s*/, '');
        if (!t) return false;
        if (/^(important pricing|additional information)/i.test(t)) return false;
        if (/^(compare|card details|apply now)/i.test(t)) return false;
        return true;
      });
      if (bulletItems.length) {
        const ul = document.createElement('ul');
        bulletItems.forEach((li) => {
          const item = document.createElement('li');
          appendWithFootnotes(document, item, li);
          if (norm(item.textContent)) ul.append(item);
        });
        if (ul.children.length) cell.push(ul);
      }

      // "Card details" link (to the PDP).
      const detailsLink = [...tile.querySelectorAll('a')].find((a) => /card details/i.test(a.textContent));
      if (detailsLink && detailsLink.getAttribute('href')) {
        const a = document.createElement('a');
        a.href = detailsLink.getAttribute('href');
        a.textContent = 'Card details';
        const p = document.createElement('p');
        p.append(a);
        cell.push(p);
      }

      // "Apply now" primary CTA.
      const applyLink = [...tile.querySelectorAll('a')].find((a) => /apply now/i.test(a.textContent));
      if (applyLink && applyLink.getAttribute('href')) {
        const a = document.createElement('a');
        a.href = applyLink.getAttribute('href');
        a.textContent = 'Apply now';
        const p = document.createElement('p');
        p.append(a);
        cell.push(p);
      }

      if (cell.length) cells.push([cell]);
    });

    return cells;
  }

  // Build the header cell for a stack: the section heading + its "View all …"
  // link. Rendered as the FIRST row of the cc-category block so the block owns
  // it (and the featured variant can style the link as a bordered button). The
  // block JS detects this row by "has a heading (h1/h2) and no card name (h3)".
  //   headingText: the section title (e.g. "Rewards Credit Cards")
  //   headingLevel: 1 for the featured stack (page H1), else 2
  function buildHeaderCell(document, headingText, headingLevel, viewAllEl) {
    const cell = [];
    if (headingText) cell.push(heading(document, headingLevel, headingText));
    if (viewAllEl && norm(viewAllEl.textContent)) {
      const a = document.createElement('a');
      a.href = viewAllEl.getAttribute('href') || '#';
      a.textContent = norm(viewAllEl.textContent);
      const p = document.createElement('p');
      p.append(a);
      cell.push(p);
    }
    return cell.length ? cell : null;
  }

  // Build a whole category stack as a single cc-category block whose first row is
  // the header (heading + view-all) and whose remaining rows are the cards.
  //   headingText/headingLevel: the section title to render in the header row.
  function buildStack(document, stack, featured, headingText, headingLevel) {
    const cells = buildCards(document, stack);
    if (!cells.length) return [];

    // Header row (heading + "View all …") prepended before the card rows.
    const viewAll = stack.children[0] && stack.children[0].querySelector('a');
    const headerCell = buildHeaderCell(document, headingText, headingLevel, viewAll);
    if (headerCell) cells.unshift([headerCell]);

    const name = featured ? 'cc-category (featured)' : 'cc-category';
    const out = [WebImporter.Blocks.createBlock(document, { name, cells })];
    if (featured) out.push(sectionMetadata(document, 'explore-featured'));
    return out;
  }

  // Pick the visible card/product image in the hero. The source ships two <img>
  // with the same src (a hidden responsive duplicate + the shown one); take the
  // one that is actually rendered (has layout box), else the last match.
  function visibleImg(imgs) {
    const shown = imgs.filter((i) => i.getClientRects && i.getClientRects().length
      && i.getBoundingClientRect().width > 1);
    return shown[shown.length - 1] || imgs[imgs.length - 1] || null;
  }

  function cloneImg(document, src, alt) {
    const im = document.createElement('img');
    im.src = src;
    im.alt = alt || '';
    return im;
  }

  // Build the top promo hero banner (#hero-banner) as a `hero` block.
  //
  // The banner ROTATES per session between two structurally different variants:
  //   • "offer"  — a single-card promo: card-name eyebrow + offer headline +
  //                card art + navy "Apply Now" button + "Card details" link.
  //   • "brand"  — a product-family banner: a big white title + tagline + a
  //                fanned-cards image + a white "Learn More" button.
  // We detect which is live and emit the matching section Style so the CSS can
  // lay each out faithfully. Offer values (e.g. "50K") are API-injected and
  // captured as rendered at import time.
  function buildHeroBanner(document) {
    const hero = document.querySelector('#hero-banner');
    if (!hero) return [];

    const imgs = [...hero.querySelectorAll('img')];
    const bgImg = imgs.find((i) => /bg-img/.test(i.getAttribute('src') || ''));
    const otherImgs = imgs.filter((i) => i !== bgImg);
    const cardImg = visibleImg(otherImgs);

    const learnMore = [...hero.querySelectorAll('a, button')].find((a) => /learn more/i.test(a.textContent));
    const apply = [...hero.querySelectorAll('a, button')].find((a) => /apply now/i.test(a.textContent));
    const details = [...hero.querySelectorAll('a')].find((a) => /card details/i.test(a.textContent));

    // Row 1: background image (shared by both variants).
    const bgCell = [];
    if (bgImg) bgCell.push(cloneImg(document, bgImg.getAttribute('src'), bgImg.getAttribute('alt')));

    const content = [];
    let style = 'explore-hero-offer';

    // --- Brand variant: .hero-copy title + .hero-subcopy tagline + Learn More. ---
    const titleEl = hero.querySelector('.hero-copy');
    const taglineEl = hero.querySelector('.hero-subcopy');
    if (learnMore && (titleEl || taglineEl)) {
      style = 'explore-hero-brand';
      // Image FIRST so the shared hero.js classifies it as the card-art and does
      // not misread the tagline <p> as a retail promo ribbon (that heuristic only
      // fires when a text <p> precedes the card-art <p>). CSS places it right.
      if (cardImg) content.push(cloneImg(document, cardImg.getAttribute('src'), cardImg.getAttribute('alt') || norm(titleEl && titleEl.textContent)));
      if (titleEl && norm(titleEl.textContent)) {
        const h = document.createElement('h2');
        appendWithFootnotes(document, h, titleEl);
        content.push(h);
      }
      if (taglineEl && norm(taglineEl.textContent)) {
        const p = document.createElement('p');
        appendWithFootnotes(document, p, taglineEl);
        content.push(p);
      }
      if (learnMore.getAttribute('href')) {
        const a = document.createElement('a');
        a.href = learnMore.getAttribute('href');
        a.textContent = 'Learn More';
        const p = document.createElement('p');
        p.append(a);
        content.push(p);
      }
    } else {
      // --- Offer variant: eyebrow + headline + card art + Apply Now + details. ---
      const eyebrowEl = hero.querySelector('.eyebrow-copy');
      const eyebrow = eyebrowEl ? norm(eyebrowEl.textContent) : '';
      const isNoise = (t) => !t || /fill:|color:|hero-banner|apply now|card details/i.test(t) || t === eyebrow;
      let bodyEls = [...hero.querySelectorAll('.text-black')]
        .filter((e) => !isNoise(norm(e.textContent)) && norm(e.textContent).length > 8);
      if (!bodyEls.length) {
        bodyEls = [...hero.querySelectorAll('p, span, div, h1, h2, h3')]
          .filter((e) => e.children.length <= 2
            && !isNoise(norm(e.textContent))
            && norm(e.textContent).length > 8
            && !e.querySelector('img, a, button, style, script'));
      }
      bodyEls.sort((a, b) => a.textContent.length - b.textContent.length);
      const headlineEl = bodyEls[0];
      const supportEl = bodyEls.length > 1 ? bodyEls[bodyEls.length - 1] : null;

      if (cardImg) content.push(cloneImg(document, cardImg.getAttribute('src'), cardImg.getAttribute('alt') || eyebrow));
      if (eyebrow) content.push(para(document, eyebrow));
      if (headlineEl && norm(headlineEl.textContent)) {
        const h = document.createElement('h2');
        appendWithFootnotes(document, h, headlineEl);
        content.push(h);
      }
      if (supportEl && norm(supportEl.textContent)) {
        const p = document.createElement('p');
        appendWithFootnotes(document, p, supportEl);
        content.push(p);
      }
      if (apply && apply.getAttribute('href')) {
        const a = document.createElement('a');
        a.href = apply.getAttribute('href');
        a.textContent = 'Apply Now';
        const p = document.createElement('p');
        p.append(a);
        content.push(p);
      }
      if (details && details.getAttribute('href')) {
        const a = document.createElement('a');
        a.href = details.getAttribute('href');
        a.textContent = 'Card details';
        const p = document.createElement('p');
        p.append(a);
        content.push(p);
      }
    }

    if (!content.length) return [];
    const block = WebImporter.Blocks.createBlock(document, {
      name: 'hero',
      cells: [[bgCell.length ? bgCell : ''], [content]],
    });
    return [block, sectionMetadata(document, style)];
  }

  // Build the category tab strip that sits directly after the hero
  // (#legal_zeta_tabs > tds-category-nav-bar): "Explore Cards · Balance Transfer
  // (4) · Travel (8) · Rewards (12) · No Annual Fee (19) · Cash Back (3) ·
  // Retail (11)". On the source these are client-side (javascript:void(0))
  // filters, so we resolve each to its real Citi category landing page (same
  // slugs as the per-section "View all …" links). Emitted as a nav list of
  // links styled as a horizontal tab bar.
  function buildCategoryTabs(document) {
    const nav = document.querySelector('#legal_zeta_tabs tds-category-nav-bar, tds-category-nav-bar');
    if (!nav) return [];

    // Category label (sans count) -> category landing page path.
    const slugFor = (label) => {
      const key = label.replace(/\s*\(\d+\)\s*$/, '').trim().toLowerCase();
      const map = {
        'explore cards': '/credit-cards',
        'balance transfer': '/credit-cards/balance-transfer-credit-cards',
        travel: '/credit-cards/travel-reward-credit-cards',
        rewards: '/credit-cards/rewards-credit-cards',
        'no annual fee': '/credit-cards/no-annual-fee-credit-cards',
        'cash back': '/credit-cards/cash-back-credit-cards',
        retail: '/credit-cards/retail-credit-cards',
      };
      return map[key] || '#';
    };

    // De-dupe: the widget renders each label twice (a hidden <li> mirror + the
    // visible <a>). Collect unique labels in document order.
    const seen = new Set();
    const labels = [];
    [...nav.querySelectorAll('li, a, button')].forEach((el) => {
      const t = norm(el.textContent);
      if (!t || seen.has(t)) return;
      seen.add(t);
      labels.push(t);
    });
    if (!labels.length) return [];

    const ul = document.createElement('ul');
    labels.forEach((label) => {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = slugFor(label);
      a.textContent = label;
      li.append(a);
      ul.append(li);
    });

    return [ul, sectionMetadata(document, 'explore-category-tabs')];
  }

  window.CustomImportScript = {
    default: {
      transform: (payload) => {
        const { document, url, params } = payload;
        const sourceUrl = (params && params.originalURL) || url;
        const main = document.createElement('main');

        const push = (nodes) => {
          if (!nodes || !nodes.length) return;
          nodes.forEach((n) => main.append(n));
          main.append(document.createElement('hr'));
        };

        // 1. Top promo hero — referenced as a reusable FRAGMENT rather than an
        //    inline hero block. The source hero rotates per session; the distinct
        //    variants were captured to content/fragments/heroes/. This page pins
        //    the brand family banner. The `fragment` block loads the fragment's
        //    .plain.html and inlines it (so the hero styling + section Style ride
        //    along from the fragment). Path is /content-prefixed to match how
        //    this project serves content locally.
        const fragLink = document.createElement('a');
        fragLink.href = '/content/fragments/heroes/brand-citi-strata-credit-cards';
        fragLink.textContent = '/content/fragments/heroes/brand-citi-strata-credit-cards';
        push([WebImporter.Blocks.createBlock(document, {
          name: 'fragment',
          cells: [[fragLink]],
        })]);

        // 2. Category tab strip (#legal_zeta_tabs > tds-category-nav-bar) — the
        //    "Explore Cards / Balance Transfer / Travel / …" filter bar directly
        //    below the hero. Emitted as a nav list of links to each category page.
        const tabNodes = buildCategoryTabs(document);
        if (tabNodes.length) push(tabNodes);

        // 3. Offer disclaimer band ("These offers may not be available …").
        const disc = [...document.querySelectorAll('p')]
          .find((p) => /these offers may not be available/i.test(p.textContent));
        if (disc) {
          const clone = document.createElement('p');
          appendWithFootnotes(document, clone, disc);
          // drop the trailing "Read more" toggle text (it's a JS-only expander)
          const t = norm(clone.textContent).replace(/\s*Read more\s*$/i, '').trim();
          if (t) push([para(document, t), sectionMetadata(document, 'explore-disclaimer')]);
        }

        // 3. Category stacks. The FIRST stack is the featured variant and takes
        //    the page H1 ("Explore Citi Credit Cards") as its header; the rest use
        //    their own section <h2>. The heading + "View all …" link render inside
        //    the block as its first row.
        const h1 = document.querySelector('h1');
        const stacks = [...document.querySelectorAll('.card-stack')];

        stacks.forEach((stack, i) => {
          if (i === 0) {
            const headingText = h1 ? norm(h1.textContent) : 'Explore Citi Credit Cards';
            push(buildStack(document, stack, true, headingText, 1));
          } else {
            const h2 = stack.children[0] && stack.children[0].querySelector('h2');
            const headingText = h2 ? norm(h2.textContent) : '';
            push(buildStack(document, stack, false, headingText, 2));
          }
        });

        // Remove the trailing <hr> so there is no empty final section.
        if (main.lastElementChild && main.lastElementChild.tagName === 'HR') {
          main.lastElementChild.remove();
        }

        // Page metadata + a `template` row so the page gets a
        // `credit-card-explore` body class (via decorateTemplateAndTheme).
        main.append(document.createElement('hr'));
        WebImporter.rules.createMetadata(main, document);
        WebImporter.rules.transformBackgroundImages(main, document);
        WebImporter.rules.adjustImageUrls(main, sourceUrl, sourceUrl);
        const metaTable = [...main.querySelectorAll('table')].find((t) => {
          const first = t.querySelector('tr');
          return first && /^metadata$/i.test(first.textContent.trim());
        });
        if (metaTable) {
          const tbody = metaTable.querySelector('tbody') || metaTable;
          const tr = document.createElement('tr');
          const tdKey = document.createElement('td');
          tdKey.textContent = 'template';
          const tdVal = document.createElement('td');
          tdVal.textContent = TEMPLATE_NAME;
          tr.append(tdKey, tdVal);
          tbody.append(tr);
        }

        // Output path: /credit-cards -> credit-cards/index
        let rawPath = new URL(sourceUrl).pathname.replace(/\/$/, '').replace(/\.html?$/, '');
        if (rawPath === '' || /\/credit-cards$/.test(rawPath)) rawPath = '/credit-cards/index';
        const path = WebImporter.FileUtils.sanitizePath(rawPath);

        return [{
          element: main,
          path,
          report: { title: document.title, template: TEMPLATE_NAME },
        }];
      },
    },
  };
})();
