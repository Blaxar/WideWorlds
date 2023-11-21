/**
 * @author Nekohime <https://github.com/Nekohime>
*/

/**
 * Parses a Chat Command
 * @param {string} command - Chat input to check for a command
 * @return {null} returns null on failure
*/
const parseCommand = (command) => {
  const commandArray = command.split(' ');

  // TP Command
  // TODO: xz, angle, relativity
  if (commandArray.length >= 4 && commandArray[0] === '/tp') {
    const x = parseFloat(commandArray[1]);
    const y = parseFloat(commandArray[2]);
    const z = parseFloat(commandArray[3]);

    // Check if the extracted values are valid floats
    if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
      return {x, y, z};
    } else {
      // Invalid float values in TP Command.
      return null;
    }
  } else {
    // Invalid command format. Expected "/tp x y z".
    return null;
  }

  return null;
};

export {parseCommand};
