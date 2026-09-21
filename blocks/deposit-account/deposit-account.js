// deposit-account — Monthly Service Fee schedule in the cbol footer.
// Preferred source: the IN / OUT tabs of /cbol/zipcode-bta.json (selected by
// the visitor's ZIP → BTA). Authored block rows are the fallback when those
// tabs are empty or the workbook is still a single `data` sheet.
//
// Authored fallback rows are `account | fee`, optionally + `always` | `in`.

import {
  applyZip,
  getBta,
  getBtaFeeSchedule,
  getZip,
  onBtaUpdated,
} from '../../scripts/bta.js';

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

function buildAuthoredRow(cells) {
  const row = document.createElement('tr');
  cells.forEach((cell, i) => {
    const target = document.createElement(i === 0 ? 'th' : 'td');
    if (i === 0) target.setAttribute('scope', 'row');
    target.innerHTML = cell.innerHTML;
    row.append(target);
  });
  return row;
}

function buildSheetRow(account, fee) {
  const row = document.createElement('tr');
  const name = document.createElement('th');
  name.setAttribute('scope', 'row');
  name.textContent = account;
  const amount = document.createElement('td');
  amount.textContent = fee;
  row.append(name, amount);
  return row;
}

function buildHead(headings) {
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  headings.forEach((html) => {
    const th = document.createElement('th');
    th.setAttribute('scope', 'col');
    th.innerHTML = html;
    headerRow.append(th);
  });
  thead.append(headerRow);
  return thead;
}

/**
 * @param {Element} block
 * @returns {{ headings: string[], authored: { cells: Element[], marker: string }[] }}
 */
function readAuthored(block) {
  const authored = [...block.children]
    .map((row) => [...row.children])
    .map((cells) => {
      const marker = readMarker(cells);
      return { cells: marker ? cells.slice(0, -1) : cells, marker };
    })
    .filter(({ cells }) => cells.length);

  if (!authored.length) {
    return { headings: DEFAULT_HEADINGS, authored: [] };
  }

  const [first] = authored;
  const hasHeader = isHeaderRow(first.cells);
  const headings = hasHeader
    ? first.cells.map((cell) => cell.innerHTML)
    : DEFAULT_HEADINGS.slice(0, first.cells.length);

  return {
    headings,
    authored: authored.slice(hasHeader ? 1 : 0),
  };
}

/**
 * @param {HTMLTableSectionElement} tbody
 * @param {{ account: string, fee: string }[]} fees
 * @param {{ cells: Element[], marker: string }[]} authored
 * @param {string} outOfBTA
 */
function fillBody(tbody, fees, authored, outOfBTA) {
  tbody.replaceChildren();

  if (fees.length) {
    fees.forEach(({ account, fee }) => tbody.append(buildSheetRow(account, fee)));
    return;
  }

  // Fallback: authored rows with IN-only markers when the IN/OUT tabs are empty.
  authored.forEach(({ cells, marker }, i) => {
    const row = buildAuthoredRow(cells);
    row.dataset.bta = marker || (i === 0 ? 'always' : 'in');
    tbody.append(row);
  });
  tbody.querySelectorAll('[data-bta="in"]').forEach((el) => {
    const hide = outOfBTA === 'OUT';
    el.hidden = hide;
    if (hide) el.setAttribute('aria-hidden', 'true');
    else el.removeAttribute('aria-hidden');
  });
}

export default async function decorate(block) {
  const { headings, authored } = readAuthored(block);
  if (!headings.length && !authored.length) return;

  const table = document.createElement('table');
  table.append(buildHead(headings));
  const tbody = document.createElement('tbody');
  table.append(tbody);
  block.replaceChildren(table);

  const render = async (outOfBTA) => {
    const fees = await getBtaFeeSchedule(outOfBTA);
    fillBody(tbody, fees, authored, outOfBTA);
  };

  const result = await applyZip(getZip());
  await render(result.outOfBTA || getBta());
  onBtaUpdated((event) => {
    render(event.detail.outOfBTA);
  });
}
