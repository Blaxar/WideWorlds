/**
 * Format user message to send on a chat
 * @param {boolean} delivered - True if the message was correctly delivered,
 *                              false otherwise.
 * @param {integer} id - ID of the sending user.
 * @param {string} name - Name of the user.
 * @param {string} role - Role of the user.
 * @param {string} msg - Message to send.
 * @return {string} Stringified json websocket payload to send.
 */
function formatUserMessage(delivered, id, name, role, msg) {
  return JSON.stringify({delivered, id, name, role, msg});
}

export {formatUserMessage};
