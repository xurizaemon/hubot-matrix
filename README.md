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

Since jest only runs mjs tests with experimental-vm-modules you need to set them when running the tests...

```shell
NODE_OPTIONS="$NODE_OPTIONS --experimental-vm-modules" npm run test
```

The following secrets and variables need to be configured for integration tests:

Github secrets:

| Name                   | Example                          | Description               |
|------------------------|----------------------------------|---------------------------|
| `TEST_MATRIX_URL`      | https://matrix-client.matrix.org | Home instance URL         |
| `TEST_MATRIX_ROOM`     | `!something@example.org`         | Room ID (where to get it) |
| `TEST_MATRIX_USER`     | @someuser:example.org            | Username                  | 
| `TEST_MATRIX_PASSWORD` | ****                             | Password                  |
