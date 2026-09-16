// deposit-account — the Monthly Service Fee schedule authored inside the cbol
// footer disclosures. Rows are `account | fee`, optionally followed by a BTA
// marker cell (`always` | `in`). Unmarked rows follow the source page: the
// first account is always offered, later ones only inside the banking
// territory (BTA), so they are hidden for out-of-territory ZIPs.
//
//   Regular Checking | $15.00      → always
//   Citi Savings***  | $4.50       → in
//
// The authored block-name row reads "Deposit Account | Monthly Service Fee",
// and DA consumes that row to derive the block name, so those labels never
// reach the page as content. They are declared here to keep the rendered table
// matching the source page; an authored label row still wins when present.

import { applyZip, getZip, syncBtaRows } from '../../scripts/bta.js';

const DEFAULT_HEADINGS = ['Deposit Account', 'Monthly Service Fee'];

function cellText(cell) {
  return (cell?.textContent || '').replace(/\s+/g, ' ').trim();
}

/** A trailing `always` / `in` cell is configuration, not content. */
function readMarker(cells) {
  if (cells.length < 3) return '';
  const value = cellText(cells[cells.length - 1]).toLowerCase();
  return value === 'always' || value === 'in' ? value : '';
}

/** Authors may prepend a label row; its fee cell carries no amount. */
function isHeaderRow(cells) {
  return cells.length > 1 && !/\d/.test(cellText(cells[1]));
}

function buildRow(cells, tag) {
  const row = document.createElement('tr');
  cells.forEach((cell, i) => {
    const target = document.createElement(i === 0 ? tag : 'td');
    if (tag === 'th') target.setAttribute('scope', i === 0 ? 'row' : 'col');
    target.innerHTML = cell.innerHTML;
    row.append(target);
  });
  return row;
}

export default async function decorate(block) {
  const rows = [...block.children]
    .map((row) => [...row.children])
    .map((cells) => {
      const marker = readMarker(cells);
      return { cells: marker ? cells.slice(0, -1) : cells, marker };
    })
    .filter(({ cells }) => cells.length);
  if (!rows.length) return;

  const table = document.createElement('table');
  const [first] = rows;
  const hasHeader = isHeaderRow(first.cells);
  const headings = hasHeader
    ? first.cells.map((cell) => cell.innerHTML)
    : DEFAULT_HEADINGS.slice(0, first.cells.length);

  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  headings.forEach((html) => {
    const th = document.createElement('th');
    th.setAttribute('scope', 'col');
    th.innerHTML = html;
    headerRow.append(th);
  });
  thead.append(headerRow);
  table.append(thead);

  const tbody = document.createElement('tbody');
  rows.slice(hasHeader ? 1 : 0).forEach(({ cells, marker }, i) => {
    const row = buildRow(cells, 'th');
    row.dataset.bta = marker || (i === 0 ? 'always' : 'in');
    tbody.append(row);
  });
  table.append(tbody);

  block.replaceChildren(table);

  await applyZip(getZip());
  syncBtaRows(table);
}
