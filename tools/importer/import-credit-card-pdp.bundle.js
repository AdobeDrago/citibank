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

  // tools/importer/import-credit-card-pdp.js
  var import_credit_card_pdp_exports = {};
  __export(import_credit_card_pdp_exports, {
    default: () => import_credit_card_pdp_default
  });

  // tools/importer/parsers/hero.js
  function parse(element, { document: document2 }) {
    const bgImage = element.querySelector('img.hero-feature-grid__img, img[class*="hero-feature-grid__img"]');
    const cardArt = element.querySelector("tds-card-art img");
    const eyebrow = element.querySelector(".feature-restatement__eyebrow h1, h1");
    const flag = element.querySelector("tds-flag .flag, .flag-wrapper-v2 .flag");
    const headline = element.querySelector(".feature-restatement__header h2, tds-feature-header h2, .feature-header h2, h2.header, h2");
    const support = element.querySelector(".feature-restatement__text .feature-text, tds-feature-text.feature-restatement__text .feature-text");
    const cta = element.querySelector("tds-cta-section a.cds-button, .cta-wrapper a");
    const disclaimer = element.querySelector("tds-pdp-pricing .pricing-section__text .feature-text, tds-pdp-pricing .feature-text");
    const pricingLinks = Array.from(element.querySelectorAll(".pricing-links-container a"));
    const statParas = [];
    element.querySelectorAll(".feature-restatement__ratesfees tds-ratesfees, tds-ratesfees").forEach((item) => {
      const value = item.querySelector(".text");
      const desc = item.querySelector(".description");
      if (!value && !desc) return;
      const p = document2.createElement("p");
      if (value) {
        const strong = document2.createElement("strong");
        strong.append(...value.childNodes);
        p.append(strong);
      }
      if (desc) {
        if (value) p.append(document2.createTextNode(" \u2014 "));
        p.append(...desc.childNodes);
      }
      statParas.push(p);
    });
    const cells = [];
    if (bgImage) cells.push([bgImage]);
    const contentCell = [];
    if (cardArt) contentCell.push(cardArt);
    if (flag) {
      const flagP = document2.createElement("p");
      flagP.textContent = flag.textContent.trim();
      contentCell.push(flagP);
    }
    if (eyebrow) contentCell.push(eyebrow);
    if (headline) contentCell.push(headline);
    if (support) {
      const p = document2.createElement("p");
      p.append(...support.childNodes);
      contentCell.push(p);
    }
    contentCell.push(...statParas);
    if (cta) contentCell.push(cta);
    if (disclaimer) {
      const p = document2.createElement("p");
      p.append(...disclaimer.childNodes);
      contentCell.push(p);
    }
    pricingLinks.forEach((a) => {
      const p = document2.createElement("p");
      p.append(a);
      contentCell.push(p);
    });
    if (contentCell.length === 0 && !bgImage) {
      element.replaceWith(...element.childNodes);
      return;
    }
    cells.push([contentCell]);
    const block = WebImporter.Blocks.createBlock(document2, { name: "hero", cells });
    element.replaceWith(block);
  }

  // tools/importer/parsers/columns.js
  function bgUrlFrom(styleValue) {
    if (!styleValue) return "";
    const matches = [...styleValue.matchAll(/url\((['"]?)([^'")]+)\1\)/g)];
    const hit = matches.find((m) => /^https?:|^\/\//.test(m[2]) || m[2].includes("/content/dam/"));
    return hit ? hit[2] : matches[0] ? matches[0][2] : "";
  }
  function parse2(element, { document: document2 }) {
    const cells = [];
    const tag = element.tagName.toLowerCase();
    const buildStatCell = (eyebrow, value, description) => {
      const cell = [];
      if (eyebrow) {
        const p = document2.createElement("p");
        p.append(...eyebrow.childNodes);
        cell.push(p);
      }
      if (value) {
        const h = document2.createElement("h3");
        h.append(...value.childNodes);
        cell.push(h);
      }
      if (description) {
        const p = document2.createElement("p");
        p.append(...description.childNodes);
        cell.push(p);
      }
      return cell;
    };
    if (tag === "tds-ratesfees-container") {
      const items = Array.from(element.querySelectorAll(":scope tds-ratesfees"));
      items.forEach((item) => {
        const headingCell = buildStatCell(
          item.querySelector(".eyebrow"),
          item.querySelector(".text"),
          null
        );
        const description = item.querySelector(".description");
        const descCell = [];
        if (description) {
          const p = document2.createElement("p");
          p.append(...description.childNodes);
          descCell.push(p);
        }
        if (headingCell.length || descCell.length) {
          cells.push([headingCell, descCell]);
        }
      });
      const legal = element.querySelector("tds-pdp-pricing .feature-text");
      if (legal && cells.length) {
        const p = document2.createElement("p");
        p.append(...legal.childNodes);
        cells.push([[p], ""]);
      }
    } else if (tag === "tds-accelerator") {
      const bars = Array.from(element.querySelectorAll(":scope .accelerator-bar"));
      bars.forEach((bar) => {
        const heading = bar.querySelector("h3, .item-heading");
        const desc = bar.querySelector(".item-description");
        const headingCell = [];
        const descCell = [];
        if (heading) headingCell.push(heading);
        if (desc) {
          const p = document2.createElement("p");
          p.append(...desc.childNodes);
          descCell.push(p);
        }
        if (headingCell.length || descCell.length) {
          cells.push([headingCell, descCell]);
        }
      });
    } else {
      featureToCells(element, document2).forEach((row) => cells.push(row));
    }
    if (cells.length === 0) {
      element.replaceWith(...element.childNodes);
      return;
    }
    const block = WebImporter.Blocks.createBlock(document2, { name: "columns", cells });
    element.replaceWith(block);
    if (tag === "tds-feature") {
      document2.querySelectorAll("tds-feature").forEach((feat) => {
        if (!feat.parentNode) return;
        const isRecap = !!feat.querySelector('.recap-section, [class*="recap"]');
        if (!isRecap) return;
        const recapCells = featureToCells(feat, document2);
        if (recapCells.length === 0) {
          feat.replaceWith(...feat.childNodes);
          return;
        }
        const recapBlock = WebImporter.Blocks.createBlock(document2, { name: "columns", cells: recapCells });
        feat.replaceWith(recapBlock);
      });
    }
  }
  function featureToCells(element, document2) {
    const outCells = [];
    {
      let image = element.querySelector(".feature-layout__right img, .feature-layout__left img, tds-feature-layout img, section img");
      const framed = element.querySelector("div.feature-layout.framed, .feature-layout.framed");
      if (!image && framed) {
        let url = bgUrlFrom(framed.getAttribute("style"));
        const isHowItWorks = !!element.querySelector(":scope tds-benefit");
        if (!url && isHowItWorks) {
          url = "https://aemapi.citi.com/content/dam/cfs/uspb/usmkt/cards/en/static/images/citi-double-cash-credit-card/features/feature-framed-A--XXL-L--cash-double-cash.webp";
        }
        if (url) {
          image = document2.createElement("img");
          image.src = url;
          const h = element.querySelector("tds-feature-header h2, .feature-header h2, h2");
          image.alt = h ? h.textContent.trim() : "";
        }
      }
      const textCell = [];
      const header = element.querySelector("tds-feature-header h2, .feature-header h2, .feature-restatement__header h2");
      const eyebrow = element.querySelector(".feature-restatement__eyebrow .feature-text, tds-feature-text.feature-restatement__eyebrow .feature-text");
      if (eyebrow) {
        const p = document2.createElement("p");
        p.append(...eyebrow.childNodes);
        textCell.push(p);
      }
      if (header) textCell.push(header);
      const restatementText = element.querySelector("tds-feature-text.feature-restatement__text .feature-text");
      if (restatementText) {
        const p = document2.createElement("p");
        p.append(...restatementText.childNodes);
        textCell.push(p);
      }
      element.querySelectorAll(":scope tds-benefit").forEach((benefit) => {
        const h = benefit.querySelector("h3, .item-heading");
        const p = benefit.querySelector(".benefit-description, p");
        if (h) textCell.push(h);
        if (p) {
          const para = document2.createElement("p");
          para.append(...p.childNodes);
          textCell.push(para);
        }
      });
      element.querySelectorAll(":scope tds-cta-section a.cds-button, :scope .cta-wrapper a").forEach((a) => {
        const link = document2.createElement("a");
        link.href = a.getAttribute("href") || "";
        link.textContent = a.textContent.replace(/\s+/g, " ").trim();
        textCell.push(link);
      });
      if (image && textCell.length) {
        outCells.push([[image], textCell]);
      } else if (textCell.length) {
        outCells.push([textCell]);
      } else if (image) {
        outCells.push([[image]]);
      }
    }
    return outCells;
  }

  // tools/importer/parsers/cards.js
  function isSpriteSrc(src) {
    return !!src && /sprite[^/"]*\.svg(\?|$)/i.test(src);
  }
  function svgToImg(svg, document2, alt) {
    const clone = svg.cloneNode(true);
    if (!clone.getAttribute("xmlns")) clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    const img = document2.createElement("img");
    img.src = `data:image/svg+xml;utf8,${encodeURIComponent(clone.outerHTML)}`;
    img.alt = alt || "";
    return img;
  }
  function parse3(element, { document: document2 }) {
    const cells = [];
    const imageCell = (imgOrPic) => {
      if (!imgOrPic) return "";
      const pic = imgOrPic.closest && imgOrPic.closest("picture");
      return [pic || imgOrPic];
    };
    const buildBodyCell = (heading, description, link) => {
      const cell = [];
      if (heading) cell.push(heading);
      if (description) {
        const p = document2.createElement("p");
        p.append(...description.childNodes);
        cell.push(p);
      }
      if (link) {
        const a = document2.createElement("a");
        a.href = link.getAttribute("href") || "";
        a.textContent = link.textContent.replace(/\s+/g, " ").trim();
        cell.push(a);
      }
      return cell.length ? cell : "";
    };
    const tag = element.tagName.toLowerCase();
    const sectionH2 = element.querySelector(".grid-header-container h2, .heading h2, h2.feature-text, h2");
    if (tag === "tds-content-grid") {
      element.querySelectorAll(":scope cds-column.grid-items-3, :scope .grid-items-container cds-column").forEach((col) => {
        if (col.classList.contains("grid-header-container") || col.querySelector(":scope > .heading, :scope > div.heading")) return;
        let cardImg = col.querySelector(".icon-wrapper img.img-recommended-cards") || col.querySelector(".icon-wrapper > img") || col.querySelector("cds-icon img") || col.querySelector("img");
        if (cardImg && isSpriteSrc(cardImg.getAttribute("src"))) cardImg = null;
        const heading = col.querySelector(".item-heading h3, h3");
        let img = imageCell(cardImg);
        if (img === "") {
          const svg = col.querySelector(".icon-wrapper svg, cds-icon svg, svg");
          if (svg) img = [svgToImg(svg, document2, heading ? heading.textContent.trim() : "")];
        }
        const description = col.querySelector("p.item-description, p");
        const link = col.querySelector("tds-cta-section a.cds-button, tds-cta-section a, a.cds-button-inline-link");
        const body = buildBodyCell(heading, description, link);
        if (img === "" && body === "") return;
        cells.push([img, body]);
      });
    } else {
      const scope = element.classList.contains("benefits-container") ? element : element.querySelector(".benefits-container") || element;
      scope.querySelectorAll(":scope tds-benefit, tds-benefit").forEach((benefit) => {
        let icon = benefit.querySelector(".benefit-icon-container img, cds-icon img, img");
        if (icon && isSpriteSrc(icon.getAttribute("src"))) icon = null;
        const heading = benefit.querySelector(".benefit-header h3, h3, .item-heading");
        let img = imageCell(icon);
        if (img === "") {
          const svg = benefit.querySelector(".benefit-icon-container svg, cds-icon svg, svg");
          if (svg) img = [svgToImg(svg, document2, heading ? heading.textContent.trim() : "")];
        }
        const description = benefit.querySelector("p.benefit-description, p");
        const body = buildBodyCell(heading, description, null);
        if (img === "" && body === "") return;
        cells.push([img, body]);
      });
    }
    if (cells.length === 0) {
      element.replaceWith(...element.childNodes);
      return;
    }
    const block = WebImporter.Blocks.createBlock(document2, { name: "cards", cells });
    if (sectionH2 && sectionH2.textContent.trim()) {
      const h = document2.createElement("h2");
      h.textContent = sectionH2.textContent.trim();
      element.replaceWith(h, block);
    } else {
      element.replaceWith(block);
    }
  }

  // tools/importer/parsers/accordion.js
  function parse4(element, { document: document2 }) {
    const cells = [];
    const sectionH2 = element.querySelector(":scope > section .headline h2, .headline h2, h2.faq-title, h2");
    const sections = element.querySelectorAll(":scope cds-accordion2-section, cds-accordion2-section");
    sections.forEach((section) => {
      const heading = section.querySelector(".faq-headline h3, h3.faq-heading, .faq-heading, h3");
      const bodySource = section.querySelector(".faq-content, .faq-content-wrapper, .cds-accordion2-submenu");
      if (!heading && !bodySource) return;
      const titleCell = [];
      if (heading) {
        const h = document2.createElement("h3");
        h.append(...heading.childNodes);
        titleCell.push(h);
      } else {
        titleCell.push("");
      }
      const bodyCell = [];
      if (bodySource) {
        const parts = bodySource.querySelectorAll(":scope > .body-header, :scope > .body-text, :scope .body-header, :scope .body-text");
        if (parts.length) {
          parts.forEach((part) => {
            if (part.classList.contains("body-header")) {
              const h = document2.createElement("h4");
              h.append(...part.childNodes);
              bodyCell.push(h);
            } else {
              const p = document2.createElement("p");
              p.append(...part.childNodes);
              bodyCell.push(p);
            }
          });
        } else {
          bodyCell.push(...bodySource.childNodes);
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
      h.textContent = sectionH2.textContent.trim();
      element.replaceWith(h, block);
    } else {
      element.replaceWith(block);
    }
  }

  // tools/importer/parsers/primary-benefits.js
  function bgUrlFrom2(styleValue) {
    if (!styleValue) return "";
    const matches = [...styleValue.matchAll(/url\((['"]?)([^'")]+)\1\)/g)];
    const hit = matches.find((m) => /^https?:|^\/\//.test(m[2]) || m[2].includes("/content/dam/"));
    return hit ? hit[2] : matches[0] ? matches[0][2] : "";
  }
  function parse5(element, { document: document2 }) {
    const cells = [];
    const tiles = element.querySelectorAll(":scope tds-primary-benefit, tds-primary-benefit");
    tiles.forEach((tile, i) => {
      let bgImg = tile.querySelector(".primaryBenefits-container > img, .main-pb-container img:not(.state-icon img)") || tile.querySelector("img");
      if (!bgImg) {
        const bgHost = tile.querySelector('.primaryBenefits-container, [style*="url("]');
        const url = bgHost ? bgUrlFrom2(bgHost.getAttribute("style")) : "";
        if (url) {
          bgImg = document2.createElement("img");
          bgImg.src = url;
          const h = tile.querySelector("h3");
          bgImg.alt = h ? h.textContent.trim() : `benefit ${i + 1}`;
        }
      }
      const heading = tile.querySelector(".benefit-header h3, h3.item-heading, h3");
      if (!bgImg && !heading) return;
      const imageCell = bgImg ? [bgImg] : "";
      const headingCell = [];
      if (heading) {
        const h = document2.createElement("h3");
        h.append(...heading.childNodes);
        headingCell.push(h);
      }
      const detail = tile.querySelector(".primaryBenefits-detail, .benefit-description, .body-text");
      const detailCell = [];
      if (detail && detail.textContent.trim() !== "") {
        const p = document2.createElement("p");
        p.append(...detail.childNodes);
        detailCell.push(p);
      }
      cells.push([imageCell, headingCell.length ? headingCell : "", detailCell.length ? detailCell : ""]);
    });
    if (cells.length === 0) {
      element.replaceWith(...element.childNodes);
      return;
    }
    const block = WebImporter.Blocks.createBlock(document2, { name: "primary-benefits", cells });
    element.replaceWith(block);
  }

  // tools/importer/parsers/category-nav.js
  function svgToImg2(svg, document2, alt) {
    const clone = svg.cloneNode(true);
    if (!clone.getAttribute("xmlns")) clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    const markup = clone.outerHTML;
    const img = document2.createElement("img");
    img.src = `data:image/svg+xml;utf8,${encodeURIComponent(markup)}`;
    img.alt = alt || "";
    return img;
  }
  function parse6(element, { document: document2 }) {
    const cells = [];
    const items = element.querySelectorAll(":scope ul.nav-bar > li, ul.nav-bar > li, li");
    items.forEach((li) => {
      const anchor = li.querySelector("a.category_nav_v2_item, a");
      if (!anchor) return;
      const labelText = (anchor.querySelector(".nav-text") || anchor).textContent.replace(/\s+/g, " ").trim();
      let icon = li.querySelector(".icon-wrapper img, cds-icon img, img");
      if (!icon) {
        const svg = li.querySelector(".icon-wrapper svg, cds-icon svg, svg");
        if (svg) icon = svgToImg2(svg, document2, labelText);
      }
      if (!labelText && !icon) return;
      const rawHref = anchor.getAttribute("href") || "";
      const href = /^https?:|^\//.test(rawHref) ? rawHref : "#";
      const link = document2.createElement("a");
      link.href = href;
      link.textContent = labelText;
      const iconCell = icon ? [icon.closest("picture") || icon] : "";
      cells.push([iconCell, [link]]);
    });
    if (cells.length === 0) {
      element.replaceWith(...element.childNodes);
      return;
    }
    const block = WebImporter.Blocks.createBlock(document2, { name: "category-nav", cells });
    const headline = element.querySelector("h2.headline, .nav-container > h2, h2");
    if (headline) {
      const h = document2.createElement("h2");
      h.append(...headline.childNodes);
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

  // tools/importer/import-credit-card-pdp.js
  var parsers = {
    hero: parse,
    columns: parse2,
    cards: parse3,
    accordion: parse4,
    "primary-benefits": parse5,
    "category-nav": parse6
  };
  var PAGE_TEMPLATE = {
    name: "credit-card-pdp",
    description: "Credit card product detail page (PDP) under /credit-cards.",
    urls: [
      "https://www.citi.com/credit-cards/citi-double-cash-credit-card?category=%2F&intc=citihpmenu~creditcards~explore&afc=160"
    ],
    blocks: [
      {
        name: "hero",
        instances: ["#page-container > tds-hero-banner.ng-star-inserted"]
      },
      {
        name: "columns",
        instances: [
          "#pdp-content-container > tds-accelerator.ng-star-inserted",
          "#pdp-content-container > tds-ratesfees-container.ng-star-inserted",
          "#pdp-content-container > tds-feature.ng-star-inserted:nth-of-type(1)",
          "#pdp-content-container > tds-feature.ng-star-inserted:nth-of-type(2)"
        ]
      },
      {
        name: "cards",
        instances: [
          "#pdp-content-container > tds-content-grid.ng-star-inserted:nth-of-type(1)",
          "#pdp-content-container > tds-drawer.ng-star-inserted > section > div.benefits-container",
          "#pdp-content-container > tds-content-grid.ng-star-inserted:nth-of-type(2)"
        ]
      },
      {
        name: "accordion",
        instances: [
          "#pdp-content-container > tds-drawer.ng-star-inserted > section > div.faq-container",
          "#pdp-content-container > tds-faq.ng-star-inserted"
        ]
      },
      {
        name: "primary-benefits",
        instances: ["#pdp-content-container > tds-primary-benefits.ng-star-inserted"]
      },
      {
        name: "category-nav",
        instances: ["#pdp-content-container > tds-category-nav-bar.ng-star-inserted"]
      },
      {
        name: "section-promo",
        instances: ["#pdp-content-container > tds-feature.ng-star-inserted:nth-of-type(2)"],
        section: "pale-blue"
      }
    ],
    sections: [
      { id: "rc1c2c1", name: "Hero (card image + dynamic offer)", selector: "#page-container > tds-hero-banner.ng-star-inserted", style: null, blocks: ["hero"], defaultContent: [] },
      { id: "rc1c2c2c1", name: "Accelerator (2% cash back + intro APR)", selector: "#pdp-content-container > tds-accelerator.ng-star-inserted", style: null, blocks: ["columns"], defaultContent: [] },
      { id: "rc1c2c2c2", name: "Rates & fees list", selector: "#pdp-content-container > tds-ratesfees-container.ng-star-inserted", style: null, blocks: ["columns"], defaultContent: [] },
      { id: "rc1c2c2c3", name: "Here's how it works (3-up)", selector: "#pdp-content-container > tds-feature.ng-star-inserted:nth-of-type(1)", style: null, blocks: ["columns"], defaultContent: [] },
      { id: "rc1c2c2c4", name: "Your points. Your way (3-up)", selector: "#pdp-content-container > tds-content-grid.ng-star-inserted:nth-of-type(1)", style: null, blocks: ["cards"], defaultContent: [] },
      { id: "rc1c2c2c5", name: "Primary benefits (3 image tiles, expandable)", selector: "#pdp-content-container > tds-primary-benefits.ng-star-inserted", style: null, blocks: ["primary-benefits"], defaultContent: [] },
      { id: "rc1c2c2c6", name: "Benefits + accordions", selector: "#pdp-content-container > tds-drawer.ng-star-inserted", style: "light-grey", blocks: ["cards", "accordion"], defaultContent: [] },
      { id: "rc1c2c2c7", name: "FAQs accordion", selector: "#pdp-content-container > tds-faq.ng-star-inserted", style: null, blocks: ["accordion"], defaultContent: [] },
      { id: "rc1c2c2c8", name: "Promo (2% cash back + apply)", selector: "#pdp-content-container > tds-feature.ng-star-inserted:nth-of-type(2)", style: "pale-blue", blocks: ["columns"], defaultContent: [] },
      { id: "rc1c2c2c9", name: "You may also like (3 cards)", selector: "#pdp-content-container > tds-content-grid.ng-star-inserted:nth-of-type(2)", style: null, blocks: ["cards"], defaultContent: [] },
      { id: "rc1c2c2c10", name: "Pricing details (legal)", selector: "#pdp-content-container > tds-pdp-pricing.ng-star-inserted", style: null, blocks: [], defaultContent: ["#pdp-content-container > tds-pdp-pricing.ng-star-inserted"] },
      { id: "rc1c2c2c11", name: "Find the right card for you (category nav list)", selector: "#pdp-content-container > tds-category-nav-bar.ng-star-inserted", style: null, blocks: ["category-nav"], defaultContent: [] }
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
  var import_credit_card_pdp_default = {
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
  return __toCommonJS(import_credit_card_pdp_exports);
})();
