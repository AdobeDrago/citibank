#!/usr/bin/env node
/*
 * Local multi-brand preview wrapper.
 *
 *   npm run dev -- {brand} [path]
 *
 * Plain `aem up` always serves on localhost, where hostname detection cannot distinguish
 * brands - so it would silently render every site as the default brand. This proxies the
 * chosen brand's preview content AND opens the page with the `?brand=` override that
 * scripts/brand.js honours on local hostnames only.
 *
 * The brand list is read out of scripts/brand.js rather than duplicated here, so there is
 * no second list to drift out of sync with the registry.
 *
 * Examples:
 *   npm run dev -- citibank /credit-cards
 *   npm run dev -- banking /cbol/om/checking/citigold/featured-offer/default
 *
 * Requires Node 20+ (the AEM CLI does).
 */

import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';

const ORG = 'adobedrago';
const REF = 'main';

/* brand key -> the site name registered in the Admin Config Service */
const SITES = {
  citibank: 'citibank',
  banking: 'banking-citibank',
};

async function readBrandKeys() {
  const source = await readFile(new URL('../scripts/brand.js', import.meta.url), 'utf8');
  const registry = source.match(/BRAND_REGISTRY\s*=\s*\{([\s\S]*?)\n\};/);
  if (!registry) throw new Error('could not find BRAND_REGISTRY in scripts/brand.js');
  return [...registry[1].matchAll(/^\s*'?([a-z0-9-]+)'?\s*:/gm)].map(([, key]) => key);
}

const [brand, path = '/'] = process.argv.slice(2);
const brands = await readBrandKeys();

if (!brand || !brands.includes(brand)) {
  process.stderr.write(`usage: npm run dev -- <brand> [path]\nbrands: ${brands.join(', ')}\n`);
  process.exit(1);
}

const site = SITES[brand];
if (!site) {
  process.stderr.write(`no site name mapped for brand "${brand}" - add it to SITES in tools/aem-dev.mjs\n`);
  process.exit(1);
}

const separator = path.includes('?') ? '&' : '?';
const args = [
  '-y', '@adobe/aem-cli', 'up',
  '--forward-browser-logs',
  '--url', `https://${REF}--${site}--${ORG}.aem.page`,
  '--open', `${path}${separator}brand=${brand}`,
];

process.stdout.write(`brand "${brand}" -> site "${site}"\n`);
spawn('npx', args, { stdio: 'inherit' }).on('exit', (code) => process.exit(code ?? 0));
