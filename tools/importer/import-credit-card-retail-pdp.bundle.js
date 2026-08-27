/* eslint-disable */
var CustomImportScript = (() => {
  var __defProp = Object.defineProperty;
  var __defProps = Object.defineProperties;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getOwnPropSymbols = Object.getOwnPropertySymbols;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __propIsEnum = Object.prototype.propertyIsEnumerable;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __spreadValues = (a, b) => {
    for (var prop in b || (b = {}))
      if (__hasOwnProp.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    if (__getOwnPropSymbols)
      for (var prop of __getOwnPropSymbols(b)) {
        if (__propIsEnum.call(b, prop))
          __defNormalProp(a, prop, b[prop]);
      }
    return a;
  };
  var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // tools/importer/import-credit-card-retail-pdp.js
  var import_credit_card_retail_pdp_exports = {};
  __export(import_credit_card_retail_pdp_exports, {
    default: () => import_credit_card_retail_pdp_default
  });

  // tools/importer/parsers/retail-hero.js
  function parse(element, { document: document2 }) {
    const box = element.querySelector("app-header-section-box") || element;
    const cardArt = box.querySelector("app-card-art img, .header-cards img");
    const cardName = box.querySelector("h1.card-name, h1#headerSection, h1");
    const tagline = box.querySelector(".card-tagline h2, h2");
    const manageLine = box.querySelector(".card-tagline-desc");
    const ribbon = box.querySelector(".green-tag-text, .green-tag, .header-feature-flag");
    const applyAnchor = box.querySelector('a[href*="/apply/"]');
    const pricingLink = [...box.querySelectorAll("a[href]")].find((a) => /important pricing/i.test(a.textContent));
    const contentCell = [];
    if (ribbon && ribbon.textContent.trim()) {
      const p = document2.createElement("p");
      p.className = "hero-ribbon";
      p.append(...ribbon.cloneNode(true).childNodes);
      contentCell.push(p);
    }
    if (cardArt) {
      const img = document2.createElement("img");
      img.src = cardArt.getAttribute("src");
      img.alt = cardArt.getAttribute("alt") || "";
      contentCell.push(img);
    }
    if (cardName) {
      const h1 = document2.createElement("h1");
      h1.append(...cardName.cloneNode(true).childNodes);
      contentCell.push(h1);
    }
    if (tagline) {
      const h2 = document2.createElement("h2");
      h2.append(...tagline.cloneNode(true).childNodes);
      contentCell.push(h2);
    }
    if (applyAnchor) {
      const p = document2.createElement("p");
      const a = document2.createElement("a");
      a.href = applyAnchor.getAttribute("href").replace(/#.*$/, "");
      a.textContent = "Apply Now";
      p.append(a);
      contentCell.push(p);
    }
    if (pricingLink) {
      const p = document2.createElement("p");
      p.className = "hero-pricing-link";
      const a = document2.createElement("a");
      a.href = pricingLink.getAttribute("href");
      a.append(...pricingLink.cloneNode(true).childNodes);
      p.append(a);
      contentCell.push(p);
    }
    if (manageLine && manageLine.textContent.trim()) {
      const p = document2.createElement("p");
      p.append(...manageLine.cloneNode(true).childNodes);
      contentCell.push(p);
    }
    if (contentCell.length === 0) {
      element.replaceWith(...element.childNodes);
      return;
    }
    const block = WebImporter.Blocks.createBlock(document2, { name: "hero", cells: [[contentCell]] });
    const cardRows = [];
    element.querySelectorAll(".header-description .bubble-section").forEach((bubble) => {
      const bodyCell = [];
      const eyebrow = bubble.querySelector(":scope > .bubble-body:first-child");
      const heading = bubble.querySelector(".bubble-header");
      const bodies = bubble.querySelectorAll(":scope > .bubble-body");
      const bodyWrap = bodies.length ? bodies[bodies.length - 1] : null;
      if (eyebrow && eyebrow !== bodyWrap && eyebrow.textContent.trim()) {
        const p = document2.createElement("p");
        const strong = document2.createElement("strong");
        strong.append(...eyebrow.cloneNode(true).childNodes);
        p.append(strong);
        bodyCell.push(p);
      }
      if (heading) {
        const h3 = document2.createElement("h3");
        h3.append(...heading.cloneNode(true).childNodes);
        bodyCell.push(h3);
      }
      if (bodyWrap && bodyWrap !== eyebrow) {
        const paras = bodyWrap.querySelectorAll(":scope > p");
        if (paras.length) {
          paras.forEach((p) => bodyCell.push(p.cloneNode(true)));
        } else {
          const p = document2.createElement("p");
          p.append(...bodyWrap.cloneNode(true).childNodes);
          bodyCell.push(p);
        }
      }
      if (bodyCell.length) cardRows.push([bodyCell]);
    });
    const after = [];
    if (cardRows.length) {
      after.push(WebImporter.Blocks.createBlock(document2, { name: "cards", cells: cardRows }));
    }
    element.replaceWith(block, ...after);
  }

  // tools/importer/parsers/retail-table.js
  function parse2(element, { document: document2 }) {
    const container = element.querySelector(".table-container") || element;
    const sectionH2 = element.querySelector("h2.sub-heading, h2");
    const cardTitles = [];
    const cardArts = [];
    const imageTable = container.querySelector("table.image-table");
    if (imageTable) {
      imageTable.querySelectorAll("thead td").forEach((td) => {
        const title = td.querySelector(".card-title, .sr-only");
        const img = td.querySelector("app-card-art img, img");
        cardTitles.push(title ? title.textContent.trim() : "");
        cardArts.push(img || null);
      });
    }
    const markFor = (td) => {
      const sr = td.querySelector(".sr-only");
      const txt = (sr ? sr.textContent : td.textContent).toLowerCase();
      if (/not available|not included|no\b/.test(txt)) return "No";
      if (/included|available|yes\b/.test(txt)) return "Yes";
      return td.querySelector("svg") ? "Yes" : "";
    };
    const flattenLabel = (td) => {
      const clone = td.cloneNode(true);
      clone.querySelectorAll("br").forEach((br) => br.replaceWith(document2.createTextNode(" \u2014 ")));
      const p = document2.createElement("p");
      p.append(...clone.childNodes);
      p.querySelectorAll("*").forEach((n) => {
        if (n.tagName === "P") n.replaceWith(...n.childNodes);
      });
      return p;
    };
    const entries = [];
    container.querySelectorAll("table.content-table").forEach((tbl) => {
      const heading = tbl.querySelector("thead h3") || tbl.querySelector("thead .sr-only") || tbl.querySelector("thead th");
      if (heading && heading.textContent.trim()) {
        entries.push({ type: "heading", text: heading.textContent.trim() });
      }
      tbl.querySelectorAll("tbody tr").forEach((tr) => {
        const tds = Array.from(tr.children);
        if (!tds.length) return;
        entries.push({ type: "feature", labelTd: tds[0], markTds: tds.slice(1) });
      });
    });
    if (!entries.length) {
      element.replaceWith(...element.childNodes);
      return;
    }
    let numCards = cardArts.length;
    if (!numCards) {
      numCards = entries.reduce((m, e) => e.type === "feature" ? Math.max(m, e.markTds.length) : m, 0);
    }
    if (!numCards) numCards = 1;
    const blocks = [];
    for (let c = 0; c < numCards; c += 1) {
      const rows = [];
      const headerCell = [];
      const art = cardArts[c];
      if (art) {
        const im = document2.createElement("img");
        im.src = art.getAttribute("src");
        im.alt = art.getAttribute("alt") || cardTitles[c] || "";
        headerCell.push(im);
      }
      if (cardTitles[c]) {
        const p = document2.createElement("p");
        p.textContent = cardTitles[c];
        headerCell.push(p);
      }
      rows.push(["", headerCell.length ? headerCell : ""]);
      entries.forEach((e) => {
        if (e.type === "heading") {
          const p = document2.createElement("p");
          const strong = document2.createElement("strong");
          strong.textContent = e.text;
          p.append(strong);
          rows.push([[p], ""]);
        } else {
          const labelP = flattenLabel(e.labelTd);
          const markTd = e.markTds[c];
          rows.push([[labelP], markTd ? markFor(markTd) : ""]);
        }
      });
      const block = WebImporter.Blocks.createBlock(document2, { name: "table", cells: rows });
      blocks.push(block);
    }
    if (sectionH2 && sectionH2.textContent.trim()) {
      const h = document2.createElement("h2");
      h.append(...sectionH2.cloneNode(true).childNodes);
      element.replaceWith(h, ...blocks);
    } else {
      element.replaceWith(...blocks);
    }
  }

  // tools/importer/parsers/retail-tabs.js
  function parse3(element, { document: document2 }) {
    const tabList = element.querySelector("mkt-tab-list");
    const cells = [];
    const sectionH2 = element.querySelector("h2");
    const buttons = tabList ? Array.from(tabList.querySelectorAll('button[role="tab"]')) : [];
    buttons.forEach((btn) => {
      const labelSpan = btn.querySelector("span");
      const labelText = (labelSpan ? labelSpan.textContent : btn.textContent).trim();
      const iconImg = btn.querySelector("img");
      let iconSrc = null;
      if (iconImg) {
        const dataSrc = iconImg.getAttribute("data-src");
        const src = iconImg.getAttribute("src");
        iconSrc = dataSrc && /\.(svg|png|webp|jpe?g)(\?|$)/i.test(dataSrc) ? dataSrc : src && /\.(svg|png|webp|jpe?g)(\?|$)/i.test(src) ? src : dataSrc || src;
      }
      const panelId = btn.getAttribute("aria-controls");
      const panel = panelId ? element.querySelector(`#${CSS.escape(panelId)}`) : null;
      const label = document2.createElement("p");
      if (iconSrc) {
        const img = document2.createElement("img");
        img.src = iconSrc;
        img.alt = labelText;
        label.append(img);
      }
      label.append(document2.createTextNode(labelText));
      const labelCell = [label];
      const contentCell = [];
      const source = panel && (panel.querySelector(".panel-content") || panel);
      if (source) {
        const parts = source.querySelectorAll("h2, h3, h4, p");
        if (parts.length) {
          parts.forEach((node) => {
            const tag = node.tagName.toLowerCase();
            const el = document2.createElement(/^h[2-4]$/.test(tag) ? tag : "p");
            el.append(...node.cloneNode(true).childNodes);
            contentCell.push(el);
          });
        } else {
          const p = document2.createElement("p");
          p.append(...source.cloneNode(true).childNodes);
          contentCell.push(p);
        }
      }
      cells.push([labelCell, contentCell.length ? contentCell : ""]);
    });
    if (cells.length === 0) {
      element.replaceWith(...element.childNodes);
      return;
    }
    const block = WebImporter.Blocks.createBlock(document2, { name: "tabs", cells });
    if (sectionH2 && sectionH2.textContent.trim()) {
      const h = document2.createElement("h2");
      h.append(...sectionH2.cloneNode(true).childNodes);
      element.replaceWith(h, block);
    } else {
      element.replaceWith(block);
    }
  }

  // tools/importer/parsers/retail-accordion.js
  function parse4(element, { document: document2 }) {
    const cells = [];
    const sectionH2 = element.querySelector("h2");
    const items = element.querySelectorAll(".matlist-section");
    items.forEach((item) => {
      const trigger = item.querySelector(".accordion-trigger, button");
      const titleSrc = trigger && (trigger.querySelector(".category-title span, .category-title, h3") || trigger);
      const body = item.querySelector('.category-content, section[role="region"]');
      if (!titleSrc && !body) return;
      const titleCell = [];
      if (titleSrc) {
        const h3 = document2.createElement("h3");
        const clone = titleSrc.cloneNode(true);
        clone.querySelectorAll("cds-icon, svg, .arrow-icon").forEach((n) => n.remove());
        h3.append(...clone.childNodes);
        const link = trigger && trigger.querySelector && trigger.querySelector("a[href]");
        if (link && !h3.querySelector("a")) h3.append(link.cloneNode(true));
        titleCell.push(h3);
      } else {
        titleCell.push("");
      }
      const bodyCell = [];
      if (body) {
        const clone = body.cloneNode(true);
        clone.querySelectorAll("cds-icon, svg").forEach((n) => n.remove());
        const parts = clone.querySelectorAll("p, h4, ul, ol");
        if (parts.length) {
          parts.forEach((p) => bodyCell.push(p));
        } else {
          bodyCell.push(...clone.childNodes);
        }
      }
      if (bodyCell.length === 0) bodyCell.push("");
      cells.push([titleCell, bodyCell]);
    });
    if (cells.length === 0) {
      element.replaceWith(...element.childNodes);
      return;
    }
    const block = WebImporter.Blocks.createBlock(document2, { name: "accordion", cells });
    if (sectionH2 && sectionH2.textContent.trim()) {
      const h = document2.createElement("h2");
      h.append(...sectionH2.cloneNode(true).childNodes);
      element.replaceWith(h, block);
    } else {
      element.replaceWith(block);
    }
  }

  // tools/importer/parsers/retail-columns.js
  function parse5(element, { document: document2 }) {
    const box = element.querySelector(".box, section") || element;
    const cardArt = box.querySelector("app-card-art img, .cardart img, img");
    const name = box.querySelector("h4, h3, h2");
    const applyAnchor = box.querySelector('a[href*="/apply/"]');
    const imgCol = [];
    if (cardArt) {
      const img = document2.createElement("img");
      img.src = cardArt.getAttribute("src");
      img.alt = cardArt.getAttribute("alt") || "";
      imgCol.push(img);
    }
    const textCol = [];
    if (name) {
      const h = document2.createElement("h3");
      h.append(...name.cloneNode(true).childNodes);
      textCol.push(h);
    }
    if (applyAnchor) {
      const p = document2.createElement("p");
      const a = document2.createElement("a");
      a.href = applyAnchor.getAttribute("href").replace(/#.*$/, "");
      a.textContent = "Apply Now";
      p.append(a);
      textCol.push(p);
    } else {
      const p = document2.createElement("p");
      const strong = document2.createElement("strong");
      strong.textContent = "Apply Now";
      p.append(strong);
      textCol.push(p);
    }
    const row = [];
    if (imgCol.length) row.push(imgCol);
    if (textCol.length) row.push(textCol);
    if (row.length === 0) {
      element.replaceWith(...element.childNodes);
      return;
    }
    const block = WebImporter.Blocks.createBlock(document2, { name: "columns", cells: [row] });
    element.replaceWith(block);
    document2.querySelectorAll("app-price-detail-section").forEach((pd) => {
      if (!pd.parentNode) return;
      const nodes = [];
      const heading = pd.querySelector("h2, h3, .sub-heading");
      if (heading && heading.textContent.trim()) {
        const h = document2.createElement("h2");
        h.append(...heading.cloneNode(true).childNodes);
        nodes.push(h);
      }
      const body = pd.querySelector(".box") || pd.querySelector(".content") || pd;
      const seenLinks = /* @__PURE__ */ new Set();
      const pushEl = (el) => {
        const tag = el.tagName;
        if (!tag || tag === "STYLE" || tag === "SCRIPT") return;
        if (el === heading || heading && heading.contains(el)) return;
        if (tag === "P") {
          const p = document2.createElement("p");
          p.append(...el.cloneNode(true).childNodes);
          if (p.textContent.trim() || p.querySelector("a, img")) nodes.push(p);
        } else if (tag === "A") {
          const href = (el.getAttribute("href") || "").trim();
          const key = `${el.textContent.replace(/\s+/g, " ").trim()}|${href}`;
          if (seenLinks.has(key)) return;
          seenLinks.add(key);
          const p = document2.createElement("p");
          const isPlaceholder = href === "" || href === "#" || /^javascript:/i.test(href);
          if (isPlaceholder) {
            const strong = document2.createElement("strong");
            strong.append(...el.cloneNode(true).childNodes);
            p.append(strong);
          } else {
            const link = document2.createElement("a");
            link.href = href;
            link.append(...el.cloneNode(true).childNodes);
            p.append(link);
          }
          nodes.push(p);
        } else if (el.querySelector && el.querySelector("p, a")) {
          [...el.children].forEach(pushEl);
        } else if (el.textContent.trim()) {
          const p = document2.createElement("p");
          p.append(...el.cloneNode(true).childNodes);
          nodes.push(p);
        }
      };
      [...body.children].forEach(pushEl);
      if (nodes.length) {
        pd.replaceWith(...nodes);
      } else {
        pd.replaceWith(...pd.childNodes);
      }
    });
  }

  // tools/importer/parsers/retail-rewards.js
  function parse6(element, { document: document2 }) {
    const sectionH2 = element.querySelector("h2.sub-heading, h2");
    const leftCol = [];
    const rwItems = element.querySelectorAll(".text-container .rw-content, .rw-content");
    if (rwItems.length) {
      rwItems.forEach((item) => {
        const h = item.querySelector("h3, .rw-title");
        if (h) {
          const h3 = document2.createElement("h3");
          h3.append(...h.cloneNode(true).childNodes);
          leftCol.push(h3);
        }
        item.querySelectorAll(":scope > p").forEach((p) => leftCol.push(p.cloneNode(true)));
      });
    } else {
      const src = element.querySelector(".text-description") || element.querySelector(".text-container");
      if (src) {
        src.querySelectorAll(":scope > p").forEach((p) => {
          const clone = p.cloneNode(true);
          const lead = clone.querySelector(":scope > b, :scope > strong");
          const onlyLead = lead && clone.textContent.trim() === lead.textContent.trim();
          if (onlyLead) {
            const h3 = document2.createElement("h3");
            h3.append(...lead.childNodes);
            leftCol.push(h3);
          } else {
            leftCol.push(clone);
          }
        });
      }
    }
    const rightCol = [];
    element.querySelectorAll(".reward-feature .reward-feature-item, .reward-feature-item").forEach((item) => {
      const p = item.querySelector("p") || item;
      const el = document2.createElement("p");
      el.append(...p.cloneNode(true).childNodes);
      rightCol.push(el);
    });
    if (leftCol.length === 0 && rightCol.length === 0) {
      element.replaceWith(...element.childNodes);
      return;
    }
    const row = [];
    row.push(leftCol.length ? leftCol : "");
    if (rightCol.length) row.push(rightCol);
    const block = WebImporter.Blocks.createBlock(document2, { name: "columns", cells: [row] });
    if (sectionH2 && sectionH2.textContent.trim()) {
      const h = document2.createElement("h2");
      h.append(...sectionH2.cloneNode(true).childNodes);
      element.replaceWith(h, block);
    } else {
      element.replaceWith(block);
    }
  }

  // tools/importer/transformers/citi-cleanup.js
  var H = { before: "beforeTransform", after: "afterTransform" };
  function transform(hookName, element, payload) {
    if (hookName === H.before) {
      WebImporter.DOMUtils.remove(element, [
        "#ensConsentWidget",
        "#ensNotifyBanner",
        "#ensBannerDescription",
        "#ensSaveText",
        "#ensCancelText",
        "header#ensTitle",
        "section.consentWidget"
      ]);
      WebImporter.DOMUtils.remove(element, [
        "citi-header",
        "citi-banner",
        "citi-navigation3",
        "citi-nav-search"
      ]);
      WebImporter.DOMUtils.remove(element, [
        "citi-footer",
        "citi-footer-navigation",
        "citi-footer-sub-navigation",
        "citi-footer-disclaimer"
      ]);
      WebImporter.DOMUtils.remove(element, ["section.footer-sticky"]);
    }
    if (hookName === H.after) {
      WebImporter.DOMUtils.remove(element, [
        "citi-header",
        "citi-footer",
        "section.footer-sticky",
        "#ensConsentWidget",
        "#ensNotifyBanner",
        "header#ensTitle",
        "iframe",
        "link",
        "noscript",
        "script",
        "style"
      ]);
      element.querySelectorAll("*").forEach((el) => {
        [...el.attributes].forEach((attr) => {
          const name = attr.name;
          if (name.startsWith("_ng") || name.startsWith("ng-reflect-") || name === "ng-version" || name === "ng-tns") {
            el.removeAttribute(name);
          }
        });
        if (el.classList && el.classList.length) {
          [...el.classList].forEach((cls) => {
            if (cls.startsWith("ng-tns-") || cls.startsWith("ng-trigger")) {
              el.classList.remove(cls);
            }
          });
          if (el.getAttribute("class") === "") el.removeAttribute("class");
        }
      });
      const doc = element.ownerDocument || payload && payload.document;
      element.querySelectorAll("sup").forEach((sup) => {
        const prev = sup.previousSibling;
        if (prev && prev.nodeType === 3 && prev.textContent && !/\s$/.test(prev.textContent)) {
          prev.textContent += " ";
        }
        const next = sup.nextSibling;
        if (next && next.nodeType === 3 && next.textContent && !/^\s/.test(next.textContent)) {
          next.textContent = ` ${next.textContent}`;
        }
        const link = sup.querySelector("a");
        if (link && sup.children.length === 1) {
          const href = (link.getAttribute("href") || "").trim();
          const isPlaceholder = href === "" || href === "#" || /^javascript:/i.test(href);
          if (isPlaceholder) {
            if (doc) {
              sup.replaceWith(doc.createTextNode(` ${link.textContent.trim()} `));
            } else {
              link.removeAttribute("href");
              sup.replaceWith(link);
            }
          } else {
            sup.replaceWith(link);
          }
        }
      });
    }
  }

  // tools/importer/transformers/citi-sections.js
  var SECTION_MARKER_ATTR = "data-excat-section-id";
  function transform2(hookName, element, payload) {
    const sections = payload.template && payload.template.sections || [];
    if (hookName === "beforeTransform") {
      for (let i = sections.length - 1; i >= 0; i -= 1) {
        const section = sections[i];
        if (i === 0 && !section.style) continue;
        const sectionEl = element.querySelector(section.selector);
        if (!sectionEl) continue;
        const hr = document.createElement("hr");
        if (section.style) hr.setAttribute(SECTION_MARKER_ATTR, section.id);
        sectionEl.before(hr);
      }
    }
    if (hookName === "afterTransform") {
      for (let i = sections.length - 1; i >= 0; i -= 1) {
        const section = sections[i];
        if (!section.style) continue;
        const marker = element.querySelector(`[${SECTION_MARKER_ATTR}="${section.id}"]`);
        const anchor = marker || element.querySelector(section.selector);
        if (!anchor) continue;
        const metadataBlock = WebImporter.Blocks.createBlock(document, {
          name: "Section Metadata",
          cells: { style: section.style }
        });
        anchor.after(metadataBlock);
        if (marker) {
          marker.removeAttribute(SECTION_MARKER_ATTR);
          if (i === 0) marker.remove();
        }
      }
    }
  }

  // tools/importer/import-credit-card-retail-pdp.js
  var parsers = {
    hero: parse,
    table: parse2,
    tabs: parse3,
    accordion: parse4,
    columns: parse5,
    rewards: parse6
  };
  var PAGE_TEMPLATE = {
    name: "credit-card-retail-pdp",
    description: "Retail co-brand credit-card PDP under /credit-cards (Angular app-* DOM).",
    urls: [
      "https://www.citi.com/credit-cards/citi-best-buy-credit-cards?category=view-all-credit-cards&intc=citihpmenu~creditcards~explore&afc=161"
    ],
    blocks: [
      { name: "hero", instances: ["app-pdp section.pdp-section > app-header-section"] },
      { name: "table", instances: ["app-pdp section.pdp-section > app-pdp-compare-cards"] },
      { name: "rewards", instances: ["app-pdp section.pdp-section > app-rewards-section"] },
      { name: "tabs", instances: ["app-pdp section.pdp-section > app-benefit-section"] },
      { name: "accordion", instances: ["app-pdp section.pdp-section > app-faq-section"] },
      { name: "columns", instances: ["app-pdp section.pdp-section > app-review-section"] }
    ],
    sections: [
      { id: "rcret-hero", name: "Header (card art + dynamic offer)", selector: "app-pdp section.pdp-section > app-header-section", style: null, blocks: ["hero"], defaultContent: [] },
      { id: "rcret-compare", name: "Compare cards (comparison table)", selector: "app-pdp section.pdp-section > app-pdp-compare-cards", style: null, blocks: ["table"], defaultContent: ["app-pdp section.pdp-section > app-pdp-compare-cards h2.sub-heading"] },
      { id: "rcret-rewards", name: "Rewards and program details (2-col)", selector: "app-pdp section.pdp-section > app-rewards-section", style: null, blocks: ["rewards"], defaultContent: ["app-pdp section.pdp-section > app-rewards-section h2"] },
      { id: "rcret-benefits", name: "Card benefits (tabbed)", selector: "app-pdp section.pdp-section > app-benefit-section", style: null, blocks: ["tabs"], defaultContent: ["app-pdp section.pdp-section > app-benefit-section h2"] },
      { id: "rcret-faq", name: "FAQs (accordion)", selector: "app-pdp section.pdp-section > app-faq-section", style: null, blocks: ["accordion"], defaultContent: ["app-pdp section.pdp-section > app-faq-section h2"] },
      { id: "rcret-review", name: "Secondary apply band", selector: "app-pdp section.pdp-section > app-review-section", style: null, blocks: ["columns"], defaultContent: [] },
      { id: "rcret-pricing", name: "Pricing details (legal)", selector: "app-pdp section.pdp-section > app-price-detail-section", style: null, blocks: [], defaultContent: ["app-pdp section.pdp-section > app-price-detail-section"] }
    ]
  };
  var transformers = [
    transform,
    ...PAGE_TEMPLATE.sections && PAGE_TEMPLATE.sections.length > 1 ? [transform2] : []
  ];
  function executeTransformers(hookName, element, payload) {
    const enhancedPayload = __spreadProps(__spreadValues({}, payload), { template: PAGE_TEMPLATE });
    transformers.forEach((transformerFn) => {
      try {
        transformerFn.call(null, hookName, element, enhancedPayload);
      } catch (e) {
        console.error(`Transformer failed at ${hookName}:`, e);
      }
    });
  }
  function findBlocksOnPage(document2, template) {
    const pageBlocks = [];
    template.blocks.forEach((blockDef) => {
      if (blockDef.name.startsWith("section-")) return;
      blockDef.instances.forEach((selector) => {
        const elements = document2.querySelectorAll(selector);
        if (elements.length === 0) {
          console.warn(`Block "${blockDef.name}" selector not found: ${selector}`);
        }
        elements.forEach((element) => {
          pageBlocks.push({ name: blockDef.name, selector, element, section: blockDef.section || null });
        });
      });
    });
    console.log(`Found ${pageBlocks.length} block instances on page`);
    return pageBlocks;
  }
  var import_credit_card_retail_pdp_default = {
    transform: (payload) => {
      const { document: document2, url, params } = payload;
      const main = document2.body;
      executeTransformers("beforeTransform", main, payload);
      const pageBlocks = findBlocksOnPage(document2, PAGE_TEMPLATE);
      pageBlocks.forEach((block) => {
        if (!block.element.parentNode) return;
        const parser = parsers[block.name];
        if (parser) {
          try {
            parser(block.element, { document: document2, url, params });
          } catch (e) {
            console.error(`Failed to parse ${block.name} (${block.selector}):`, e);
          }
        } else {
          console.warn(`No parser found for block: ${block.name}`);
        }
      });
      executeTransformers("afterTransform", main, payload);
      const hr = document2.createElement("hr");
      main.appendChild(hr);
      WebImporter.rules.createMetadata(main, document2);
      WebImporter.rules.transformBackgroundImages(main, document2);
      WebImporter.rules.adjustImageUrls(main, url, params.originalURL);
      const metaTable = [...main.querySelectorAll("table")].find((t) => {
        const first = t.querySelector("tr");
        return first && /^metadata$/i.test(first.textContent.trim());
      });
      if (metaTable) {
        const tbody = metaTable.querySelector("tbody") || metaTable;
        const tr = document2.createElement("tr");
        const tdKey = document2.createElement("td");
        tdKey.textContent = "template";
        const tdVal = document2.createElement("td");
        tdVal.textContent = PAGE_TEMPLATE.name;
        tr.append(tdKey, tdVal);
        tbody.append(tr);
      }
      const rawPath = new URL(params.originalURL).pathname.replace(/\/$/, "").replace(/\.html?$/, "");
      const path = WebImporter.FileUtils.sanitizePath(rawPath === "" ? "/index" : rawPath);
      return [{
        element: main,
        path,
        report: {
          title: document2.title,
          template: PAGE_TEMPLATE.name,
          blocks: pageBlocks.map((b) => b.name)
        }
      }];
    }
  };
  return __toCommonJS(import_credit_card_retail_pdp_exports);
})();
