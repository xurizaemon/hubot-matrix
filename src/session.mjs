import './crypto-polyfill.mjs'
import sdk from 'matrix-js-sdk'
import { LocalStorageCryptoStore } from 'matrix-js-sdk/lib/crypto/store/localStorage-crypto-store.js'
import Store from './store.mjs'

export default class MatrixSession {
  constructor (botName, matrixServer, matrixUser, matrixPassword, logger, localStorage) {
    this.botName = botName
    this.matrixServer = matrixServer
    this.matrixUser = matrixUser
    this.matrixPassword = matrixPassword
    this.logger = logger
    this.localStorage = localStorage
    this.clientDefaultOptions = {
      store: new Store(this.localStorage),
      cryptoStore: new LocalStorageCryptoStore(localStorage),
      cryptoCallbacks: {
        getCrossSigningKey: (type) => null,
        onSecretRequested: (userId, deviceId, requestId, secretName) => {
          this.logger.debug(`Secret ${secretName} requested by ${userId}:${deviceId}`)
          return null
        },
        saveCrossSigningKeys: (keys) => {}
      },
      logger: this.logger
    }
  }

  createClient (cb) {
    const accessToken = this.localStorage.getItem('access_token')
    const deviceId = this.localStorage.getItem('device_id')
    const userId = this.localStorage.getItem('user_id')
    // Remove?
    const botName = this.localStorage.getItem('bot_name')

    if (!accessToken || !botName || !deviceId || !userId) {
      this.logger.debug('Creating a new session: no authentication token can be found in local storage.')
      this.login((error, client) => cb(error, client))
      return
    }

    this.logger.info('Reusing existing session: authentication information found in local storage, for user: ' + userId)
    this.client = sdk.createClient({
      baseUrl: this.matrixServer || 'https://matrix-client.matrix.org',
      accessToken,
      userId,
      deviceId,
      ...this.clientDefaultOptions
    })

    cb(null, this.client)
  }

  login (cb) {
    const that = this
    this.client = sdk.createClient({
      baseUrl: this.matrixServer || 'https://matrix-client.matrix.org'
    })
    this.client.loginRequest({
      user: this.matrixUser || this.botName,
      password: this.matrixPassword,
      type: 'm.login.password'
    }).then((data) => {
      that.logger.debug(`Logged in ${data.user_id} on device ${data.device_id}`)

      that.localStorage.setItem('access_token', data.access_token)
      that.localStorage.setItem('user_id', data.user_id)
      that.localStorage.setItem('device_id', data.device_id)
      // Remove?
      that.localStorage.setItem('bot_name', that.botName)

      // Re-initialise the client.
      that.client = sdk.createClient({
        baseUrl: that.matrixServer || 'https://matrix-client.matrix.org',
        accessToken: data.access_token,
        userId: data.user_id,
        deviceId: data.device_id,
        ...this.clientDefaultOptions
      })

      cb(null, that.client)
    }).catch((error) => {
      that.logger.error(error)
      cb(error, null)
    })
  }
}
