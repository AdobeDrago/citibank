/*
* <license header>
*/

/**
 * Action: Data Provider
 * Purpose: Generates HTML content for overlay paths under `/byom-cards/*` that the Helix Admin API consumes during
 *          preview. This action is invoked indirectly when the webhook action triggers a preview
 *          for a `/byom-cards/<slug>` path.
 *
 * How it works:
 * - Validates that the requested `__ow_path` is an overlay path (`/byom-cards/*`). If not, returns 404.
 * - Reads the `x-content-source-location` header (set by the webhook and relayed by Helix), which packs the content
 *   fragment path and variant together as `cfpath|variant`, and splits them apart. It appends `cfpath` to the AEM
 *   GraphQL persisted query base (see `CONTENT_API_ENDPOINT`).
 * - Fetches the content. The response is a standard AEM Content Fragment payload shaped like
 *   `{ data: { <query>ByPath: { item: { ... } } } }`.
 * - Extracts the top-most `item` property from that payload (see `extractTopmostItem`) and uses it directly as the
 *   Handlebars render context.
 * - Renders `templates/creditcard.html` with the `item` and returns `text/html`.
 *
 * Inputs:
 * - params.__ow_path (string): Request path; must start with `/byom-cards`.
 * - params.__ow_headers['x-content-source-location'] (string): `cfpath|variant` (or just `cfpath`). The cfpath is
 *   appended to the endpoint; the variant is parsed out. May also be supplied directly as params.cfpath (with an
 *   optional params.variant) for local/direct testing.
 * - params.CONTENT_API_URL (string, optional): Override for the content endpoint base (env `CONTENT_API_URL` honored).
 *
 * Output:
 * - HTML page (Content-Type: text/html) suitable for indexing/publishing by Helix.
 *
 * Local/Direct testing example (deployed action URL shape may vary):
 *   curl "https://<runtime-host>/api/v1/web/<ns>/<pkg>/data-provider/byom-cards/stuff-abc" \
 *     -H "x-content-source-location: /content/dam/cf-services/ccc-cf/citi-strata-elite-card|abc"
 *
 * Related:
 * - Orchestrating action: `actions/webhook/index.js`
 * - Template: `actions/data-provider/templates/creditcard.html`
 * - Sample payload: `test.json` at the app root
 */
const fetch = require('node-fetch')
const { Core } = require('@adobe/aio-sdk')
const { errorResponse } = require('../utils')
const Handlebars = require('handlebars')
const fs = require('fs')

// AEM GraphQL persisted query returning the credit card content fragment.
const CONTENT_API_ENDPOINT = 'https://publish-p199056-e2062160.adobeaemcloud.com/graphql/execute.json/cf-services/ccbypath;path='

// Header set by the webhook action and relayed by Helix to this content source. Carries `cfpath` or `cfpath|variant`.
const CF_PATH_HEADER = 'x-content-source-location'

/**
 * Breadth-first search for the shallowest (top-most) `item` property in an object graph.
 *
 * AEM GraphQL responses wrap the content in a query-specific key (e.g. `data.creditCardByPath.item`), so rather than
 * hard-coding that path we return the first `item` encountered nearest the root. This keeps the action resilient to
 * differently named persisted queries that still expose a single `item`.
 *
 * @param {*} root - Parsed JSON payload.
 * @returns {Object|null} The top-most `item` value, or null if none is found.
 */
function extractTopmostItem(root) {
  if (!root || typeof root !== 'object') return null
  const queue = [root]
  while (queue.length) {
    const node = queue.shift()
    if (node && typeof node === 'object' && !Array.isArray(node)
        && Object.prototype.hasOwnProperty.call(node, 'item')) {
      return node.item
    }
    const children = Array.isArray(node) ? node : Object.values(node)
    for (const value of children) {
      if (value && typeof value === 'object') queue.push(value)
    }
  }
  return null
}

async function main(params) {
  const logger = Core.Logger('data-provider', { level: params.LOG_LEVEL || 'debug' })

  try {
    logger.info('Invoked data-provider action')

    // check for overlay paths
    let path = params.__ow_path
    if (!path.startsWith('/')) {
      path = '/' + path
    }
    if (!path.startsWith('/byom-cards')) {
      return errorResponse(404, `${path} is not an overlay path`, logger)
    }

    // The webhook packs the content fragment path and variant into a single header as `cfpath|variant`.
    // Split it back apart; cfpath may also be supplied directly (with optional params.variant) for testing.
    const rawSource = params.__ow_headers?.[CF_PATH_HEADER] || params.cfpath || ''
    const [cfpath, headerVariant] = rawSource.split('|')
    if (!cfpath) {
      return errorResponse(400, "missing content fragment path 'cfpath'", logger)
    }

    const variant = headerVariant || params.variant
    logger.info(`Variant: ${variant || '(none)'}`)

    // Resolve the content endpoint base (param > env > default) and append the cfpath.
    const endpointBase = params.CONTENT_API_URL || process.env.CONTENT_API_URL || CONTENT_API_ENDPOINT
    const endpoint = `${endpointBase}${cfpath}`
    logger.info(`Fetching credit card content from: ${endpoint}`)

    const apiRes = await fetch(endpoint)
    if (!apiRes.ok) {
      logger.error(`Content API request failed: ${apiRes.status} ${apiRes.statusText || ''}`.trim())
      return errorResponse(502, 'failed to fetch credit card content', logger)
    }

    const apiData = await apiRes.json()

    // The data sent to Handlebars is the top-most `item` property of the response.
    const item = extractTopmostItem(apiData)
    if (!item) {
      logger.error('No "item" property found in content response')
      return errorResponse(502, 'no credit card content available', logger)
    }

    // Load and compile the template, then render it with the item as the context.
    const templateContent = fs.readFileSync(__dirname + '/templates/creditcard.html', 'utf-8')
    const template = Handlebars.compile(templateContent)

    logger.info('Rendering credit card HTML template')
    const html = template(item)

    const response = {
      statusCode: 200,
      body: html,
      headers: {
        'Content-Type': 'text/html'
      }
    }

    logger.info(`${response.statusCode}: HTML rendered successfully`)
    return response
  } catch (error) {
    logger.error(error)
    return errorResponse(500, 'server error', logger)
  }
}

exports.main = main
exports.extractTopmostItem = extractTopmostItem
exports.CONTENT_API_ENDPOINT = CONTENT_API_ENDPOINT
