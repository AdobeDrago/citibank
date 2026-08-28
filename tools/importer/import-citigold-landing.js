/* eslint-disable */
/* global WebImporter */
/**
 * Self-contained import script for the Citigold featured-offer LANDING page.
 *
 * Source: https://banking.citi.com/cbol/om/checking/citigold/featured-offer/default.htm
 * Output: content/cbol/om/checking/citigold/featured-offer/default.plain.html
 *
 * The source is a STATIC semantic banking page (not the Angular PDP framework),
 * with 7 <main> sections plus a Terms & Conditions block that lives in the page
 * footer (contentinfo). This script rebuilds each section as EDS blocks +
 * default content, and PULLS the T&C block up into main so no legal copy is lost.
 *
 * It is injected as raw page text by run-bulk-import.js, so it must be flat and
 * self-contained (no ES imports) and expose window.CustomImportScript.default
 * with a transformDOM(...) function returning [{ element, path, report }].
 */
(function () {
  const TEMPLATE_NAME = 'citigold-landing';

  const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();

  // Build a section-metadata block ({ Style: <style> }) so the section can be
  // styled by body.<template>.<style> rules without inventing new blocks.
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

  // ---- Section builders. Each returns an array of DOM nodes to append to main,
  //      followed by a section break (<hr>) added by the caller. ----

  function buildHero(document, section) {
    const nodes = [];
    const h1 = section.querySelector('h1');
    if (h1) nodes.push(heading(document, 1, h1.textContent));
    // offer paragraph + disclaimer paragraph (skip empty). Drop the inline
    // footnote jump-links (superscript "1"/"§"/etc.) so their marker text does
    // not glue onto the copy; keep the sentence text intact.
    section.querySelectorAll('p').forEach((srcP) => {
      const clone = srcP.cloneNode(true);
      clone.querySelectorAll('sup, a.jmp-lnk, .jmp-lnk').forEach((n) => n.remove());
      // drop the now-orphaned " ." left where "See offer details." linked out,
      // and collapse any resulting doubled period ("activities..") to one.
      const t = norm(clone.textContent)
        .replace(/\s+\./g, '.')
        .replace(/\.{2,}/g, '.')
        .trim();
      if (t) nodes.push(para(document, t));
    });
    // primary CTA -> link. Source uses a <button class="hero__cta">Get Started</button>;
    // prefer it explicitly. Ignore in-page footnote/jump links (.jmp-lnk, single
    // char like "1"/"§", or "See offer details").
    const ctaBtn = section.querySelector('.hero__cta, button');
    let ctaText = norm(ctaBtn && ctaBtn.textContent);
    if (!ctaText || /see offer details/i.test(ctaText) || ctaText.length < 3) ctaText = 'Get Started';
    const a = document.createElement('a');
    a.href = '#apply';
    a.textContent = ctaText;
    const ctaP = document.createElement('p');
    ctaP.append(a);
    nodes.push(ctaP);

    const hero = WebImporter.Blocks.createBlock(document, {
      name: 'hero',
      cells: [[nodes]],
    });
    return [hero, sectionMetadata(document, 'landing-hero')];
  }

  // Append an element's text to `target`, but keep any trailing footnote marker
  // (source wraps it in a <sup>, e.g. "Fees" + <sup>2</sup>) as a real <sup> so
  // it renders raised instead of gluing onto the label ("Fees2").
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
        // recurse into spans/links etc., flattening their text but keeping sups
        appendWithFootnotes(document, target, node);
      }
    });
  }

  // A feature list rendered as a text-only cards block, preceded by its H2.
  function buildCardsFromList(document, h2Text, listEl, style) {
    const cells = [];
    [...listEl.children].forEach((li) => {
      const title = li.querySelector('h3, h4, strong');
      const desc = li.querySelector('p');
      const cell = [];
      if (title && norm(title.textContent)) {
        const p = document.createElement('p');
        const strong = document.createElement('strong');
        appendWithFootnotes(document, strong, title);
        p.append(strong);
        cell.push(p);
      }
      if (desc && norm(desc.textContent)) {
        const p = document.createElement('p');
        appendWithFootnotes(document, p, desc);
        cell.push(p);
      }
      if (cell.length) cells.push([cell]);
    });
    if (!cells.length) return [];
    const out = [];
    if (h2Text) out.push(heading(document, 2, h2Text));
    out.push(WebImporter.Blocks.createBlock(document, { name: 'cards', cells }));
    if (style) out.push(sectionMetadata(document, style));
    return out;
  }

  // A dollar amount ("$500", "$30,000") -> <strong> with the "$" as a <sup>,
  // matching the source's superscript-dollar treatment. Returns a <p>.
  // Position in the cell (2nd child = big offer amount, 4th = min balance)
  // drives sizing in CSS, so no marker attribute is needed here.
  function amountPara(document, dollarStr) {
    const m = String(dollarStr).match(/\$?\s*([\d,]+)/);
    const num = m ? m[1] : String(dollarStr);
    const p = document.createElement('p');
    const strong = document.createElement('strong');
    const sup = document.createElement('sup');
    sup.textContent = '$';
    strong.append(sup, document.createTextNode(num));
    p.append(strong);
    return p;
  }

  // Deposit tiers ($500 / $1,500) as a 2-column columns block. Each cell stacks:
  // small "EARN" label, large $amount (sup $), "Minimum Balance:" label, $amount.
  function buildDepositTiles(document, earningsEl) {
    const tiers = [...earningsEl.children]
      .filter((c) => !/^or$/i.test(norm(c.textContent)) && norm(c.textContent).length > 2);
    if (!tiers.length) return [];
    const row = tiers.map((tier) => {
      const cell = [];
      const full = norm(tier.textContent);
      // "EARN $500 Minimum Balance: $30,000"
      const m = full.match(/EARN\s*(\$[\d,]+)\s*(?:Minimum Balance:\s*(\$[\d,]+))?/i);
      if (m) {
        cell.push(para(document, 'EARN'));
        cell.push(amountPara(document, m[1]));
        if (m[2]) {
          cell.push(para(document, 'Minimum Balance:'));
          cell.push(amountPara(document, m[2]));
        }
      } else {
        cell.push(para(document, full));
      }
      return cell;
    });
    return [WebImporter.Blocks.createBlock(document, { name: 'columns', cells: [row] })];
  }

  function buildBonus(document, section) {
    const out = [];
    const h2 = section.querySelector('h2');
    if (h2) out.push(heading(document, 2, h2.textContent));

    const earnings = section.querySelector('.bonus__earnings');
    if (earnings) out.push(...buildDepositTiles(document, earnings));

    // 3 numbered steps -> cards
    const stepsWrap = section.querySelector('.bonus__steps-wrapper');
    if (stepsWrap) {
      const stepItems = [...stepsWrap.querySelectorAll('li')].filter((li) => li.querySelector('h3'));
      const seen = new Set();
      const cells = [];
      stepItems.forEach((li) => {
        const h3 = li.querySelector('h3');
        // source wraps the step number in its own span ("Step 1") followed by
        // the title text ("Open new account"). Split them: the "Step N" label
        // renders as a small gold line above the navy bold title.
        let label = '';
        let title = '';
        if (h3) {
          const parts = [...h3.childNodes].map((n) => norm(n.textContent)).filter(Boolean);
          const m = parts.length ? parts[0].match(/^(Step\s*\d+)\s*(.*)$/i) : null;
          if (m) {
            label = norm(m[1]);
            title = norm([m[2], ...parts.slice(1)].filter(Boolean).join(' '));
          } else {
            title = norm(parts.join(' '));
          }
        }
        const key = norm(`${label} ${title}`);
        if (!key || seen.has(key)) return; // de-dupe (source duplicates first step)
        seen.add(key);
        const desc = li.querySelector('p');
        const cell = [];
        if (label) cell.push(para(document, label)); // "Step N" label line
        const p = document.createElement('p');
        const strong = document.createElement('strong');
        strong.textContent = title || key;
        p.append(strong);
        cell.push(p);
        if (desc && norm(desc.textContent)) cell.push(para(document, desc.textContent));
        cells.push([cell]);
      });
      if (cells.length) out.push(WebImporter.Blocks.createBlock(document, { name: 'cards', cells }));
    }

    // Bonus footnotes (offer terms) -> default paragraphs, de-duplicated.
    const seenTxt = new Set();
    section.querySelectorAll('.bonus__earnings-disclaimer p, .bonus__steps-wrapper ~ * p, [class*="footnote"] p').forEach((p) => {
      const t = norm(p.textContent);
      if (t && t.length > 12 && !seenTxt.has(t)) { seenTxt.add(t); out.push(para(document, t)); }
    });

    out.push(sectionMetadata(document, 'landing-bonus'));
    return out;
  }

  // CAMB line: "Combined Average Monthly Balance $0 - $29,999.99" — keep the
  // label as normal text and bold the dollar range (matches source emphasis).
  function cambPara(document, text) {
    const full = norm(text);
    const p = document.createElement('p');
    const idx = full.indexOf('$');
    if (idx > 0) {
      p.append(document.createTextNode(`${full.slice(0, idx).trim()} `));
      const strong = document.createElement('strong');
      strong.textContent = full.slice(idx).trim();
      p.append(strong);
    } else {
      p.textContent = full;
    }
    return p;
  }

  function buildAccounts(document, section) {
    const out = [];
    const h2 = section.querySelector('h2');
    if (h2) out.push(heading(document, 2, h2.textContent));
    // intro paragraph
    const intro = section.querySelector('.accounts__body p, .accounts__title-container ~ * p');
    if (intro && norm(intro.textContent)) out.push(para(document, intro.textContent));

    // "Citi Relationship Tiers" tab label (small centered bordered tab in source)
    const tab = [...section.querySelectorAll('div, span, p, h3, h4')]
      .find((el) => /^citi relationship tiers$/i.test(norm(el.textContent)));
    if (tab) {
      const p = document.createElement('p');
      const em = document.createElement('em');
      em.textContent = 'Citi Relationship Tiers';
      p.append(em);
      out.push(p);
    }

    const container = section.querySelector('.accounts__cards-container');
    if (container) {
      const cards = [...container.children].filter((c) => c.querySelector('h3'));
      const cells = [];
      cards.forEach((card) => {
        const cell = [];
        const tier = card.querySelector('h3');
        if (tier) {
          const p = document.createElement('p');
          const strong = document.createElement('strong');
          strong.textContent = norm(tier.textContent);
          p.append(strong);
          cell.push(p);
        }
        // CAMB range paragraph (first p) — label normal, dollar range bold
        const camb = card.querySelector('p');
        if (camb && norm(camb.textContent)) cell.push(cambPara(document, camb.textContent));
        // "Includes all …" subheading
        const inc = card.querySelector('h4');
        if (inc && norm(inc.textContent)) {
          const p = document.createElement('p');
          const em = document.createElement('em');
          em.textContent = norm(inc.textContent);
          p.append(em);
          cell.push(p);
        }
        // benefit bullets
        const bullets = [...card.querySelectorAll('ul li')].map((li) => norm(li.textContent)).filter(Boolean);
        if (bullets.length) {
          const ul = document.createElement('ul');
          bullets.forEach((b) => { const li = document.createElement('li'); li.textContent = b; ul.append(li); });
          cell.push(ul);
        }
        // Open an Account CTA (skip phone-number-only ctas)
        const ctaEl = card.querySelector('button, a');
        const ctaTxt = norm(ctaEl && ctaEl.textContent);
        if (ctaTxt && /open an account/i.test(ctaTxt)) {
          const a = document.createElement('a');
          a.href = '#apply';
          a.textContent = 'Open an Account';
          const p = document.createElement('p');
          p.append(a);
          cell.push(p);
        }
        if (cell.length) cells.push([cell]);
      });
      if (cells.length) out.push(WebImporter.Blocks.createBlock(document, { name: 'cards', cells }));
    }

    // trailing note (re-tiering) if present
    const note = section.querySelector('.accounts__footnotes p, [class*="footnote"] p');
    if (note && norm(note.textContent)) out.push(para(document, note.textContent));

    out.push(sectionMetadata(document, 'landing-tiers'));
    return out;
  }

  // Generic "heading + paragraph + optional link" section -> default content.
  function buildSimple(document, section, style) {
    const out = [];
    section.querySelectorAll('h1, h2, h3, p, a').forEach((el) => {
      const tag = el.tagName.toLowerCase();
      const t = norm(el.textContent);
      if (!t) return;
      if (/^h[1-3]$/.test(tag)) {
        out.push(heading(document, Number(tag[1]), t));
      } else if (tag === 'a') {
        // only standalone links not already inside a captured <p>
        if (el.closest('p')) return;
        const a = document.createElement('a');
        a.href = el.getAttribute('href') || '#';
        a.textContent = t;
        const p = document.createElement('p');
        p.append(a);
        out.push(p);
      } else {
        out.push(para(document, t));
      }
    });
    if (out.length && style) out.push(sectionMetadata(document, style));
    return out;
  }

  window.CustomImportScript = {
    default: {
      transform: (payload) => {
        const { document, url, params } = payload;
        const sourceUrl = (params && params.originalURL) || url;
        const main = document.createElement('main');
        const src = document.querySelector('main') || document.body;

        const push = (nodes) => {
          if (!nodes || !nodes.length) return;
          nodes.forEach((n) => main.append(n));
          main.append(document.createElement('hr'));
        };

        // 1. Hero
        const hero = src.querySelector('section.hero');
        if (hero) push(buildHero(document, hero));

        // 2. Benefits: two subsections in one section
        const bf = src.querySelector('section.benefits_features');
        if (bf) {
          const explore = bf.querySelector('.benefits_features__rtb');
          const exploreH2 = [...bf.querySelectorAll('h2')].find((h) => /explore/i.test(h.textContent));
          const exploreList = explore && explore.querySelector('ul, ol');
          if (exploreList) push(buildCardsFromList(document, exploreH2 && exploreH2.textContent, exploreList, 'landing-features'));

          const seeH2 = [...bf.querySelectorAll('h2')].find((h) => /see what citigold/i.test(h.textContent));
          // "See what Citigold" list — target its specific container; pick the UL
          // with the most items (avoids a smaller responsive-duplicate list).
          const seeLists = [...bf.querySelectorAll('.benefits_features__card-container, .rounded-corners-wrapper ul, .rounded-corners-wrapper ol')];
          const seeList = seeLists.sort((a, b) => b.children.length - a.children.length)[0];
          if (seeList) push(buildCardsFromList(document, seeH2 && seeH2.textContent, seeList, 'landing-offer-cards'));

          // "INVESTMENTS: NOT FDIC INSURED …" strip inside benefits — select the
          // SMALLEST element whose entire text is the disclaimer (avoid grabbing a
          // big ancestor whose textContent is the whole section).
          const invEl = [...bf.querySelectorAll('*')]
            .filter((e) => /^INVESTMENTS:\s*NOT FDIC INSURED/i.test(norm(e.textContent)) && norm(e.textContent).length < 90 && e.children.length === 0)[0]
            || [...bf.querySelectorAll('*')].filter((e) => /^INVESTMENTS:\s*NOT FDIC INSURED/i.test(norm(e.textContent)) && norm(e.textContent).length < 90)[0];
          if (invEl) push([para(document, invEl.textContent)]);
        }

        // 3. Bonus
        const bonus = src.querySelector('section#bonus');
        if (bonus) push(buildBonus(document, bonus));

        // 4. Account tiers
        const accounts = src.querySelector('section#account-features');
        if (accounts) push(buildAccounts(document, accounts));

        // 5. Home-address / Have Questions
        const zip = src.querySelector('section.zip-selector-inline');
        if (zip) push(buildSimple(document, zip, 'landing-zip'));

        // 6. Investment/insurance disclaimer strip (miranda)
        const miranda = src.querySelector('section.miranda');
        if (miranda && norm(miranda.textContent)) push([para(document, miranda.textContent), sectionMetadata(document, 'landing-miranda')]);

        // 7. Final apply CTA (sticky bar)
        const sticky = src.querySelector('section.sticky-bar');
        if (sticky) {
          const nodes = [];
          const h2 = sticky.querySelector('h2');
          if (h2) nodes.push(heading(document, 2, h2.textContent));
          const a = document.createElement('a');
          a.href = '#apply';
          a.textContent = 'Get Started';
          const p = document.createElement('p');
          p.append(a);
          nodes.push(p);
          nodes.push(sectionMetadata(document, 'landing-cta'));
          push(nodes);
        }

        // NOTE: The full "Important Legal Disclosures & Information" T&C block
        // lives in the source page <footer>, not the main content. It is authored
        // into the cbol footer fragment (content/cbol-footer.plain.html) and
        // rendered by blocks/footer/footer.js, so it is intentionally NOT pulled
        // into the page body here.

        // Remove the trailing <hr> so there is no empty final section.
        if (main.lastElementChild && main.lastElementChild.tagName === 'HR') {
          main.lastElementChild.remove();
        }

        // Page metadata + a `template` row so the page gets a
        // `template-citigold-landing` body class (via decorateTemplateAndTheme),
        // which scopes the landing styling without touching other templates.
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

        // Path from source URL: strip .htm -> featured-offer/default
        const rawPath = new URL(sourceUrl).pathname.replace(/\/$/, '').replace(/\.html?$/, '');
        const path = WebImporter.FileUtils.sanitizePath(rawPath === '' ? '/index' : rawPath);

        return [{
          element: main,
          path,
          report: { title: document.title, template: TEMPLATE_NAME },
        }];
      },
    },
  };
})();
