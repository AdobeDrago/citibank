import { toCamelCase } from '../../scripts/aem.js';

const TOKEN_RE = /\{\{\s*([A-Za-z0-9 _-]+)\s*\}\}/g;
const SHARED_SHEET_PATH = '/credit-cards/offerpricingpositioning.json';

/**
 * Reads an authored sheet URL from the block (if present) and removes that
 * link so it is not treated as a CTA. Falls back to the shared credit-cards
 * offerpricingpositioning workbook.
 * @param {Element} block
 * @returns {string}
 */
function getOfferSheetUrl(block) {
  const authored = [...block.querySelectorAll('a[href]')].find((anchor) => {
    const href = anchor.getAttribute('href') || '';
    return /offerpricingpositioning/i.test(href);
  });

  if (authored) {
    const isSheetOnly = authored.parentElement
      && authored.parentElement.tagName === 'P'
      && authored.parentElement.textContent.replace(/\s+/g, ' ').trim()
        === authored.textContent.replace(/\s+/g, ' ').trim();
    const { pathname } = new URL(authored.href, window.location.href);
    if (isSheetOnly) authored.parentElement.remove();
    return pathname.endsWith('.json') ? pathname : `${pathname.replace(/\/$/, '')}.json`;
  }

  return SHARED_SHEET_PATH;
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function normalizeName(value) {
  return String(value || '').trim().toLowerCase();
}

/**
 * Reads a cookie by name from a cookie header string.
 * @param {string} name
 * @param {string} cookieSource
 * @returns {string}
 */
function readCookie(name, cookieSource) {
  const source = `; ${cookieSource || ''}`;
  const parts = source.split(`; ${name}=`);
  if (parts.length < 2) return '';
  return decodeURIComponent(parts.pop().split(';').shift() || '').trim();
}

/**
 * Reads the offer segment tab from the ecid cookie (e.g. ecid=seg-a).
 * Falls back to ?ecid= when the cookie is not set.
 * @returns {string}
 */
function getEcid() {
  const fromCookie = readCookie('ecid', document.cookie);
  if (fromCookie) return fromCookie;
  return new URLSearchParams(window.location.search).get('ecid') || '';
}

/**
 * Current credit-card page slug (e.g. citi-aadvantage-globe-mastercard).
 * @returns {string}
 */
function getPageSlug() {
  const path = window.location.pathname.replace(/\.html$/, '').replace(/\/$/, '');
  return path.split('/').filter(Boolean).pop() || '';
}

/**
 * @param {object} row
 * @returns {string}
 */
function pageNameOf(row) {
  return row?.['Page Name'] ?? row?.pageName ?? row?.pagename ?? row?.['page-name'] ?? '';
}

/**
 * Picks the workbook tab for the ecid cookie / ?ecid= (seg-a, seg-b).
 * First tab if missing.
 * @param {object} json
 * @param {string} ecid
 * @returns {object}
 */
function getSegmentSheet(json, ecid) {
  if (!json || typeof json !== 'object') return json;
  const isMulti = json[':type'] === 'multi-sheet' || Array.isArray(json[':names']);
  if (!isMulti) return json;

  const names = Array.isArray(json[':names'])
    ? json[':names']
    : Object.keys(json).filter((key) => !key.startsWith(':'));
  const wanted = normalizeName(ecid);
  const match = wanted ? names.find((name) => normalizeName(name) === wanted) : null;
  const name = match || names[0];
  return (name && json[name] && typeof json[name] === 'object') ? json[name] : json;
}

/**
 * Returns the row whose Page Name matches the current card page.
 * @param {object[]} rows
 * @param {string} slug
 * @returns {object|null}
 */
function findPageRow(rows, slug) {
  const wanted = normalizeName(slug);
  if (!wanted) return null;
  return rows.find((row) => {
    const raw = String(pageNameOf(row)).trim().replace(/\.html$/i, '').replace(/\/$/, '');
    return normalizeName(raw.split('/').pop()) === wanted;
  }) || null;
}

/**
 * Legacy: row whose Ecid column matches the URL, or the first row.
 * @param {object[]} rows
 * @param {string} ecid
 * @returns {object|null}
 */
function findOfferRow(rows, ecid) {
  const wanted = normalizeName(ecid);
  if (wanted) {
    const match = rows.find((row) => {
      const value = row?.Ecid ?? row?.ecid ?? row?.ECID ?? '';
      return normalizeName(value) === wanted;
    });
    if (match) return match;
  }
  return rows[0] || null;
}

/**
 * Maps one sheet row's columns to camelCase tokens (bonusMiles, etc.).
 * @param {object} row
 * @returns {Record<string, string>}
 */
function rowToValues(row) {
  const values = {};
  if (!row || typeof row !== 'object') return values;
  Object.entries(row).forEach(([key, value]) => {
    if (key.startsWith(':') || value == null || !String(value).trim()) return;
    values[toCamelCase(key)] = String(value).trim();
  });
  return values;
}

/**
 * Maps a Franklin/DA sheet payload to camelCase keys.
 * Shared workbook: the ecid cookie (or ?ecid=) selects the tab (seg-a, seg-b);
 * Page Name selects
 * the current card. Also supports a legacy Ecid column, Key/Value rows,
 * and a single row of named columns.
 * @param {object} json
 * @returns {Record<string, string>}
 */
function sheetToValues(json) {
  const segment = getSegmentSheet(json, getEcid());
  const rows = Array.isArray(segment?.data)
    ? segment.data.filter((row) => row && typeof row === 'object')
    : [];
  if (rows.some((row) => pageNameOf(row))) {
    return rowToValues(findPageRow(rows, getPageSlug()));
  }
  if (rows.some((row) => row.Ecid || row.ecid || row.ECID)) {
    return rowToValues(findOfferRow(rows, getEcid()));
  }

  const values = {};
  rows.forEach((row) => {
    const key = row.Key || row.key || row.Name || row.name;
    const value = row.Value ?? row.value ?? row.Text ?? row.text;
    if (key && value != null && String(value).trim()) {
      values[toCamelCase(String(key))] = String(value).trim();
    }
  });
  if (Object.keys(values).length) return values;
  return rowToValues(rows[0]);
}

/**
 * Resolves a {{token}} against sheet values.
 * Authored tokens are already camelCase (bonusMiles). toCamelCase() lowercases
 * those first, so "bonusMiles" becomes "bonusmiles" and would miss the sheet key.
 * Prefer the authored key, then camelCase (for "Bonus Miles"), then ignore-case.
 * @param {Record<string, string>} values
 * @param {string} rawKey
 * @returns {string|null}
 */
function lookupOfferValue(values, rawKey) {
  const trimmed = String(rawKey).trim();
  if (!trimmed) return null;
  if (values[trimmed] != null) return values[trimmed];
  const camel = toCamelCase(trimmed);
  if (values[camel] != null) return values[camel];
  const lower = trimmed.toLowerCase();
  const match = Object.keys(values).find((key) => key.toLowerCase() === lower);
  return match != null ? values[match] : null;
}

/**
 * Replaces {{token}} placeholders in the hero with values from the offer sheet.
 * @param {Element} root
 * @param {Record<string, string>} values
 */
function replaceTokens(root, values) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);

  nodes.forEach((node) => {
    const { textContent } = node;
    if (!textContent || !textContent.includes('{{')) return;
    node.textContent = textContent.replace(TOKEN_RE, (match, rawKey) => {
      const value = lookupOfferValue(values, rawKey);
      return value != null ? value : match;
    });
  });
}

/**
 * Loads offer / pricing values from the page sheet and fills authored tokens.
 * @param {Element} block
 * @param {string} sheetUrl
 */
async function hydrateOfferValues(block, sheetUrl) {
  if (!block.textContent.includes('{{')) return;
  try {
    const resp = await fetch(sheetUrl);
    if (!resp.ok) return;
    const json = await resp.json();
    if (!json || typeof json !== 'object') return;
    const values = sheetToValues(json);
    if (!Object.keys(values).length) return;
    replaceTokens(block, values);
  } catch {
    // Keep authored tokens if the sheet is unavailable.
  }
}

/**
 * Hero block (credit-cards PDP feature hero).
 *
 * Authored structure: 2 rows.
 *   Row 1 = full-bleed lifestyle background image.
 *   Row 2 = a single cell holding a flat list of paragraphs/headings:
 *     card-art image, eyebrow, h1 label, h2 offer headline, supporting line,
 *     two stat paragraphs (<strong> + label), CTA link, legal disclaimer,
 *     and two footnote links.
 *
 * Dynamic offer values (bonus miles, spend requirement, annual fee) are
 * authored as {{token}} placeholders and filled from the shared
 * /credit-cards/offerpricingpositioning workbook. The ecid cookie (or
 * ?ecid=seg-a|seg-b) picks the tab; Page Name picks the current card
 * (first tab if ecid is missing).
 *
 * This decorator classifies those flat elements and groups them so the CSS
 * can lay them out as the source does (card + label header row, stat row,
 * footnote row) over the background image.
 */
export default function decorate(block) {
  const sheetUrl = getOfferSheetUrl(block);
  const rows = [...block.children];
  const bgRow = rows[0];
  const contentRow = rows[rows.length - 1];
  if (bgRow) bgRow.classList.add('hero-bg');
  if (!contentRow) return;
  contentRow.classList.add('hero-content-row');

  const content = contentRow.querySelector(':scope > div') || contentRow;
  content.classList.add('hero-content');

  const kids = [...content.children];
  let cardArt = null;
  const headings = [];
  const stats = [];
  const links = [];
  const texts = [];

  // Retail promo ribbon (e.g. "No annual fee¹"): a short paragraph authored BEFORE
  // the card-art image. It carries a footnote <a>, so without this it would be
  // misclassified as the CTA. Identify it as any <p> that precedes the card-art
  // picture and pull it out so it can overlay the card art (retail branch below).
  const cardArtIdx = kids.findIndex((el) => el.tagName === 'P' && el.querySelector('picture'));
  const ribbon = cardArtIdx > 0
    ? kids.find((el, i) => i < cardArtIdx && el.tagName === 'P' && !el.querySelector('picture'))
    : null;

  kids.forEach((el) => {
    if (el === ribbon) return;
    if (/^H[1-6]$/.test(el.tagName)) {
      headings.push(el);
      return;
    }
    if (el.tagName !== 'P') return;
    if (el.querySelector('picture')) {
      cardArt = el;
      return;
    }
    if (el.querySelector('strong')) {
      stats.push(el);
      return;
    }
    // A "link paragraph" (the CTA, or a standalone footnote/pricing link) is one
    // whose entire visible text IS the link — e.g. <p><a>Apply now</a></p>. A
    // paragraph that merely CONTAINS an inline footnote marker (e.g. the
    // supporting line "after spending $1,000 in the first 3 months<a><sup>2</sup></a>")
    // has text beyond the link, so it is treated as a text paragraph — otherwise
    // the offer's footnote superscript would be misread as the primary CTA.
    const anchor = el.querySelector('a');
    const pText = el.textContent.replace(/\s+/g, ' ').trim();
    const aText = anchor ? anchor.textContent.replace(/\s+/g, ' ').trim() : '';
    if (anchor && aText && pText === aText) {
      links.push(el);
    } else {
      texts.push(el);
    }
  });
  if (ribbon) ribbon.classList.add('hero-ribbon');

  // Card art + h1 label share a header row.
  const h1 = headings.find((h) => h.tagName === 'H1');
  if (cardArt) cardArt.classList.add('hero-card-art');
  if (h1) h1.classList.add('hero-title');
  if (cardArt && h1) {
    const head = document.createElement('div');
    head.className = 'hero-head';
    content.insertBefore(head, cardArt);
    head.append(cardArt, h1);
  }

  // Text-only paragraphs, in document order: eyebrow, supporting, disclaimer.
  if (texts[0]) texts[0].classList.add('hero-eyebrow');
  if (texts[1]) texts[1].classList.add('hero-supporting');
  const disclaimer = texts[texts.length - 1];
  if (disclaimer && disclaimer !== texts[0]) disclaimer.classList.add('hero-disclaimer');

  // Stat paragraphs: <strong>value</strong> — label<sup>n</sup>.
  stats.forEach((p) => {
    p.classList.add('hero-stat');
    const value = p.querySelector('strong');
    if (value) value.classList.add('hero-stat-value');
    // Strip the leading " — " separator from the first text node.
    [...p.childNodes].forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        node.textContent = node.textContent.replace(/^\s*[—–-]\s*/, ' ');
      }
    });
  });
  if (stats.length) {
    const statsRow = document.createElement('div');
    statsRow.className = 'hero-stats';
    content.insertBefore(statsRow, stats[0]);
    statsRow.append(...stats);
  }

  // Link paragraphs, in document order: CTA first, then footnotes.
  if (links[0]) {
    links[0].classList.add('button-container');
    const cta = links[0].querySelector('a');
    if (cta) cta.classList.add('button', 'primary');
  }
  // The "Important Pricing & Terms Information +" link (retail) sits directly under
  // the CTA in the source; pull it out of the footnotes group so it can be placed
  // and styled on its own. Identified by its visible text.
  const rest = links.slice(1);
  const pricingLink = rest.find((p) => /important pricing/i.test(p.textContent));
  if (pricingLink) pricingLink.classList.add('hero-pricing-link');
  const footnotes = rest.filter((p) => p !== pricingLink);
  footnotes.forEach((p) => p.classList.add('hero-footnote'));
  if (footnotes.length) {
    const fnRow = document.createElement('div');
    fnRow.className = 'hero-footnotes';
    content.insertBefore(fnRow, footnotes[0]);
    fnRow.append(...footnotes);
  }

  // Retail credit-card PDP variant: no background image and a two-column white
  // band (card art on the left, text on the right). The shared decoration above
  // groups the card art and the h1 label together in `.hero-head`, which cannot
  // be split into separate columns with CSS alone, so restructure here. Guarded
  // by the template body class so tds-* PDP heroes are left untouched.
  if (document.body.classList.contains('credit-card-retail-pdp')) {
    const media = document.createElement('div');
    media.className = 'hero-media';
    const body = document.createElement('div');
    body.className = 'hero-body';
    if (ribbon) media.append(ribbon);
    if (cardArt) media.append(cardArt);
    if (h1) body.append(h1);
    [...content.children].forEach((child) => {
      if (child.classList.contains('hero-head')) {
        child.remove();
        return;
      }
      body.append(child);
    });
    content.append(media, body);
  }

  hydrateOfferValues(block, sheetUrl);
}
