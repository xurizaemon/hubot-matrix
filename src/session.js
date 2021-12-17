const sdk = require("matrix-js-sdk");
  const {
    LocalStorageCryptoStore,
  } = require('matrix-js-sdk/lib/crypto/store/localStorage-crypto-store');


class MatrixSession {

  constructor(botName, matrixServer, matrixUser, matrixPassword, logger, localStorage) {
    this.botName = botName;
    this.matrixServer = matrixServer;
    this.matrixUser = matrixUser;
    this.matrixPassword = matrixPassword;
    this.logger = logger;
    this.localStorage = localStorage;
  }

  createClient(cb) {
    let accessToken = this.localStorage.getItem("access_token");
    let botName = this.localStorage.getItem("bot_name");
    let deviceId = this.localStorage.getItem("device_id");
    let userId = this.localStorage.getItem("user_id");

    if (!accessToken || !botName || !deviceId || !userId) {
      this.logger.info("Creating a new session: no authentication token can be found in local storage.")
      this.login((err, client) => cb(err, client))
      return;
    }

    this.logger.info("Reusing existing session: authentication information found in local storage, for user: " + userId)
    this.client = sdk.createClient({
      baseUrl: this.matrixServer || 'https://matrix.org',
      accessToken: accessToken,
      userId: userId,
      deviceId: deviceId,
      sessionStore: new sdk.WebStorageSessionStore(this.localStorage),
    });

    cb(null, this.client)
  }

  login(cb) {
    let that = this;
    this.client = sdk.createClient(this.matrixServer || 'https://matrix.org');
    this.client.login('m.login.password', {
      user: this.matrixUser || this.botName,
      password: this.matrixPassword
    }, async (err, data) => {

      if (err) {
        that.logger.error(err);
        cb(err, null)
      }

      that.logger.info(`Logged in ${data.user_id} on device ${data.device_id}`);
      that.client = sdk.createClient({
        baseUrl: that.matrixServer || 'https://matrix.org',
        accessToken: data.access_token,
        userId: data.user_id,
        deviceId: data.device_id,
        sessionStore: new sdk.WebStorageSessionStore(that.localStorage),
        cryptoStore: new LocalStorageCryptoStore(localStorage)

      });

      that.localStorage.setItem("access_token", data.access_token)
      that.localStorage.setItem("bot_name", that.botName)
      that.localStorage.setItem("user_id", data.user_id)
      that.localStorage.setItem("device_id", data.device_id)
      cb(null, that.client)
    });
  }

}

module.exports = MatrixSession
