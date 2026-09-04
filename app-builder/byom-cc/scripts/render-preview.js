/*
 * Render the data-provider template locally for visual inspection.
 *
 * Two data sources:
 *   1. Local file (default): read a JSON payload from disk (test.json by default).
 *   2. Live fetch: pass --cfpath to fetch the same AEM GraphQL content the deployed action uses.
 *
 * In both cases the top-most `item` property is used as the Handlebars context and rendered with
 * templates/creditcard.html, so the output matches what the data-provider action returns at runtime.
 *
 * Usage:
 *   node scripts/render-preview.js                                  # local: test.json -> preview.html
 *   node scripts/render-preview.js --data other.json               # local: other.json
 *   node scripts/render-preview.js --cfpath /content/dam/.../card   # live: fetch endpointBase + cfpath
 *   node scripts/render-preview.js --cfpath /content/... --endpoint https://host/graphql/execute.json/q;path=
 *   node scripts/render-preview.js --out out.html                   # choose output file
 *
 * Notes:
 * - --endpoint overrides the content endpoint base (defaults to the action's CONTENT_API_ENDPOINT).
 * - The output is raw, unstyled HTML fragments (as the action emits them); final styling comes from the
 *   published EDS/Helix page, not this preview.
 */
const fs = require('fs')
const path = require('path')
const Handlebars = require('handlebars')
const fetch = require('node-fetch')
const { extractTopmostItem, CONTENT_API_ENDPOINT } = require('../actions/data-provider/index.js')

const root = path.join(__dirname, '..')
const templateFile = path.join(root, 'actions', 'data-provider', 'templates', 'creditcard.html')

/**
 * Minimal flag parser supporting `--key value` and `--key=value`.
 * @param {string[]} argv
 * @returns {Object}
 */
function parseArgs(argv) {
  const args = {}
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]
    if (!token.startsWith('--')) continue
    const eq = token.indexOf('=')
    if (eq !== -1) {
      args[token.slice(2, eq)] = token.slice(eq + 1)
    } else {
      const next = argv[i + 1]
      if (next && !next.startsWith('--')) {
        args[token.slice(2)] = next
        i++
      } else {
        args[token.slice(2)] = true
      }
    }
  }
  return args
}

/**
 * Loads the render payload either from a live endpoint (when cfpath is given) or a local JSON file.
 * @param {Object} args
 * @returns {Promise<{payload: Object, source: string}>}
 */
async function loadPayload(args) {
  if (args.cfpath) {
    const base = args.endpoint || CONTENT_API_ENDPOINT
    const url = `${base}${args.cfpath}`
    const res = await fetch(url)
    if (!res.ok) {
      throw new Error(`Content API request failed: ${res.status} ${res.statusText || ''} (${url})`.trim())
    }
    return { payload: await res.json(), source: url }
  }
  const dataFile = args.data || path.join(root, 'test.json')
  return { payload: JSON.parse(fs.readFileSync(dataFile, 'utf-8')), source: dataFile }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const outFile = args.out || path.join(root, 'preview.html')

  const { payload, source } = await loadPayload(args)

  const item = extractTopmostItem(payload)
  if (!item) {
    console.error(`No top-most "item" found in payload from ${source}`)
    process.exit(1)
  }

  const template = Handlebars.compile(fs.readFileSync(templateFile, 'utf-8'))
  const html = template(item)
  fs.writeFileSync(outFile, html, 'utf-8')

  console.log(`Rendered ${source} -> ${outFile} (${html.length} bytes)`)
}

main().catch((error) => {
  console.error(error.message || error)
  process.exit(1)
})
