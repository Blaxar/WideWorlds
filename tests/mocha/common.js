import parseAvatarsDat from '../../common/avatars-dat-parser.js';
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
});
