const MatrixSession = require('./session');
const sdk = require("matrix-js-sdk");

jest.mock("matrix-js-sdk")

test('client login if no authentication token is available in the local storage', () => {
  const client = {
    login: jest.fn(() => {
    })
  };
  sdk.createClient.mockReturnValue(client);

  let matrixSession = new MatrixSession("juliasbot", "http://server:8080", "julia",
    "123", logger, new LocalStorageMock());
  matrixSession.createClient(jest.fn(() => {}));

  expect(client.login).toHaveBeenCalledTimes(1);
});

test('no client login if authentication token is available in the local storage', () => {
  const client = {
    login: jest.fn(() => {
    })
  };
  sdk.createClient.mockReturnValue(client);

  let localStorageMock = new LocalStorageMock();
  localStorageMock.setItem("access_token", "someAccessToken")
  localStorageMock.setItem("bot_name", "someBotName")
  localStorageMock.setItem("user_id", "someUserId")
  localStorageMock.setItem("device_id", "someDeviceId")

  let matrixSession = new MatrixSession("juliasbot", "http://server:8080", "julia",
    "123", logger, localStorageMock);
  matrixSession.createClient(jest.fn(() => {}));

  expect(client.login).toHaveBeenCalledTimes(0);
});


const logger = {
  info: jest.fn(() => {
  }),
  error: jest.fn(() => {
  }),
}

class LocalStorageMock {
  constructor() {
    this.store = {};
  }

  clear() {
    this.store = {};
  }

  getItem(key) {
    return this.store[key] || null;
  }

  setItem(key, value) {
    this.store[key] = String(value);
  }

  removeItem(key) {
    delete this.store[key];
  }
}
