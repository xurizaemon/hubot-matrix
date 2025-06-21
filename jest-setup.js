// Polyfill in some Node crypto for tests only.
import { TextEncoder, TextDecoder } from 'util'
import crypto from 'crypto'

// Add TextEncoder and TextDecoder to global
global.TextEncoder = TextEncoder
global.TextDecoder = TextDecoder

// Add crypto to global
if (typeof global.crypto === 'undefined') {
  global.crypto = {
    getRandomValues: function (array) {
      return crypto.randomBytes(array.length).copy(array)
    }
  }
}
