/**
 * @author Julien 'Blaxar' Bardagi <blaxar.waldarax@gmail.com>
 */

const entityType = {
  unknown: 0,
  user: 1,
};

const updateType = {
  unknown: 0,
  joining: 1,
  leaving: 2,
  moving: 3,
  teleporting: 4,
};

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

/*
 * User state data block is a binary sequence holding the following data:
 *
 * 0x00 | Entity type, 2 bytes ushort |
 * 0x02 | Update type, 2 bytes ushort |
 * 0x04 | Entity ID, 4 bytes uint |
 * 0x08 | X position, 4 bytes float (in meters) |
 * 0x0c | Y position, 4 bytes float (in meters) |
 * 0x10 | Z position, 4 bytes float (in meters) |
 * 0x14 | Yaw, 4 bytes float (in radians) |
 * 0x18 | Pitch, 4 bytes float (in radians) |
 * 0x1c | Roll, 4 bytes float (in radians) |
 */

/**
 * Serialize binary payload of entity state
 * @param {integer} entityType - Code of the entity type.
 * @param {integer} updateType - Code of the update type.
 * @param {integer} entityId - ID of the entity.
 * @param {float} x - World position on the X axis (in meters).
 * @param {float} y - World position on the Y axis (in meters).
 * @param {float} z - World position on the Z axis (in meters).
 * @param {float} yaw - Yaw (in radians).
 * @param {float} pitch - Pitch (in radians).
 * @param {float} roll - Roll (in radians).
 * @return {Uint8Array} Entity state binary payload
 */
function serializeEntityState(entityType, updateType, entityId, x, y, z,
    yaw, pitch, roll) {
  const state = new Uint8Array(0x20);
  const uShortArray = new Uint16Array(state.buffer);
  const uIntArray = new Uint32Array(state.buffer);
  const floatArray = new Float32Array(state.buffer);

  uShortArray[0] = entityType;
  uShortArray[1] = updateType;
  uIntArray[1] = entityId;
  floatArray[2] = x;
  floatArray[3] = y;
  floatArray[4] = z;
  floatArray[5] = yaw;
  floatArray[6] = pitch;
  floatArray[7] = roll;

  return state;
}

/**
 * Validate binary payload of entity state, throws if invalid
 * @param {Uint8Array} state - Entity state binary payload.
 */
function validateState(state) {
  // Validate payload type
  if (! state instanceof Uint8Array) {
    throw new Error('Invalid payload type for entity state');
  }

  // Validate payload length
  if (state.length != 0x20) {
    throw new Error('Invalid payload length for entity state');
  }
}

/**
 * Deserialize binary payload of entity state
 * @param {Uint8Array} state - Entity state binary payload.
 * @return {object} Entity state in object form
 */
function deserializeEntityState(state) {
  validateState(state);

  const uShortArray = new Uint16Array(state.buffer);
  const uIntArray = new Uint32Array(state.buffer);
  const floatArray = new Float32Array(state.buffer);

  const entityType = uShortArray[0];
  const updateType = uShortArray[1];
  const entityId = uIntArray[1];
  const x = floatArray[2];
  const y = floatArray[3];
  const z = floatArray[4];
  const yaw = floatArray[5];
  const pitch = floatArray[6];
  const roll = floatArray[7];

  return {entityType, updateType, entityId, x, y, z, yaw, pitch, roll};
}

/**
 * Forward binary payload of entity state, perfom validation and value check
 * @param {integer} entityType - Code of the entity type.
 * @param {integer} entityId - ID of the entity.
 * @param {Uint8Array} state - Entity state binary payload.
 * @return {Uint8Array} Entity state binary payload
 */
function forwardEntityState(entityType, entityId, state) {
  validateState(state);

  // Validate that the entity type and ID are matching the data block
  const uShortArray = new Uint16Array(state.buffer);
  const uIntArray = new Uint32Array(state.buffer);

  if (uShortArray[0] != entityType) {
    throw new Error('Mismatching entity type in entity state');
  }

  if (uIntArray[1] != entityId) {
    throw new Error('Mismatching entity ID in entity state');
  }

  return state;
}

export {formatUserMessage, serializeEntityState, deserializeEntityState,
  forwardEntityState, entityType, updateType};
