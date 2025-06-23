import { Robot, Adapter, TextMessage, User } from 'hubot'

import sdk from 'matrix-js-sdk'

import request from 'request'
import sizeOf from 'image-size'
import MatrixSession from './session.mjs'
import { LocalStorage } from 'node-localstorage'
import '@matrix-org/olm'

let localStorage
if (localStorage == null) {
  localStorage = new LocalStorage('./hubot-matrix.localStorage')
}

export default {
  use (robot) {
    let that

    class Matrix extends Adapter {
      constructor () {
        super(...arguments)
        this.lastPresenceUpdate = 0
        this.PRESENCE_UPDATE_INTERVAL = 60000 // Minimum 1 minute between updates
      }

      updatePresence () {
        const now = Date.now()
        if (now - this.lastPresenceUpdate >= this.PRESENCE_UPDATE_INTERVAL) {
          this.robot.logger.debug(`Setting presence. Last update was ${this.lastPresenceUpdate}ms ago`)
          this.robot.matrixClient.setPresence({ presence: 'online' })
            .catch(error => {
              if (error.errcode === 'M_LIMIT_EXCEEDED') {
                const waitMs = error.retry_after_ms || 10000
                this.robot.logger.warn(`Rate limited when setting presence. Retry after: ${waitMs}ms`)
              } else {
                this.robot.logger.warn(`Error ${error.errcode} setting presence: ${error.message}`)
              }
            })
          this.lastPresenceUpdate = now
        }
      }

      handleUnknownDevices (error) {
        const that = this
        return (() => {
          const result = []
          for (const stranger in error.devices) {
            const devices = error.devices[stranger]
            result.push((() => {
              const result1 = []
              for (const device in devices) {
                that.robot.logger.debug(`Acknowledging ${stranger}'s device ${device}`)
                result1.push(that.robot.matrixClient.setDeviceKnown(stranger, device))
              }
              return result1
            })())
          }
          return result
        })()
      }

      send (envelope, ...strings) {
        this.updatePresence()
        return (() => {
          const result = []
          for (const str of Array.from(strings)) {
            that.robot.logger.debug(`Sending to ${envelope.room}: ${str}`)
            if (/^(f|ht)tps?:\/\//i.test(str)) {
              result.push(that.sendURL(envelope, str))
            } else {
              result.push(that.robot.matrixClient.sendNotice(envelope.room, str).catch(error => {
                if (error.name === 'UnknownDeviceError') {
                  that.handleUnknownDevices(error)
                  return that.robot.matrixClient.sendNotice(envelope.room, str)
                }
                console.error(error.name, error)
                throw error
              }))
            }
          }
          return result
        })()
      }

      emote (envelope, ...strings) {
        return Array.from(strings).map((str) =>
          that.robot.matrixClient.sendEmoteMessage(envelope.room, str).catch(error => {
            if (error.name === 'UnknownDeviceError') {
              that.handleUnknownDevices(error)
              return that.robot.matrixClient.sendEmoteMessage(envelope.room, str)
            }
            console.error(error, 'error')
          }))
      }

      reply (envelope, ...strings) {
        return Array.from(strings).map((str) =>
          that.send(envelope, `${envelope.user.name}: ${str}`))
      }

      topic (envelope, ...strings) {
        return Array.from(strings).map((str) =>
          that.robot.matrixClient.sendStateEvent(envelope.room, 'm.room.topic', {
            topic: str
          }, ''))
      }

      sendURL (envelope, url) {
        that.robot.logger.debug(`Downloading ${url}`)
        return request({ url, encoding: null }, (error, response, body) => {
          if (error) {
            that.robot.logger.error(`Request error: ${JSON.stringify(error)}`)
            return false
          } else if (response.statusCode === 200) {
            let info
            try {
              const dimensions = sizeOf(body)
              that.robot.logger.debug(`Image has dimensions ${JSON.stringify(dimensions)}, size ${body.length}`)
              if (dimensions.type === 'jpg') {
                dimensions.type = 'jpeg'
              }
              info = { mimetype: `image/${dimensions.type}`, h: dimensions.height, w: dimensions.width, size: body.length }
              return that.robot.matrixClient.uploadContent(body, {
                name: url,
                type: info.mimetype
              }).then(response => {
                return that.robot.matrixClient.sendImageMessage(envelope.room, response.content_uri, info, url).catch(error1 => {
                  if (error1.name === 'UnknownDeviceError') {
                    that.handleUnknownDevices(error1)
                    return that.robot.matrixClient.sendImageMessage(envelope.room, response.content_uri, info, url)
                  }
                })
              })
            } catch (error2) {
              that.robot.logger.error(error2.message)
              return that.send(envelope, ` ${url}`)
            }
          }
        })
      }

      run () {
        this.robot.logger.debug(`Run ${this.robot.name}`)

        const matrixServer = process.env.HUBOT_MATRIX_HOST_SERVER
        const matrixUser = process.env.HUBOT_MATRIX_USER
        const matrixPassword = process.env.HUBOT_MATRIX_PASSWORD
        const botName = this.robot.name

        const that = this
        const matrixSession = new MatrixSession(botName, matrixServer, matrixUser, matrixPassword, this.robot.logger, localStorage)
        matrixSession.createClient(async (error, client) => {
          if (error) {
            this.robot.logger.error(error)
            return
          }
          that.robot.matrixClient = client

          try {
            // https://matrix-org.github.io/matrix-js-sdk/classes/matrix.MatrixClient.html#initrustcrypto
            await that.robot.matrixClient.initRustCrypto({ useIndexedDB: false })
            that.robot.logger.info('End-to-end encryption initialized successfully')

            // Wait for crypto to be fully ready
            await new Promise((resolve) => {
              const checkCryptoReady = () => {
                if (that.robot.matrixClient.isCryptoEnabled()) {
                  that.robot.logger.debug('Crypto is ready, proceeding with client start')
                  resolve()
                } else {
                  that.robot.logger.debug('Waiting for crypto to be ready...')
                  setTimeout(checkCryptoReady, 100)
                }
              }
              checkCryptoReady()
            })

          } catch (cryptoError) {
            that.robot.logger.error(`Failed to initialize encryption: ${cryptoError.message}`)
          }

          // Set up event handlers
          that.robot.matrixClient.on('sync', (state, prevState, data) => {
            switch (state) {
              case 'PREPARED':
                that.robot.logger.info(`Synced ${that.robot.matrixClient.getRooms().length} rooms`)
                that.robot.logger.debug(`Crypto enabled: ${that.robot.matrixClient.isCryptoEnabled()}`)

                // We really don't want to let people set the display name to something other than the bot
                // name because the bot only reacts to its own name.
                const userId = that.robot.matrixClient.getUserId()
                const currentDisplayName = that.robot.matrixClient.getUser(userId).displayName
                if (that.robot.name !== currentDisplayName) {
                  const botDisplayName = String(that.robot.name || 'MatrixBot')
                  that.robot.logger.info(`Setting display name to ${botDisplayName}`)
                  that.robot.matrixClient.setDisplayName(botDisplayName)
                }
                return that.emit('connected')
            }
          })

          that.robot.matrixClient.on('Room.timeline', (event, room, toStartOfTimeline) => {
            if ((event.getType() === 'm.room.message') && (toStartOfTimeline === false)) {
              const message = event.getContent()
              const senderName = event.getSender()
              const senderUser = that.robot.brain.userForId(senderName)
              senderUser.room = room.roomId
              const userId = that.robot.matrixClient.getUserId()
              if (senderName !== userId) {
                that.robot.logger.debug(`Received message: ${JSON.stringify(message)} in room: ${senderUser.room}, from: ${senderUser.name} (${senderUser.id}).`)
                if (message.msgtype === 'm.text') {
                  if (message.body.indexOf(that.robot.name) !== -1) {
                    that.updatePresence()
                  }
                  that.receive(new TextMessage(senderUser, message.body))
                }
                if ((message.msgtype !== 'm.text') || (message.body.indexOf(that.robot.name) !== -1)) {
                  return that.robot.matrixClient.sendReadReceipt(event)
                }
              }
            }
          })

          that.robot.matrixClient.on('RoomMember.membership', (event, member) => {
            const userId = that.robot.matrixClient.getUserId()
            if ((member.membership === 'invite') && (member.userId === userId)) {
              return that.robot.matrixClient.joinRoom(member.roomId).then(() => {
                return that.robot.logger.info(`Auto-joined ${member.roomId}`)
              })
            }
          })

          // Start client after crypto is ready
          return that.robot.matrixClient.startClient({
            initialSyncLimit: 0,
            presence: {
              enabled: false
            },
            pendingEventOrdering: 'detached'
          })
        })
      }
    }

    that = new Matrix(robot)
    return that
  }
}
