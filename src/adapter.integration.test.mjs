import { jest, test, expect, beforeAll, afterAll, describe } from '@jest/globals'
import MatrixAdapter from './matrix.mjs'
import { Robot, TextMessage } from 'hubot'

// Create a dedicated test bot account for these tests
const TEST_BOT_NAME = process.env.TEST_BOT_NAME || 'HubotMatrixTest'
const TEST_MATRIX_PASSWORD = process.env.TEST_MATRIX_PASSWORD
const TEST_MATRIX_ROOM = process.env.TEST_MATRIX_ROOM
const TEST_MATRIX_URL = process.env.TEST_MATRIX_URL || 'https://matrix-client.matrix.org'
const TEST_MATRIX_USER = process.env.TEST_MATRIX_USER

const runIntegrationTests = TEST_MATRIX_USER && TEST_MATRIX_PASSWORD && TEST_MATRIX_ROOM

describe('Matrix Adapter Integration Tests', () => {
  let robot
  let adapter

  beforeAll(() => {
    if (!runIntegrationTests) {
      console.warn('Skipping integration tests - missing environment variables')
      return
    }

    process.env.HUBOT_MATRIX_HOST_SERVER = TEST_MATRIX_URL
    process.env.HUBOT_MATRIX_USER = TEST_MATRIX_USER
    process.env.HUBOT_MATRIX_PASSWORD = TEST_MATRIX_PASSWORD

    // Create test robot
    robot = new Robot(null, 'mock-adapter', false, TEST_BOT_NAME)

    // Spy on robot methods
    robot.receive = jest.fn(robot.receive)

    // Use the real adapter
    adapter = MatrixAdapter.use(robot)
    robot.adapter = adapter
  })

  afterAll(async () => {
    if (robot && robot.matrixClient) {
      await robot.matrixClient.stopClient()
    }

    // Reset environment variables
    delete process.env.HUBOT_MATRIX_HOST_SERVER
    delete process.env.HUBOT_MATRIX_USER
    delete process.env.HUBOT_MATRIX_PASSWORD
  })

  test('should connect to Matrix server', (done) => {
    if (!runIntegrationTests) {
      done()
      return
    }

    // Listen for connected event
    adapter.on('connected', () => {
      expect(robot.matrixClient).toBeDefined()
      expect(robot.matrixClient.getUserId()).toBeDefined()
      done()
    })

    // Run the adapter
    adapter.run()
  }, 10000)

  test('should send a message to a room', async () => {
    if (!runIntegrationTests) return

    // Wait for client to be ready
    if (!robot.matrixClient) {
      await new Promise(resolve => setTimeout(resolve, 5000))
    }

    // Create an envelope for the test room
    const envelope = { room: TEST_MATRIX_ROOM }

    // Send a test message
    const testMessage = `Test message from integration test: ${Date.now()}`

    // Use a promise to track the send operation
    return new Promise((resolve, reject) => {
      try {
        adapter.send(envelope, testMessage)

        // Wait to allow the message to be sent
        setTimeout(() => {
          resolve()
        }, 2000)
      } catch (error) {
        reject(error)
      }
    })
  }, 10000)
})
