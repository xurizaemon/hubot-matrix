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
  }

  createClient (cb) {
    const accessToken = this.localStorage.getItem('access_token')
    const botName = this.localStorage.getItem('bot_name')
    const deviceId = this.localStorage.getItem('device_id')
    const userId = this.localStorage.getItem('user_id')

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
      store: new Store(this.localStorage),
      cryptoStore: new LocalStorageCryptoStore(this.localStorage),
      logger: this.logger
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
      that.client = sdk.createClient({
        baseUrl: that.matrixServer || 'https://matrix-client.matrix.org',
        accessToken: data.access_token,
        userId: data.user_id,
        deviceId: data.device_id,
        store: new Store(this.localStorage),
        cryptoStore: new LocalStorageCryptoStore(that.localStorage),
        logger: this.logger
      })

      that.localStorage.setItem('access_token', data.access_token)
      that.localStorage.setItem('bot_name', that.botName)
      that.localStorage.setItem('user_id', data.user_id)
      that.localStorage.setItem('device_id', data.device_id)
      cb(null, that.client)
    }).catch((error) => {
      that.logger.error(error)
      cb(error, null)
    })
  }
}
