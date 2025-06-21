import crypto from 'crypto'

// Polyfill for crypto.getRandomValues() in Node.js
if (typeof global.crypto === 'undefined') {
  global.crypto = {}
}

if (typeof global.crypto.getRandomValues === 'undefined') {
  global.crypto.getRandomValues = function (array) {
    const bytes = crypto.randomBytes(array.length)
    array.set(bytes)
    return array
  }
}

export default global.crypto
