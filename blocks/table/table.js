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

export default async function decorate(block) {
  const table = document.createElement('table');
  const thead = document.createElement('thead');
  const tbody = document.createElement('tbody');

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
}
