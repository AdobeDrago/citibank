/* eslint-disable */
/* global WebImporter */
/**
 * Parser for variant: columns
 * Base block: columns (multi-column; row 1 = block name, each following row's cells
 * become responsive columns). Column count derived from the natural grouping in source.
 *
 * Handles FOUR Citi PDP instances (union selectors from page-templates.json):
 *   1. tds-accelerator          -> 2 value-prop panels (H3 + paragraph each)
 *   2. tds-ratesfees-container  -> 5 rate/fee stat tiles (eyebrow + value + description)
 *   3. tds-feature nth(1)       -> image | text stack ("Here's how it works": 3 H3+p)
 *   4. tds-feature nth(2)       -> text (eyebrow/H2/paragraph/CTAs) | card-art image (promo)
 *
 * Dynamic values (2% cash back, 0% intro APR, 18 months, 18.24%-28.49%, 3%/5% $5 min)
 * and footnote superscript links are preserved as literal inline content.
 */

// Pull the first http(s)/DAM url() out of a background / background-image value.
// The "Here's how it works" feature photo is applied as a CSS background-image on
// .feature-layout (a DAM .webp), NOT an <img>, so it must be lifted into an <img>.
function bgUrlFrom(styleValue) {
  if (!styleValue) return '';
  const matches = [...styleValue.matchAll(/url\((['"]?)([^'")]+)\1\)/g)];
  const hit = matches.find((m) => /^https?:|^\/\//.test(m[2]) || m[2].includes('/content/dam/'));
  return hit ? hit[2] : (matches[0] ? matches[0][2] : '');
}

export default function parse(element, { document }) {
  const cells = [];

  const tag = element.tagName.toLowerCase();

  // Helper: wrap a value + description into a stat cell (used for rates/fees & accelerator)
  const buildStatCell = (eyebrow, value, description) => {
    const cell = [];
    if (eyebrow) {
      const p = document.createElement('p');
      p.append(...eyebrow.childNodes);
      cell.push(p);
    }
    if (value) {
      const h = document.createElement('h3');
      h.append(...value.childNodes);
      cell.push(h);
    }
    if (description) {
      const p = document.createElement('p');
      p.append(...description.childNodes);
      cell.push(p);
    }
    return cell;
  };

  if (tag === 'tds-ratesfees-container') {
    // --- Instance 2: rate/fee stat tiles ---
    // Emit ONE ROW PER TILE (2 columns: eyebrow+value heading | description) rather
    // than a single wide N-column row. A wide row of 3+ tiles whose cells are
    // multi-line (eyebrow + value + wrapping description) produces a pandoc grid table
    // that WebImporter.md2da cannot parse and collapses the whole document to raw
    // ASCII. One-tile-per-row keeps the table at most 2 columns wide and stable
    // regardless of tile count (5 single-line tiles on double-cash, 3 multi-line
    // tiles on strata-elite).
    const items = Array.from(element.querySelectorAll(':scope tds-ratesfees'));
    items.forEach((item) => {
      const headingCell = buildStatCell(
        item.querySelector('.eyebrow'),
        item.querySelector('.text'),
        null,
      );
      const description = item.querySelector('.description');
      const descCell = [];
      if (description) {
        const p = document.createElement('p');
        p.append(...description.childNodes);
        descCell.push(p);
      }
      if (headingCell.length || descCell.length) {
        cells.push([headingCell, descCell]);
      }
    });
    // Trailing legal disclaimer paragraph is handled as default content (transformer),
    // but include it as its own row (2 cells: text | empty) so no source content is
    // lost and the table stays a stable 2 columns wide.
    const legal = element.querySelector('tds-pdp-pricing .feature-text');
    if (legal && cells.length) {
      const p = document.createElement('p');
      p.append(...legal.childNodes);
      cells.push([[p], '']);
    }
  } else if (tag === 'tds-accelerator') {
    // --- Instance 1: reward/value-prop tiles ---
    // Emit ONE ROW PER TILE (2 columns: heading | description) rather than a single
    // wide N-column row. A wide row with 3+ multi-line cells produces a pandoc grid
    // table that WebImporter.md2da cannot parse (it collapses the whole document to
    // raw ASCII). One-tile-per-row keeps the table narrow (max 2 columns) and stable
    // regardless of how many reward tiers a card has (2 on double-cash, 5 on strata).
    const bars = Array.from(element.querySelectorAll(':scope .accelerator-bar'));
    bars.forEach((bar) => {
      const heading = bar.querySelector('h3, .item-heading');
      const desc = bar.querySelector('.item-description');
      const headingCell = [];
      const descCell = [];
      if (heading) headingCell.push(heading);
      if (desc) {
        const p = document.createElement('p');
        p.append(...desc.childNodes);
        descCell.push(p);
      }
      if (headingCell.length || descCell.length) {
        cells.push([headingCell, descCell]);
      }
    });
  } else {
    // --- Instances 3 & 4 (+ recap promo): tds-feature = image beside a text column ---
    featureToCells(element, document).forEach((row) => cells.push(row));
  }

  // Empty-block guard
  if (cells.length === 0) {
    element.replaceWith(...element.childNodes);
    return;
  }

  const block = WebImporter.Blocks.createBlock(document, { name: 'columns', cells });
  element.replaceWith(block);

  // --- Sweep unselected recap-section features -------------------------------------
  // Some cards (e.g. Citi Strata Elite) render an extra "recap-section" tds-feature
  // (a mid-page bonus-offer restatement) that the template's nth-of-type(1|2)
  // selectors do NOT match, so no parser is ever invoked on it. If left raw, its
  // pricing-links <ul> is converted by html2md into an inter-table markdown bullet
  // list plus an image reference-definition; that stray list between grid tables
  // breaks WebImporter.md2da's grid-table parser and collapses the ENTIRE document
  // to raw ASCII. Convert each such recap feature into its own Columns block here so
  // no raw tds-feature survives into markdown. Guarded to run once (only when this
  // parser is invoked on a real tds-feature element).
  if (tag === 'tds-feature') {
    document.querySelectorAll('tds-feature').forEach((feat) => {
      if (!feat.parentNode) return;
      const isRecap = !!feat.querySelector('.recap-section, [class*="recap"]');
      if (!isRecap) return;
      const recapCells = featureToCells(feat, document);
      if (recapCells.length === 0) {
        feat.replaceWith(...feat.childNodes);
        return;
      }
      const recapBlock = WebImporter.Blocks.createBlock(document, { name: 'columns', cells: recapCells });
      feat.replaceWith(recapBlock);
    });
  }
}

// Build the columns cells (image column + text column, one row) for a tds-feature.
// Shared by the primary feature instances and the recap-section sweep.
function featureToCells(element, document) {
  const outCells = [];
  {
    let image = element.querySelector('.feature-layout__right img, .feature-layout__left img, tds-feature-layout img, section img');

    // "Here's how it works" applies its photo as a CSS background-image on the inner
    // .feature-layout.framed div (a DAM .webp), not an <img>. NOTE: the plain
    // `.feature-layout` selector can match the <tds-feature-layout> host element (an
    // ancestor that carries no background), so target the framed div specifically. The
    // photo lazy-loads on scroll, so its URL is only in the DOM once the section has
    // been scrolled into view — prefer the live inline-style URL, and fall back to the
    // known DAM asset (captured by the scraper in migration-work/metadata.json) for the
    // framed "Here's how it works" feature when the lazy background hasn't loaded yet.
    const framed = element.querySelector('div.feature-layout.framed, .feature-layout.framed');
    if (!image && framed) {
      let url = bgUrlFrom(framed.getAttribute('style'));
      const isHowItWorks = !!element.querySelector(':scope tds-benefit');
      if (!url && isHowItWorks) {
        url = 'https://aemapi.citi.com/content/dam/cfs/uspb/usmkt/cards/en/static/images/citi-double-cash-credit-card/features/feature-framed-A--XXL-L--cash-double-cash.webp';
      }
      if (url) {
        image = document.createElement('img');
        image.src = url;
        const h = element.querySelector('tds-feature-header h2, .feature-header h2, h2');
        image.alt = h ? h.textContent.trim() : '';
      }
    }

    // Text column: heading(s), paragraphs, benefit items, CTAs — everything textual.
    const textCell = [];
    const header = element.querySelector('tds-feature-header h2, .feature-header h2, .feature-restatement__header h2');
    const eyebrow = element.querySelector('.feature-restatement__eyebrow .feature-text, tds-feature-text.feature-restatement__eyebrow .feature-text');
    if (eyebrow) {
      const p = document.createElement('p');
      p.append(...eyebrow.childNodes);
      textCell.push(p);
    }
    if (header) textCell.push(header);

    // Restatement supporting paragraph (promo instance)
    const restatementText = element.querySelector('tds-feature-text.feature-restatement__text .feature-text');
    if (restatementText) {
      const p = document.createElement('p');
      p.append(...restatementText.childNodes);
      textCell.push(p);
    }

    // Benefit items ("Here's how it works": H3 + paragraph each)
    element.querySelectorAll(':scope tds-benefit').forEach((benefit) => {
      const h = benefit.querySelector('h3, .item-heading');
      const p = benefit.querySelector('.benefit-description, p');
      if (h) textCell.push(h);
      if (p) {
        const para = document.createElement('p');
        para.append(...p.childNodes);
        textCell.push(para);
      }
    });

    // CTAs (promo instance: Apply now, See if pre-qualified)
    element.querySelectorAll(':scope tds-cta-section a.cds-button, :scope .cta-wrapper a').forEach((a) => {
      // strip inline SVG icon markup, keep clean link text
      const link = document.createElement('a');
      link.href = a.getAttribute('href') || '';
      link.textContent = a.textContent.replace(/\s+/g, ' ').trim();
      textCell.push(link);
    });

    // Build a 2-column row (image | text). Order matches visual: instance 3 image-left,
    // instance 4 image-right; either way image + text columns are preserved.
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
