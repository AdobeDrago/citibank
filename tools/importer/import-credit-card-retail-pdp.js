/* eslint-disable */
/* global WebImporter */

// PARSER IMPORTS (retail co-brand PDP — app-* Angular DOM, separate from tds-* PDP)
import heroParser from './parsers/retail-hero.js';
import tableParser from './parsers/retail-table.js';
import tabsParser from './parsers/retail-tabs.js';
import accordionParser from './parsers/retail-accordion.js';
import columnsParser from './parsers/retail-columns.js';
import rewardsParser from './parsers/retail-rewards.js';

// TRANSFORMER IMPORTS (shared cleanup + section-metadata transformers)
import citiCleanupTransformer from './transformers/citi-cleanup.js';
import citiSectionsTransformer from './transformers/citi-sections.js';

// PARSER REGISTRY
const parsers = {
  hero: heroParser,
  table: tableParser,
  tabs: tabsParser,
  accordion: accordionParser,
  columns: columnsParser,
  rewards: rewardsParser,
};

// PAGE TEMPLATE CONFIGURATION - credit-card-retail-pdp (mirrors page-templates.json)
const PAGE_TEMPLATE = {
  name: 'credit-card-retail-pdp',
  description: 'Retail co-brand credit-card PDP under /credit-cards (Angular app-* DOM).',
  urls: [
    'https://www.citi.com/credit-cards/citi-best-buy-credit-cards?category=view-all-credit-cards&intc=citihpmenu~creditcards~explore&afc=161',
  ],
  blocks: [
    { name: 'hero', instances: ['app-pdp section.pdp-section > app-header-section'] },
    { name: 'table', instances: ['app-pdp section.pdp-section > app-pdp-compare-cards'] },
    { name: 'rewards', instances: ['app-pdp section.pdp-section > app-rewards-section'] },
    { name: 'tabs', instances: ['app-pdp section.pdp-section > app-benefit-section'] },
    { name: 'accordion', instances: ['app-pdp section.pdp-section > app-faq-section'] },
    { name: 'columns', instances: ['app-pdp section.pdp-section > app-review-section'] },
  ],
  sections: [
    { id: 'rcret-hero', name: 'Header (card art + dynamic offer)', selector: 'app-pdp section.pdp-section > app-header-section', style: null, blocks: ['hero'], defaultContent: [] },
    { id: 'rcret-compare', name: 'Compare cards (comparison table)', selector: 'app-pdp section.pdp-section > app-pdp-compare-cards', style: null, blocks: ['table'], defaultContent: ['app-pdp section.pdp-section > app-pdp-compare-cards h2.sub-heading'] },
    { id: 'rcret-rewards', name: 'Rewards and program details (2-col)', selector: 'app-pdp section.pdp-section > app-rewards-section', style: null, blocks: ['rewards'], defaultContent: ['app-pdp section.pdp-section > app-rewards-section h2'] },
    { id: 'rcret-benefits', name: 'Card benefits (tabbed)', selector: 'app-pdp section.pdp-section > app-benefit-section', style: null, blocks: ['tabs'], defaultContent: ['app-pdp section.pdp-section > app-benefit-section h2'] },
    { id: 'rcret-faq', name: 'FAQs (accordion)', selector: 'app-pdp section.pdp-section > app-faq-section', style: null, blocks: ['accordion'], defaultContent: ['app-pdp section.pdp-section > app-faq-section h2'] },
    { id: 'rcret-review', name: 'Secondary apply band', selector: 'app-pdp section.pdp-section > app-review-section', style: null, blocks: ['columns'], defaultContent: [] },
    { id: 'rcret-pricing', name: 'Pricing details (legal)', selector: 'app-pdp section.pdp-section > app-price-detail-section', style: null, blocks: [], defaultContent: ['app-pdp section.pdp-section > app-price-detail-section'] },
  ],
};

// TRANSFORMER REGISTRY - cleanup runs first, sections after (only when 2+ sections)
const transformers = [
  citiCleanupTransformer,
  ...(PAGE_TEMPLATE.sections && PAGE_TEMPLATE.sections.length > 1 ? [citiSectionsTransformer] : []),
];

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

    // Add a `template` metadata row so the page receives a `template-credit-card-retail-pdp`
    // body class (via decorateTemplateAndTheme). Scopes retail design overrides without
    // affecting the credit-card-pdp pages or other templates.
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
