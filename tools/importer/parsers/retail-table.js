/* eslint-disable */
/* global WebImporter */
/**
 * Parser for variant: retail-table (credit-card-retail-pdp template)
 * Base block: table (row 0 = header cells, subsequent rows = data cells).
 * Source: Citi RETAIL co-brand PDP — app-pdp section.pdp-section > app-pdp-compare-cards
 *
 * The compare-cards section holds a div.table-container with FOUR tables:
 *   1. table.image-table  — the card header row: an empty label cell + one
 *      <app-card-art> per compared card, plus a .card-title label.
 *   2..N table.content-table — each has a thead group heading (e.g. "Shopping at
 *      Best Buy®") and a tbody of feature rows: [feature label | mark | mark].
 *      Marks are inline SVG check/x; inclusion is read from the sibling
 *      .sr-only text ("... included" / "... not available") -> "Yes" / "No".
 *
 * md2da COLLAPSE FIX (mirrors the tds-* columns.js one-tile-per-row strategy):
 * Emitting all features as ONE wide EDS table produces a 3-column pandoc grid
 * table (blank label col + one column per card). WebImporter.md2da reliably
 * COLLAPSES grid tables with >=3 columns once they grow past a modest size —
 * the whole document degrades to a single <p> of raw "+---" ASCII (verified: the
 * 2-card / ~13-feature compare grid collapses; a narrow 3-col grid with the same
 * rows also collapses). 2-column grid tables with the identical content survive.
 * So we emit ONE 2-column `table` block PER compared card:
 *     [ (blank)                | <card art img + title> ]   <- header row
 *     [ **group heading**      | (empty) ]                  <- spanning heading
 *     [ <feature label>        | Yes / No ]                 <- feature rows
 * This keeps every table at exactly 2 columns (md2da-safe) while preserving all
 * feature copy, per-card Yes/No marks, group headings and the card art + title.
 *
 * Feature labels are also flattened to a SINGLE line (source <br> continuations
 * like "3% back in rewards<br>on gas purchases" are joined with " — ") so no cell
 * emits a "\"-continued multiline grid cell.
 */
export default function parse(element, { document }) {
  const container = element.querySelector('.table-container') || element;

  // Section H2 ("COMPARE CARDS"), lifted out and emitted above the block(s) (the
  // shared sections transformer does not emit template defaultContent).
  const sectionH2 = element.querySelector('h2.sub-heading, h2');

  // --- Card columns (from the image table): title + art image per card ---
  const cardTitles = [];
  const cardArts = [];
  const imageTable = container.querySelector('table.image-table');
  if (imageTable) {
    imageTable.querySelectorAll('thead td').forEach((td) => {
      const title = td.querySelector('.card-title, .sr-only');
      const img = td.querySelector('app-card-art img, img');
      cardTitles.push(title ? title.textContent.trim() : '');
      cardArts.push(img || null);
    });
  }

  const markFor = (td) => {
    const sr = td.querySelector('.sr-only');
    const txt = (sr ? sr.textContent : td.textContent).toLowerCase();
    if (/not available|not included|no\b/.test(txt)) return 'No';
    if (/included|available|yes\b/.test(txt)) return 'Yes';
    return td.querySelector('svg') ? 'Yes' : '';
  };

  // Flatten a feature-label <td> into ONE inline-only line. Source labels wrap the
  // primary phrase in <b>/<strong> and add a <br>-separated qualifier
  // ("3% back in rewards<br>on gas purchases"). A multiline cell would emit a
  // "\"-continued grid cell; join the pieces with " — " and keep footnote <sup>
  // anchors (unwrapped to plain markers) so nothing is lost.
  const flattenLabel = (td) => {
    const clone = td.cloneNode(true);
    // Replace <br> with " — " separators.
    clone.querySelectorAll('br').forEach((br) => br.replaceWith(document.createTextNode(' — ')));
    // The bold phrase should stay bold; wrap the whole thing in <strong> only if a
    // <b>/<strong> already leads it. Rebuild as a single <p> to guarantee one line.
    const p = document.createElement('p');
    p.append(...clone.childNodes);
    // Collapse any stray whitespace/newlines to single spaces.
    p.querySelectorAll('*').forEach((n) => {
      if (n.tagName === 'P') n.replaceWith(...n.childNodes);
    });
    return p;
  };

  // Collect the ordered list of feature entries once (shared across card tables):
  //   { type: 'heading', text } | { type: 'feature', label(td), marks: [td,...] }
  const entries = [];
  container.querySelectorAll('table.content-table').forEach((tbl) => {
    // Group heading: the <th> stacks a visible <h3> AND a duplicate .sr-only span
    // ("Shopping at Best Buy®" twice). Prefer the <h3> alone to avoid doubling.
    const heading = tbl.querySelector('thead h3')
      || tbl.querySelector('thead .sr-only')
      || tbl.querySelector('thead th');
    if (heading && heading.textContent.trim()) {
      entries.push({ type: 'heading', text: heading.textContent.trim() });
    }
    tbl.querySelectorAll('tbody tr').forEach((tr) => {
      const tds = Array.from(tr.children);
      if (!tds.length) return;
      entries.push({ type: 'feature', labelTd: tds[0], markTds: tds.slice(1) });
    });
  });

  if (!entries.length) {
    element.replaceWith(...element.childNodes);
    return;
  }

  // How many cards to emit a table for: prefer the image-table columns, else the
  // widest feature row's mark count.
  let numCards = cardArts.length;
  if (!numCards) {
    numCards = entries.reduce((m, e) => (e.type === 'feature' ? Math.max(m, e.markTds.length) : m), 0);
  }
  if (!numCards) numCards = 1;

  // Build ONE 2-column table block per card.
  const blocks = [];
  for (let c = 0; c < numCards; c += 1) {
    const rows = [];

    // Header row: blank label cell + card art image over title.
    const headerCell = [];
    const art = cardArts[c];
    if (art) {
      const im = document.createElement('img');
      im.src = art.getAttribute('src');
      im.alt = art.getAttribute('alt') || cardTitles[c] || '';
      headerCell.push(im);
    }
    if (cardTitles[c]) {
      const p = document.createElement('p');
      p.textContent = cardTitles[c];
      headerCell.push(p);
    }
    rows.push(['', headerCell.length ? headerCell : '']);

    // Feature + heading rows.
    entries.forEach((e) => {
      if (e.type === 'heading') {
        // Spanning group heading as single-line bold text (NOT an <h3> block) in the
        // first cell with an empty second cell, keeping the grid a stable 2 columns.
        const p = document.createElement('p');
        const strong = document.createElement('strong');
        strong.textContent = e.text;
        p.append(strong);
        rows.push([[p], '']);
      } else {
        const labelP = flattenLabel(e.labelTd);
        const markTd = e.markTds[c];
        rows.push([[labelP], markTd ? markFor(markTd) : '']);
      }
    });

    const block = WebImporter.Blocks.createBlock(document, { name: 'table', cells: rows });
    blocks.push(block);
  }

  if (sectionH2 && sectionH2.textContent.trim()) {
    const h = document.createElement('h2');
    h.append(...sectionH2.cloneNode(true).childNodes);
    element.replaceWith(h, ...blocks);
  } else {
    element.replaceWith(...blocks);
  }
}
