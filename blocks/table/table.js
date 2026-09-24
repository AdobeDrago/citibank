/*
 * Table Block
 * Recreate a table
 * https://www.hlx.live/developer/block-collection/table
 */

function buildCell(rowIndex) {
  const cell = rowIndex ? document.createElement('td') : document.createElement('th');
  if (!rowIndex) cell.setAttribute('scope', 'col');
  return cell;
}

function cellText(cell) {
  return (cell?.textContent || '').replace(/\s+/g, ' ').trim();
}

function decorateBta(table, syncBtaRows) {
  const headerRow = table.querySelector('thead tr');
  const headers = [...(headerRow?.children || [])];
  const btaIndex = headers.findIndex((cell) => cellText(cell).toLowerCase() === 'bta');
  if (btaIndex < 0) return;

  headers[btaIndex].remove();
  table.querySelectorAll('tbody tr').forEach((row) => {
    const cell = row.children[btaIndex];
    if (!cell) return;
    const value = cellText(cell).toLowerCase();
    row.dataset.bta = value === 'in' ? 'in' : 'always';
    cell.remove();
  });

  const labels = [...table.querySelectorAll('thead th')].map(cellText).filter(Boolean);
  if (labels.length) table.setAttribute('aria-label', labels.join(', '));

  syncBtaRows(table);
}

function markFeatureValue(cell) {
  const text = cell.textContent.trim();
  if (!/^(yes|no)$/i.test(text)) return;
  cell.classList.add(`table-value-${text.toLowerCase()}`);
  const label = document.createElement('span');
  label.className = 'table-value-label';
  label.textContent = text;
  cell.replaceChildren(label);
}

function restoreRetailLabelBreaks(table) {
  table.querySelectorAll('tbody tr:not(.retail-compare-heading) > td:first-child strong, tbody tr:not(.retail-compare-heading) > td:first-child b').forEach((lead) => {
    const next = lead.nextSibling;
    if (!next || next.nodeType !== Node.TEXT_NODE) return;
    const match = next.textContent.match(/^\s*[—–-]\s*/);
    if (!match) return;
    const rest = next.textContent.slice(match[0].length);
    lead.after(document.createElement('br'));
    if (rest) next.textContent = rest;
    else next.remove();
  });
}

function mergeRetailCompareTables(wrappers) {
  const primaryWrapper = wrappers[0];
  const primaryBlock = primaryWrapper.querySelector('.table');
  const primaryTable = primaryBlock?.querySelector('table');
  if (!primaryTable) return;

  const primaryHeader = primaryTable.querySelector('thead tr');
  const primaryRows = [...primaryTable.querySelectorAll('tbody tr')];
  if (!primaryHeader) return;

  wrappers.slice(1).forEach((wrapper) => {
    const table = wrapper.querySelector('table');
    if (!table) return;

    const headerValue = table.querySelector('thead tr')?.children[1];
    if (headerValue) primaryHeader.append(headerValue);

    [...table.querySelectorAll('tbody tr')].forEach((row, i) => {
      const valueCell = row.children[1];
      if (valueCell && primaryRows[i]) primaryRows[i].append(valueCell);
    });

    wrapper.remove();
  });

  const cardCount = primaryHeader.children.length - 1;
  primaryBlock.classList.add('retail-compare');
  primaryWrapper.classList.add('retail-compare-wrapper');
  primaryBlock.style.setProperty('--retail-compare-cols', String(Math.max(cardCount, 1)));

  // Group-heading rows: label only, empty value cells (e.g. "Get more benefits…").
  // Source renders these as a second content-table with margin-bottom 1.8rem on
  // the prior table — insert a gap row so the merged grid keeps that spacing.
  primaryRows.forEach((row) => {
    const cells = [...row.children];
    const hasValues = cells.slice(1).some((cell) => cellText(cell));
    if (!hasValues && cellText(cells[0])) {
      row.classList.add('retail-compare-heading');
      const colCount = cells.length;
      const label = cells[0];
      label.colSpan = colCount;
      cells.slice(1).forEach((cell) => cell.remove());

      const gapRow = document.createElement('tr');
      gapRow.className = 'retail-compare-gap';
      gapRow.setAttribute('aria-hidden', 'true');
      const gapCell = document.createElement('td');
      gapCell.colSpan = colCount;
      gapRow.append(gapCell);
      row.before(gapRow);
    }
  });
}

function tryMergeRetailCompare(block) {
  if (!document.body.classList.contains('credit-card-retail-pdp')) return;

  block.classList.add('retail-compare');
  block.closest('.table-wrapper')?.classList.add('retail-compare-wrapper');

  const section = block.closest('.section');
  if (!section || section.dataset.retailCompareDone === 'true') return;

  section.classList.add('retail-compare-section');

  const wrappers = [...section.querySelectorAll(':scope > .table-wrapper')];
  if (wrappers.length < 2) {
    block.style.setProperty('--retail-compare-cols', '1');
    return;
  }
  if (wrappers.some((wrapper) => !wrapper.querySelector('.table table'))) return;

  section.dataset.retailCompareDone = 'true';
  mergeRetailCompareTables(wrappers);
}

export default async function decorate(block) {
  const table = document.createElement('table');
  const thead = document.createElement('thead');
  const tbody = document.createElement('tbody');
  const isRetail = document.body.classList.contains('credit-card-retail-pdp');

  const header = !block.classList.contains('no-header');
  if (header) table.append(thead);
  table.append(tbody);

  [...block.children].forEach((child, i) => {
    const row = document.createElement('tr');
    if (header && i === 0) thead.append(row);
    else tbody.append(row);
    [...child.children].forEach((col) => {
      const cell = buildCell(header ? i : i + 1);
      const align = col.getAttribute('data-align');
      const valign = col.getAttribute('data-valign');
      if (align) cell.style.textAlign = align;
      if (valign) cell.style.verticalAlign = valign;
      cell.innerHTML = col.innerHTML;
      if (isRetail && cell.tagName === 'TD') markFeatureValue(cell);
      row.append(cell);
    });
  });
  block.innerHTML = '';
  block.append(table);

  if (block.classList.contains('bta')) {
    const { applyZip, getZip, syncBtaRows } = await import('../../scripts/bta.js');
    await applyZip(getZip());
    decorateBta(table, syncBtaRows);
  }

  if (isRetail) {
    const section = block.closest('.section');
    tryMergeRetailCompare(block);
    const liveTable = section?.querySelector('.table.retail-compare table') || table;
    if (liveTable.isConnected) restoreRetailLabelBreaks(liveTable);
  }
}
