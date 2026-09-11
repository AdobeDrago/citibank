const PRODUCT_ROOT = '/credit-cards/';
const PRODUCT_TYPE = 'credit card';
const LEAD_CATEGORY = 'most popular';
const OPT_OUT_VALUES = ['false', 'no', 'off', '0'];

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizePath(value) {
  return cleanString(value).replace(/\.html$/, '').replace(/\/$/, '');
}

function isDirectChild(path, root) {
  if (!path.startsWith(root)) return false;
  const relativePath = path.slice(root.length);
  return Boolean(relativePath) && !relativePath.includes('/');
}

function isCreditCardProduct(value) {
  return cleanString(value).toLowerCase().replace(/-/g, ' ') === PRODUCT_TYPE;
}

// Comparison defaults to enabled; authors opt a card out rather than in.
function isExplicitlyDisabled(value) {
  return OPT_OUT_VALUES.includes(cleanString(value).toLowerCase());
}

function parseOrder(value) {
  const order = Number.parseInt(value, 10);
  return Number.isFinite(order) ? order : Number.MAX_SAFE_INTEGER;
}

// Authors separate list values with semicolons, but comma-separated legacy
// content is still published, so fall back to commas when no semicolon exists.
export function parseList(value) {
  if (Array.isArray(value)) return value.map(cleanString).filter(Boolean);

  const text = cleanString(value);
  if (!text) return [];

  const separator = /[;|\n]/.test(text) ? /[;|\n]+/ : /,/;
  return text.split(separator).map((entry) => entry.trim()).filter(Boolean);
}

function normalizeProduct(item, root) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return null;

  const path = normalizePath(item.path);
  // Page titles carry an SEO suffix, so authors set a clean card name separately.
  const title = cleanString(item['card title']) || cleanString(item.title);
  if (!isDirectChild(path, root) || !title || !isCreditCardProduct(item.product)) return null;

  return {
    path,
    title,
    eyebrow: cleanString(item.eyebrow),
    image: cleanString(item.image),
    annualFee: cleanString(item['annual fee']),
    applyUrl: cleanString(item['apply url']),
    benefits: parseList(item['card benefits']),
    categories: parseList(item.categories),
    order: parseOrder(item['product order']),
    comparable: !isExplicitlyDisabled(item.compare),
    pricingInfo: cleanString(item['pricing info']),
    additionalInfo: cleanString(item['additional info']),
  };
}

export function getCategories(products) {
  const seen = new Map();
  products.forEach((product) => {
    product.categories.forEach((category) => {
      const key = category.toLowerCase();
      if (!seen.has(key)) seen.set(key, category);
    });
  });

  // "Most Popular" leads the chip row; the rest keep product order.
  const entries = [...seen.entries()];
  return [
    ...entries.filter(([key]) => key === LEAD_CATEGORY),
    ...entries.filter(([key]) => key !== LEAD_CATEGORY),
  ].map(([, label]) => label);
}

export function filterByCategories(products, selected) {
  if (!selected.size) return products;
  return products.filter((product) => product.categories
    .some((category) => selected.has(category.toLowerCase())));
}

export default function getProducts(payload, root = PRODUCT_ROOT) {
  if (!payload || !Array.isArray(payload.data)) {
    throw new TypeError('Product index response must contain a data array.');
  }

  return payload.data
    .map((item) => normalizeProduct(item, root))
    .filter(Boolean)
    .sort((left, right) => left.order - right.order
      || left.title.localeCompare(right.title));
}
