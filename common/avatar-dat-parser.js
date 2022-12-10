/**
 * Parse AW avatars.dat file
 * @param {string} fileContent - Text content of the avatars.dat file.
 * @return {Object} Object describing the content of the .dat file.
 */
function parseAvatarDat(fileContent) {
  const data = {
    version: null,
    avatars: [],
  };

  let currentAvatar = null;
  let imp = false;
  let exp = false;

  for (let line of fileContent.split(/\r?\n/)) {
    // Sanitizing the line first, trim excess spaces and remove comments
    let match = line.match(/^(.*)#(?!\!)/);

    if ( match && match[1]) {
      line = match[1];
    }

    line = line.trim();

    match = line.match(/^(.*)=(.*)$/);
    if (imp && match && match[1] && match[2]) {
      // Implicit animation
      currentAvatar.imp[match[1]] = match[2];
      continue;
    }

    if (exp && match && match[1] && match[2]) {
      // Explicit animation
      currentAvatar.exp[match[1]] = match[2];
      continue;
    }

    match = line.match(/^version +([0-9]+)$/);
    if (match && match[1]) {
      // Get animation version
      data.version = parseInt(match[1]);
      continue;
    }

    if (line == 'avatar') {
      // Entering an avatar section
      currentAvatar = {name: null, geometry: null, imp: {}, exp: {}};
    } else if (line == 'endavatar') {
      // Leaving current avatar section
      data.avatars.push(currentAvatar);
      currentAvatar = null;
    } else if (line == 'beginimp') {
      // Begin implicit animations section
      imp = true;
    } else if (line == 'endimp') {
      // End implicit animations section
      imp = false;
    } else if (line == 'beginexp') {
      // Begin explicit animations section
      exp = true;
    } else if (line == 'endexp') {
      // End explicit animations section
      exp = false;
    } else {
      let match = line.match(/^name=(.*)$/);
      if (match && match[1]) {
        // Fetching display name of the avatar
        currentAvatar.name = match[1];
        continue;
      }

      match = line.match(/^geometry=(.*)$/);
      if (match && match[1]) {
        // Fetching 3D file model name of the avatar
        currentAvatar.geometry = match[1];
        continue;
      }
    }
  }

  return data;
}

export default parseAvatarDat;
