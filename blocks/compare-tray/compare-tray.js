import getProducts from '../product-list/product-list-data.js';

// Same key/format compare-cards.js reads to know which cards to show —
// kept as its own inline copy here (rather than a shared module) to avoid
// an extra file to wire up; if this key or JSON shape ever changes, update
// both files together.
const SELECTION_KEY = 'compare-cards-selected';
const MAX_SLOTS = 3;
const COMPARE_PATH = '/credit-cards/compare-cards';
const INDEX_URL = '/credit-card-index.json';

function getSelection() {
  try {
    return JSON.parse(sessionStorage.getItem(SELECTION_KEY)) || [];
  } catch {
    return [];
  }
}

function setSelection(paths) {
  sessionStorage.setItem(SELECTION_KEY, JSON.stringify(paths));
  document.dispatchEvent(new CustomEvent('compare-selection-changed', { detail: { paths } }));
}

/**
 * product-list.js sets data-compare-path on each checkbox (the same
 * product.path used as the id everywhere here), so we can read it directly
 * instead of matching on label text — text matching broke silently on any
 * formatting difference and was the root cause of the tray occasionally
 * losing sync with the checkboxes.
 */
function findIdForCheckbox(checkbox) {
  return checkbox.dataset.comparePath || null;
}

// Keyed by path (the same identifier product-list.js links/navigates with
// and now also stores on each checkbox), since the product index has no
// separate numeric/string id field.
async function fetchCardsById() {
  const res = await fetch(INDEX_URL);
  const json = await res.json();
  const products = getProducts(json);
  return new Map(products.map((product) => [product.path, product]));
}

function uncheckProductListBox(id) {
  document.querySelectorAll('.product-list-compare-input').forEach((box) => {
    if (findIdForCheckbox(box) === id) {
      box.checked = false;
      box.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
}

function buildCloseIcon() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.innerHTML = '<path d="M2.366 1.234a.8.8 0 0 0-1.132 1.132L10.87 12l-9.635 9.634a.8.8 0 0 0 1.132 1.132L12 13.13l9.634 9.635a.8.8 0 0 0 1.132-1.132L13.13 12l9.635-9.634a.8.8 0 0 0-1.132-1.132L12 10.87z"></path>';
  return svg;
}

function buildThumb(slotIndex, id, card, cardsById, tray) {
  const thumb = document.createElement('div');
  thumb.className = 'compare-tray-thumb';

  if (!card) {
    thumb.classList.add('compare-tray-thumb-empty');
    const srOnly = document.createElement('span');
    srOnly.className = 'sr-only';
    srOnly.textContent = `No Cart item ${slotIndex + 1} selected for compare`;
    thumb.append(srOnly);
    return thumb;
  }

  const art = document.createElement('div');
  art.className = 'compare-tray-thumb-art';
  art.innerHTML = `<img src="${card.image}" alt="${card.title} card">`;
  thumb.append(art);

  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'compare-tray-remove';
  remove.setAttribute('aria-label', `Remove cart item ${slotIndex + 1} ${card.title}`);
  remove.append(buildCloseIcon());
  remove.addEventListener('click', () => {
    setSelection(getSelection().filter((selectedId) => selectedId !== id));
    // Also uncheck the matching product-list checkbox, since that
    // block's own state (input.checked) is otherwise left stale. This
    // dispatches its own 'change' that the document listener below will
    // also react to; the explicit renderTray call after it guarantees this
    // exact card is dropped even if that title-based match fails to find
    // (or mismatches) the checkbox to uncheck.
    uncheckProductListBox(id);
    // renderTray is defined below; buildThumb and renderTray call each
    // other (renderTray builds thumbs, a thumb's remove button re-renders
    // the tray), so one must reference the other before its definition
    // regardless of ordering. Safe due to function-declaration hoisting.
    // eslint-disable-next-line no-use-before-define
    renderTray(tray, cardsById);
  });
  thumb.append(remove);

  return thumb;
}

function renderTray(tray, cardsById) {
  tray.replaceChildren();
  const ids = getSelection();

  if (!ids.length) {
    tray.classList.add('compare-tray-hidden');
    return;
  }
  tray.classList.remove('compare-tray-hidden');

  const inner = document.createElement('div');
  inner.className = 'compare-tray-inner';

  for (let i = 0; i < MAX_SLOTS; i += 1) {
    const id = ids[i];
    const card = id ? cardsById.get(id) : null;
    inner.append(buildThumb(i, id, card, cardsById, tray));
  }

  const compareWrap = document.createElement('div');
  compareWrap.className = 'compare-tray-compare-wrap';

  const compareBtn = document.createElement('a');
  compareBtn.className = 'compare-tray-compare';
  compareBtn.textContent = 'Compare now';

  const canCompare = ids.length >= 2;
  if (canCompare) {
    compareBtn.href = COMPARE_PATH;
  } else {
    compareBtn.setAttribute('aria-disabled', 'true');
    compareBtn.classList.add('compare-tray-compare-disabled');
    compareBtn.addEventListener('click', (event) => event.preventDefault());
  }

  compareWrap.append(compareBtn);
  inner.append(compareWrap);
  tray.append(inner);
}

export default async function decorate(block) {
  block.textContent = '';
  block.classList.add('compare-tray-hidden');

  const cardsById = await fetchCardsById().catch(() => new Map());

  renderTray(block, cardsById);

  // Listen at the document level for checkbox changes anywhere on the page,
  // since product-list.js's own listener can't be modified to notify us
  // directly. Re-derives the full checked set on every change.
  document.addEventListener('change', (event) => {
    if (!event.target.classList.contains('product-list-compare-input')) return;

    const checkedIds = [...document.querySelectorAll('.product-list-compare-input:checked')]
      .map((box) => findIdForCheckbox(box))
      .filter(Boolean);

    setSelection(checkedIds);
    renderTray(block, cardsById);
  });
}
