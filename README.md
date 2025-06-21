# Hubot adapter for Matrix

This is a [Hubot](https://hubot.github.com) adapter for [Matrix](https://matrix.org/).

## Installation

Use the following adapter based on your Hubot version (`npm list hubot`).

* For Hubot v2, `npm i hubot-matrix@1`
* For Hubot v3, `npm i hubot-matrix@2`
* For Hubot v13+, `npm i @xurizaemon/hubot-matrix`

## Adapter configuration

Set the following variables:

* `HUBOT_ADAPTER` should be `hubot-matrix`
* `HUBOT_MATRIX_HOST_SERVER` - the Matrix server to connect to (default is `https://matrix.org` if unset)
* `HUBOT_MATRIX_USER` - bot login on the Matrix server - eg `@examplebotname:matrix.example.org`
* `HUBOT_MATRIX_PASSWORD` - bot password on the Matrix server

## Tests

To run tests in Github Actions, the following **Github Secrets** should be configured.

| Name                   | Example                          | Description               |
|------------------------|----------------------------------|---------------------------|
| `TEST_MATRIX_URL`      | https://matrix-client.matrix.org | Home instance URL         |
| `TEST_MATRIX_ROOM`     | `!something@example.org`         | Room ID (where to get it) |
| `TEST_MATRIX_USER`     | @someuser:example.org            | Username                  |
| `TEST_MATRIX_PASSWORD` | ****                             | Password                  |

There are environment variables which the tests need set to execute also. In Github Actions,
these variables are set in the Github workflow configuration (`.github/workflows/*.yml`).

| Name                    | Example                          | Description                |
|-------------------------|----------------------------------|----------------------------|
| `HUBOT_MATRIX_HOST`     | https://matrix-client.matrix.org | Home instance URL          |
| `HUBOT_MATRIX_PASSWORD` | ****                             | Test user a/c password.    |
| `HUBOT_MATRIX_USERNAME` | ****                             | Test user a/c login.       |
| `HUBOT_FAREWELL_*`      | Configure `hubot-farewell`[^1]   | Configure shutdown message |
| `HUBOT_STARTUP_*`       | Configure `hubot-startup`[^2]    | Configure startup message  |

Jest requires the experimental-vm-modules Node option to run .mjs tests:

```shell
NODE_OPTIONS="$NODE_OPTIONS --experimental-vm-modules" npm run test
```

[^1]: https://github.com/xurizaemon/hubot-farewell/

[^2]: https://github.com/xurizaemon/hubot-startup/
