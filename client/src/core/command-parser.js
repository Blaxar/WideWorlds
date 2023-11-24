/**
 * @author Nekohime <https://github.com/Nekohime>
 */

import {MathUtils} from 'three';
import {userFeedPriority} from './user-feed.js';
import * as utils3D from './utils-3d.js';

const isNumber = (value) => !isNaN(value);
const toFixed = (value) => Number(value.toFixed(3));

/**
 * Chat Command Parser Class.
 */
class CommandParser {
  /**
   * @constructor
   * @param {Engine3D} engine3d - The 3D engine
   * @param {UserFeed} userFeed - The user feed for publishing messages.
   */
  constructor(engine3d, userFeed) {
    this.engine3d = engine3d;
    this.userFeed = userFeed;
  }

  /**
   * Parses a Chat Command
   * @param {string} msg - Chat input to check for a command
   * @return {null|Array} returns null on failure
   *  or returns array of values for a given command.
   */
  handleCommand(msg) {
    const cmdArray = msg.replace(/^\//, '').split(' ');
    const [cmd] = cmdArray;
    let result = [];

    if (cmd === 'tp') {
      result = this.handleTPCommand(cmdArray);
    } else if (cmd === 'getpos') {
      this.showUserPosition();
    } else {
      result.error = 'ERR_INVALID_COMMAND';
    }

    if (result?.error) {
      this.userFeed.publish(`Error: ${result.error} for command: ${msg}`, null,
          userFeedPriority.error);
    }

    return null;
  }

  /**
   * Handles the "/tp" command, parsing command parameters
   *  and initiating teleportation.
   * @param {string[]} cmdArray - An array containing the command and its
   *  parameters.
   * @return {null|{error: string}} Returns null on success, or an error object
   *  on failure.
   */
  handleTPCommand(cmdArray) {
    const [one, two, three, four] = cmdArray.slice(1).map(parseFloat);

    const validateAndTeleport = (teleportData, message) => {
      if (Object.values(teleportData).every(isNumber)) {
        if (isNumber(four)) {
          if (four >= 0) {
            const result = this.engine3d.teleportUser(teleportData, four);
            this.userFeed.publish(message(result), null, userFeedPriority.info);
          } else {
            return {error: 'ERR_NEGATIVE_YAW'};
          }
        } else {
          const result = this.engine3d.teleportUser(teleportData);
          this.userFeed.publish(message(result), null, userFeedPriority.info);
        }
      } else {
        return {error: 'ERR_INVALID_VALUES'};
      }
    };

    if (cmdArray.length === 3) {
      return validateAndTeleport({x: one, z: two},
          ({x, z}) => `You have been teleported to: ${x}X, ${z}Z`);
    } else if (cmdArray.length === 4) {
      return validateAndTeleport({x: one, y: two, z: three},
          ({x, y, z}) => `You have been teleported to: ${x}X, ${y}Y, ${z}Z`);
    } else if (cmdArray.length >= 5) {
      return validateAndTeleport(
          {x: one, y: two, z: three, yaw: four}, ({x, y, z, yaw}) =>
            `You have been teleported to: ${x}X, ${y}Y, ${z}Z, ${yaw}°`);
    } else {
      return {error: 'ERR_TOO_FEW_ARGUMENTS'};
    }
  }

  /**
   * Displays the user's current position and yaw angle.
   *
   * @return {void}
   */
  showUserPosition() {
    const {position, rotation} = this.engine3d.user;
    const {x, y, z} = position;
    const degreeYaw = utils3D.flipYawDegrees(MathUtils.radToDeg(rotation.y));
    const yaw = Math.ceil(degreeYaw);
    this.userFeed.publish(
        `You are at: ${toFixed(x)}X, ${toFixed(y)}Y, ${toFixed(z)}Z, ${yaw}°`,
        null, userFeedPriority.info);
  }

  /**
   * Checks for command in chat input
   * @param {string} msg - Chat input
   * @return {boolean} returns whether the input message is a command or not.
   */
  isCommand(msg) {
    return msg.startsWith('/') && msg.length > 1 && !msg.startsWith('//');
  }
}

export default CommandParser;
