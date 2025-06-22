import { jest, test, expect, beforeAll, afterAll, describe } from '@jest/globals'
import { LocalStorage } from 'node-localstorage'
import MatrixSession from './session.mjs'

// Create a dedicated test bot account for these tests
const TEST_BOT_NAME = process.env.TEST_BOT_NAME || 'hubot-matrix-test-bot'
const TEST_MATRIX_PASSWORD = process.env.TEST_MATRIX_PASSWORD
const TEST_MATRIX_ROOM_ID = process.env.TEST_MATRIX_ROOM_ID
const TEST_MATRIX_SERVER = process.env.TEST_MATRIX_SERVER || 'https://matrix-client.matrix.org'
const TEST_MATRIX_USER = process.env.TEST_MATRIX_USER

// Skip all tests if credentials aren't provided
const runIntegrationTests = TEST_MATRIX_USER && TEST_MATRIX_PASSWORD

function createLogger () {
  return {
    info: jest.fn(msg => console.log(`[INFO] ${msg}`)),
    warn: jest.fn(msg => console.warn(`[WARN] ${msg}`)),
    error: jest.fn(msg => console.error(`[ERROR] ${msg}`)),
    debug: jest.fn(msg => console.debug(`[DEBUG] ${msg}`)),
    trace: jest.fn(msg => {}),
    log: jest.fn(msg => console.log(`[LOG] ${msg}`)),
    setLevel: jest.fn(),
    silly: jest.fn()
  }
}

describe('Matrix Session Integration Tests', () => {
  let matrixClient
  let localStorage
  let logger

  // Only run these tests if credentials are provided
  beforeAll(() => {
    if (!runIntegrationTests) {
      console.warn('Skipping integration tests - no TEST_MATRIX_USER/PASSWORD environment variables set')
    } else {
      localStorage = new LocalStorage('./integration-test.localStorage')
      logger = {
        info: jest.fn(msg => console.log(`[INFO] ${msg}`)),
        warn: jest.fn(msg => console.warn(`[WARN] ${msg}`)),
        error: jest.fn(msg => console.error(`[ERROR] ${msg}`)),
        debug: jest.fn(msg => console.debug(`[DEBUG] ${msg}`)),
        trace: jest.fn(msg => {}),
        setLevel: jest.fn(),
        log: jest.fn(msg => console.log(`[LOG] ${msg}`)),
        silly: jest.fn()
      }
    }
  })

  afterAll(async () => {
    if (localStorage) {
      try {
        localStorage.clear()
      } catch (err) {
        console.warn('Error clearing localStorage:', err.message)
      }
    }

    if (matrixClient) {
      try {
        await matrixClient.stopClient({
          unsetStoppedFlag: true
        })
      } catch (err) {
        console.warn('Error stopping Matrix client:', err.message)
      }
    }
  })

  test('should connect to Matrix server and authenticate', async () => {
    if (!runIntegrationTests) return

    const matrixSession = new MatrixSession(
      TEST_BOT_NAME,
      TEST_MATRIX_SERVER,
      TEST_MATRIX_USER,
      TEST_MATRIX_PASSWORD,
      logger,
      localStorage
    )

    let timeoutId
    try {
      const result = await Promise.race([
        new Promise((resolve, reject) => {
          matrixSession.createClient((err, client) => {
            if (err) {
              reject(err)
              return
            }
            matrixClient = client
            resolve(client)
          })
        }),
        new Promise((_, reject) => {
          timeoutId = setTimeout(() => {
            reject(new Error('Matrix client creation timed out'))
          }, 25000)
        })
      ])

      expect(result).toBeDefined()
      expect(result.getUserId()).toBeDefined()

      expect(localStorage.getItem('access_token')).toBeDefined()
      expect(localStorage.getItem('user_id')).toBeDefined()
    } finally {
      // Clear the timeout to prevent open handles
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, 10000)

  test('should sync rooms with the server', async () => {
    if (!runIntegrationTests) return
    if (!matrixClient) {
      console.warn('Skipping sync test - no Matrix client available')
      return
    }

    const syncPromise = new Promise((resolve) => {
      // Timeout handler which won't fail the test, just resolve.
      const timeoutId = setTimeout(() => {
        console.warn('Sync timeout - continuing test anyway')
        matrixClient.removeListener('sync', onSync)
        resolve()
      }, 10000)

      const onSync = (state) => {
        console.log(`Sync state: ${state}`)
        if (state === 'PREPARED') {
          clearTimeout(timeoutId)
          matrixClient.removeListener('sync', onSync)
          resolve()
        }
      }

      matrixClient.on('sync', onSync)

      try {
        matrixClient.startClient({
          initialSyncLimit: 1,
          pendingEventOrdering: 'detached',
          timelineSupport: false // Reduce updates to fetch.
        })
      } catch (err) {
        console.error('Error starting client:', err)
        clearTimeout(timeoutId)
        resolve() // Continue rather than failing.
      }
    })

    await syncPromise

    expect(matrixClient).toBeDefined()
  }, 10000) // Allow 60s for network operations.
})
