/**
 * @author Nekohime <https://github.com/Nekohime>
 */

import {MathUtils} from 'three';
import {userFeedPriority} from './user-feed.js';
import * as utils3D from './utils-3d.js';
import {speeds} from './user-config.js';

const isNumber = (value) => !isNaN(value);
const toFixed = (value) => Number(value.toFixed(3));

/**
 * Chat Command Parser Class.
 */
class CommandParser {
  /**
   * @constructor
   * @param {Engine3D} engine3d - The 3D engine
   * @param {String} worldData - The current world's attributes
   * @param {UserFeed} userFeed - The user feed for publishing messages.
   * @param {object} configsNode - the 'controls' node in the user configs
   */
  constructor(engine3d, worldData, userFeed, configsNode) {
    this.engine3d = engine3d;
    this.worldData = worldData;
    this.userFeed = userFeed;
    this.configsNode = configsNode;
  }

  /**
   * Parses a Chat Command
   * @param {string} msg - Chat input to check for a command
   * @return {null|Array} returns null on failure
   *  or returns array of values for a given command.
   */
  handleCommand(msg) {
    const cmdArray = msg.replace(/^\//, '').split(' ');
    const [cmd, ...args] = cmdArray;
    let result = [];
    if (typeof this.worldData === 'string') {
      this.worldData = JSON.parse(this.worldData);
    }

    switch (cmd.toLowerCase()) {
      case 'lz':
        const entryPoint = this.worldData.entryPoint;
        const {x, y, z, yaw} = this.engine3d.teleportUser(
            entryPoint, entryPoint.yaw);
        this.userFeed.publish(`You have been teleported to the Landing Zone ` +
          `(at ${x}X, ${y}Y, ${z}Z, ${yaw}°).`, null, userFeedPriority.info);
        break;
      case 'gz':
        result = this.engine3d.teleportUser({x: 0, y: 0, z: 0}, 0);
        this.userFeed.publish(`You have been teleported to Ground Zero ` +
          `(at 0X, 0Y, 0Z, 0°).`, null, userFeedPriority.info);
        break;
      case 'tp':
        result = this.handleTPCommand(cmdArray);
        break;
      case 'getpos':
        this.showUserPosition();
        break;
      case 'worlddata':
        console.log(this.worldData);
        break;
      case 'walk':
      case 'run':
        const [speed] = args.map(parseFloat);
        result.error = isNaN(speed) ? 'ERR_INVALID_VALUE' :
          (this.configsNode.at(`${cmd}Speed`).set(speed), null);
        break;
      case 'resetwalk':
      case 'resetrun':
        const speedType = `${cmd.slice(5)}Speed`;
        this.configsNode.at(speedType).set(speeds[`${cmd.slice(5)}`]);
        break;
      default:
        result.error = 'ERR_INVALID_COMMAND';
        break;
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
