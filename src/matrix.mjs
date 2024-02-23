import { Robot, Adapter, TextMessage, User } from 'hubot';

import sdk from "matrix-js-sdk";

import request from 'request';
import sizeOf from 'image-size';
import MatrixSession from './session.mjs';

import {LocalStorage} from 'node-localstorage';

let localStorage;
if (localStorage == null) {
  localStorage = new LocalStorage('./hubot-matrix.localStorage');
}

export default {
    use(robot) {

        let that;

        class Matrix extends Adapter {
            constructor() {
                super(...arguments);
                this.robot.logger.info("Constructor");
            }

            handleUnknownDevices(err) {
                let that = this;
                return (() => {
                    let result = [];
                    for (const stranger in err.devices) {
                        const devices = err.devices[stranger];
                        result.push((() => {
                            let result1 = [];
                            for (let device in devices) {
                                that.robot.logger.info(`Acknowledging ${stranger}'s device ${device}`);
                                result1.push(that.robot.matrixClient.setDeviceKnown(stranger, device));
                            }
                            return result1;
                        })());
                    }
                    return result;
                })();
            }

            send(envelope, ...strings) {
                return (() => {
                    let result = [];
                    for (const str of Array.from(strings)) {
                        that.robot.logger.info(`Sending to ${envelope.room}: ${str}`);
                        if (/^(f|ht)tps?:\/\//i.test(str)) {
                            result.push(that.sendURL(envelope, str));
                        } else {
                            result.push(that.robot.matrixClient.sendNotice(envelope.room, str).catch(err => {
                                if (err.name === 'UnknownDeviceError') {
                                    that.handleUnknownDevices(err);
                                    return that.robot.matrixClient.sendNotice(envelope.room, str);
                                }
                            }));
                        }
                    }
                    return result;
                })();
            }

            emote(envelope, ...strings) {
                return Array.from(strings).map((str) =>
                    that.robot.matrixClient.sendEmoteMessage(envelope.room, str).catch(err => {
                        if (err.name === 'UnknownDeviceError') {
                            that.handleUnknownDevices(err);
                            return that.robot.matrixClient.sendEmoteMessage(envelope.room, str);
                        }
                    }));
            }

            reply(envelope, ...strings) {
                return Array.from(strings).map((str) =>
                    that.send(envelope, `${envelope.user.name}: ${str}`));
            }

            topic(envelope, ...strings) {
                return Array.from(strings).map((str) =>
                    that.robot.matrixClient.sendStateEvent(envelope.room, "m.room.topic", {
                        topic: str
                    }, ""));
            }

            sendURL(envelope, url) {
                that.robot.logger.info(`Downloading ${url}`);
                return request({url, encoding: null}, (error, response, body) => {
                    if (error) {
                        return that.robot.logger.info(`Request error: ${JSON.stringify(error)}`);
                    } else if (response.statusCode === 200) {
                        let info;
                        try {
                            let dims = sizeOf(body);
                            that.robot.logger.info(`Image has dimensions ${JSON.stringify(dims)}, size ${body.length}`);
                            if (dims.type === 'jpg') {
                                dims.type = 'jpeg';
                            }
                            info = {mimetype: `image/${dims.type}`, h: dims.height, w: dims.width, size: body.length};
                            return that.robot.matrixClient.uploadContent(body, {
                                name: url,
                                type: info.mimetype
                            }).then(response => {
                                return that.robot.matrixClient.sendImageMessage(envelope.room, response.content_uri, info, url).catch(err => {
                                    if (err.name === 'UnknownDeviceError') {
                                        that.handleUnknownDevices(err);
                                        return that.robot.matrixClient.sendImageMessage(envelope.room, response.content_uri, info, url);
                                    }
                                });
                            });
                        } catch (error1) {
                            error = error1;
                            that.robot.logger.info(error.message);
                            return that.send(envelope, ` ${url}`);
                        }
                    }
                });
            }

            run() {
                this.robot.logger.info(`Run ${this.robot.name}`);

                let matrixServer = process.env.HUBOT_MATRIX_HOST_SERVER;
                let matrixUser = process.env.HUBOT_MATRIX_USER;
                let matrixPassword = process.env.HUBOT_MATRIX_PASSWORD;
                let botName = this.robot.name;

                let that = this;
                let matrixSession = new MatrixSession(botName, matrixServer, matrixUser, matrixPassword, this.robot.logger, localStorage);
                matrixSession.createClient(async (err, client) => {
                    if (err) {
                        this.robot.logger.error(err);
                        return;
                    }
                    that.robot.matrixClient = client;
                    that.robot.matrixClient.on('sync', (state, prevState, data) => {
                        switch (state) {
                            case "PREPARED":
                                that.robot.logger.info(`Synced ${that.robot.matrixClient.getRooms().length} rooms`);
                                // We really don't want to let people set the display name to something other than the bot
                                // name because the bot only reacts to it's own name.
                                let userId = that.robot.matrixClient.getUserId();
                                const currentDisplayName = that.robot.matrixClient.getUser(userId).displayName;
                                if (that.robot.name !== currentDisplayName) {
                                    that.robot.logger.info(`Setting display name to ${that.robot.name}`);
                                    that.robot.matrixClient.setDisplayName(that.robot.name);
                                }
                                return that.emit('connected');
                        }
                    });
                    that.robot.matrixClient.on('Room.timeline', (event, room, toStartOfTimeline) => {
                        if ((event.getType() === 'm.room.message') && (toStartOfTimeline === false)) {
                            that.robot.matrixClient.setPresence({presence: "online"});
                            let message = event.getContent();
                            let name = event.getSender();
                            let user = that.robot.brain.userForId(name);
                            user.room = room.roomId;
                            let userId = that.robot.matrixClient.getUserId();
                            if (name !== userId) {
                                that.robot.logger.info(`Received message: ${JSON.stringify(message)} in room: ${user.room}, from: ${user.name} (${user.id}).`);
                                if (message.msgtype === "m.text") {
                                    that.receive(new TextMessage(user, message.body));
                                }
                                if ((message.msgtype !== "m.text") || (message.body.indexOf(that.robot.name) !== -1)) {
                                    return that.robot.matrixClient.sendReadReceipt(event);
                                }
                            }
                        }
                    });
                    that.robot.matrixClient.on('RoomMember.membership', (event, member) => {
                        let userId = that.robot.matrixClient.getUserId();
                        if ((member.membership === 'invite') && (member.userId === userId)) {
                            return that.robot.matrixClient.joinRoom(member.roomId).then(() => {
                                return that.robot.logger.info(`Auto-joined ${member.roomId}`);
                            });
                        }
                    });
                    return that.robot.matrixClient.startClient(0);
                });

            }
        }

        that = new Matrix(robot);
        return that;
    }
}
