/*
* <license header>
*/

jest.mock('@adobe/aio-sdk', () => ({
  Core: {
    Logger: jest.fn()
  }
}))

const { Core } = require('@adobe/aio-sdk')
const mockLoggerInstance = {
  info: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
}
Core.Logger.mockReturnValue(mockLoggerInstance)

jest.mock('node-fetch')
const fetch = require('node-fetch')
const fs = require('fs')
const path = require('path')
const action = require('./../actions/data-provider/index.js')

// Sample AEM GraphQL content fragment payload used across the app (data.creditCardByPath.item).
const mockApiResponse = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'test.json'), 'utf-8')
)
const expectedItem = mockApiResponse.data.creditCardByPath.item
const CFPATH = '/content/dam/cf-services/ccc-cf/citi-strata-elite-card'

beforeEach(() => {
  Core.Logger.mockClear()
  Object.values(mockLoggerInstance).forEach(fn => fn.mockReset())
  fetch.mockReset()

  // Default mock for the content API fetch - successful response
  fetch.mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(mockApiResponse)
  })
})

const fakeParams = { __ow_headers: { 'x-content-source-location': CFPATH } }

describe('data-provider', () => {
  test('main should be defined', () => {
    expect(action.main).toBeInstanceOf(Function)
  })

  test('extractTopmostItem returns the shallowest item property', () => {
    expect(action.extractTopmostItem(mockApiResponse)).toBe(expectedItem)
    expect(action.extractTopmostItem({ item: 42 })).toBe(42)
    expect(action.extractTopmostItem({ a: { item: 1 }, item: 2 })).toBe(2)
    expect(action.extractTopmostItem({ no: 'item here' })).toBeNull()
    expect(action.extractTopmostItem(null)).toBeNull()
  })

  test('should set logger to use LOG_LEVEL param', async () => {
    await action.main({ ...fakeParams, __ow_path: '/byom-cards/1', LOG_LEVEL: 'trace' })
    expect(Core.Logger).toHaveBeenCalledWith('data-provider', { level: 'trace' })
  })

  test('should check for overlay paths', async () => {
    const invalidParams = { ...fakeParams, __ow_path: '/invalid-path' }
    const response = await action.main(invalidParams)
    expect(response).toEqual({
      error: {
        statusCode: 404,
        body: { error: '/invalid-path is not an overlay path' }
      }
    })
  })

  test('should return HTML content with correct status code for valid path', async () => {
    const validParams = { ...fakeParams, __ow_path: '/byom-cards/1' }
    const response = await action.main(validParams)
    expect(response.statusCode).toBe(200)
    expect(response.headers['Content-Type']).toBe('text/html')
    expect(typeof response.body).toBe('string')
  })

  test('should render the hero block from the item', async () => {
    const validParams = { ...fakeParams, __ow_path: '/byom-cards/1' }
    const response = await action.main(validParams)
    expect(response.body).toContain('class="hero"')
    // eyeBrow and title.html come straight from the item
    expect(response.body).toContain('Bonus Offer')
    expect(response.body).toContain('Citi Strata Elite')
    // hero background image uses the publish URL
    expect(response.body).toContain(expectedItem.hero.backgroundImage._publishUrl)
  })

  test('should render repeatable sections (feerates, accelerate, benefits, features)', async () => {
    const validParams = { ...fakeParams, __ow_path: '/byom-cards/1' }
    const response = await action.main(validParams)
    expect(response.body).toContain('class="fees-rates"')
    expect(response.body).toContain('class="accelerate"')
    expect(response.body).toContain('class="primary-benefits"')
    expect(response.body).toContain('class="features"')
    // Content from array entries is rendered (unescaped HTML)
    expect(response.body).toContain('Balance transfer fee')
    expect(response.body).toContain('Citi Entertainment')
  })

  test('should append cfpath to the configured endpoint override', async () => {
    const validParams = { ...fakeParams, __ow_path: '/byom-cards/1', CONTENT_API_URL: 'https://example.com/graphql;path=' }
    await action.main(validParams)
    expect(fetch).toHaveBeenCalledWith(`https://example.com/graphql;path=${CFPATH}`)
  })

  test('should accept cfpath as a direct param when no header is present', async () => {
    const validParams = { __ow_path: '/byom-cards/1', cfpath: CFPATH, CONTENT_API_URL: 'https://example.com/graphql;path=' }
    await action.main(validParams)
    expect(fetch).toHaveBeenCalledWith(`https://example.com/graphql;path=${CFPATH}`)
  })

  test('should split cfpath|variant from the single header and log the variant', async () => {
    const validParams = {
      __ow_path: '/byom-cards/1',
      __ow_headers: { 'x-content-source-location': `${CFPATH}|abc` }
    }
    const response = await action.main(validParams)
    expect(response.statusCode).toBe(200)
    // cfpath (without the variant suffix) is what gets appended to the endpoint
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining(`;path=${CFPATH}`))
    expect(fetch).not.toHaveBeenCalledWith(expect.stringContaining('|abc'))
    expect(mockLoggerInstance.info).toHaveBeenCalledWith('Variant: abc')
  })

  test('should return 400 when cfpath is missing', async () => {
    const response = await action.main({ __ow_path: '/byom-cards/1', __ow_headers: {} })
    expect(response).toEqual({
      error: {
        statusCode: 400,
        body: { error: "missing content fragment path 'cfpath'" }
      }
    })
    expect(fetch).not.toHaveBeenCalled()
  })

  test('should return 502 when the content API request fails', async () => {
    fetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error'
    })

    const validParams = { ...fakeParams, __ow_path: '/byom-cards/1' }
    const response = await action.main(validParams)
    expect(response).toEqual({
      error: {
        statusCode: 502,
        body: { error: 'failed to fetch credit card content' }
      }
    })
  })

  test('should return 502 when no item is present in the response', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { creditCardByPath: {} } })
    })

    const validParams = { ...fakeParams, __ow_path: '/byom-cards/1' }
    const response = await action.main(validParams)
    expect(response).toEqual({
      error: {
        statusCode: 502,
        body: { error: 'no credit card content available' }
      }
    })
  })

  test('if there is an error should return a 500 and log the error', async () => {
    const fakeError = new Error('template error')
    jest.spyOn(fs, 'readFileSync').mockImplementation(() => {
      throw fakeError
    })

    const validParams = { ...fakeParams, __ow_path: '/byom-cards/1' }
    const response = await action.main(validParams)
    expect(response).toEqual({
      error: {
        statusCode: 500,
        body: { error: 'server error' }
      }
    })
    expect(mockLoggerInstance.error).toHaveBeenCalledWith(fakeError)

    fs.readFileSync.mockRestore()
  })
})
