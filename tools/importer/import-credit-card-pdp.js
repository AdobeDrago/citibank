/* eslint-disable */
/* global WebImporter */

// PARSER IMPORTS
import heroParser from './parsers/hero.js';
import columnsParser from './parsers/columns.js';
import cardsParser from './parsers/cards.js';
import accordionParser from './parsers/accordion.js';
import primaryBenefitsParser from './parsers/primary-benefits.js';
import categoryNavParser from './parsers/category-nav.js';

// TRANSFORMER IMPORTS
import citiCleanupTransformer from './transformers/citi-cleanup.js';
import citiSectionsTransformer from './transformers/citi-sections.js';

// PARSER REGISTRY
const parsers = {
  hero: heroParser,
  columns: columnsParser,
  cards: cardsParser,
  accordion: accordionParser,
  'primary-benefits': primaryBenefitsParser,
  'category-nav': categoryNavParser,
};

// PAGE TEMPLATE CONFIGURATION - Embedded from page-templates.json
const PAGE_TEMPLATE = {
  name: 'credit-card-pdp',
  description: 'Credit card product detail page (PDP) under /credit-cards.',
  urls: [
    'https://www.citi.com/credit-cards/citi-double-cash-credit-card?category=%2F&intc=citihpmenu~creditcards~explore&afc=160',
  ],
  blocks: [
    {
      name: 'hero',
      instances: ['#page-container > tds-hero-banner.ng-star-inserted'],
    },
    {
      name: 'columns',
      instances: [
        '#pdp-content-container > tds-accelerator.ng-star-inserted',
        '#pdp-content-container > tds-ratesfees-container.ng-star-inserted',
        '#pdp-content-container > tds-feature.ng-star-inserted:nth-of-type(1)',
        '#pdp-content-container > tds-feature.ng-star-inserted:nth-of-type(2)',
      ],
    },
    {
      name: 'cards',
      instances: [
        '#pdp-content-container > tds-content-grid.ng-star-inserted:nth-of-type(1)',
        '#pdp-content-container > tds-drawer.ng-star-inserted > section > div.benefits-container',
        '#pdp-content-container > tds-content-grid.ng-star-inserted:nth-of-type(2)',
      ],
    },
    {
      name: 'accordion',
      instances: [
        '#pdp-content-container > tds-drawer.ng-star-inserted > section > div.faq-container',
        '#pdp-content-container > tds-faq.ng-star-inserted',
      ],
    },
    {
      name: 'primary-benefits',
      instances: ['#pdp-content-container > tds-primary-benefits.ng-star-inserted'],
    },
    {
      name: 'category-nav',
      instances: ['#pdp-content-container > tds-category-nav-bar.ng-star-inserted'],
    },
    {
      name: 'section-promo',
      instances: ['#pdp-content-container > tds-feature.ng-star-inserted:nth-of-type(2)'],
      section: 'pale-blue',
    },
  ],
  sections: [
    { id: 'rc1c2c1', name: 'Hero (card image + dynamic offer)', selector: '#page-container > tds-hero-banner.ng-star-inserted', style: null, blocks: ['hero'], defaultContent: [] },
    { id: 'rc1c2c2c1', name: 'Accelerator (2% cash back + intro APR)', selector: '#pdp-content-container > tds-accelerator.ng-star-inserted', style: null, blocks: ['columns'], defaultContent: [] },
    { id: 'rc1c2c2c2', name: 'Rates & fees list', selector: '#pdp-content-container > tds-ratesfees-container.ng-star-inserted', style: null, blocks: ['columns'], defaultContent: [] },
    { id: 'rc1c2c2c3', name: "Here's how it works (3-up)", selector: '#pdp-content-container > tds-feature.ng-star-inserted:nth-of-type(1)', style: null, blocks: ['columns'], defaultContent: [] },
    { id: 'rc1c2c2c4', name: 'Your points. Your way (3-up)', selector: '#pdp-content-container > tds-content-grid.ng-star-inserted:nth-of-type(1)', style: null, blocks: ['cards'], defaultContent: [] },
    { id: 'rc1c2c2c5', name: 'Primary benefits (3 image tiles, expandable)', selector: '#pdp-content-container > tds-primary-benefits.ng-star-inserted', style: null, blocks: ['primary-benefits'], defaultContent: [] },
    { id: 'rc1c2c2c6', name: 'Benefits + accordions', selector: '#pdp-content-container > tds-drawer.ng-star-inserted', style: 'light-grey', blocks: ['cards', 'accordion'], defaultContent: [] },
    { id: 'rc1c2c2c7', name: 'FAQs accordion', selector: '#pdp-content-container > tds-faq.ng-star-inserted', style: null, blocks: ['accordion'], defaultContent: [] },
    { id: 'rc1c2c2c8', name: 'Promo (2% cash back + apply)', selector: '#pdp-content-container > tds-feature.ng-star-inserted:nth-of-type(2)', style: 'pale-blue', blocks: ['columns'], defaultContent: [] },
    { id: 'rc1c2c2c9', name: 'You may also like (3 cards)', selector: '#pdp-content-container > tds-content-grid.ng-star-inserted:nth-of-type(2)', style: null, blocks: ['cards'], defaultContent: [] },
    { id: 'rc1c2c2c10', name: 'Pricing details (legal)', selector: '#pdp-content-container > tds-pdp-pricing.ng-star-inserted', style: null, blocks: [], defaultContent: ['#pdp-content-container > tds-pdp-pricing.ng-star-inserted'] },
    { id: 'rc1c2c2c11', name: 'Find the right card for you (category nav list)', selector: '#pdp-content-container > tds-category-nav-bar.ng-star-inserted', style: null, blocks: ['category-nav'], defaultContent: [] },
  ],
};

// TRANSFORMER REGISTRY - cleanup runs first, sections after (only when 2+ sections)
const transformers = [
  citiCleanupTransformer,
  ...(PAGE_TEMPLATE.sections && PAGE_TEMPLATE.sections.length > 1 ? [citiSectionsTransformer] : []),
];

/**
 * Execute all page transformers for a specific hook
 */
function executeTransformers(hookName, element, payload) {
  const enhancedPayload = { ...payload, template: PAGE_TEMPLATE };
  transformers.forEach((transformerFn) => {
    try {
      transformerFn.call(null, hookName, element, enhancedPayload);
    } catch (e) {
      console.error(`Transformer failed at ${hookName}:`, e);
    }
  });
}

/**
 * Find all blocks on the page based on the embedded template configuration.
 * Skips section-* entries — those drive the section transformer, not parsers.
 */
function findBlocksOnPage(document, template) {
  const pageBlocks = [];
  template.blocks.forEach((blockDef) => {
    if (blockDef.name.startsWith('section-')) return;
    blockDef.instances.forEach((selector) => {
      const elements = document.querySelectorAll(selector);
      if (elements.length === 0) {
        console.warn(`Block "${blockDef.name}" selector not found: ${selector}`);
      }
      elements.forEach((element) => {
        pageBlocks.push({ name: blockDef.name, selector, element, section: blockDef.section || null });
      });
    });
  });
  console.log(`Found ${pageBlocks.length} block instances on page`);
  return pageBlocks;
}

export default {
  transform: (payload) => {
    const { document, url, params } = payload;
    const main = document.body;

    // 1. beforeTransform cleanup (remove header/footer/Angular noise)
    executeTransformers('beforeTransform', main, payload);

    // 2. Find blocks on page
    const pageBlocks = findBlocksOnPage(document, PAGE_TEMPLATE);

    // 3. Parse each block. Skip elements already detached by a prior parser.
    pageBlocks.forEach((block) => {
      if (!block.element.parentNode) return;
      const parser = parsers[block.name];
      if (parser) {
        try {
          parser(block.element, { document, url, params });
        } catch (e) {
          console.error(`Failed to parse ${block.name} (${block.selector}):`, e);
        }
      } else {
        console.warn(`No parser found for block: ${block.name}`);
      }
    });

    // 4. afterTransform (final cleanup + section breaks/metadata)
    executeTransformers('afterTransform', main, payload);

    // 5. WebImporter built-in rules
    const hr = document.createElement('hr');
    main.appendChild(hr);
    WebImporter.rules.createMetadata(main, document);
    WebImporter.rules.transformBackgroundImages(main, document);
    WebImporter.rules.adjustImageUrls(main, url, params.originalURL);

    // Add a `template` metadata row so the page receives a `template-credit-card-pdp`
    // body class (via decorateTemplateAndTheme in scripts.js). This scopes credit-cards
    // section design overrides in styles.css without affecting other templates/pages.
    // createMetadata emits the metadata as a <table> (block name row + key/value rows);
    // append one more row to it.
    const metaTable = [...main.querySelectorAll('table')].find((t) => {
      const first = t.querySelector('tr');
      return first && /^metadata$/i.test(first.textContent.trim());
    });
    if (metaTable) {
      const tbody = metaTable.querySelector('tbody') || metaTable;
      const tr = document.createElement('tr');
      const tdKey = document.createElement('td');
      tdKey.textContent = 'template';
      const tdVal = document.createElement('td');
      tdVal.textContent = PAGE_TEMPLATE.name;
      tr.append(tdKey, tdVal);
      tbody.append(tr);
    }

    // 6. Generate sanitized path
    const rawPath = new URL(params.originalURL).pathname
      .replace(/\/$/, '')
      .replace(/\.html?$/, '');
    const path = WebImporter.FileUtils.sanitizePath(rawPath === '' ? '/index' : rawPath);

    return [{
      element: main,
      path,
      report: {
        title: document.title,
        template: PAGE_TEMPLATE.name,
        blocks: pageBlocks.map((b) => b.name),
      },
    }];
  },
};
