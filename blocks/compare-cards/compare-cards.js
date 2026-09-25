import getProducts from '../product-list/product-list-data.js';

const VIEW_ALL_URL = '/credit-cards/view-all-credit-cards';
const INDEX_URL = '/credit-card-index.json';
// Static comparison content (About this card, Benefits, Annual Fee, APR,
// Travel Perks, With This Card) for the sections below the header. Assigned
// PURELY BY SLOT POSITION — slot 0 always gets this sheet's row 0, slot 1
// always gets row 1, and so on — regardless of which real card (by path)
// the person actually selected into that slot. This is intentional for
// now: the header reflects the real selection, but the detailed comparison
// content is fixed placeholder content per the current prototype scope.
const CARD_DATA_URL = '/credit-cards/compare-card-data.json';
const MAX_SLOTS = 3;

// Same key/format compare-tray.js writes when checkboxes change — kept as
// its own inline copy here (rather than a shared module) to avoid an extra
// file to wire up; if this key or JSON shape ever changes, update both
// files together.
const SELECTION_KEY = 'compare-cards-selected';

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

function splitList(value) {
  return (value || '').split('|').map((s) => s.trim()).filter(Boolean);
}

const CLOSE_ICON = `
  <svg class="compare-cards-close-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
    <path d="M2.366 1.234a.8.8 0 0 0-1.132 1.132L10.87 12l-9.635 9.634a.8.8 0 0 0 1.132 1.132L12 13.13l9.634 9.635a.8.8 0 0 0 1.132-1.132L13.13 12l9.635-9.634a.8.8 0 0 0-1.132-1.132L12 10.87z" />
  </svg>
`;

/**
 * credit-card-index.json + getProducts() remains the source of truth for
 * which cards exist and their header identity (title, image, path,
 * applyUrl, comparable) — matched by product.path everywhere, same as
 * product-list.js and compare-tray.js.
 */
async function fetchProducts() {
  const res = await fetch(INDEX_URL);
  if (!res.ok) throw new Error(`Failed to load ${INDEX_URL}`);
  const json = await res.json();
  return getProducts(json);
}

// Best-effort, ordered array (not keyed by anything) — a missing/unreachable
// compare-card-data.json should not break the page; slots just render with
// no static content below the header if this comes back empty.
async function fetchCompareRows() {
  try {
    const res = await fetch(CARD_DATA_URL);
    if (!res.ok) return [];
    const json = await res.json();
    return json.data || [];
  } catch {
    return [];
  }
}

// The static content for a given slot position, cycling through the sheet's
// rows if there are more slots than rows (harmless with the current 3
// slots / 6 rows, but keeps this from breaking if either count changes).
function staticContentForSlot(compareRows, slotIndex) {
  if (!compareRows.length) return null;
  const row = compareRows[slotIndex % compareRows.length];
  return {
    about: { title: row.aboutTitle || '', body: row.aboutBody || '' },
    benefits: splitList(row.benefits),
    annualFeeList: splitList(row.annualFee),
    apr: {
      purchase: row.aprPurchase || '',
      balanceTransferRate: row.aprBalanceTransferRate || '',
      balanceTransferFee: row.aprBalanceTransferFee || '',
    },
    travelPerks: splitList(row.travelPerks),
    withThisCard: splitList(row.withThisCard),
  };
}

function pickCards(products) {
  const byPath = new Map(products.map((product) => [product.path, product]));
  const selectedPaths = getSelection();
  const selected = selectedPaths.map((path) => byPath.get(path)).filter(Boolean);

  return selected.length
    ? selected.slice(0, MAX_SLOTS)
    // Nothing selected (e.g. direct navigation without going through the
    // tray) — fall back to the first few comparable products rather than
    // showing an empty page.
    : products.filter((product) => product.comparable).slice(0, MAX_SLOTS);
}

function plainName(card) {
  return (card.title || '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ');
}

function buildCloseBtn(className, card) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = className;
  btn.setAttribute('aria-label', `Remove ${plainName(card)}`);
  btn.innerHTML = CLOSE_ICON;
  return btn;
}

// Same marker/disclosure pattern as product-list.js's createDisclosure —
// pricingInfo and additionalInfo are plain body text, not links, so these
// render as inline expandable <details> rather than anchors to a URL the
// shared index doesn't provide.
function buildFootnotes(className, card) {
  const wrap = document.createElement('div');
  wrap.className = className;

  const items = [
    ['1', 'Important Pricing & Information', card.pricingInfo],
    ['2', 'Additional Information', card.additionalInfo],
  ].filter(([, , text]) => text);

  items.forEach(([marker, label, text]) => {
    const details = document.createElement('details');
    const summary = document.createElement('summary');
    const sup = document.createElement('sup');
    sup.setAttribute('aria-hidden', 'true');
    sup.textContent = marker;
    summary.append(sup, ` ${label} +`);
    const body = document.createElement('p');
    body.textContent = text;
    details.append(summary, body);
    wrap.append(details);
  });

  return wrap;
}

function buildAddCardCell(slotIndex, lastRemoved) {
  const cell = document.createElement('div');
  cell.className = 'compare-cards-card compare-cards-add-card';
  cell.dataset.slotIndex = slotIndex;

  if (lastRemoved && lastRemoved.index === slotIndex) {
    const undoBtn = document.createElement('button');
    undoBtn.type = 'button';
    undoBtn.className = 'compare-cards-undo';
    undoBtn.textContent = 'Undo';
    cell.append(undoBtn);
  }

  const body = document.createElement('div');
  body.className = 'compare-cards-add-card-body';

  const title = document.createElement('p');
  title.className = 'compare-cards-add-card-title';
  title.textContent = 'Add a New Card to Compare';
  body.append(title);

  const addBtn = document.createElement('a');
  addBtn.className = 'compare-cards-add-card-btn';
  addBtn.href = VIEW_ALL_URL;
  addBtn.textContent = 'Add Card';
  body.append(addBtn);

  cell.append(body);
  return cell;
}

// Compact counterpart to buildAddCardCell, for the sticky bar's smaller
// slots — same Add Card/Undo behavior (both handled by the delegated click
// listener on `block`, so nothing extra to wire up here), different sizing.
function buildStickyAddCardCell(slotIndex, lastRemoved) {
  const cell = document.createElement('div');
  cell.className = 'compare-cards-sticky-card compare-cards-sticky-add-card';
  cell.dataset.slotIndex = slotIndex;

  if (lastRemoved && lastRemoved.index === slotIndex) {
    const undoBtn = document.createElement('button');
    undoBtn.type = 'button';
    undoBtn.className = 'compare-cards-undo compare-cards-sticky-undo';
    undoBtn.textContent = 'Undo';
    cell.append(undoBtn);
  }

  const title = document.createElement('p');
  title.className = 'compare-cards-sticky-add-card-title';
  title.textContent = 'Add a New Card to Compare';
  cell.append(title);

  const addBtn = document.createElement('a');
  addBtn.className = 'compare-cards-add-card-btn compare-cards-sticky-add-card-btn';
  addBtn.href = VIEW_ALL_URL;
  addBtn.textContent = 'Add Card';
  cell.append(addBtn);

  return cell;
}

function buildHeader(slots, lastRemoved) {
  const header = document.createElement('div');
  header.className = 'compare-cards-header compare-cards-scroller';

  slots.forEach((card, index) => {
    if (!card) {
      header.append(buildAddCardCell(index, lastRemoved));
      return;
    }

    const cell = document.createElement('div');
    cell.className = 'compare-cards-card';
    cell.dataset.cardId = card.path;

    cell.append(buildCloseBtn('compare-cards-close', card));

    const name = document.createElement('h2');
    name.className = 'compare-cards-name';
    name.textContent = card.title;
    cell.append(name);

    const img = document.createElement('img');
    img.className = 'compare-cards-image';
    img.src = card.image;
    img.alt = `${plainName(card)} card`;
    cell.append(img);

    const cta = document.createElement('a');
    cta.className = 'compare-cards-cta';
    cta.href = card.applyUrl;
    cta.target = '_blank';
    cta.textContent = 'Apply now';
    cell.append(cta);

    cell.append(buildFootnotes('compare-cards-footnotes', card));

    header.append(cell);
  });

  return header;
}

function buildTopicRow(label, slots, getContent, isFirst = false) {
  const wrapper = document.createElement('div');
  wrapper.className = 'compare-cards-topic-row';
  if (isFirst) wrapper.classList.add('compare-cards-topic-row-first');

  const labelWrap = document.createElement('div');
  labelWrap.className = 'compare-cards-topic-label-wrap';

  const labelEl = document.createElement('h2');
  labelEl.className = 'compare-cards-topic-label';
  labelEl.textContent = label;
  labelWrap.append(labelEl);

  wrapper.append(labelWrap);

  const content = document.createElement('div');
  content.className = 'compare-cards-topic-content compare-cards-scroller';

  slots.forEach((card) => {
    const cell = document.createElement('div');
    cell.className = 'compare-cards-topic-cell';

    if (card) {
      cell.dataset.cardId = card.path;
      cell.innerHTML = getContent(card);
    } else {
      cell.classList.add('compare-cards-topic-cell-empty');
      cell.setAttribute('aria-hidden', 'true');
    }

    content.append(cell);
  });

  wrapper.append(content);
  return wrapper;
}

function buildTitle() {
  const wrapper = document.createElement('div');
  wrapper.className = 'cmp-title';
  const h1 = document.createElement('h1');
  h1.textContent = 'Compare Credit Cards';
  wrapper.append(h1);
  return wrapper;
}

function buildDots(slots) {
  if (slots.length < 3) return null;

  const nav = document.createElement('ul');
  nav.className = 'compare-cards-dots';
  nav.setAttribute('role', 'list');

  for (let i = 0; i < slots.length - 1; i += 1) {
    const li = document.createElement('li');
    li.setAttribute('role', 'listitem');
    const dot = document.createElement('span');
    dot.className = i === 0 ? 'compare-cards-dot active' : 'compare-cards-dot';
    dot.setAttribute('role', 'button');
    dot.setAttribute('tabindex', '0');
    dot.dataset.page = i;
    const nameA = slots[i] ? plainName(slots[i]) : 'Add a new card';
    const nameB = slots[i + 1] ? plainName(slots[i + 1]) : 'Add a new card';
    dot.setAttribute('aria-label', `${nameA} and ${nameB} comparison`);
    li.append(dot);
    nav.append(li);
  }

  return nav;
}

function buildStickyBar(slots, lastRemoved) {
  const bar = document.createElement('div');
  bar.className = 'compare-cards-sticky-bar compare-cards-scroller';

  slots.forEach((card, index) => {
    if (!card) {
      bar.append(buildStickyAddCardCell(index, lastRemoved));
      return;
    }

    const cell = document.createElement('div');
    cell.className = 'compare-cards-sticky-card';
    cell.dataset.cardId = card.path;
    cell.append(buildCloseBtn('compare-cards-sticky-close', card));

    const title = document.createElement('p');
    title.className = 'compare-cards-sticky-title';
    title.textContent = card.title;
    cell.append(title);

    const main = document.createElement('div');
    main.className = 'compare-cards-sticky-main';

    const img = document.createElement('img');
    img.className = 'compare-cards-sticky-image';
    img.src = card.image;
    img.alt = `${plainName(card)} card`;
    main.append(img);

    const cta = document.createElement('a');
    cta.className = 'compare-cards-sticky-cta';
    cta.href = card.applyUrl;
    cta.target = '_blank';
    cta.textContent = 'Apply now';
    main.append(cta);

    cell.append(main);
    cell.append(buildFootnotes('compare-cards-sticky-footnotes', card));

    bar.append(cell);
  });

  return bar;
}

function initStickySync(block, header, stickyBar) {
  const SCROLL_THRESHOLD = 100;

  const updateStickyState = () => {
    stickyBar.classList.toggle('is-visible', window.scrollY > SCROLL_THRESHOLD);
  };

  updateStickyState();
  window.addEventListener('scroll', updateStickyState, { passive: true });

  stickyBar.addEventListener('click', (event) => {
    const closeBtn = event.target.closest('.compare-cards-sticky-close');
    if (!closeBtn) return;
    const { cardId } = closeBtn.closest('.compare-cards-sticky-card').dataset;
    const mainClose = header.querySelector(`.compare-cards-card[data-card-id="${cardId}"] .compare-cards-close`);
    if (mainClose) mainClose.click();
  });
}

function initCarouselSync(block, dotsNav) {
  const getScrollers = () => Array.from(block.querySelectorAll('.compare-cards-scroller'));

  const scrollers = getScrollers();
  if (!scrollers.length) return;

  const master = scrollers[0];
  let syncing = false;

  const setActivePage = (page) => {
    if (!dotsNav) return;
    dotsNav.querySelectorAll('.compare-cards-dot').forEach((dot, i) => {
      dot.classList.toggle('active', i === page);
    });
  };

  const syncFromMaster = () => {
    if (syncing) return;
    syncing = true;

    const masterMax = master.scrollWidth - master.clientWidth;
    const ratio = masterMax > 0 ? master.scrollLeft / masterMax : 0;

    getScrollers().forEach((other) => {
      if (other === master) return;
      const otherMax = other.scrollWidth - other.clientWidth;
      other.scrollLeft = ratio * otherMax;
    });

    if (masterMax > 0) {
      const page = ratio >= 0.5 ? 1 : 0;
      setActivePage(page);
    }

    requestAnimationFrame(() => { syncing = false; });
  };

  master.addEventListener('scroll', syncFromMaster, { passive: true });

  if (dotsNav) {
    dotsNav.addEventListener('click', (event) => {
      const li = event.target.closest('li');
      if (!li) return;
      const dot = li.querySelector('.compare-cards-dot');
      if (!dot) return;
      const page = Number(dot.dataset.page);

      const masterMax = master.scrollWidth - master.clientWidth;
      const left = page === 0 ? 0 : masterMax;
      master.scrollTo({ left, behavior: 'smooth' });
      setActivePage(page);
    });

    dotsNav.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const li = event.target.closest('li');
      if (!li) return;
      const dot = li.querySelector('.compare-cards-dot');
      if (!dot) return;
      event.preventDefault();
      dot.click();
    });
  }
}

export default async function decorate(block) {
  block.textContent = '';

  let cards;
  let compareRows;
  try {
    [cards, compareRows] = await Promise.all([
      fetchProducts().then((products) => pickCards(products)),
      fetchCompareRows(),
    ]);
  } catch {
    block.textContent = 'Unable to load card comparison data.';
    return;
  }

  if (!cards.length) {
    block.textContent = 'No cards available to compare.';
    return;
  }

  // Pad up to MAX_SLOTS with nulls so a partial selection (e.g. only 2
  // cards) still renders a full 3-column grid, with the missing slot(s)
  // showing the same "Add a New Card to Compare" placeholder already used
  // when a card is removed later, rather than a shrunken/empty column.
  const slots = cards.slice();
  while (slots.length < MAX_SLOTS) slots.push(null);

  let lastRemoved = null;

  function render() {
    // Merge each real card's header identity with static content assigned
    // purely by slot position (see staticContentForSlot) — this is what
    // makes the About/Benefits/APR/etc. rows always show sheet content
    // regardless of which actual card is in that slot.
    const displaySlots = slots.map((card, i) => (
      card ? { ...card, ...staticContentForSlot(compareRows, i) } : null
    ));

    const header = buildHeader(displaySlots, lastRemoved);
    const stickyBar = buildStickyBar(displaySlots, lastRemoved);
    const dotsNav = buildDots(displaySlots);

    const aboutRow = buildTopicRow('About this card', displaySlots, (card) => `
      <h3 class="rewards-title">${card.about?.title || ''}</h3>
      <p class="about-content">${card.about?.body || ''}</p>
    `, true);

    const benefitsRow = buildTopicRow('Card Benefits', displaySlots, (card) => `
      <ul>${(card.benefits || []).map((b) => `<li>${b}</li>`).join('')}</ul>
    `);

    const annualFeeRow = buildTopicRow('Annual Fee', displaySlots, (card) => `
      <ul class="annual-fee-list">${(card.annualFeeList || []).map((f) => `<li>${f}</li>`).join('')}</ul>
    `);

    const aprRow = buildTopicRow('APR', displaySlots, (card) => `
      <div class="apr-item"><h4>Purchase Rate</h4><p>${card.apr?.purchase || ''}</p></div>
      <div class="apr-item"><h4>Balance Transfer Rate</h4><p>${card.apr?.balanceTransferRate || ''}</p></div>
      <div class="apr-item"><h4>Balance Transfer Fee</h4><p>${card.apr?.balanceTransferFee || ''}</p></div>
    `);

    const travelPerksRow = buildTopicRow('Travel Perks', displaySlots, (card) => `
      <ul>${(card.travelPerks || []).map((t) => `<li>${t}</li>`).join('')}</ul>
    `);

    const withThisCardRow = buildTopicRow('With This Card, You Also Get', displaySlots, (card) => `
      <ul>${(card.withThisCard || []).map((w) => `<li>${w}</li>`).join('')}</ul>
    `);

    const children = [stickyBar, buildTitle()];
    if (dotsNav) children.push(dotsNav);
    children.push(
      header,
      aboutRow,
      benefitsRow,
      annualFeeRow,
      aprRow,
      travelPerksRow,
      withThisCardRow,
    );

    block.replaceChildren(...children);
    initStickySync(block, header, stickyBar);
    initCarouselSync(block, dotsNav);
  }

  render();

  block.addEventListener('click', (event) => {
    const closeBtn = event.target.closest('.compare-cards-close');
    if (closeBtn) {
      const { cardId } = closeBtn.closest('.compare-cards-card').dataset;
      const index = slots.findIndex((c) => c && c.path === cardId);
      if (index !== -1) {
        lastRemoved = { card: slots[index], index };
        slots[index] = null;
        // Keep the shared selection in sync, so returning to the listing
        // page reflects this removal instead of showing the tray/checkbox
        // state from when this page first loaded.
        setSelection(slots.filter(Boolean).map((card) => card.path));
        render();
      }
      return;
    }

    const undoBtn = event.target.closest('.compare-cards-undo');
    if (undoBtn) {
      if (lastRemoved) {
        slots[lastRemoved.index] = lastRemoved.card;
        lastRemoved = null;
        setSelection(slots.filter(Boolean).map((card) => card.path));
        render();
      }
      return;
    }

    const addBtn = event.target.closest('.compare-cards-add-card-btn');
    if (addBtn) {
      window.location.href = VIEW_ALL_URL;
    }
  });
}
