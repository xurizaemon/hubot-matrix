import {jest, test, expect, afterEach, describe} from '@jest/globals';

//jest.mock("matrix-js-sdk")
jest.unstable_mockModule('matrix-js-sdk', () => ({
  default: {
    createClient: jest.fn(),
  }
}))

afterEach(() => {
  jest.clearAllMocks();
})

const sdk = (await import('matrix-js-sdk')).default;
const MatrixSession = (await import('./session.mjs')).default

const mockedLoginResult = {
  user_id: "someUserId",
  access_token: "someAccessToken",
  bot_name: "juliasbot",
  device_id: "someDeviceId"
}

describe('if no authentication token is available in the local storage', () => {
  test('performs a client login', () => {
    const client = {
      login: jest.fn().mockResolvedValue(mockedLoginResult)
    };
    sdk.createClient.mockReturnValue(client);

    let matrixSession = new MatrixSession("juliasbot", "http://server:8080", "julia",
        "123", logger, new LocalStorageMock());
    matrixSession.createClient(jest.fn(() => {}));

    expect(client.login).toHaveBeenCalledTimes(1);
  })

  test('updates the localStorage', (done) => {
    const client = {
      login: jest.fn().mockResolvedValue(mockedLoginResult)
    };
    sdk.createClient.mockReturnValue(client);

    const localStorageMock = new LocalStorageMock()
    localStorageMock.xxx = "ASDF"

    let matrixSession = new MatrixSession("juliasbot", "http://server:8080", "julia",
        "123", logger, localStorageMock);

    matrixSession.createClient(jest.fn(() => {
      expect(localStorageMock.getItem("access_token")).toEqual("someAccessToken")
      expect(localStorageMock.getItem("bot_name")).toEqual("juliasbot")
      expect(localStorageMock.getItem("user_id")).toEqual("someUserId")
      expect(localStorageMock.getItem("device_id")).toEqual("someDeviceId")
      done()
    }));
  })
})

test('no client login if authentication token is available in the local storage', () => {
  const client = {
    login: jest.fn().mockResolvedValue(mockedLoginResult)
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
