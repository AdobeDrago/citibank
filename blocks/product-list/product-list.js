import { createOptimizedPicture } from '../../scripts/aem.js';
import {
  getOfferSheetUrl, fetchOfferSheetJson, sheetToValues, replaceOfferTokens, resolveOfferTokens,
} from '../../scripts/offer-sheet.js';
import getProducts, { filterByCategories, getCategories } from './product-list-data.js';
import { createIcon, iconForBenefit } from './product-list-icons.js';

const INDEX_URL = '/credit-card-index.json';
const MAX_BENEFITS = 4;
const MAX_COMPARE = 3;

function createStatus(message, type = 'status') {
  const status = document.createElement('p');
  status.className = `product-list-${type}`;
  status.setAttribute('role', type === 'error' ? 'alert' : 'status');
  status.textContent = message;
  return status;
}

function createBanner(product) {
  if (!product.eyebrow) return null;

  const banner = document.createElement('p');
  banner.className = 'product-list-banner';
  banner.textContent = product.eyebrow;
  return banner;
}

function createImage(product) {
  if (!product.image) return null;

  const link = document.createElement('a');
  link.className = 'product-list-image';
  link.href = product.path;
  link.tabIndex = -1;
  link.setAttribute('aria-hidden', 'true');
  link.append(createOptimizedPicture(
    product.image,
    `${product.title} card`,
    false,
    [{ media: '(min-width: 900px)', width: '500' }, { width: '400' }],
  ));
  return link;
}

function createHeader(product) {
  const header = document.createElement('div');
  header.className = 'product-list-header';

  const heading = document.createElement('h3');
  const titleLink = document.createElement('a');
  titleLink.href = product.path;
  titleLink.textContent = product.title;
  heading.append(titleLink);

  header.append(...[createImage(product), heading].filter(Boolean));
  return header;
}

function createBenefitItem(text, icon) {
  const item = document.createElement('li');
  item.append(createIcon(icon));
  const label = document.createElement('span');
  label.textContent = text;
  item.append(label);
  return item;
}

function annualFeeLabel(annualFee) {
  return annualFee === '$0' ? 'No Annual Fee' : `${annualFee} Annual Fee`;
}

// Resolved as a string before formatting (rather than via post-render DOM
// replacement) so a {{annual fee}} token resolving to $0 still triggers the
// "No Annual Fee" label instead of literally showing "$0 Annual Fee".
function createBenefits(product, values) {
  const rows = product.benefits.slice(0, MAX_BENEFITS).map((text) => [text, iconForBenefit(text)]);
  const annualFee = values ? resolveOfferTokens(product.annualFee, values) : product.annualFee;
  if (annualFee) rows.push([annualFeeLabel(annualFee), 'dollar']);
  if (!rows.length) return null;

  const list = document.createElement('ul');
  list.className = 'product-list-benefits';
  rows.forEach(([text, icon]) => list.append(createBenefitItem(text, icon)));
  return list;
}

function syncCompareUI(grid) {
  const boxes = [...grid.querySelectorAll('.product-list-compare-input')];
  const selectedCount = boxes.filter((box) => box.checked).length;
  grid.querySelectorAll('.product-list-compare-count').forEach((count) => {
    count.textContent = `(${selectedCount}/${MAX_COMPARE})`;
  });
  boxes.forEach((box) => {
    box.disabled = !box.checked && selectedCount >= MAX_COMPARE;
  });
}

function createCompare(product, grid) {
  if (!product.comparable) return null;

  const label = document.createElement('label');
  label.className = 'product-list-compare';

  const input = document.createElement('input');
  input.type = 'checkbox';
  input.className = 'product-list-compare-input';
  input.setAttribute('aria-label', `Compare ${product.title}`);
  input.addEventListener('change', () => syncCompareUI(grid));

  const text = document.createElement('span');
  text.append('Compare ', Object.assign(document.createElement('span'), {
    className: 'product-list-compare-count',
    textContent: `(0/${MAX_COMPARE})`,
  }));

  label.append(input, text);
  return label;
}

function createDetails(product) {
  const details = document.createElement('a');
  details.className = 'product-list-details';
  details.href = product.path;
  details.append(document.createTextNode('Card details'), createIcon('chevron'));
  return details;
}

function createLinks(product, grid) {
  const links = document.createElement('div');
  links.className = 'product-list-links';
  links.append(...[createCompare(product, grid), createDetails(product)].filter(Boolean));
  return links;
}

function createApply(product) {
  if (!product.applyUrl) return null;

  const apply = document.createElement('a');
  apply.className = 'button primary product-list-apply';
  apply.href = product.applyUrl;
  apply.textContent = 'Apply now';
  apply.setAttribute('aria-label', `Apply now for ${product.title}`);
  return apply;
}

// The marker ties the disclosure to the matching footnote in the benefit list.
function createDisclosure(marker, label, text) {
  if (!text) return null;

  const details = document.createElement('details');
  details.className = 'product-list-disclosure';

  const summary = document.createElement('summary');
  const footnote = document.createElement('sup');
  footnote.textContent = marker;
  summary.append(footnote, label);

  const body = document.createElement('p');
  body.textContent = text;
  details.append(summary, body);
  return details;
}

function createDisclosures(product) {
  const items = [
    createDisclosure('1', 'Important Pricing & Information', product.pricingInfo),
    createDisclosure('2', 'Additional Information', product.additionalInfo),
  ].filter(Boolean);
  if (!items.length) return null;

  const wrapper = document.createElement('div');
  wrapper.className = 'product-list-disclosures';
  wrapper.append(...items);
  return wrapper;
}

function createCard(product, grid, offerValuesByPath) {
  const item = document.createElement('li');
  const article = document.createElement('article');
  const values = offerValuesByPath.get(product.path);

  article.append(...[
    createBanner(product),
    createHeader(product),
    createBenefits(product, values),
    createLinks(product, grid),
    createApply(product),
    createDisclosures(product),
  ].filter(Boolean));

  item.append(article);

  // Catches any other {{token}} authored in the card (eyebrow, benefits,
  // disclosures); annualFee is already resolved above via createBenefits.
  if (values && Object.keys(values).length && item.textContent.includes('{{')) {
    replaceOfferTokens(item, values);
  }

  return item;
}

function createChip(category) {
  const chip = document.createElement('button');
  chip.type = 'button';
  chip.className = 'product-list-chip';
  chip.textContent = category;
  chip.dataset.category = category.toLowerCase();
  chip.setAttribute('aria-pressed', 'false');
  return chip;
}

function syncChips(chips, selected) {
  [...chips.children].forEach((chip) => {
    chip.setAttribute('aria-pressed', String(selected.has(chip.dataset.category)));
  });
}

// No chip selected means no filter, so deselecting the last chip shows every card.
function toggleCategory(selected, category) {
  if (selected.has(category)) selected.delete(category);
  else selected.add(category);
}

function createChips(categories, selected, onChange) {
  const chips = document.createElement('div');
  chips.className = 'product-list-chips';
  chips.setAttribute('role', 'group');
  chips.setAttribute('aria-label', 'Filter credit cards');
  chips.append(...categories.map((category) => createChip(category)));

  chips.addEventListener('click', (event) => {
    const chip = event.target.closest('.product-list-chip');
    if (!chip) return;

    toggleCategory(selected, chip.dataset.category);
    syncChips(chips, selected);
    onChange();
  });

  return chips;
}

function createGrid(products, offerValuesByPath) {
  const grid = document.createElement('ul');
  grid.className = 'product-list-grid';
  products.forEach((product) => grid.append(createCard(product, grid, offerValuesByPath)));
  return grid;
}

function renderProducts(block, products, offerValuesByPath) {
  if (!products.length) {
    block.replaceChildren(createStatus('No credit card products are available.', 'empty'));
    return;
  }

  const categories = getCategories(products);
  const selected = new Set();

  const count = document.createElement('p');
  count.className = 'product-list-count';
  count.setAttribute('role', 'status');

  const results = document.createElement('div');
  results.className = 'product-list-results';

  const update = () => {
    const visible = filterByCategories(products, selected);
    count.textContent = `Showing ${visible.length} ${visible.length === 1 ? 'card' : 'cards'}`;
    results.replaceChildren(createGrid(visible, offerValuesByPath));
  };

  const chips = categories.length ? createChips(categories, selected, update) : null;

  const toolbar = document.createElement('div');
  toolbar.className = 'product-list-toolbar';
  toolbar.append(...[count, chips].filter(Boolean));

  block.replaceChildren(toolbar, results);
  update();
}

function slugOf(path) {
  return path.split('/').filter(Boolean).pop() || '';
}

// product-list-only formatting: a dollar bonus (e.g. "$200") is shown as authored,
// but a points/miles bonus (e.g. "40,000" or "50000") is shortened to "40k"/"50k".
function formatBonusAmount(value) {
  if (!value || value.startsWith('$')) return value;
  const numeric = Number(value.replace(/,/g, ''));
  if (!Number.isFinite(numeric)) return value;
  const thousands = Math.round((numeric / 1000) * 10) / 10;
  return `${thousands}k`;
}

// One offer sheet row per product, keyed by path. ecid picks the shared
// workbook tab for the whole grid; each product resolves its own Page Name
// row from its own path, unlike a single-page block reading window.location.
function buildOfferValuesByPath(products, offerJson) {
  const offerValuesByPath = new Map();
  if (!offerJson) return offerValuesByPath;
  products.forEach((product) => {
    const values = sheetToValues(offerJson, slugOf(product.path));
    if (values.bonusAmount) values.bonusAmount = formatBonusAmount(values.bonusAmount);
    offerValuesByPath.set(product.path, values);
  });
  return offerValuesByPath;
}

/**
 * Credit-card grid, index/JSON-driven (no authored block content). Cards may
 * author {{token}} placeholders (e.g. {{bonus amount}}, {{annual fee}}) in
 * page metadata; those are resolved per card from the shared offer sheet.
 * The sheet URL must be read before the block's own DOM is wiped below.
 */
export default async function decorate(block) {
  const sheetUrl = getOfferSheetUrl(block);
  block.replaceChildren(createStatus('Loading credit cards…'));

  try {
    const [payload, offerJson] = await Promise.all([
      fetch(INDEX_URL).then((response) => {
        if (!response.ok) throw new Error(`Product index request failed: ${response.status}`);
        return response.json();
      }),
      // Keep authored tokens if the offer sheet is unavailable; only a
      // broken product index should surface the block's error state.
      fetchOfferSheetJson(sheetUrl).catch(() => null),
    ]);
    const products = getProducts(payload);
    renderProducts(block, products, buildOfferValuesByPath(products, offerJson));
  } catch (error) {
    block.replaceChildren(createStatus('Credit cards could not be loaded. Please try again later.', 'error'));
    // eslint-disable-next-line no-console
    console.error('Product list loading failed', error);
  }
}
