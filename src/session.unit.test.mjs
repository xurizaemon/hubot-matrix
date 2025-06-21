import { jest, test, expect, afterEach, describe } from '@jest/globals'

jest.unstable_mockModule('matrix-js-sdk', () => ({
  default: {
    createClient: jest.fn()
  }
}))

afterEach(() => {
  jest.clearAllMocks()
})

const sdk = (await import('matrix-js-sdk')).default
const MatrixSession = (await import('./session.mjs')).default

const mockedLoginResult = {
  user_id: 'someUserId',
  access_token: 'someAccessToken',
  bot_name: 'juliasbot',
  device_id: 'someDeviceId'
}

describe('if no authentication token is available in the local storage', () => {
  test('performs a client login', () => {
    const client = {
      loginRequest: jest.fn().mockResolvedValue(mockedLoginResult)
    }
    sdk.createClient.mockReturnValue(client)

    const matrixSession = new MatrixSession('juliasbot', 'http://server:8080', 'julia',
      '123', logger, new LocalStorageMock())
    matrixSession.createClient(jest.fn(() => {}))

    expect(client.loginRequest).toHaveBeenCalledTimes(1)
  })

  test('updates the localStorage', (done) => {
    const client = {
      loginRequest: jest.fn().mockResolvedValue(mockedLoginResult)
    }
    sdk.createClient.mockReturnValue(client)

    const localStorageMock = new LocalStorageMock()
    localStorageMock.xxx = 'ASDF'

    const matrixSession = new MatrixSession('juliasbot', 'http://server:8080', 'julia',
      '123', logger, localStorageMock)

    matrixSession.createClient(jest.fn(() => {
      expect(localStorageMock.getItem('access_token')).toEqual('someAccessToken')
      expect(localStorageMock.getItem('bot_name')).toEqual('juliasbot')
      expect(localStorageMock.getItem('user_id')).toEqual('someUserId')
      expect(localStorageMock.getItem('device_id')).toEqual('someDeviceId')
      done()
    }))
  })
})

test('no client login if authentication token is available in the local storage', () => {
  const client = {
    loginRequest: jest.fn().mockResolvedValue(mockedLoginResult)
  }
  sdk.createClient.mockReturnValue(client)

  const localStorageMock = new LocalStorageMock()
  localStorageMock.setItem('access_token', 'someAccessToken')
  localStorageMock.setItem('bot_name', 'someBotName')
  localStorageMock.setItem('user_id', 'someUserId')
  localStorageMock.setItem('device_id', 'someDeviceId')

  const matrixSession = new MatrixSession('juliasbot', 'http://server:8080', 'julia',
    '123', logger, localStorageMock)
  matrixSession.createClient(jest.fn(() => {}))

  expect(client.loginRequest).toHaveBeenCalledTimes(0)
})

const logger = {
  info: jest.fn(msg => console.log(`[INFO] ${msg}`)),
  warn: jest.fn(msg => console.warn(`[WARN] ${msg}`)),
  error: jest.fn(msg => console.error(`[ERROR] ${msg}`)),
  debug: jest.fn(msg => console.debug(`[DEBUG] ${msg}`)),
  trace: jest.fn(msg => {}),
  setLevel: jest.fn(),
  // Matrix SDK sometimes checks for these too
  log: jest.fn(msg => console.log(`[LOG] ${msg}`)),
  silly: jest.fn()
}

class LocalStorageMock {
  constructor () {
    this.store = {}
  }

  clear () {
    this.store = {}
  }

  getItem (key) {
    return this.store[key] || null
  }

  setItem (key, value) {
    this.store[key] = String(value)
  }

  removeItem (key) {
    delete this.store[key]
  }
}

/**
 * Retry a function with exponential backoff when rate limited
 * @param {Function} fn - Function to retry (should return a promise)
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} initialDelay - Initial delay in ms
 * @param {Logger} logger - Logger instance
 * @returns {Promise<any>} - Result of the function
 */
async function retryWithBackoff (fn, maxRetries = 3, initialDelay = 1000, logger) {
  let retries = 0
  let lastError
  let delay = initialDelay

  while (retries < maxRetries) {
    try {
      return await fn()
    } catch (err) {
      lastError = err

      // Check if it's a rate limit error
      if (err.errcode === 'M_LIMIT_EXCEEDED') {
        // Use the retry_after_ms from the error if available, otherwise use exponential backoff
        const retryAfter = err.retry_after_ms || delay
        logger.warn(`Rate limited, retrying after ${retryAfter}ms (retry ${retries + 1}/${maxRetries})`)

        // Wait for the specified time
        await new Promise(resolve => setTimeout(resolve, retryAfter))

        // Increase delay for next retry (exponential backoff)
        delay = delay * 2
        retries++
      } else {
        // If it's not a rate limit error, don't retry
        throw err
      }
    }
  }

  // If we've exhausted all retries, throw the last error
  throw lastError
}
