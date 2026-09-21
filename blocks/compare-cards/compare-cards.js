const VIEW_ALL_URL = '/credit-cards/view-all-credit-cards';
const CARD_DATA_URL = '/credit-cards/compare-card-data.json';
const CARD_IDS = ['aa-platinum-select', 'strata-elite', 'aa-executive'];

const CLOSE_ICON = `
  <svg class="compare-cards-close-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
    <path d="M2.366 1.234a.8.8 0 0 0-1.132 1.132L10.87 12l-9.635 9.634a.8.8 0 0 0 1.132 1.132L12 13.13l9.634 9.635a.8.8 0 0 0 1.132-1.132L13.13 12l9.635-9.634a.8.8 0 0 0-1.132-1.132L12 10.87z" />
  </svg>
`;

function splitList(value) {
  return (value || '').split('|').map((s) => s.trim()).filter(Boolean);
}

function rowToCard(row) {
  return {
    id: row.id,
    name: row.name,
    image: row.image,
    imageAlt: row.imageAlt,
    applyUrl: row.applyUrl,
    pricingUrl: row.pricingUrl,
    about: {
      title: row.aboutTitle,
      body: row.aboutBody,
    },
    benefits: splitList(row.benefits),
    annualFee: splitList(row.annualFee),
    apr: {
      purchase: row.aprPurchase,
      balanceTransferRate: row.aprBalanceTransferRate,
      balanceTransferFee: row.aprBalanceTransferFee,
    },
    travelPerks: splitList(row.travelPerks),
    withThisCard: splitList(row.withThisCard),
  };
}

async function fetchCards() {
  const res = await fetch(CARD_DATA_URL);
  if (!res.ok) throw new Error(`Failed to load ${CARD_DATA_URL}`);
  const json = await res.json();
  const rows = json.data || [];
  const byId = new Map(rows.map((row) => [row.id, row]));
  return CARD_IDS
    .map((id) => byId.get(id))
    .filter(Boolean)
    .map(rowToCard);
}

function plainName(card) {
  return card.name.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ');
}

function buildCloseBtn(className, card) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = className;
  btn.setAttribute('aria-label', `Remove ${plainName(card)}`);
  btn.innerHTML = CLOSE_ICON;
  return btn;
}

function buildFootnotes(className, card) {
  const wrap = document.createElement('div');
  wrap.className = className;

  const pricing = document.createElement('a');
  pricing.href = card.pricingUrl;
  pricing.target = '_blank';
  pricing.rel = 'noopener';
  pricing.innerHTML = '<span><sup aria-hidden="true">1</sup> Important Pricing &amp; Information +</span>';

  const addInfo = document.createElement('a');
  addInfo.href = '#';
  addInfo.innerHTML = '<span><sup aria-hidden="true">2</sup> Additional Information +</span>';

  wrap.append(pricing, addInfo);
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
    cell.dataset.cardId = card.id;

    cell.append(buildCloseBtn('compare-cards-close', card));

    const name = document.createElement('h2');
    name.className = 'compare-cards-name';
    name.innerHTML = card.name;
    cell.append(name);

    const img = document.createElement('img');
    img.className = 'compare-cards-image';
    img.src = card.image;
    img.alt = card.imageAlt;
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
      cell.dataset.cardId = card.id;
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

function buildStickyBar(slots) {
  const bar = document.createElement('div');
  bar.className = 'compare-cards-sticky-bar compare-cards-scroller';

  slots.forEach((card) => {
    const cell = document.createElement('div');
    cell.className = 'compare-cards-sticky-card';

    if (!card) {
      cell.classList.add('compare-cards-sticky-card-empty');
      cell.setAttribute('aria-hidden', 'true');
      bar.append(cell);
      return;
    }

    cell.dataset.cardId = card.id;
    cell.append(buildCloseBtn('compare-cards-sticky-close', card));

    const title = document.createElement('p');
    title.className = 'compare-cards-sticky-title';
    title.innerHTML = card.name;
    cell.append(title);

    const main = document.createElement('div');
    main.className = 'compare-cards-sticky-main';

    const img = document.createElement('img');
    img.className = 'compare-cards-sticky-image';
    img.src = card.image;
    img.alt = card.imageAlt;
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
  try {
    cards = await fetchCards();
  } catch {
    block.textContent = 'Unable to load card comparison data.';
    return;
  }

  if (!cards.length) {
    block.textContent = 'No cards available to compare.';
    return;
  }

  const slots = cards.slice();
  let lastRemoved = null;

  function render() {
    const header = buildHeader(slots, lastRemoved);
    const stickyBar = buildStickyBar(slots);
    const dotsNav = buildDots(slots);

    const aboutRow = buildTopicRow('About this card', slots, (card) => `
      <h3 class="rewards-title">${card.about.title}</h3>
      <p class="about-content">${card.about.body}</p>
    `, true);

    const benefitsRow = buildTopicRow('Card Benefits', slots, (card) => `
      <ul>${card.benefits.map((b) => `<li>${b}</li>`).join('')}</ul>
    `);

    const annualFeeRow = buildTopicRow('Annual Fee', slots, (card) => `
      <ul class="annual-fee-list">${card.annualFee.map((f) => `<li>${f}</li>`).join('')}</ul>
    `);

    const aprRow = buildTopicRow('APR', slots, (card) => `
      <div class="apr-item"><h4>Purchase Rate</h4><p>${card.apr.purchase}</p></div>
      <div class="apr-item"><h4>Balance Transfer Rate</h4><p>${card.apr.balanceTransferRate}</p></div>
      <div class="apr-item"><h4>Balance Transfer Fee</h4><p>${card.apr.balanceTransferFee}</p></div>
    `);

    const travelPerksRow = buildTopicRow('Travel Perks', slots, (card) => `
      <ul>${card.travelPerks.map((t) => `<li>${t}</li>`).join('')}</ul>
    `);

    const withThisCardRow = buildTopicRow('With This Card, You Also Get', slots, (card) => `
      <ul>${card.withThisCard.map((w) => `<li>${w}</li>`).join('')}</ul>
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
      const index = slots.findIndex((c) => c && c.id === cardId);
      if (index !== -1) {
        lastRemoved = { card: slots[index], index };
        slots[index] = null;
        render();
      }
      return;
    }

    const undoBtn = event.target.closest('.compare-cards-undo');
    if (undoBtn) {
      if (lastRemoved) {
        slots[lastRemoved.index] = lastRemoved.card;
        lastRemoved = null;
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
