/**
 * @author Julien 'Blaxar' Bardagi <blaxar.waldarax@gmail.com>
 */

import parseAvatarsDat from '../../common/avatars-dat-parser.js';
import {serializeEntityState, deserializeEntityState, forwardEntityState,
  packEntityStates, unpackEntityStates, entityStateSize}
  from '../../common/ws-data-format.js';
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

  return serializeEntityState(entityType, updateType, entityId,
      x, y, z, yaw, pitch, roll);
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

    const state = serializeEntityState(entityType, updateType, entityId,
                                       x, y, z, yaw, pitch, roll);

    const uShortArray = new Uint16Array(state.buffer);
    const uIntArray = new Uint32Array(state.buffer);
    const floatArray = new Float32Array(state.buffer);

    assert.strictEqual(uShortArray[0], entityType);
    assert.strictEqual(uShortArray[1], updateType);
    assert.strictEqual(uIntArray[1], entityId);
    assert.ok(epsEqual(floatArray[2], x));
    assert.ok(epsEqual(floatArray[3], y));
    assert.ok(epsEqual(floatArray[4], z));
    assert.ok(epsEqual(floatArray[5], yaw));
    assert.ok(epsEqual(floatArray[6], pitch));
    assert.ok(epsEqual(floatArray[7], roll));

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

    const state = serializeEntityState(entityType, updateType, entityId,
                                       x, y, z, yaw, pitch, roll);

    const fwrdState = forwardEntityState(entityType, entityId, state);

    const uShortArray = new Uint16Array(fwrdState.buffer);
    const uIntArray = new Uint32Array(fwrdState.buffer);
    const floatArray = new Float32Array(fwrdState.buffer);

    assert.strictEqual(uShortArray[0], entityType);
    assert.strictEqual(uShortArray[1], updateType);
    assert.strictEqual(uIntArray[1], entityId);
    assert.ok(epsEqual(floatArray[2], x));
    assert.ok(epsEqual(floatArray[3], y));
    assert.ok(epsEqual(floatArray[4], z));
    assert.ok(epsEqual(floatArray[5], yaw));
    assert.ok(epsEqual(floatArray[6], pitch));
    assert.ok(epsEqual(floatArray[7], roll));

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
    let nbEntityStates = uIntArray[0];

    assert.strictEqual(nbEntityStates, 3);
    assert.strictEqual(pack.length, 4 + 3 * entityStateSize);

    /* Try unpacking and validating equality */
    const unpacked = unpackEntityStates(pack);
    assert.strictEqual(unpacked.length, 3);
    assert.equal(JSON.stringify(entityStates[0]), JSON.stringify(unpacked[0]));
    assert.equal(JSON.stringify(entityStates[1]), JSON.stringify(unpacked[1]));
    assert.equal(JSON.stringify(entityStates[2]), JSON.stringify(unpacked[2]));

    const emptyPack = packEntityStates([]);

    uIntArray = new Uint32Array(emptyPack.buffer);
    nbEntityStates = uIntArray[0];

    assert.strictEqual(nbEntityStates, 0);
    assert.strictEqual(emptyPack.length, 4);

    /* Fiddle with the payload length to trigger an exception */
    const badPack = new Uint8Array(pack.length + 1);
    badPack.set(pack, 0);
    assert.throws(() => unpackEntityStates(badPack), Error);
  });
});
