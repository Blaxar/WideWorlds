/**
 * @author Julien 'Blaxar' Bardagi <blaxar.waldarax@gmail.com>
 */

import parseAvatarsDat from '../../common/avatars-dat-parser.js';
import Prop from '../../common/db/model/Prop.js';
import {localEndiannessCue, otherEndiannessCue} from '../../common/endian.js';
import {serializeEntityState, deserializeEntityState, forwardEntityState,
  packEntityStates, unpackEntityStates, entityStateSize,
  validateEntityState, validateEntityStatePack,
  simpleStringHash} from '../../common/ws-data-format.js';
import {serializeProp, deserializeProp, packPropData, unpackPropData,
  propDataMinSize, validatePropData, validatePropDataPack, hashProps}
  from '../../common/props-data-format.js';
import {epsEqual} from '../utils.js';
import * as assert from 'assert';

const sampleAvatarDat = "# animation registry version 0.3\r\n\
version 3 # keep this around\r\n\
\r\n\
avatar\r\n\
 name=Mr.Touriste\r\n\
 geometry=homme_builder.rwx\r\n\
  beginimp\r\n\
    walk=qwalkf2\r\n\
    idle=qwait2\r\n\
    wait=qblink\r\n\
    endwait=qendwait\r\n\
    run=qrun2\r\n\
    fly=qfly2\r\n\
    hover=qhover1\r\n\
    swim=qswim\r\n\
    float=qfloat\r\n\
    sauter=qjump1\r\n\
    fall=qfall1\r\n\
  endimp\r\n\
 endimp\r\n\
 beginexp\r\n\
  Danser=danser\r\n\
  Macarena=macarena\r\n\
  Disco=disco\r\n\
  Prise_de_tete=prise_de_tete\r\n\
  Caprice=caprice\r\n\
  Haluciner=haluciner\r\n\
  Egyptienne=egyptienne\r\n\
  Salut=salut\r\n\
  Frapper=frapper\r\n\
  Bisou=bisou\r\n\
  Assis=assis\r\n\
  Retourner=retourner\r\n\
  endexp\r\n\
endavatar\r\n\
\r\n\
avatar\r\n\
 name=Mme.Touriste\r\n\
 geometry=femme_builder.rwx\r\n\
   beginimp\r\n\
    walk=qwalkf2\r\n\
    idle=qwait2\r\n\
    wait=qblink\r\n\
    endwait=qendwait\r\n\
    run=qrun2\r\n\
    fly=qfly2\r\n\
    hover=qhover1\r\n\
    swim=qswim\r\n\
    float=qfloat\r\n\
    sauter=qjump1\r\n\
    fall=qfall1\r\n\
  endimp\r\n\
 beginexp\r\n\
  Salut=salut\r\n\
  Danser=danser\r\n\
  Disco=disco\r\n\
  Retourner=retourner\r\n\
  endexp\r\n\
endavatar\r\n\
# Above statements will be ignored (missing avatar section)\r\n\
name=Squelette 01\r\n\
  geometry=t_skelojack01.rwx\r\n\
  beginimp\r\n\
    walk=qwalkf2\r\n\
    idle=qwait2\r\n\
    wait=qblink\r\n\
    endwait=qendwait\r\n\
    run=qrun2\r\n\
    fly=qfly2\r\n\
    hover=qhover1\r\n\
    swim=qswim\r\n\
    float=qfloat\r\n\
    sauter=qjump1\r\n\
    fall=qfall1\r\n\
  endimp\r\n\
  beginexp\r\n\
  endexp\r\n\
endavatar\r\n";

const dummySerializeEntityState = (offset = 0) => {
  const entityType = 1 + offset;
  const updateType = 2 + offset;
  const entityId = 3 + offset;
  const x = 25.2 + offset;
  const y = 30.25 + offset;
  const z = -12.0 + offset;
  const yaw = 3.1415 + offset;
  const pitch = 1.2 + offset;
  const roll = 2.5 + offset;
  const dataBlock0 = offset;
  const dataBlock1 = offset + 1;
  const dataBlock2 = offset + 2;
  const dataBlock3 = offset + 3;
  const dataBlock4 = offset + 4;
  const dataBlock5 = offset + 5;
  const dataBlock6 = offset + 6;
  const dataBlock7 = offset + 7;

  return serializeEntityState({entityType, updateType, entityId, x,
      y, z, yaw, pitch, roll, dataBlock0, dataBlock1, dataBlock2,
      dataBlock3, dataBlock4, dataBlock5, dataBlock6, dataBlock7});
};

const dummySerializeProp = (offset = 0) => {
  const id = 1337 + offset;
  const worldId = 42 + offset;
  const userId = 666 + offset;
  const date = 1721471167013 + offset;
  const x = 25.2 + offset;
  const y = 30.25 + offset;
  const z = -12.0 + offset;
  const yaw = 3.1415 + offset;
  const pitch = 1.2 + offset;
  const roll = 2.5 + offset;
  const name = `door0${offset}.rwx`;
  const description = `Welcome! Here we pay using ${offset}€`;
  const action = `create solid off; create name ${offset}`;

  return serializeProp(new Prop(id, worldId, userId, date, x, y, z,
      yaw, pitch, roll, name, description, action));
};

// Testing common utils
describe('common', () => {
  it('parseAvatarsDat', () => {
    const data = parseAvatarsDat(sampleAvatarDat);
    assert.strictEqual(data.version, 3);
    assert.strictEqual(data.avatars.length, 2);

    const firstAvatar = data.avatars[0];
    assert.strictEqual(firstAvatar.name, 'Mr.Touriste');
    assert.strictEqual(firstAvatar.geometry, 'homme_builder.rwx');
    assert.strictEqual(Object.values(firstAvatar.imp).length, 11);
    assert.strictEqual(Object.values(firstAvatar.exp).length, 12);

    const firstImp = firstAvatar.imp;
    assert.strictEqual(firstImp['walk'], 'qwalkf2');
    assert.strictEqual(firstImp['idle'], 'qwait2');
    assert.strictEqual(firstImp['wait'], 'qblink');
    assert.strictEqual(firstImp['endwait'], 'qendwait');
    assert.strictEqual(firstImp['run'], 'qrun2');
    assert.strictEqual(firstImp['fly'], 'qfly2');
    assert.strictEqual(firstImp['hover'], 'qhover1');
    assert.strictEqual(firstImp['swim'], 'qswim');
    assert.strictEqual(firstImp['float'], 'qfloat');
    assert.strictEqual(firstImp['sauter'], 'qjump1');
    assert.strictEqual(firstImp['fall'], 'qfall1');

    const firstExp = firstAvatar.exp;
    assert.strictEqual(firstExp['Danser'], 'danser');
    assert.strictEqual(firstExp['Macarena'], 'macarena');
    assert.strictEqual(firstExp['Disco'], 'disco');
    assert.strictEqual(firstExp['Prise_de_tete'], 'prise_de_tete');
    assert.strictEqual(firstExp['Caprice'], 'caprice');
    assert.strictEqual(firstExp['Haluciner'], 'haluciner');
    assert.strictEqual(firstExp['Egyptienne'], 'egyptienne');
    assert.strictEqual(firstExp['Salut'], 'salut');
    assert.strictEqual(firstExp['Frapper'], 'frapper');
    assert.strictEqual(firstExp['Bisou'], 'bisou');
    assert.strictEqual(firstExp['Assis'], 'assis');
    assert.strictEqual(firstExp['Retourner'], 'retourner');

    const secondAvatar = data.avatars[1];
    assert.strictEqual(secondAvatar.name, 'Mme.Touriste');
    assert.strictEqual(secondAvatar.geometry, 'femme_builder.rwx');
    assert.strictEqual(Object.values(secondAvatar.imp).length, 11);
    assert.strictEqual(Object.values(secondAvatar.exp).length, 4);

    const secondImp = secondAvatar.imp;
    assert.strictEqual(secondImp['walk'], 'qwalkf2');
    assert.strictEqual(secondImp['idle'], 'qwait2');
    assert.strictEqual(secondImp['wait'], 'qblink');
    assert.strictEqual(secondImp['endwait'], 'qendwait');
    assert.strictEqual(secondImp['run'], 'qrun2');
    assert.strictEqual(secondImp['fly'], 'qfly2');
    assert.strictEqual(secondImp['hover'], 'qhover1');
    assert.strictEqual(secondImp['swim'], 'qswim');
    assert.strictEqual(secondImp['float'], 'qfloat');
    assert.strictEqual(secondImp['sauter'], 'qjump1');
    assert.strictEqual(secondImp['fall'], 'qfall1');

    const secondExp = secondAvatar.exp;
    assert.strictEqual(secondExp['Salut'], 'salut');
    assert.strictEqual(secondExp['Danser'], 'danser');
    assert.strictEqual(secondExp['Disco'], 'disco');
    assert.strictEqual(secondExp['Retourner'], 'retourner');
  });

  it('(de)serializeEntityState', () => {
    const entityType = 1;
    const updateType = 2;
    const entityId = 1337;
    const x = 25.2;
    const y = 30.25;
    const z = -12.0;
    const yaw = 3.1415;
    const pitch = 1.2;
    const roll = 2.5;

    const state = serializeEntityState({entityType, updateType, entityId,
        x, y, z, yaw, pitch, roll});

    const uShortArray = new Uint16Array(state.buffer);
    const uIntArray = new Uint32Array(state.buffer);
    const floatArray = new Float32Array(state.buffer);

    assert.strictEqual(uIntArray[0], localEndiannessCue);
    assert.strictEqual(uShortArray[2], entityType);
    assert.strictEqual(uShortArray[3], updateType);
    assert.strictEqual(uIntArray[2], entityId);
    assert.ok(epsEqual(floatArray[3], x));
    assert.ok(epsEqual(floatArray[4], y));
    assert.ok(epsEqual(floatArray[5], z));
    assert.ok(epsEqual(floatArray[6], yaw));
    assert.ok(epsEqual(floatArray[7], pitch));
    assert.ok(epsEqual(floatArray[8], roll));

    const dictState = deserializeEntityState(state);

    assert.strictEqual(dictState.entityType, entityType);
    assert.strictEqual(dictState.updateType, updateType);
    assert.strictEqual(dictState.entityId, entityId);
    assert.ok(epsEqual(dictState.x, x));
    assert.ok(epsEqual(dictState.y, y));
    assert.ok(epsEqual(dictState.z, z));
    assert.ok(epsEqual(dictState.yaw, yaw));
    assert.ok(epsEqual(dictState.pitch, pitch));
    assert.ok(epsEqual(dictState.roll, roll));
  });

  it('forwardEntityState', () => {
    const entityType = 1;
    const updateType = 2;
    const entityId = 1337;
    const x = 25.2;
    const y = 30.25;
    const z = -12.0;
    const yaw = 3.1415;
    const pitch = 1.2;
    const roll = 2.5;
    const dataBlock0 = 11;
    const dataBlock1 = 12;
    const dataBlock2 = 13;
    const dataBlock3 = 14;
    const dataBlock4 = 15;
    const dataBlock5 = 16;
    const dataBlock6 = 17;
    const dataBlock7 = 18;

    const state = serializeEntityState({entityType, updateType, entityId,
        x, y, z, yaw, pitch, roll, dataBlock0, dataBlock1, dataBlock2,
        dataBlock3, dataBlock4, dataBlock5, dataBlock6, dataBlock7});

    const fwrdState = forwardEntityState(entityType, entityId, state);

    const uShortArray = new Uint16Array(fwrdState.buffer);
    const uIntArray = new Uint32Array(fwrdState.buffer);
    const floatArray = new Float32Array(fwrdState.buffer);

    assert.strictEqual(uIntArray[0], localEndiannessCue);
    assert.strictEqual(uShortArray[2], entityType);
    assert.strictEqual(uShortArray[3], updateType);
    assert.strictEqual(uIntArray[2], entityId);
    assert.ok(epsEqual(floatArray[3], x));
    assert.ok(epsEqual(floatArray[4], y));
    assert.ok(epsEqual(floatArray[5], z));
    assert.ok(epsEqual(floatArray[6], yaw));
    assert.ok(epsEqual(floatArray[7], pitch));
    assert.ok(epsEqual(floatArray[8], roll));

    // Checking data blocks
    assert.strictEqual(uShortArray[18], 11);
    assert.strictEqual(uShortArray[19], 12);
    assert.strictEqual(uShortArray[20], 13);
    assert.strictEqual(uShortArray[21], 14);
    assert.strictEqual(uShortArray[22], 15);
    assert.strictEqual(uShortArray[23], 16);
    assert.strictEqual(uShortArray[24], 17);
    assert.strictEqual(uShortArray[25], 18);

    assert.throws(() => forwardEntityState(entityType + 1, entityId, state), Error);
    assert.throws(() => forwardEntityState(entityType, entityId + 1, state), Error);
    assert.throws(() => forwardEntityState(entityType, entityId, "bad value"), Error);
  });

  it('(un)packEntityStates', () => {
    /* Try packing first */
    const entityStates = [dummySerializeEntityState(0),
        dummySerializeEntityState(1), dummySerializeEntityState(2)];

    /* Fiddle with the payload length and type to trigger an exception */
    assert.throws(() => packEntityStates(['some string']), Error);
    assert.throws(() => packEntityStates([new Uint8Array(2)]), Error);

    const pack = packEntityStates(entityStates);

    let uIntArray = new Uint32Array(pack.buffer);
    let endiannessCue = uIntArray[0];
    let nbEntityStates = uIntArray[1];

    assert.strictEqual(endiannessCue, localEndiannessCue);
    assert.strictEqual(nbEntityStates, 3);
    assert.strictEqual(pack.length, 8 + 3 * entityStateSize);

    /* Try unpacking and validating equality */
    const unpacked = unpackEntityStates(pack);
    assert.strictEqual(unpacked.length, 3);
    assert.equal(JSON.stringify(entityStates[0]), JSON.stringify(unpacked[0]));
    assert.equal(JSON.stringify(entityStates[1]), JSON.stringify(unpacked[1]));
    assert.equal(JSON.stringify(entityStates[2]), JSON.stringify(unpacked[2]));

    const emptyPack = packEntityStates([]);

    uIntArray = new Uint32Array(emptyPack.buffer);
    endiannessCue = uIntArray[0];
    nbEntityStates = uIntArray[1];

    assert.strictEqual(endiannessCue, localEndiannessCue);
    assert.strictEqual(nbEntityStates, 0);
    assert.strictEqual(emptyPack.length, 8);

    /* Fiddle with the payload length to trigger an exception */
    const badPack = new Uint8Array(pack.length + 1);
    badPack.set(pack, 0);
    assert.throws(() => unpackEntityStates(badPack), Error);
  });

  it('endianness handling', () => {
    /* Test state validation: unknown endian */
    let state = dummySerializeEntityState(0);
    state[0] = 0xaa;

    assert.throws(() => validateEntityState(state), Error);

    /* Test state validation: other endian */
    state = dummySerializeEntityState(0);
    let otherState = validateEntityState(state, otherEndiannessCue, localEndiannessCue);
    let uInt32 = new Uint32Array(otherState.buffer);
    let endiannessCue = uInt32[0];

    assert.strictEqual(endiannessCue, otherEndiannessCue);
    assert.notEqual(JSON.stringify(state.slice(4)), JSON.stringify(otherState.slice(4)));
    otherState = validateEntityState(state);
    assert.equal(JSON.stringify(state), JSON.stringify(otherState));

    uInt32 = new Uint32Array(otherState.buffer);
    endiannessCue = uInt32[0];

    assert.strictEqual(endiannessCue, localEndiannessCue);

    /* Test state pack validation: unknown endian */
    let pack = packEntityStates([dummySerializeEntityState(0),
        dummySerializeEntityState(1), dummySerializeEntityState(2)]);
    pack[0] = 0xbb;

    assert.throws(() => validateEntityStatePack(pack), Error);

    /* Test state pack validation: endian switching */
    pack = packEntityStates([dummySerializeEntityState(0),
        dummySerializeEntityState(1), dummySerializeEntityState(2)]);
    let nbEntityStates = validateEntityStatePack(pack, otherEndiannessCue, localEndiannessCue);

    assert.notEqual(nbEntityStates, 3);
    nbEntityStates = validateEntityStatePack(pack);
    assert.strictEqual(nbEntityStates, 3);
  });

  it('simpleStringHash', () => {
    assert.strictEqual(simpleStringHash(''), 0); // Empty string
    assert.strictEqual(simpleStringHash('idle', 0x0), 0); // Zeroed mask

    assert.strictEqual(simpleStringHash('run'), simpleStringHash('run')); // Consistent hash
    assert.notEqual(simpleStringHash('fly'), simpleStringHash('run')); // No collision

    // Different masks
    assert.notEqual(simpleStringHash('walk', 0xffff), simpleStringHash('walk', 0xff));
  });

  it('(de)serializeProp', () => {
    const id = 1337;
    const worldId = 42;
    const userId = 666;
    const date = 1721471167013;
    const x = 25.2;
    const y = 30.25;
    const z = -12.0;
    const yaw = 3.1415;
    const pitch = 1.2;
    const roll = 2.5;
    const name = 'door03.rwx';
    const description = 'Welcome! Here we pay using €';
    const action = 'create solid off';

    const encoder = new TextEncoder();
    const encodedName = encoder.encode(name);
    const encodedDescription = encoder.encode(description);
    const encodedAction = encoder.encode(action);

    const prop = serializeProp(new Prop(id, worldId, userId, date, x, y, z,
        yaw, pitch, roll, name, description, action));

    const uCharArray = new Uint8Array(prop.buffer);
    const uShortArray = new Uint16Array(prop.buffer, 0, 33);
    const uIntArray = new Uint32Array(prop.buffer, 0, 16);
    const uLongArray = new BigUint64Array(prop.buffer, 0, 8);
    const floatArray = new Float32Array(prop.buffer, 0, 16);
    const doubleArray = new Float64Array(prop.buffer, 0, 8);

    assert.strictEqual(uIntArray[0], localEndiannessCue);
    assert.strictEqual(uIntArray[1], id);
    assert.strictEqual(uIntArray[2], worldId);
    assert.strictEqual(uIntArray[3], userId);
    assert.strictEqual(uLongArray[2], BigInt(date));
    assert.ok(epsEqual(doubleArray[3], x));
    assert.ok(epsEqual(doubleArray[4], y));
    assert.ok(epsEqual(doubleArray[5], z));
    assert.ok(epsEqual(floatArray[12], yaw));
    assert.ok(epsEqual(floatArray[13], pitch));
    assert.ok(epsEqual(floatArray[14], roll));
    assert.strictEqual(uShortArray[30], encodedName.length);
    assert.strictEqual(uShortArray[31], encodedDescription.length);
    assert.strictEqual(uShortArray[32], encodedAction.length);
    assert.strictEqual(prop.length, propDataMinSize + encodedName.length +
        encodedDescription.length + encodedAction.length);

    const dictProp = deserializeProp(prop);

    assert.ok(dictProp instanceof Prop);
    assert.strictEqual(dictProp.id, id);
    assert.strictEqual(dictProp.worldId, worldId);
    assert.strictEqual(dictProp.userId, userId);
    assert.strictEqual(dictProp.date, BigInt(date));
    assert.ok(epsEqual(dictProp.x, x));
    assert.ok(epsEqual(dictProp.y, y));
    assert.ok(epsEqual(dictProp.z, z));
    assert.ok(epsEqual(dictProp.yaw, yaw));
    assert.ok(epsEqual(dictProp.pitch, pitch));
    assert.ok(epsEqual(dictProp.roll, roll));
    assert.equal(dictProp.name, name);
    assert.equal(dictProp.action, action);
    assert.equal(dictProp.description, description);
  });

  it('(un)packPropData', () => {
    /* Try packing first */
    const propEntries = [dummySerializeProp(0),
        dummySerializeProp(1), dummySerializeProp(2)];

    /* Fiddle with the payload length and type to trigger an exception */
    assert.throws(() => packPropData(['some string']), Error);
    assert.throws(() => packPropData([new Uint8Array(2)]), Error);

    const pack = packPropData(propEntries);

    let uIntArray = new Uint32Array(pack.buffer, 0, 2);
    let endiannessCue = uIntArray[0];
    let nbEntityStates = uIntArray[1];

    assert.strictEqual(endiannessCue, localEndiannessCue);
    assert.strictEqual(nbEntityStates, 3);

    /* Try unpacking and validating equality */
    const unpacked = unpackPropData(pack);
    assert.strictEqual(unpacked.length, 3);
    assert.equal(JSON.stringify(propEntries[0]), JSON.stringify(unpacked[0]));
    assert.equal(JSON.stringify(propEntries[1]), JSON.stringify(unpacked[1]));
    assert.equal(JSON.stringify(propEntries[2]), JSON.stringify(unpacked[2]));

    const emptyPack = packPropData([]);

    uIntArray = new Uint32Array(emptyPack.buffer);
    endiannessCue = uIntArray[0];
    nbEntityStates = uIntArray[1];

    assert.strictEqual(endiannessCue, localEndiannessCue);
    assert.strictEqual(nbEntityStates, 0);
    assert.strictEqual(emptyPack.length, 8);

    /* Fiddle with the payload length to trigger an exception */
    const badPack = new Uint8Array(pack.length + 1);
    badPack.set(pack, 0);
    assert.throws(() => unpackPropData(badPack), Error);
  });

  it('hashProps', () => {
    const firstProp = {id: 1, date: 12345};
    const secondProp = {id: 4, date: BigInt(12346)};

    assert.strictEqual(hashProps([]), 0); // Empty list

    assert.strictEqual(hashProps([firstProp, secondProp]), hashProps([secondProp, firstProp])); // Consistent hash
    assert.notEqual(hashProps([firstProp, secondProp]), hashProps([firstProp])); // No collision
  });
});
