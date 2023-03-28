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

const entityStateSize = 0x2c;
const localEndiannessCue = 0x11223344;
const otherEndiannessCue = 0x44332211;


/*
 * Entity state data block is a binary sequence holding the following data:
 *
 * 0x00 | Endianness cue, 4 bytes |
 * 0x04 | Entity type, 2 bytes ushort |
 * 0x06 | Update type, 2 bytes ushort |
 * 0x08 | Entity ID, 4 bytes uint |
 * 0x0c | X position, 4 bytes float (in meters) |
 * 0x10 | Y position, 4 bytes float (in meters) |
 * 0x14 | Z position, 4 bytes float (in meters) |
 * 0x18 | Yaw, 4 bytes float (in radians) |
 * 0x1c | Pitch, 4 bytes float (in radians) |
 * 0x20 | Roll, 4 bytes float (in radians) |
 * 0x24 | Data block 0, 2 bytes |
 * 0x26 | Data block 1, 2 bytes |
 * 0x28 | Data block 2, 2 bytes |
 * 0x2a | Data block 3, 2 bytes |
 */

const entityStateSchema = {
  entityCue: [0x00, 0x04],
  entityType: [0x04, 0x02],
  updateType: [0x06, 0x02],
  entityId: [0x08, 0x04],
  x: [0x0c, 0x04],
  y: [0x10, 0x04],
  z: [0x14, 0x04],
  yaw: [0x18, 0x04],
  pitch: [0x1c, 0x04],
  roll: [0x20, 0x04],
  dataBlock0: [0x24, 0x02],
  dataBlock1: [0x26, 0x02],
  dataBlock2: [0x28, 0x02],
  dataBlock3: [0x2a, 0x02],
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
 * @param {short} dataBlock0 - First data block.
 * @param {short} dataBlock1 - Second data block.
 * @param {short} dataBlock2 - Third data block.
 * @param {short} dataBlock3 - Fourth data block.
 * @return {Uint8Array} Entity state binary payload
 */
function serializeEntityState({entityType, updateType, entityId, x, y, z,
  yaw, pitch, roll, dataBlock0 = 0, dataBlock1 = 0, dataBlock2 = 0,
  dataBlock3 = 0}) {
  const state = new Uint8Array(entityStateSize);
  const uShortArray = new Uint16Array(state.buffer);
  const uIntArray = new Uint32Array(state.buffer);
  const floatArray = new Float32Array(state.buffer);

  uIntArray[0] = localEndiannessCue;
  uShortArray[2] = entityType;
  uShortArray[3] = updateType;
  uIntArray[2] = entityId;
  floatArray[3] = x;
  floatArray[4] = y;
  floatArray[5] = z;
  floatArray[6] = yaw;
  floatArray[7] = pitch;
  floatArray[8] = roll;
  uShortArray[18] = dataBlock0;
  uShortArray[19] = dataBlock1;
  uShortArray[20] = dataBlock2;
  uShortArray[21] = dataBlock3;

  return state;
}

/**
 * Flip endian on entity state binary payload, for internal use only
 * @param {Uint8Array} state - Entity state binary payload.
 * @return {Uint8Array} Endian-flipped binary payload for entity state.
 */
function flipEntityStateEndian(state) {
  if (state.length != entityStateSize) {
    throw new Error('Invalid payload length for entity state');
  }

  const flippedState = new Uint8Array(entityStateSize);

  for (const [address, size] of Object.values(entityStateSchema)) {
    const maxOffset = size - 1;

    for (let i = 0; i < size; i++) {
      flippedState[address + i] = state[address + maxOffset - i];
    }
  }

  return flippedState;
}

/**
 * Validate binary payload of entity state, performs endianness
 * conversion if needed, throws if invalid
 * @param {Uint8Array} state - Entity state binary payload.
 * @param {integer} expectedEndiannessCue - Expected endianness cue.
 * @param {integer} oppositeEndiannessCue - opposite endianness cue.
 * @return {Uint8Array} Valid binary payload for entity state
 */
function validateEntityState(state,
    expectedEndiannessCue = localEndiannessCue,
    oppositeEndiannessCue = otherEndiannessCue) {
  // Validate payload type
  if (! state instanceof Uint8Array) {
    throw new Error('Invalid payload type for entity state');
  }

  // Validate payload length
  if (state.length != entityStateSize) {
    throw new Error('Invalid payload length for entity state');
  }

  let validState = state;

  const endiannessCue = (new Uint32Array(state.buffer))[0];

  if (endiannessCue != expectedEndiannessCue) {
    if (endiannessCue != oppositeEndiannessCue) {
      throw new Error('Unknown endian for entity state payload');
    }

    // Mismatching endianness: flip everything
    validState = flipEntityStateEndian(state);
  }

  return validState;
}

/**
 * Deserialize binary payload of entity state
 * @param {Uint8Array} state - Entity state binary payload.
 * @return {object} Entity state in object form
 */
function deserializeEntityState(state) {
  const validState = validateEntityState(state);

  const uShortArray = new Uint16Array(validState.buffer);
  const uIntArray = new Uint32Array(validState.buffer);
  const floatArray = new Float32Array(validState.buffer);

  const entityType = uShortArray[2];
  const updateType = uShortArray[3];
  const entityId = uIntArray[2];
  const x = floatArray[3];
  const y = floatArray[4];
  const z = floatArray[5];
  const yaw = floatArray[6];
  const pitch = floatArray[7];
  const roll = floatArray[8];
  const dataBlock0 = uShortArray[18];
  const dataBlock1 = uShortArray[19];
  const dataBlock2 = uShortArray[20];
  const dataBlock3 = uShortArray[21];

  return {entityType, updateType, entityId, x, y, z, yaw, pitch, roll,
    dataBlock0, dataBlock1, dataBlock2, dataBlock3};
}

/**
 * Forward binary payload of entity state, perfom validation and value check
 * @param {integer} entityType - Code of the entity type.
 * @param {integer} entityId - ID of the entity.
 * @param {Uint8Array} state - Entity state binary payload.
 * @return {Uint8Array} Entity state binary payload
 */
function forwardEntityState(entityType, entityId, state) {
  const validState = validateEntityState(state);

  // Validate that the entity type and ID are matching the data block
  const uShortArray = new Uint16Array(validState.buffer);
  const uIntArray = new Uint32Array(validState.buffer);

  if (uShortArray[2] != entityType) {
    throw new Error('Mismatching entity type in entity state');
  }

  if (uIntArray[2] != entityId) {
    throw new Error('Mismatching entity ID in entity state');
  }

  return validState;
}

/**
 * Pack several entity state payloads into a single payload
 * @param {array} entityStates - Array of entity state payloads.
 * @return {Uint8Array} Entity state binary payload pack
 */
function packEntityStates(entityStates) {
  const entityStatePack = new Uint8Array(8 + entityStateSize *
      entityStates.length);
  const uIntArray = new Uint32Array(entityStatePack.buffer);
  uIntArray[0] = localEndiannessCue; // Start with the endianness cue...
  uIntArray[1] = entityStates.length; // ...followed by the number of entries

  entityStates.forEach((state, i) => {
    entityStatePack.set(validateEntityState(state), 8 + i * entityStateSize);
  });

  return entityStatePack;
}

/**
 * Validate binary payload of entity state, throws if invalid,
 * return endian-correct number of entries in the pack
 * @param {Uint8Array} statePack - Entity state pack binary payload.
 * @param {integer} expectedEndiannessCue - Expected endianness cue.
 * @param {integer} oppositeEndiannessCue - opposite endianness cue.
 * @return {integer} Number of entries in the pack
 */
function validateEntityStatePack(statePack,
    expectedEndiannessCue = localEndiannessCue,
    oppositeEndiannessCue = otherEndiannessCue) {
  // Validate payload type
  if (! statePack instanceof Uint8Array) {
    throw new Error('Invalid payload type for entity state pack');
  }

  const uIntArray = new Uint32Array(statePack.buffer);

  const endiannessCue = uIntArray[0];
  let nbEntityStates = uIntArray[1];

  if (endiannessCue != expectedEndiannessCue) {
    if (endiannessCue != oppositeEndiannessCue) {
      throw new Error('Unknown endian for entity state pack payload');
    }

    const newUint8 = new Uint8Array(4);

    newUint8[0] = statePack[7];
    newUint8[1] = statePack[6];
    newUint8[2] = statePack[5];
    newUint8[3] = statePack[4];

    nbEntityStates = (new Uint32Array(newUint8.buffer))[0];
  }

  return nbEntityStates;
}

/**
 * Unpack entity state payload bundle into an array of individual payloads
 * @param {Uint8Array} entityStatePack - Entity state binary payload pack
 * @return {array} Array of entity state payloads.
 */
function unpackEntityStates(entityStatePack) {
  const nbEntityStates = validateEntityStatePack(entityStatePack);

  if (entityStatePack.length != (8 + nbEntityStates * entityStateSize)) {
    throw new Error('Invalid payload pack size');
  }

  const entityStates = [];

  for (let i = 0; i < nbEntityStates; i++) {
    const begin = 8 + i * entityStateSize;
    const end = begin + entityStateSize;

    const state = new Uint8Array(entityStatePack
        .slice(begin, end).buffer);
    entityStates.push(validateEntityState(state));
  }

  return entityStates;
}

export {formatUserMessage, serializeEntityState, deserializeEntityState,
  forwardEntityState, packEntityStates, unpackEntityStates, entityType,
  updateType, entityStateSize, localEndiannessCue, otherEndiannessCue,
  validateEntityState, validateEntityStatePack};
