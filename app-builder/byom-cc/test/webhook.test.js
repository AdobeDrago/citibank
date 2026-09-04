/*
* <license header>
*/

jest.mock('@adobe/aio-sdk', () => ({
  Core: {
    Logger: jest.fn()
  }
}))

const { Core } = require('@adobe/aio-sdk')
const mockLoggerInstance = { info: jest.fn(), debug: jest.fn(), error: jest.fn(), warn: jest.fn() }
Core.Logger.mockReturnValue(mockLoggerInstance)

jest.mock('node-fetch')
const fetch = require('node-fetch')
const action = require('./../actions/webhook/index.js')

const CFPATH = '/content/dam/cf-services/ccc-cf/citi-strata-elite-card'
const VARIANT = 'abc'
// page path = /byom-cards/<last segment of cfpath>-<variant>
const expectedPath = `/byom-cards/citi-strata-elite-card-${VARIANT}`

beforeEach(() => {
  Core.Logger.mockClear()
  Object.values(mockLoggerInstance).forEach(fn => fn.mockReset())
  fetch.mockReset()
})

afterEach(() => {
  jest.restoreAllMocks()
})

const baseParams = {
  LOG_LEVEL: 'info',
  PROJECT_COORDS: 'owner/repo/main',
  TOKEN: 'aem-token',
  cfpath: CFPATH,
  variant: VARIANT
}

describe('webhook', () => {
  test('main should be defined', () => {
    expect(action.main).toBeInstanceOf(Function)
  })

  test('generatePagePath builds /byom-cards/<last cfpath segment>-<variant>', () => {
    expect(action.generatePagePath('/some/path/stuff', 'abc')).toBe('/byom-cards/stuff-abc')
    expect(action.generatePagePath(CFPATH, 'v2')).toBe('/byom-cards/citi-strata-elite-card-v2')
    expect(action.generatePagePath('/a/b/', 'x')).toBe('/byom-cards/b-x')
  })

  test('should set logger to use LOG_LEVEL param', async () => {
    fetch
      .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ preview: { status: 200 } }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ status: 200 }) })

    await action.main({ ...baseParams, LOG_LEVEL: 'trace' })

    expect(Core.Logger).toHaveBeenCalledWith(expect.any(String), { level: 'trace' })
  })

  test('should return 400 when required params missing', async () => {
    const response = await action.main({ PROJECT_COORDS: 'owner/repo/main' })
    expect(response).toEqual({
      error: {
        statusCode: 400,
        body: { error: "missing parameter(s) 'TOKEN, cfpath, variant'" }
      }
    })
  })

  test('should attempt preview up to 3 times before succeeding and then publish', async () => {
    const previewFailure = {
      ok: true,
      status: 200,
      json: () => Promise.resolve({ preview: { status: 500 } })
    }
    const previewSuccess = {
      ok: true,
      status: 200,
      json: () => Promise.resolve({ preview: { status: 200 } })
    }
    const publishSuccess = {
      ok: true,
      status: 200,
      json: () => Promise.resolve({ status: 200 })
    }

    fetch
      .mockResolvedValueOnce(previewFailure)
      .mockResolvedValueOnce(previewFailure)
      .mockResolvedValueOnce(previewSuccess)
      .mockResolvedValueOnce(publishSuccess)

    const response = await action.main(baseParams)

    expect(response.statusCode).toBe(200)
    expect(response.body.previewSuccessful).toBe(true)
    expect(response.body.publishSuccessful).toBe(true)
    expect(response.body.previewAttempts).toHaveLength(3)
    expect(response.body.pagePath).toBe(expectedPath)
    expect(fetch).toHaveBeenCalledTimes(4)

    const [previewUrl, previewOptions] = fetch.mock.calls[0]
    expect(previewUrl).toBe(`https://admin.hlx.page/preview/${baseParams.PROJECT_COORDS}${expectedPath}`)
    expect(previewOptions.headers.authorization).toBe(`token ${baseParams.TOKEN}`)
    expect(previewOptions.headers['x-content-source-location']).toBe(`${CFPATH}|${VARIANT}`)

    // Publish uses the /live/ endpoint on the same coords + page path.
    const publishUrl = fetch.mock.calls[3][0]
    expect(publishUrl).toBe(`https://admin.hlx.page/live/${baseParams.PROJECT_COORDS}${expectedPath}`)
  })

  test('should forward cfpath|variant in a single header on preview and publish', async () => {
    fetch
      .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ preview: { status: 200 } }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ status: 200 }) })

    const response = await action.main(baseParams)

    expect(response.statusCode).toBe(200)
    expect(fetch).toHaveBeenCalledTimes(2)

    const [, previewOptions] = fetch.mock.calls[0]
    expect(previewOptions.headers['x-content-source-location']).toBe(`${CFPATH}|${VARIANT}`)
    expect(previewOptions.headers['x-content-source-variant']).toBeUndefined()

    const [, publishOptions] = fetch.mock.calls[1]
    expect(publishOptions.headers['x-content-source-location']).toBe(`${CFPATH}|${VARIANT}`)
  })

  test('should read cfpath and variant from POST request body', async () => {
    fetch
      .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ preview: { status: 200 } }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ status: 200 }) })

    // PROJECT_COORDS/TOKEN arrive as params (manifest inputs); per-request cfpath/variant come from the body.
    const bodyJson = { cfpath: '/a/b/other-card', variant: 'xyz' }
    const bodyBase64 = Buffer.from(JSON.stringify(bodyJson)).toString('base64')

    const response = await action.main({
      LOG_LEVEL: 'info',
      PROJECT_COORDS: 'owner/repo/main',
      TOKEN: 'aem-token',
      __ow_body: bodyBase64,
      __ow_method: 'post'
    })

    expect(response.statusCode).toBe(200)
    expect(response.body.pagePath).toBe('/byom-cards/other-card-xyz')
    expect(fetch).toHaveBeenCalledTimes(2)

    const [previewUrl, previewOptions] = fetch.mock.calls[0]
    expect(previewUrl).toBe('https://admin.hlx.page/preview/owner/repo/main/byom-cards/other-card-xyz')
    expect(previewOptions.headers['x-content-source-location']).toBe('/a/b/other-card|xyz')
  })

  test('should accept PROJECT_COORDS and TOKEN from the POST request body', async () => {
    fetch
      .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ preview: { status: 200 } }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ status: 200 }) })

    // Everything supplied via the body (no params, no env).
    const bodyJson = { PROJECT_COORDS: 'owner/repo/main', TOKEN: 'body-token', cfpath: CFPATH, variant: VARIANT }
    const bodyBase64 = Buffer.from(JSON.stringify(bodyJson)).toString('base64')

    const response = await action.main({ LOG_LEVEL: 'info', __ow_body: bodyBase64, __ow_method: 'post' })

    expect(response.statusCode).toBe(200)
    expect(response.body.pagePath).toBe(expectedPath)
    expect(fetch).toHaveBeenCalledTimes(2)

    const [previewUrl, previewOptions] = fetch.mock.calls[0]
    expect(previewUrl).toBe(`https://admin.hlx.page/preview/owner/repo/main${expectedPath}`)
    expect(previewOptions.headers.authorization).toBe('token body-token')
  })

  test('should return 500 when preview never succeeds', async () => {
    fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ preview: { status: 500 } })
    })

    const response = await action.main(baseParams)

    expect(response.statusCode).toBe(500)
    expect(response.body.previewSuccessful).toBe(false)
    expect(response.body.publishSuccessful).toBe(false)
    expect(response.body.pagePath).toBe(expectedPath)
    expect(fetch).toHaveBeenCalledTimes(3)
  })

  test('should return 500 and log error when publish fails', async () => {
    const previewSuccess = {
      ok: true,
      status: 200,
      json: () => Promise.resolve({ preview: { status: 200 } })
    }
    const publishFailure = {
      ok: false,
      status: 500,
      statusText: 'Server Error',
      text: () => Promise.resolve('failure')
    }

    fetch
      .mockResolvedValueOnce(previewSuccess)
      .mockResolvedValueOnce(publishFailure)

    const response = await action.main(baseParams)

    expect(response.statusCode).toBe(500)
    expect(response.body.previewSuccessful).toBe(true)
    expect(response.body.publishSuccessful).toBe(false)
    expect(response.body.pagePath).toBe(expectedPath)
    expect(mockLoggerInstance.error).toHaveBeenCalledWith(`Publish failed for path: ${expectedPath}`)
  })
})
