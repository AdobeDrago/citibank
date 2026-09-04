/*
* <license header>
*/

/**
 * Action: Webhook
 * Purpose: Orchestrates an automated preview → publish pipeline for Helix projects (Edge Delivery Services).
 *
 * How it works (high level):
 * 1) This action is invoked by an external webhook (e.g., via HTTP POST).
 * 2) It generates an overlay path under `/byom-cards/` derived from `cfpath` and `variant` and calls the Helix Admin
 *    API to preview that path. The request includes an admin token and forwards `cfpath` and `variant` as headers so
 *    the data provider knows what content (and which variant) to render.
 * 3) The Helix Admin API, when resolving content for that overlay path, invokes the "data-provider" action in this
 *    repository (see `actions/data-provider/index.js`). That action appends `cfpath` to its content endpoint and
 *    returns HTML built from `templates/creditcard.html`.
 * 4) If preview succeeds, this action triggers a live publish for the same path, finalizing the page.
 *
 * Why the overlay path?
 * - Paths under `/byom-cards/*` are treated as dynamic/overlay content resolved by the data provider action.
 *   This keeps the demo isolated and lets each card/variant be published at its own URL.
 *
 * Inputs (JSON body, action params, or environment variable — resolved in that order):
 * - PROJECT_COORDS (string, required): Helix project coordinates `owner/repo/ref`.
 * - TOKEN (string, required): Helix admin API token. Being a secret, prefer env/params over the request body.
 * - cfpath (string, required): Content fragment path forwarded to the data provider and appended to its content
 *   endpoint (e.g. `/content/dam/cf-services/ccc-cf/citi-strata-elite-card`).
 * - variant (string, required): Variant identifier forwarded to the data provider and used to build the page slug.
 *
 * The generated page path is `/byom-cards/<last segment of cfpath>-<variant>`
 * (e.g. cfpath `/some/path/stuff` + variant `abc` => `/byom-cards/stuff-abc`).
 *
 * Output:
 * - JSON with a summary of preview attempts, publish result, and the generated page path.
 *
 * Example invocation (JSON body):
 *   curl -X POST "https://<runtime-host>/api/v1/web/<ns>/<pkg>/webhook" \
 *     -H "Content-Type: application/json" \
 *     -d '{
 *           "PROJECT_COORDS":"<owner>/<repo>/<ref>",
 *           "TOKEN":"<helix_admin_token>",
 *           "cfpath":"/content/dam/cf-services/ccc-cf/citi-strata-elite-card",
 *           "variant":"abc"
 *         }'
 *
 * The code intentionally contains verbose comments to make the control flow easy to follow for demo purposes.
 */
const fetch = require('node-fetch')
const { Core } = require('@adobe/aio-sdk')
const { errorResponse } = require('../utils')

const MAX_PREVIEW_ATTEMPTS = 3

// Header forwarded (via Helix) to the data-provider content source. Carries `cfpath` or `cfpath|variant`.
const CF_PATH_HEADER = 'x-content-source-location'

/**
 * Entry point invoked by Adobe I/O Runtime.
 *
 * @param {Object} params - Action parameters, including runtime-provided metadata.
 * @param {string} [params.PROJECT_COORDS] - Helix project coordinates (e.g. owner/repo/ref).
 * @param {string} [params.TOKEN] - Helix admin token used to authenticate preview/publish requests.
 * @param {string} [params.cfpath] - Content fragment path forwarded to the data provider.
 * @param {string} [params.variant] - Variant identifier forwarded to the data provider and used in the page slug.
 * @returns {Promise<Object>} - HTTP response compatible object.
 */
async function main(params) {
  const logger = Core.Logger('main', { level: params.LOG_LEVEL || 'info' })

  try {
    logger.info("Invoked webhook action")

    // Parse request body if present (for POST requests with JSON payload)
    let bodyParams = {}
    if (params.__ow_body) {
      try {
        const bodyString = Buffer.from(params.__ow_body, 'base64').toString('utf-8')
        logger.debug('Decoded body:', bodyString)
        bodyParams = JSON.parse(bodyString)
        logger.debug('Parsed body params:', JSON.stringify(bodyParams))
      } catch (error) {
        logger.warn('Failed to parse request body:', error.message)
      }
    }

    // Resolve essential configuration. Body takes precedence, then action params, then environment variables.
    // Prefer supplying TOKEN via env/params (it is a secret) rather than in each request body.
    const projectCoords = bodyParams.PROJECT_COORDS || params.PROJECT_COORDS || process.env.PROJECT_COORDS
    const token = bodyParams.TOKEN || params.TOKEN || process.env.TOKEN

    // Per-request inputs: cfpath (what to render) and variant (which variation). Body takes precedence.
    const cfpath = bodyParams.cfpath || params.cfpath
    const variant = bodyParams.variant || params.variant
    logger.debug(`cfpath: ${cfpath}, variant: ${variant}`)

    // Collect any configuration gaps before attempting network calls.
    const missingFields = []
    if (!projectCoords) missingFields.push('PROJECT_COORDS')
    if (!token) missingFields.push('TOKEN')
    if (!cfpath) missingFields.push('cfpath')
    if (!variant) missingFields.push('variant')
    if (missingFields.length > 0) {
      return errorResponse(400, `missing parameter(s) '${missingFields.join(', ')}'`, logger)
    }

    // Build the overlay page path from the cfpath's last segment and the variant.
    const pagePath = generatePagePath(cfpath, variant)

    let previewSuccessful = false
    const previewAttempts = []

    // Preview is retried three times.
    for (let attempt = 0; attempt < MAX_PREVIEW_ATTEMPTS; attempt++) {
      const attemptNumber = attempt + 1
      const result = await processEvent(token, 'preview', projectCoords, pagePath, 'publish', cfpath, variant, logger)
      previewAttempts.push({ attempt: attemptNumber, success: result.success, status: result.status })

      if (result.success) {
        previewSuccessful = true
        logger.debug(`Preview successful for path: ${pagePath}`)
        break
      } else {
        logger.info(`Preview attempt ${attemptNumber} failed for path: ${pagePath}`)
      }
    }

    let publishSuccessful = false
    if (previewSuccessful) {
      // Only attempt a live publish after preview succeeds; this mirrors typical Helix workflows.
      const publishResult = await processEvent(token, 'live', projectCoords, pagePath, 'publish', cfpath, variant, logger)
      publishSuccessful = publishResult.success
      if (publishSuccessful) {
        logger.debug(`Publish successful for path: ${pagePath}`)
      } else {
        logger.error(`Publish failed for path: ${pagePath}`)
      }
    }

    const success = previewSuccessful && publishSuccessful
    return {
      statusCode: success ? 200 : 500,
      body: {
        previewSuccessful,
        publishSuccessful,
        previewAttempts,
        pagePath
      }
    }
  } catch (error) {
    // Any unexpected exception is mapped to a generic server error to keep the API predictable.
    logger.error(error)
    return errorResponse(500, error.message || 'server error', logger)
  }
}

/**
 * Builds the overlay page path from the content fragment's last path segment and the variant.
 *
 * Example: cfpath `/some/path/stuff` + variant `abc` => `/byom-cards/stuff-abc`.
 *
 * @param {string} cfpath - Content fragment path; its last segment forms the base of the slug.
 * @param {string} variant - Variant identifier appended after a dash.
 * @returns {string} A path like "/byom-cards/stuff-abc".
 */
function generatePagePath(cfpath, variant) {
  const lastSegment = String(cfpath || '').split('/').filter(Boolean).pop() || ''
  return `/byom-cards/${lastSegment}-${variant}`
}

/**
 * Helper to call the Helix admin API for either preview or live environments.
 *
 * @param {string} token - Helix admin token.
 * @param {'preview'|'live'} uriEnv - Target environment.
 * @param {string} projectCoords - Helix project coordinates.
 * @param {string} path - Path to run this action against.
 * @param {'publish'|'delete'} action - Desired action.
 * @param {string} [cfpath] - Content fragment path forwarded to the data provider.
 * @param {string} [variant] - Variant identifier forwarded to the data provider.
 * @param {Object} logger - Structured logger instance.
 * @returns {Promise<{success: boolean, status?: number, body?: *, error?: Error}>}
 */
async function processEvent(token, uriEnv, projectCoords, path, action, cfpath, variant, logger) {
  const url = `https://admin.hlx.page/${uriEnv}/${projectCoords}${path}`
  const headers = {
    authorization: `token ${token}`
  }

  // Forward the content fragment path and variant to the data provider in a single header (`cfpath|variant`).
  // Helix reliably relays `x-content-source-location` to the content source; the data provider splits it back apart.
  if (cfpath) {
    headers[CF_PATH_HEADER] = variant ? `${cfpath}|${variant}` : cfpath
  }

  const options = {
    method: action === 'publish' ? 'POST' : 'DELETE',
    headers
  }

  try {
    const res = await fetch(url, options)

    if (!res.ok) {
      // Capture the upstream error payload (if any) to aid debugging during demos.
      const errorText = await safeRead(res)
      logger.info(`Request not successful: ${res.status} ${res.statusText || ''} - ${errorText}`.trim())
      return { success: false, status: res.status, statusText: res.statusText }
    }

    let payload = null
    try {
      payload = await res.json()
    } catch (parseError) {
      // Some Helix endpoints respond with empty bodies; logging at debug helps future troubleshooting.
      logger.debug(`No JSON payload returned for ${uriEnv} ${path}`)
    }

    logger.debug(`Request for ${uriEnv} successful on ${path}`)

    if (uriEnv === 'preview') {
      const previewStatus = payload?.preview?.status
      if (typeof previewStatus === 'number') {
        return { success: previewStatus === 200, status: res.status, body: payload }
      }
    }

    return { success: true, status: res.status, body: payload }
  } catch (error) {
    logger.error(`Failed to process event for ${uriEnv} on ${path}`, error)
    return { success: false, error }
  }
}

/**
 * Reads a response body as text while tolerating stream errors.
 *
 * @param {Response} res - Fetch response.
 * @returns {Promise<string>} - The raw body or an empty string if it cannot be read.
 */
async function safeRead(res) {
  try {
    return await res.text()
  } catch (error) {
    return ''
  }
}

exports.main = main
exports.processEvent = processEvent
exports.generatePagePath = generatePagePath
