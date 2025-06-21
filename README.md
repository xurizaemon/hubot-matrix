# Hubot adapter for Matrix

This is a [Hubot](https://hubot.github.com) adapter for [Matrix](https://matrix.org/).

## Installation

Use the following adapter based on your Hubot version (`npm list hubot`).

* For Hubot v2, `npm i hubot-matrix@1`
* For Hubot v3, `npm i hubot-matrix@2`
* For Hubot v13+, `npm i @xurizaemon/hubot-matrix`

## Adapter configuration

Set the following variables:

* `HUBOT_ADAPTER` should be `@xurizaemon/hubot-matrix`
* `HUBOT_MATRIX_HOST_SERVER` - the Matrix server to connect to (default is `https://matrix.org` if unset)
* `HUBOT_MATRIX_USER` - bot login on the Matrix server - eg `@examplebotname:matrix.example.org`
* `HUBOT_MATRIX_PASSWORD` - bot password on the Matrix server

## Tests

To run tests in Github Actions, the following **Github Secrets** should be configured.

| Name                   | Example                          | Description               |
|------------------------|----------------------------------|---------------------------|
| `TEST_MATRIX_URL`      | https://matrix-client.matrix.org | Home instance URL         |
| `TEST_MATRIX_ROOM`     | `!something:example.org`         | Room ID (where to get it) |
| `TEST_MATRIX_USER`     | `@someuser:example.org`          | Username                  |
| `TEST_MATRIX_PASSWORD` | `********`                       | Password                  |

See `.github/workflows/*.yml` and test code for reference usage.

### Hubot demo (e2e) test

[hubot-demo](.github/workflows/hubot-demo.yml) creates a fresh Hubot instance and connects to Matrix 
using creds provided from the secrets above to configure the Hubot instance.

| Name                    | Example                          | Description                |
|-------------------------|----------------------------------|----------------------------|
| `HUBOT_MATRIX_HOST`     | https://matrix-client.matrix.org | Home instance URL          |
| `HUBOT_MATRIX_PASSWORD` | ****                             | Test user a/c password.    |
| `HUBOT_MATRIX_USERNAME` | ****                             | Test user a/c login.       |
| `HUBOT_FAREWELL_*`      | Configure `hubot-farewell`[^1]   | Configure shutdown message |
| `HUBOT_STARTUP_*`       | Configure `hubot-startup`[^2]    | Configure startup message  |

### Jest
Jest requires the experimental-vm-modules Node option to run .mjs tests:

```shell
NODE_OPTIONS="$NODE_OPTIONS --experimental-vm-modules" npm run test
```

[^1]: https://github.com/xurizaemon/hubot-farewell/

[^2]: https://github.com/xurizaemon/hubot-startup/
