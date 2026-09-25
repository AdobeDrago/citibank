import { createOptimizedPicture } from '../../scripts/aem.js';
import {
  getOfferSheetUrl, fetchOfferSheetJson, sheetToValues, replaceOfferTokens, resolveOfferTokens,
} from '../../scripts/offer-sheet.js';
import getProducts, { filterByCategories, getCategories } from './product-list-data.js';
import { createIcon, iconForBenefit } from './product-list-icons.js';

const INDEX_URL = '/credit-card-index.json';
const MAX_BENEFITS = 4;
const MAX_COMPARE = 3;
const MAX_CATEGORY_CARDS = 4;
const SELECTION_KEY = 'compare-cards-selected';

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

// `scope` is whatever compare checkboxes should be counted/capped together —
// a single grid in flat mode, or the whole block in grouped mode so the limit
// applies across category sections instead of resetting per section.
function syncCompareUI(scope) {
  const boxes = [...scope.querySelectorAll('.product-list-compare-input')];
  const selectedCount = boxes.filter((box) => box.checked).length;
  scope.querySelectorAll('.product-list-compare-count').forEach((count) => {
    count.textContent = `(${selectedCount}/${MAX_COMPARE})`;
  });
  boxes.forEach((box) => {
    box.disabled = !box.checked && selectedCount >= MAX_COMPARE;
  });
}

function getSharedSelection() {
  try {
    return JSON.parse(sessionStorage.getItem(SELECTION_KEY)) || [];
  } catch {
    return [];
  }
}

// Checkboxes always render unchecked; this re-syncs them to whatever's
// already in the shared selection (e.g. returning here after removing a
// card on the tray/compare page) and dispatches 'change' so syncCompareUI
// updates the "(n/3)" count and disabled state exactly as if the person
// had clicked them.

function restoreCompareSelection(block) {
  const selected = new Set(getSharedSelection());
  if (!selected.size) return;
  block.querySelectorAll('.product-list-compare-input').forEach((box) => {
    if (selected.has(box.dataset.comparePath)) {
      box.checked = true;
      box.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
}

function createCompare(product, scope) {
  if (!product.comparable) return null;

  const label = document.createElement('label');
  label.className = 'product-list-compare';

  const input = document.createElement('input');
  input.type = 'checkbox';
  input.className = 'product-list-compare-input';
  input.setAttribute('aria-label', `Compare ${product.title}`);
  input.dataset.comparePath = product.path;
  input.addEventListener('change', () => syncCompareUI(scope));

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

function createLinks(product, scope) {
  const links = document.createElement('div');
  links.className = 'product-list-links';
  links.append(...[createCompare(product, scope), createDetails(product)].filter(Boolean));
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

function createCard(product, scope, offerValuesByPath) {
  const item = document.createElement('li');
  const article = document.createElement('article');
  const values = offerValuesByPath.get(product.path);

  article.append(...[
    createBanner(product),
    createHeader(product),
    createBenefits(product, values),
    createLinks(product, scope),
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

// `scope` lets a caller share one compare limit across several grids (see
// renderGroupedProducts); flat mode omits it, so each grid counts itself.
function createGrid(products, scope, offerValuesByPath) {
  const grid = document.createElement('ul');
  grid.className = 'product-list-grid';
  products.forEach((product) => grid.append(createCard(product, scope || grid, offerValuesByPath)));
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
    results.replaceChildren(createGrid(visible, undefined, offerValuesByPath));
  };

  const chips = categories.length ? createChips(categories, selected, update) : null;

  const toolbar = document.createElement('div');
  toolbar.className = 'product-list-toolbar';
  toolbar.append(...[count, chips].filter(Boolean));

  block.replaceChildren(toolbar, results);
  update();
}

const UNCATEGORIZED_LABEL = 'All Credit Cards';

// A category's own {{count}} substitution for its "View all" link text — kept
// separate from scripts/offer-sheet.js's {{token}} system, since this runs on
// the category section itself, never on card content.
function resolveViewAllLabel(label, count) {
  return label.replace(/\{\{\s*count\s*\}\}/i, count);
}

function createViewAllLink(label, href, count) {
  const link = document.createElement('a');
  link.className = 'product-list-view-all';
  link.href = href;
  link.textContent = resolveViewAllLabel(label, count);
  return link;
}

// Heading and "View all …" share a row so the link sits at the far right of
// the section title, matching the cc-category header on the Explore page.
function createCategoryHeader(title, viewAllLink) {
  const header = document.createElement('div');
  header.className = 'product-list-category-header';

  const heading = document.createElement('h2');
  heading.className = 'product-list-category-heading';
  heading.textContent = title;

  header.append(...[heading, viewAllLink].filter(Boolean));
  return header;
}

// `viewAll` (authored label + href) caps the section at MAX_CATEGORY_CARDS
// with a link to see the rest; omitted (auto-derived categories, or a row
// that didn't author both cells) shows every matching card, as before.
function createCategorySection(category, products, scope, offerValuesByPath, viewAll) {
  const section = document.createElement('div');
  section.className = 'product-list-category';

  const capped = viewAll?.label && viewAll?.href && products.length > MAX_CATEGORY_CARDS;
  const visible = capped ? products.slice(0, MAX_CATEGORY_CARDS) : products;
  const link = capped ? createViewAllLink(viewAll.label, viewAll.href, products.length) : null;

  section.append(
    createCategoryHeader(category, link),
    createGrid(visible, scope, offerValuesByPath),
  );
  return section;
}

// Each authored row names a category to show, in that order: cell 1 is the
// category to match against card metadata, cell 2 is the section's display
// title (falls back to the category name), cell 3 is the "View all" link
// text with a {{count}} placeholder for the total match count (e.g. "View
// all {{count}} No Annual Fee Cards"), cell 4 is that link's destination.
// Cells 2-4 are all optional; a category missing cells 3-4 simply shows every
// matching card with no cap. Any other category present in the data is left
// out entirely. Read before the block's own content is wiped below.
function getAuthoredCategories(block) {
  return [...block.children]
    .map((row) => {
      const cells = [...row.children];
      const [category, title, viewAllLabel] = cells
        .slice(0, 3)
        .map((cell) => cell.textContent.replace(/\s+/g, ' ').trim());
      if (!category) return null;

      const linkCell = cells[3];
      const viewAllHref = linkCell
        ? (linkCell.querySelector('a')?.href || linkCell.textContent.trim())
        : '';

      return {
        category,
        title: title || category,
        viewAll: (viewAllLabel && viewAllHref) ? { label: viewAllLabel, href: viewAllHref } : null,
      };
    })
    .filter(Boolean);
}

// One heading + grid per category (a card with several categories appears in
// each). Compare is scoped to the whole block so the 3-card cap holds across
// every section, not per category.
function renderGroupedProducts(block, products, authoredCategories, offerValuesByPath) {
  if (!products.length) {
    block.replaceChildren(createStatus('No credit card products are available.', 'empty'));
    return;
  }

  // Authors can whitelist + order specific categories (with their own display
  // title); otherwise fall back to every category found in the data, titled
  // as-is.
  const categories = authoredCategories.length
    ? authoredCategories
    : getCategories(products).map((category) => ({ category, title: category }));

  const sections = categories
    .map(({ category, title, viewAll }) => [
      title,
      filterByCategories(products, new Set([category.toLowerCase()])),
      viewAll,
    ])
    .filter(([, matching]) => matching.length)
    .map(([title, matching, viewAll]) => (
      createCategorySection(title, matching, block, offerValuesByPath, viewAll)
    ));

  // Categories are author-supplied metadata, so a card with none authored
  // would otherwise silently vanish from a grouped-only view. Skipped when
  // authors whitelist categories explicitly — only those should show then.
  if (!authoredCategories.length) {
    const uncategorized = products.filter((product) => !product.categories.length);
    if (uncategorized.length) {
      sections.push(
        createCategorySection(UNCATEGORIZED_LABEL, uncategorized, block, offerValuesByPath),
      );
    }
  }

  if (!sections.length) {
    block.replaceChildren(createStatus('No credit card products are available.', 'empty'));
    return;
  }

  block.replaceChildren(...sections);
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
 * Credit-card grid, index/JSON-driven (no authored block content). Author the
 * block as "Product List (Grouped)" for a heading + grid per category (e.g.
 * the Explore page); plain "Product List" keeps the single grid + filter
 * chips (e.g. the "view all" compare page). In grouped mode, each authored
 * row names one category to show (in that order): first cell is the category
 * to match against card metadata, optional second cell is the section's
 * display title (e.g. "Rewards" / "Rewards Credit Cards"). Leave the block
 * empty to show every category found in the data instead.
 *
 * Cards may author {{token}} placeholders (e.g. {{bonus amount}},
 * {{annual fee}}) in page metadata; those are resolved per card from the
 * shared offer sheet (scripts/offer-sheet.js), keyed by the card's own page
 * (Page Name) and the visitor's ecid segment. The sheet URL must be read
 * before the block's own DOM is wiped below.
 */
export default async function decorate(block) {
  const grouped = block.classList.contains('grouped');
  const authoredCategories = grouped ? getAuthoredCategories(block) : [];
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
    const offerValuesByPath = buildOfferValuesByPath(products, offerJson);
    if (grouped) {
      renderGroupedProducts(block, products, authoredCategories, offerValuesByPath);
    } else {
      renderProducts(block, products, offerValuesByPath);
    }
    restoreCompareSelection(block);
  } catch (error) {
    block.replaceChildren(createStatus('Credit cards could not be loaded. Please try again later.', 'error'));
    // eslint-disable-next-line no-console
    console.error('Product list loading failed', error);
  }
}
